// Feature: netflix-intro-skipper, Property 4: 無効状態の動作, Property 5: 有効状態の動作
// Property-Based Tests for Conditional Behavior

const fc = require("fast-check");
const { JSDOM } = require("jsdom");

// Mock classes for testing
class SettingsManager {
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  async getEnabled() {
    return this.enabled;
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
  }
}

class SkipButtonDetector {
  isValidSkipButton(button) {
    if (!button) {
      return false;
    }

    if (button.style.display === "none" || button.hidden) {
      return false;
    }

    // Ensure getBoundingClientRect is available for testing
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
  }
}

class AutoClickHandler {
  constructor(skipButtonDetector) {
    this.skipButtonDetector = skipButtonDetector;
    this.maxRetries = 3;
    this.retryDelay = 500;
    this.clickTimeout = 1000;
  }

  async clickButton(button, retryCount = 0, settingsManager = null) {
    try {
      if (!button || !this.skipButtonDetector.isValidSkipButton(button)) {
        return false;
      }

      // Check if auto-skip is enabled before clicking
      if (settingsManager) {
        const isEnabled = await settingsManager.getEnabled();
        if (!isEnabled) {
          return false;
        }
      }

      const clickPromise = new Promise((resolve) => {
        setTimeout(() => {
          try {
            let clickCalled = false;

            if (typeof button.click === "function") {
              button.click();
              clickCalled = true;
            }

            resolve(clickCalled);
          } catch (error) {
            resolve(false);
          }
        }, 50); // Reduced delay for testing
      });

      const success = await clickPromise;

      if (!success && retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1, settingsManager);
      }

      return success;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1, settingsManager);
      }

      return false;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

describe("Conditional Behavior - Property-Based Tests", () => {
  // Helper function to create DOM environment for each property test
  function withTestDOM(testFn) {
    return async (...args) => {
      const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: "https://www.netflix.com/watch/123456",
      });

      const originalDocument = global.document;
      const originalWindow = global.window;
      const originalMouseEvent = global.MouseEvent;

      try {
        global.document = dom.window.document;
        global.window = dom.window;
        global.MouseEvent = dom.window.MouseEvent;

        return await testFn(...args);
      } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        global.MouseEvent = originalMouseEvent;
        dom.window.close();
      }
    };
  }

  // Property 4: 無効状態の動作
  test("Property 4: Disabled state behavior", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          buttonText: fc.constantFrom(
            "Skip Intro",
            "Skip",
            "イントロをスキップ",
            "スキップ"
          ),
          isVisible: fc.boolean(),
          isEnabled: fc.boolean(),
        }),
        withTestDOM(async ({ buttonText, isVisible, isEnabled }) => {
          const settingsManager = new SettingsManager(false); // Auto-skip disabled
          const skipButtonDetector = new SkipButtonDetector();
          const autoClickHandler = new AutoClickHandler(skipButtonDetector);

          const button = document.createElement("button");
          button.textContent = buttonText;

          // Ensure getBoundingClientRect is available for testing
          button.getBoundingClientRect = () => ({ width: 100, height: 30 });

          if (!isVisible) {
            button.style.display = "none";
          }

          if (!isEnabled) {
            button.disabled = true;
          }

          // Always add a click method for testing
          let clickCount = 0;
          button.click = () => {
            clickCount++;
          };

          document.body.appendChild(button);

          const result = await autoClickHandler.clickButton(
            button,
            0,
            settingsManager
          );

          document.body.removeChild(button);

          // Property: When auto-skip is disabled, no button should be clicked regardless of its state
          expect(result).toBe(false);
          expect(clickCount).toBe(0);
        })
      ),
      { numRuns: 100 }
    );
  });

  // Property 5: 有効状態の動作
  test("Property 5: Enabled state behavior", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          buttonText: fc.constantFrom(
            "Skip Intro",
            "Skip",
            "イントロをスキップ",
            "スキップ"
          ),
          isVisible: fc.boolean(),
          isEnabled: fc.boolean(),
        }),
        withTestDOM(async ({ buttonText, isVisible, isEnabled }) => {
          const settingsManager = new SettingsManager(true); // Auto-skip enabled
          const skipButtonDetector = new SkipButtonDetector();
          const autoClickHandler = new AutoClickHandler(skipButtonDetector);

          const button = document.createElement("button");
          button.textContent = buttonText;

          // Ensure getBoundingClientRect is available for testing
          button.getBoundingClientRect = () => ({ width: 100, height: 30 });

          if (!isVisible) {
            button.style.display = "none";
          }

          if (!isEnabled) {
            button.disabled = true;
          }

          // Always add a click method for testing
          let clickCount = 0;
          button.click = () => {
            clickCount++;
          };

          document.body.appendChild(button);

          const result = await autoClickHandler.clickButton(
            button,
            0,
            settingsManager
          );

          document.body.removeChild(button);

          // Property: When auto-skip is enabled, valid buttons should be clicked
          if (isVisible && isEnabled) {
            expect(result).toBe(true);
            expect(clickCount).toBeGreaterThan(0);
          } else {
            // Invalid buttons should not be clicked even when enabled
            expect(result).toBe(false);
            expect(clickCount).toBe(0);
          }
        })
      ),
      { numRuns: 100 }
    );
  });

  // Property 5a: Settings state transition behavior
  test("Property 5a: Settings state transition behavior", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          buttonText: fc.constantFrom("Skip Intro", "スキップ"),
          initialState: fc.boolean(),
          finalState: fc.boolean(),
        }),
        withTestDOM(async ({ buttonText, initialState, finalState }) => {
          const settingsManager = new SettingsManager(initialState);
          const skipButtonDetector = new SkipButtonDetector();
          const autoClickHandler = new AutoClickHandler(skipButtonDetector);

          const button = document.createElement("button");
          button.textContent = buttonText;

          // Ensure getBoundingClientRect is available for testing
          button.getBoundingClientRect = () => ({ width: 100, height: 30 });

          let clickCount = 0;
          button.click = () => {
            clickCount++;
          };

          document.body.appendChild(button);

          // First click attempt with initial state
          const result1 = await autoClickHandler.clickButton(
            button,
            0,
            settingsManager
          );

          // Change settings state
          await settingsManager.setEnabled(finalState);

          // Second click attempt with final state
          const result2 = await autoClickHandler.clickButton(
            button,
            0,
            settingsManager
          );

          document.body.removeChild(button);

          // Property: Click behavior should match the current settings state
          expect(result1).toBe(initialState);
          expect(result2).toBe(finalState);

          // Click count should match the number of successful attempts
          const expectedClicks = (initialState ? 1 : 0) + (finalState ? 1 : 0);
          expect(clickCount).toBe(expectedClicks);
        })
      ),
      { numRuns: 50 }
    );
  });
});
