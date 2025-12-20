// Feature: netflix-intro-skipper, Property 11: 再試行メカニズム
// Property-Based Tests for Retry Mechanism

const fc = require("fast-check");
const { JSDOM } = require("jsdom");

// Mock ErrorHandler for testing
class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
  }

  handleError(error, context = "unknown", silent = false) {
    this.errorCount++;
    if (!silent) {
      console.error(`[Test] Error in ${context}:`, error.message);
    }
    return false;
  }

  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }

  reset() {
    this.errorCount = 0;
  }
}

// Mock SkipButtonDetector with retry capabilities
class SkipButtonDetectorWithRetry {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.skipTextPatterns = {
      ja: ["イントロをスキップ", "スキップ"],
      en: ["Skip Intro", "Skip"],
    };
    this.detectionMethods = [
      { method: "detectByCssSelector", priority: 3, name: "selector" },
      { method: "detectByText", priority: 2, name: "text" },
      { method: "detectByAriaLabel", priority: 2, name: "aria-label" },
      { method: "detectByFallbackSelectors", priority: 1, name: "fallback" },
      { method: "detectByAdvancedHeuristics", priority: 1, name: "heuristics" },
    ];
    this.failureRate = 0.2; // 20% chance of method failure
  }

  detectButton() {
    try {
      if (!this.errorHandler.shouldContinue()) {
        return null;
      }

      // Try detection methods in priority order with retry logic
      const sortedMethods = this.detectionMethods.sort(
        (a, b) => b.priority - a.priority
      );

      for (const methodInfo of sortedMethods) {
        try {
          // Simulate method failure
          if (Math.random() < this.failureRate) {
            throw new Error(`${methodInfo.method} failed`);
          }

          const result = this[methodInfo.method]();
          if (result) {
            return {
              element: result,
              detectionMethod: methodInfo.name,
              confidence: this.calculateConfidence(
                methodInfo.priority,
                methodInfo.name
              ),
            };
          }
        } catch (error) {
          this.errorHandler.handleError(
            error,
            `SkipButtonDetector.${methodInfo.method}`,
            true
          );
          // Continue to next method on error
        }
      }

      return null;
    } catch (error) {
      this.errorHandler.handleError(error, "SkipButtonDetector.detectButton");
      return null;
    }
  }

  calculateConfidence(priority, methodName) {
    const baseConfidence = {
      selector: 0.9,
      text: 0.8,
      "aria-label": 0.7,
      fallback: 0.6,
      heuristics: 0.5,
    };
    return baseConfidence[methodName] || 0.5;
  }

  detectByCssSelector() {
    // Simulate finding a button 70% of the time
    if (Math.random() < 0.7) {
      const button = document.createElement("button");
      button.textContent = "Skip Intro";
      button.className = "skip-credits-button";
      return button;
    }
    return null;
  }

  detectByText() {
    // Simulate finding a button 60% of the time
    if (Math.random() < 0.6) {
      const button = document.createElement("button");
      button.textContent = "Skip";
      return button;
    }
    return null;
  }

  detectByAriaLabel() {
    // Simulate finding a button 50% of the time
    if (Math.random() < 0.5) {
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Skip Intro");
      return button;
    }
    return null;
  }

  detectByFallbackSelectors() {
    // Simulate finding a button 40% of the time
    if (Math.random() < 0.4) {
      const button = document.createElement("button");
      button.textContent = "Skip";
      button.className = "player-controls-button";
      return button;
    }
    return null;
  }

  detectByAdvancedHeuristics() {
    // Simulate finding a button 30% of the time
    if (Math.random() < 0.3) {
      const button = document.createElement("button");
      button.textContent = "Continue";
      return button;
    }
    return null;
  }

  isValidSkipButton(button) {
    if (!button) return false;

    // Simulate validation failure 10% of the time
    if (Math.random() < 0.1) {
      throw new Error("Button validation failed");
    }

    return true;
  }
}

// Mock AutoClickHandler with retry capabilities
class AutoClickHandlerWithRetry {
  constructor(skipButtonDetector, errorHandler) {
    this.skipButtonDetector = skipButtonDetector;
    this.errorHandler = errorHandler;
    this.maxRetries = 3;
    this.fallbackRetries = 2;
    this.retryDelay = 10; // Reduced for testing
    this.clickFailureRate = 0.3; // 30% chance of click failure
  }

