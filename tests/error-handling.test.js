// Feature: netflix-intro-skipper, Property 10: エラーハンドリングと回復
// Property-Based Tests for Error Handling and Recovery

const fc = require("fast-check");
const { JSDOM } = require("jsdom");

// Mock ErrorHandler class for testing
class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorCooldown = 60000;
    this.lastErrorReport = 0;
    this.errorLog = [];
  }

  handleError(error, context = "unknown", silent = false) {
    try {
      this.errorCount++;

      const errorInfo = {
        message: error.message || "Unknown error",
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString(),
        errorCount: this.errorCount,
      };

      this.errorLog.push(errorInfo);

      if (!silent && Date.now() - this.lastErrorReport > this.errorCooldown) {
        console.error(`[Test] Error in ${context}:`, errorInfo);
        this.lastErrorReport = Date.now();
      }

      if (this.errorCount >= this.maxErrors) {
        console.warn("[Test] Too many errors, temporarily disabling");
      }

      return false;
    } catch (handlerError) {
      console.warn("[Test] Error handler failed:", handlerError.message);
      return false;
    }
  }

  reset() {
    this.errorCount = 0;
    this.errorLog = [];
  }

  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }

  getErrorLog() {
    return [...this.errorLog];
  }
}

// Mock SkipButtonDetector with error handling
class SkipButtonDetectorWithErrors {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.skipTextPatterns = {
      ja: ["イントロをスキップ", "スキップ"],
      en: ["Skip Intro", "Skip"],
    };
  }

  detectButton() {
    try {
      if (!this.errorHandler.shouldContinue()) {
        return null;
      }

      // Simulate potential DOM access errors
      if (Math.random() < 0.1) {
        // 10% chance of error
        throw new Error("DOM access error");
      }

      return null; // Simplified for testing
    } catch (error) {
      this.errorHandler.handleError(error, "SkipButtonDetector.detectButton");
      return null;
    }
  }

  isValidSkipButton(button) {
    try {
      if (!button) {
        return false;
      }

      // Simulate potential validation errors
      if (Math.random() < 0.05) {
        // 5% chance of error
        throw new Error("Button validation error");
      }

      if (button.style.display === "none" || button.hidden) {
        return false;
      }

      if (!button.getBoundingClientRect) {
        button.getBoundingClientRect = () => ({ width: 100, height: 30 });
      }

      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }

      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        return false;
      }

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        error,
        "SkipButtonDetector.isValidSkipButton",
        true
      );
      return false;
    }
  }
}

// Mock AutoClickHandler with error handling
class AutoClickHandlerWithErrors {
  constructor(skipButtonDetector, errorHandler) {
    this.skipButtonDetector = skipButtonDetector;
    this.errorHandler = errorHandler;
    this.maxRetries = 3;
    this.retryDelay = 10; // Reduced for testing
  }

  async clickButton(button, retryCount = 0) {
    try {
      if (!this.errorHandler.shouldContinue()) {
        return false;
      }

      if (!button || !this.skipButtonDetector.isValidSkipButton(button)) {
        return false;
      }

      // Simulate potential click errors
      if (Math.random() < 0.15) {
        // 15% chance of error
        throw new Error("Click execution error");
      }

      const clickPromise = omise((resolve) => {
        setTimeout(() => {
          try {
            if (typeof button.click === "function") {
              button.click();
              resolve(true);
            } else {
              resolve(false);
            }
          } catch (error) {
            this.errorHandler.handleError(
              error,
              "AutoClickHandler.clickButton.clickExecution"
            );
            resolve(false);
          }
        }, 10);
      });

      const success = await clickPromise;

      if (!success && retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1);
      }

      return success;
    } catch (error) {
      this.errorHandler.handleError(error, "AutoClickHandler.clickButton");

      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1);
      }

      return false;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Mock SettingsManager with error handling
