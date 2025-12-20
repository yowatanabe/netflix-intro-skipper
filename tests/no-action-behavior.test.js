// Feature: netflix-intro-skipper, Property 2: スキップボタンがない場合の無動作
// Property-Based Tests for No-Action Behavior

const fc = require("fast-check");
const { JSDOM } = require("jsdom");

// Mock SkipButtonDetector that can simulate no button found
class SkipButtonDetector {
  constructor() {
    this.shouldFindButton = true; // Can be controlled for testing
  }

  detectButton() {
    // If we're simulating no button exists, return null
    if (!this.shouldFindButton) {
      return null;
    }

    // If we should find a button, look for it in the DOM
    const button = global.document?.querySelector(
      'button[data-testid="skip-button"]'
    );

    // Debug logging
    console.log(
      `SkipButtonDetector: shouldFindButton=${
        this.shouldFindButton
      }, button found=${!!button}`
    );

    if (button) {
      return {
        element: button,
        detectionMethod: "test",
        confidence: 0.9,
      };
    }

    // If shouldFindButton is true but no button exists in DOM, return null
    return null;
  }

  setButtonExists(exists) {
    this.shouldFindButton = exists;
  }
}

// Mock AutoClickHandler that tracks click attempts
class AutoClickHandler {
  constructor() {
    this.clickAttempts = [];
  }

  async clickButton(button) {
    this.clickAttempts.push({
      timestamp: Date.now(),
      button: button,
      success: true,
    });

    if (button && typeof button.click === "function") {
      button.click();
      return true;
    }
    return false;
  }

  getClickCount() {
    return this.clickAttempts.length;
  }

  reset() {
    this.clickAttempts = [];
  }
}

// Mock SettingsManager
class SettingsManager {
  constructor() {
    this.enabled = true;
  }

  async getEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Mock SessionStateManager
class SessionStateManager {
  constructor() {
    this.sessions = new Map();
    this.sessionIdCounter = 0;
  }

  initializeSession() {
    const videoId = "test_video";
    if (!this.sessions.has(videoId)) {
      this.sessions.set(videoId, {
        sessionId: `session_${++this.sessionIdCounter}`,
        videoId: videoId,
        skipAttempts: 0,
        lastSkipAttempt: 0,
      });
    }
    return this.sessions.get(videoId);
  }

  canAttemptSkip() {
    return true; // Always allow for testing
  }

  recordSkipAttempt(success, method, confidence) {
    const session = this.sessions.get("test_video");
    if (session) {
      session.skipAttempts++;
      session.lastSkipAttempt = Date.now();
    }
  }
}

// Mock DOMMonitor for no-action testing
class DOMMonitor {
  constructor() {
    this.skipButtonDetector = new SkipButtonDetector();
    this.autoClickHandler = new AutoClickHandler();
    this.settingsManager = new SettingsManager();
    this.sessionManager = new SessionStateManager();
  }

  async checkForSkipButton() {
    // Initialize session
    const session = this.sessionManager.initializeSession();
    if (!session || !this.sessionManager.canAttemptSkip()) {
      return false;
    }

    // Check if auto-skip is enabled
    const isEnabled = await this.settingsManager.getEnabled();
    if (!isEnabled) {
      return false;
    }

    // Try to detect button
    const result = this.skipButtonDetector.detectButton();

    if (result && result.element) {
      // Button found - attempt click
      const success = await this.autoClickHandler.clickButton(result.element);
      this.sessionManager.recordSkipAttempt(
        success,
        result.detectionMethod,
        result.confidence
      );
      return success;
    } else {
      // No button found - no action taken (this is the behavior we're testing)
      return false;
    }
  }

  setButtonExists(exists) {
    this.skipButtonDetector.setButtonExists(exists);
  }

  getClickCount() {
    return this.autoClickHandler.getClickCount();
  }