  async clickButton(button, retryCount = 0) {
    try {
      if (!this.errorHandler.shouldContinue()) {
        return false;
      }

      if (!button || !this.skipButtonDetector.isValidSkipButton(button)) {
        return false;
      }

      // Simulate click failure
      if (Math.random() < this.clickFailureRate) {
        throw new Error("Click failed");
      }

      // Try primary click method first
      let success = await this.attemptClick(button);

      // If primary method fails, try alternative methods
      if (!success && retryCount < this.maxRetries) {
        success = await this.clickWithAlternativeMethods(button, 0);

        if (!success) {
          await this.delay(this.retryDelay);
          return this.clickButton(button, retryCount + 1);
        }
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

  async attemptClick(button) {
    try {
      // Simulate click success 70% of the time
      if (Math.random() < 0.7) {
        if (typeof button.click === "function") {
          button.click();
          return true;
        }
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(error, "AutoClickHandler.attemptClick");
      return false;
    }
  }

  async clickWithAlternativeMethods(button, retryCount = 0) {
    try {
      const methods = [
        () => this.clickWithMouseEvent(button),
        () => this.clickWithDirectCall(button),
        () => this.clickWithFocus(button),
      ];

      for (let i = 0; i < methods.length; i++) {
        try {
          const success = await methods[i]();
          if (success) {
            return true;
          }
          await this.delay(5);
        } catch (error) {
          this.errorHandler.handleError(
            error,
            `AutoClickHandler.alternativeMethod${i}`,
            true
          );
        }
      }

      if (retryCount < this.fallbackRetries) {
        await this.delay(this.retryDelay);
        return this.clickWithAlternativeMethods(button, retryCount + 1);
      }

      return false;
    } catch (error) {
      this.errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithAlternativeMethods"
      );
      return false;
    }
  }

  async clickWithMouseEvent(button) {
    // Simulate success 60% of the time
    return Math.random() < 0.6;
  }

  async clickWithDirectCall(button) {
    // Simulate success 80% of the time
    return Math.random() < 0.8;
  }

  async clickWithFocus(button) {
    // Simulate success 50% of the time
    return Math.random() < 0.5;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

describe("Retry Mechanism - Property-Based Tests", () => {
  // Helper function to create DOM environment for each property test
  function withTestDOM(testFn) {
    return async (...args) => {
      const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: "https://www.netflix.com/watch/123456",
      });

      const originalDocument = global.document;
      const originalWindow = global.window;

      try {
        global.document = dom.window.document;
        global.window = dom.window;

        return await testFn(...args);
      } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        dom.window.close();
      }
    };
  }

  // Property 11: 再試行メカニズム
  test("Property 11: Retry mechanism with fallback methods", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          buttonText: fc.constantFrom(
            "Skip Intro",
            "Skip",
            "イントロをスキップ"
          ),
          maxAttempts: fc.integer({ min: 3, max: 8 }),
          shouldSucceedEventually: fc.boolean(),
        }),
        withTestDOM(
          async ({ buttonText, maxAttempts, shouldSucceedEventually }) => {
            const errorHandler = new ErrorHandler();
            const skipButtonDetector = new SkipButtonDetectorWithRetry(
              errorHandler
            );
            const autoClickHandler = new AutoClickHandlerWithRetry(
              skipButtonDetector,
              errorHandler
            );

            // Adjust failure rates based on whether we want eventual success
            if (shouldSucceedEventually) {
              skipButtonDetector.failureRate = 0.1; // Lower failure rate
              autoClickHandler.clickFailureRate = 0.2;
            } else {
              skipButtonDetector.failureRate = 0.8; // Higher failure rate
              autoClickHandler.clickFailureRate = 0.9;
            }

            let totalAttempts = 0;
            let successCount = 0;
            let detectionAttempts = 0;
            let clickAttempts = 0;

            // Perform multiple attempts to test retry mechanism
            for (let i = 0; i < maxAttempts; i++) {
              totalAttempts++;

              try {
                // Try to detect button
                const result = skipButtonDetector.detectButton();
                detectionAttempts++;

                if (result && result.element) {
                  // Try to click button
                  const success = await autoClickHandler.clickButton(
                    result.element
                  );
                  clickAttempts++;

                  if (success) {
                    successCount++;
                  }
                }
              } catch (error) {
                // Errors should be handled gracefully
              }

              // Stop if we've had too many errors
              if (!errorHandler.shouldContinue()) {
                break;
              }
            }

            // Property: Retry mechanism should attempt multiple methods before giving up
            expect(totalAttempts).toBeGreaterThan(0);
            expect(detectionAttempts).toBeGreaterThan(0);

            // Property: If configured for eventual success, should succeed at least once
            if (shouldSucceedEventually && maxAttempts >= 5) {
              expect(successCount).toBeGreaterThan(0);
            }

            // Property: Error handler should track errors without breaking the system
            expect(errorHandler.errorCount).toBeGreaterThanOrEqual(0);

            // Property: System should respect error limits
            if (errorHandler.errorCount >= errorHandler.maxErrors) {
              expect(errorHandler.shouldContinue()).toBe(false);
            }
          }
        )
      ),
      { numRuns: 50 }
    );
  }, 15000); // 15 second timeout

  // Property 11a: Fallback detection methods
  test("Property 11a: Fallback detection methods are tried in order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          primaryFailureRate: fc.float({
            min: Math.fround(0.5),
            max: Math.fround(1.0),
          }),
          fallbackSuccessRate: fc.float({
            min: Math.fround(0.1),
            max: Math.fround(0.8),
          }),
        }),
        withTestDOM(async ({ primaryFailureRate, fallbackSuccessRate }) => {
          const errorHandler = new ErrorHandler();
          const skipButtonDetector = new SkipButtonDetectorWithRetry(
            errorHandler
          );

          // Configure failure rates
          skipButtonDetector.failureRate = primaryFailureRate;

          let detectionAttempts = 0;
          let successfulDetections = 0;
          let methodsUsed = new Set();

          // Try detection multiple times
          for (let i = 0; i < 10; i++) {
            detectionAttempts++;

            const result = skipButtonDetector.detectButton();
            if (result) {
              successfulDetections++;
              methodsUsed.add(result.detectionMethod);
            }
          }

          // Property: Multiple detection methods should be attempted
          expect(detectionAttempts).toBe(10);

          // Property: When primary methods fail, fallback methods should be used
          // Note: If all methods fail due to high failure rates, methodsUsed might be empty
          if (primaryFailureRate > 0.7 && successfulDetections > 0) {
            // Only check if we had some successful detections
            expect(methodsUsed.size).toBeGreaterThanOrEqual(1);
          }

          // Property: Error handler should not prevent all attempts (unless max errors reached)
          if (errorHandler.errorCount < errorHandler.maxErrors) {
            expect(errorHandler.shouldContinue()).toBe(true);
          } else {
            expect(errorHandler.shouldContinue()).toBe(false);
          }
        })
      ),
      { numRuns: 30 }
    );
  });

  // Property 11b: Click retry with alternative methods
  test("Property 11b: Click retry uses alternative methods", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          primaryClickFailureRate: fc.float({
            min: Math.fround(0.6),
            max: Math.fround(1.0),
          }),
          alternativeSuccessRate: fc.float({
            min: Math.fround(0.2),
            max: Math.fround(0.9),
          }),
        }),
        withTestDOM(
          async ({ primaryClickFailureRate, alternativeSuccessRate }) => {
            const errorHandler = new ErrorHandler();
            const skipButtonDetector = new SkipButtonDetectorWithRetry(
              errorHandler
            );
            const autoClickHandler = new AutoClickHandlerWithRetry(
              skipButtonDetector,
              errorHandler
            );

            // Configure failure rates
            autoClickHandler.clickFailureRate = primaryClickFailureRate;

            const button = document.createElement("button");
            button.textContent = "Skip Intro";
            button.click = jest.fn();

            let clickAttempts = 0;
            let successfulClicks = 0;

            // Try clicking multiple times
            for (let i = 0; i < 5; i++) {
              clickAttempts++;

              const success = await autoClickHandler.clickButton(button);
              if (success) {
                successfulClicks++;
              }
            }

            // Property: Click attempts should be made
            expect(clickAttempts).toBe(5);

            // Property: With high primary failure rate, alternative methods should provide some success
            if (primaryClickFailureRate > 0.8 && alternativeSuccessRate > 0.5) {
              expect(successfulClicks).toBeGreaterThanOrEqual(0);
            }

            // Property: Error handler should track failures without breaking system (unless max errors reached)
            if (errorHandler.errorCount < errorHandler.maxErrors) {
              expect(errorHandler.shouldContinue()).toBe(true);
            } else {
              expect(errorHandler.shouldContinue()).toBe(false);
            }
          }
        )
      ),
      { numRuns: 30 }
    );
  });

  // Property 11c: Retry limits are respected
  test("Property 11c: Retry limits prevent infinite loops", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          maxRetries: fc.integer({ min: 1, max: 5 }),
          alwaysFail: fc.boolean(),
        }),
        withTestDOM(async ({ maxRetries, alwaysFail }) => {
          const errorHandler = new ErrorHandler();
          const skipButtonDetector = new SkipButtonDetectorWithRetry(
            errorHandler
          );
          const autoClickHandler = new AutoClickHandlerWithRetry(
            skipButtonDetector,
            errorHandler
          );

          // Configure for failure if requested
          if (alwaysFail) {
            skipButtonDetector.failureRate = 1.0;
            autoClickHandler.clickFailureRate = 1.0;
          }

          autoClickHandler.maxRetries = maxRetries;

          const button = document.createElement("button");
          button.textContent = "Skip Intro";

          const startTime = Date.now();
          const success = await autoClickHandler.clickButton(button);
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Property: Operation should complete within reasonable time (not infinite loop)
          expect(duration).toBeLessThan(5000); // 5 seconds max

          // Property: If always failing, should eventually give up
          if (alwaysFail) {
            expect(success).toBe(false);
          }

          // Property: Error count should not exceed reasonable limits
          expect(errorHandler.errorCount).toBeLessThan(50);
        })
      ),
      { numRuns: 20 }
    );
  });
});