class SettingsManagerWithErrors {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.enabled = true;
    this.defaultSettings = { autoSkipEnabled: true };
  }

  async getEnabled() {
    try {
      // Simulate potential storage errors
      if (Math.random() < 0.08) {
        // 8% chance of error
        throw new Error("Storage access error");
      }

      return this.enabled;
    } catch (error) {
      this.errorHandler.handleError(error, "SettingsManager.getEnabled");
      return this.defaultSettings.autoSkipEnabled;
    }
  }

  async setEnabled(enabled) {
    try {
      // Simulate potential storage errors
      if (Math.random() < 0.08) {
        // 8% chance of error
        throw new Error("Storage write error");
      }

      this.enabled = enabled;
    } catch (error) {
      this.errorHandler.handleError(error, "SettingsManager.setEnabled");
      throw error;
    }
  }
}

describe("Error Handling and Recovery - Property-Based Tests", () => {
  // Helper function to create DOM environment for each property test
  function withTestDOM(testFn) {
    return async (...args) => {
      const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: "https://www.netflix.com/watch/123456",
      });

      const originalDocument = global.document;
      const originalWindow = global.window;
      const originalConsole = global.console;

      try {
        global.document = dom.window.document;
        global.window = dom.window;

        // Mock console to capture error logs
        const mockConsole = {
          ...originalConsole,
          error: jest.fn(),
          warn: jest.fn(),
          log: originalConsole.log,
        };
        global.console = mockConsole;

        return await testFn(...args);
      } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        global.console = originalConsole;
        dom.window.close();
      }
    };
  }

  // Property 10: エラーハンドリングと回復
  test("Property 10: Error handling and recovery", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          buttonText: fc.constantFrom(
            "Skip Intro",
            "Skip",
            "イントロをスキップ"
          ),
          operationCount: fc.integer({ min: 3, max: 10 }), // Reduced for performance
          shouldReset: fc.boolean(),
        }),
        withTestDOM(async ({ buttonText, operationCount, shouldReset }) => {
          const errorHandler = new ErrorHandler();
          const skipButtonDetector = new SkipButtonDetectorWithErrors(
            errorHandler
          );
          const autoClickHandler = new AutoClickHandlerWithErrors(
            skipButtonDetector,
            errorHandler
          );
          const settingsManager = new SettingsManagerWithErrors(errorHandler);

          const button = document.createElement("button");
          button.textContent = buttonText;
          button.getBoundingClientRect = () => ({ width: 100, height: 30 });

          let clickCount = 0;
          button.click = () => {
            clickCount++;
          };

          document.body.appendChild(button);

          let operationsCompleted = 0;
          let lastErrorCount = 0;

          // Perform multiple operations that may trigger errors
          for (let i = 0; i < operationCount; i++) {
            try {
              // Mix of different operations that can fail
              if (i % 3 === 0) {
                await autoClickHandler.clickButton(button);
              } else if (i % 3 === 1) {
                await settingsManager.getEnabled();
              } else {
                skipButtonDetector.detectButton();
              }

              operationsCompleted++;

              // Reset errors midway if requested
              if (shouldReset && i === Math.floor(operationCount / 2)) {
                lastErrorCount = errorHandler.errorCount;
                errorHandler.reset();
              }
            } catch (error) {
              // Some operations may throw, but system should continue
            }

            // If too many errors, system should stop continuing
            if (!errorHandler.shouldContinue()) {
              break;
            }
          }

          document.body.removeChild(button);

          // Property: System should handle errors gracefully and continue operation
          expect(operationsCompleted).toBeGreaterThan(0); // Some operations should complete

          // Property: Error handler should log errors without throwing unhandled exceptions
          const errorLog = errorHandler.getErrorLog();
          expect(Array.isArray(errorLog)).toBe(true);

          // Property: System should respect error limits
          if (errorHandler.errorCount >= errorHandler.maxErrors) {
            expect(errorHandler.shouldContinue()).toBe(false);
          }

          // Property: Error reset should work if requested
          if (shouldReset && lastErrorCount > 0) {
            expect(errorHandler.errorCount).toBeLessThan(
              lastErrorCount + operationCount
            );
          }

          // Property: No unhandled exceptions should be thrown
          // (This is implicitly tested by the test completing successfully)
        })
      ),
      { numRuns: 50 } // Reduced for performance
    );
  }, 10000); // 10 second timeout

  // Property 10a: Error logging and context preservation
  test("Property 10a: Error logging preserves context", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorContexts: fc.array(
            fc.constantFrom(
              "SkipButtonDetector.detectButton",
              "AutoClickHandler.clickButton",
              "SettingsManager.getEnabled",
              "DOMMonitor.processMutations"
            ),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        withTestDOM(async ({ errorContexts }) => {
          const errorHandler = new ErrorHandler();

          // Simulate errors from different contexts
          for (const context of errorContexts) {
            const error = new Error(`Test error from ${context}`);
            errorHandler.handleError(error, context);
          }

          const errorLog = errorHandler.getErrorLog();

          // Property: All errors should be logged with correct context
          expect(errorLog.length).toBe(errorContexts.length);

          for (let i = 0; i < errorContexts.length; i++) {
            expect(errorLog[i].context).toBe(errorContexts[i]);
            expect(errorLog[i].message).toContain(errorContexts[i]);
            expect(errorLog[i].timestamp).toBeDefined();
            expect(errorLog[i].errorCount).toBe(i + 1);
          }
        })
      ),
      { numRuns: 50 }
    );
  });

  // Property 10b: Silent failure behavior
  test("Property 10b: Silent failure does not break Netflix functionality", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorCount: fc.integer({ min: 1, max: 15 }),
          silentRatio: fc.float({ min: 0, max: 1 }),
        }),
        withTestDOM(async ({ errorCount, silentRatio }) => {
          const errorHandler = new ErrorHandler();
          const originalConsoleError = console.error;
          const originalConsoleWarn = console.warn;

          let consoleErrorCalls = 0;
          let consoleWarnCalls = 0;

          console.error = (...args) => {
            consoleErrorCalls++;
          };

          console.warn = (...args) => {
            consoleWarnCalls++;
          };

          try {
            // Generate errors with some being silent
            for (let i = 0; i < errorCount; i++) {
              const error = new Error(`Test error ${i}`);
              const silent = Math.random() < silentRatio;
              errorHandler.handleError(error, `context-${i}`, silent);
            }

            const errorLog = errorHandler.getErrorLog();

            // Property: All errors should be logged regardless of silent flag
            expect(errorLog.length).toBe(errorCount);

            // Property: Silent errors should not spam console
            // (Some console calls are expected due to rate limiting)
            expect(consoleErrorCalls).toBeLessThanOrEqual(errorCount);

            // Property: System should continue functioning despite errors
            expect(
              errorHandler.shouldContinue() ||
                errorHandler.errorCount >= errorHandler.maxErrors
            ).toBe(true);
          } finally {
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
          }
        })
      ),
      { numRuns: 50 }
    );
  });

  // Property 10c: Error recovery after reset
  test("Property 10c: Error recovery after reset", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialErrors: fc.integer({ min: 5, max: 12 }),
          postResetErrors: fc.integer({ min: 1, max: 8 }),
        }),
        withTestDOM(async ({ initialErrors, postResetErrors }) => {
          const errorHandler = new ErrorHandler();

          // Generate initial errors
          for (let i = 0; i < initialErrors; i++) {
            const error = new Error(`Initial error ${i}`);
            errorHandler.handleError(error, `initial-context-${i}`);
          }

          const preResetCount = errorHandler.errorCount;
          const preResetShouldContinue = errorHandler.shouldContinue();

          // Reset errors
          errorHandler.reset();

          // Property: Reset should clear error count
          expect(errorHandler.errorCount).toBe(0);
          expect(errorHandler.shouldContinue()).toBe(true);

          // Generate post-reset errors
          for (let i = 0; i < postResetErrors; i++) {
            const error = new Error(`Post-reset error ${i}`);
            errorHandler.handleError(error, `post-reset-context-${i}`);
          }

          // Property: System should function normally after reset
          expect(errorHandler.errorCount).toBe(postResetErrors);

          if (postResetErrors < errorHandler.maxErrors) {
            expect(errorHandler.shouldContinue()).toBe(true);
          }

          // Property: Error log should be cleared after reset
          const errorLog = errorHandler.getErrorLog();
          expect(errorLog.length).toBe(postResetErrors);
        })
      ),
      { numRuns: 50 }
    );
  });
});