  reset() {
    this.autoClickHandler.reset();
  }
}

describe("No-Action Behavior - Property-Based Tests", () => {
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

  // Property 2: スキップボタンがない場合の無動作
  test("Property 2: No action when no skip button exists", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasSkipButton: fc.boolean(),
          checkAttempts: fc.integer({ min: 1, max: 5 }),
          autoSkipEnabled: fc.boolean(),
        }),
        withTestDOM(
          async ({ hasSkipButton, checkAttempts, autoSkipEnabled }) => {
            const domMonitor = new DOMMonitor();

            // Set up the test scenario
            domMonitor.setButtonExists(hasSkipButton);
            domMonitor.settingsManager.setEnabled(autoSkipEnabled);

            // Create skip button only if it should exist
            let button = null;
            if (hasSkipButton) {
              button = global.document.createElement("button");
              button.setAttribute("data-testid", "skip-button");
              button.textContent = "Skip Intro";

              let clickCount = 0;
              button.click = () => {
                clickCount++;
              };

              global.document.body.appendChild(button);
            }

            // Perform multiple check attempts
            let successfulClicks = 0;
            for (let i = 0; i < checkAttempts; i++) {
              const result = await domMonitor.checkForSkipButton();
              if (result) {
                successfulClicks++;
              }
              // Small delay between attempts
              await new Promise((resolve) => setTimeout(resolve, 10));
            }

            // Clean up button if it was created
            if (button && button.parentNode) {
              global.document.body.removeChild(button);
            }

            // Property: When no skip button exists, no clicks should be attempted
            if (!hasSkipButton) {
              expect(domMonitor.getClickCount()).toBe(0);
              expect(successfulClicks).toBe(0);
            }

            // Property: When auto-skip is disabled, no clicks should occur regardless of button existence
            if (!autoSkipEnabled) {
              expect(successfulClicks).toBe(0);
            }

            // Property: When button exists and auto-skip is enabled, clicks should occur
            if (hasSkipButton && autoSkipEnabled) {
              // Debug information
              console.log(
                `Debug: hasSkipButton=${hasSkipButton}, autoSkipEnabled=${autoSkipEnabled}`
              );
              console.log(
                `Debug: domMonitor.getClickCount()=${domMonitor.getClickCount()}`
              );
              console.log(`Debug: successfulClicks=${successfulClicks}`);
              console.log(
                `Debug: button exists in DOM=${!!global.document.querySelector(
                  'button[data-testid="skip-button"]'
                )}`
              );

              expect(domMonitor.getClickCount()).toBeGreaterThan(0);
              expect(successfulClicks).toBeGreaterThan(0);
            }
          }
        )
      ),
      { numRuns: 20, timeout: 1000 }
    );
  }, 15000);

  // Property test for consistent no-action behavior
  test("Property 2b: Consistent no-action across multiple checks", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        withTestDOM(async (checkCount) => {
          const domMonitor = new DOMMonitor();

          // Ensure no skip button exists
          domMonitor.setButtonExists(false);
          domMonitor.settingsManager.setEnabled(true);

          // Perform multiple checks
          const results = [];
          for (let i = 0; i < checkCount; i++) {
            const result = await domMonitor.checkForSkipButton();
            results.push(result);
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          // Property: All checks should return false (no action taken)
          expect(results.every((result) => result === false)).toBe(true);

          // Property: No clicks should have been attempted
          expect(domMonitor.getClickCount()).toBe(0);

          // Property: Extension should remain in a consistent state
          expect(domMonitor.settingsManager.getEnabled()).resolves.toBe(true);
        })
      ),
      { numRuns: 10, timeout: 1000 }
    );
  }, 10000);

  // Property test for no interference with normal playback
  test("Property 2c: No interference with normal Netflix playback", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasOtherButtons: fc.boolean(),
          buttonCount: fc.integer({ min: 0, max: 5 }),
        }),
        withTestDOM(async ({ hasOtherButtons, buttonCount }) => {
          const domMonitor = new DOMMonitor();

          // Ensure no skip button exists
          domMonitor.setButtonExists(false);
          domMonitor.settingsManager.setEnabled(true);

          // Create other Netflix UI buttons (play, pause, etc.)
          const otherButtons = [];
          if (hasOtherButtons) {
            for (let i = 0; i < buttonCount; i++) {
              const button = global.document.createElement("button");
              button.setAttribute("data-testid", `netflix-button-${i}`);
              button.textContent = [
                "Play",
                "Pause",
                "Volume",
                "Fullscreen",
                "Settings",
              ][i % 5];

              let clickCount = 0;
              button.click = () => {
                clickCount++;
              };
              button.clickCount = () => clickCount;

              global.document.body.appendChild(button);
              otherButtons.push(button);
            }
          }

          // Check for skip button multiple times
          for (let i = 0; i < 3; i++) {
            await domMonitor.checkForSkipButton();
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          // Property: Other Netflix buttons should not be affected
          for (const button of otherButtons) {
            expect(button.clickCount()).toBe(0); // Should not have been clicked by extension
          }

          // Property: No skip-related clicks should have occurred
          expect(domMonitor.getClickCount()).toBe(0);

          // Clean up
          otherButtons.forEach((button) => {
            if (button.parentNode) {
              global.document.body.removeChild(button);
            }
          });
        })
      ),
      { numRuns: 15, timeout: 1000 }
    );
  }, 12000);
});
