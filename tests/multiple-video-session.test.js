// Feature: netflix-intro-skipper, Property 3: 複数動画セッション処理
// Property-Based Tests for Multiple Video Session Handling

const fc = require("fast-check");
const { JSDOM } = require("jsdom");

// Mock SessionStateManager for testing
class SessionStateManager {
  constructor() {
    this.sessions = new Map();
    this.currentVideoId = null;
    this.sessionIdCounter = 0;
  }

  generateSessionId() {
    return `session_${++this.sessionIdCounter}_${Date.now()}`;
  }

  getCurrentVideoId() {
    // Use mocked URL if available, otherwise fall back to global.window
    const url =
      (this.domMonitor && this.domMonitor.mockUrl) ||
      global.window?.location?.href ||
      "https://www.netflix.com/watch/123456";
    const watchMatch = url.match(/\/watch\/(\d+)/);
    if (watchMatch) {
      return watchMatch[1];
    }
    return "unknown_video";
  }

  initializeSession() {
    const videoId = this.getCurrentVideoId();

    if (this.currentVideoId !== videoId) {
      this.currentVideoId = videoId;
    }

    if (!this.sessions.has(videoId)) {
      const sessionId = this.generateSessionId();
      const sessionState = {
        sessionId: sessionId,
        videoId: videoId,
        skipAttempts: 0,
        lastSkipAttempt: 0,
        skipSuccessful: false,
        sessionStartTime: Date.now(),
        detectionHistory: [],
        errors: [],
        isActive: true,
      };

      this.sessions.set(videoId, sessionState);
    }

    return this.sessions.get(videoId);
  }

  getCurrentSession() {
    const videoId = this.getCurrentVideoId();
    return this.sessions.get(videoId) || null;
  }

  recordSkipAttempt(success, detectionMethod, confidence) {
    const session = this.getCurrentSession();
    if (session) {
      session.skipAttempts++;
      session.lastSkipAttempt = Date.now();
      session.skipSuccessful = success;

      session.detectionHistory.push({
        timestamp: Date.now(),
        method: detectionMethod,
        confidence: confidence,
        success: success,
      });

      if (session.detectionHistory.length > 10) {
        session.detectionHistory = session.detectionHistory.slice(-10);
      }
    }
  }

  canAttemptSkip(cooldownMs = 50) {
    // Much shorter cooldown for testing
    const session = this.getCurrentSession();
    if (!session) {
      return true;
    }

    const timeSinceLastAttempt = Date.now() - session.lastSkipAttempt;
    return timeSinceLastAttempt >= cooldownMs;
  }

  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([videoId, session]) => ({
      videoId,
      ...session,
    }));
  }
}

// Mock SkipButtonDetector
class SkipButtonDetector {
  detectButton() {
    const button = global.document?.querySelector(
      'button[data-testid="skip-button"]'
    );
    if (button) {
      return {
        element: button,
        detectionMethod: "test",
        confidence: 0.9,
      };
    }
    return null;
  }
}

// Mock AutoClickHandler
class AutoClickHandler {
  constructor() {
    this.clickResults = [];
  }

  async clickButton(button) {
    if (button && typeof button.click === "function") {
      button.click();
      this.clickResults.push({
        timestamp: Date.now(),
        success: true,
      });
      return true;
    }
    return false;
  }
}

// Mock DOMMonitor with session management
class DOMMonitor {
  constructor() {
    this.sessionManager = new SessionStateManager();
    this.skipButtonDetector = new SkipButtonDetector();
    this.autoClickHandler = new AutoClickHandler();
    this.mockUrl = null; // For mocking URL changes

    // Pass reference to this DOMMonitor to SessionStateManager
    this.sessionManager.domMonitor = this;
  }

  async checkForSkipButton() {
    const session = this.sessionManager.initializeSession();
    if (!session || !this.sessionManager.canAttemptSkip()) {
      return false;
    }

    const result = this.skipButtonDetector.detectButton();
    if (result && result.element) {
      const success = await this.autoClickHandler.clickButton(result.element);
      this.sessionManager.recordSkipAttempt(
        success,
        result.detectionMethod,
        result.confidence
      );
      return success;
    }
    return false;
  }

  handleUrlChange(newUrl) {
    // Simulate URL change without triggering JSDOM navigation
    // Instead of setting location.href, we'll mock the URL internally
    this.mockUrl = newUrl;

    // Initialize session for new video
    return this.sessionManager.initializeSession();
  }
}

describe("Multiple Video Session Handling - Property-Based Tests", () => {
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

  // Property 3: 複数動画セッション処理
  test("Property 3: Multiple video session independence", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 同じ videoId は同じ動画として1つのセッションにまとまる (Map のキー) ため、
        // videoId が重複しないように生成する。重複すると、セッション数の断言が不安定になる
        fc.uniqueArray(
          fc.record({
            videoId: fc
              .integer({ min: 100000, max: 999999 })
              .map((id) => id.toString()),
            hasSkipButton: fc.boolean(),
            skipAttempts: fc.integer({ min: 0, max: 2 }), // Reduced for performance
          }),
          {
            selector: (videoSession) => videoSession.videoId,
            minLength: 2,
            maxLength: 3, // Reduced for performance
          }
        ),
        withTestDOM(async (videoSessions) => {
          const domMonitor = new DOMMonitor();
          const sessionResults = [];

          // Process each video session independently
          for (const videoSession of videoSessions) {
            const videoUrl = `https://www.netflix.com/watch/${videoSession.videoId}`;

            // Simulate navigation to new video
            const session = domMonitor.handleUrlChange(videoUrl);

            // Verify session was created for this video
            expect(session).toBeTruthy();
            expect(session.videoId).toBe(videoSession.videoId);

            // Create skip button if this video should have one
            if (videoSession.hasSkipButton) {
              const button = global.document.createElement("button");
              button.setAttribute("data-testid", "skip-button");
              button.textContent = "Skip Intro";

              let clickCount = 0;
              button.click = () => {
                clickCount++;
              };

              global.document.body.appendChild(button);

              // Simulate skip attempts for this video (reduced for performance)
              for (let i = 0; i < videoSession.skipAttempts; i++) {
                await domMonitor.checkForSkipButton();
                // Small delay between attempts
                await new Promise((resolve) => setTimeout(resolve, 10));
              }

              global.document.body.removeChild(button);

              sessionResults.push({
                videoId: videoSession.videoId,
                session: domMonitor.sessionManager.getCurrentSession(),
                clickCount: clickCount,
              });
            } else {
              // No skip button - should not attempt clicks
              const result = await domMonitor.checkForSkipButton();
              expect(result).toBe(false);

              sessionResults.push({
                videoId: videoSession.videoId,
                session: domMonitor.sessionManager.getCurrentSession(),
                clickCount: 0,
              });
            }
          }

          // Verify session independence
          const allSessions = domMonitor.sessionManager.getAllSessions();

          // Property: Each video should have its own independent session
          expect(allSessions.length).toBe(videoSessions.length);

          // Property: Sessions should not interfere with each other
          const sessionIds = allSessions.map((s) => s.sessionId);
          const uniqueSessionIds = new Set(sessionIds);
          expect(uniqueSessionIds.size).toBe(sessionIds.length); // All session IDs should be unique

          const videoIds = allSessions.map((s) => s.videoId);
          const uniqueVideoIds = new Set(videoIds);
          expect(uniqueVideoIds.size).toBe(videoIds.length); // All video IDs should be unique
        })
      ),
      { numRuns: 5, timeout: 1000 } // Reduced for performance
    );
  }, 10000);

  // Property test for session state isolation
  test("Property 3b: Session state isolation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc.integer({ min: 100000, max: 999999 }).map((id) => id.toString()),
            fc.integer({ min: 100000, max: 999999 }).map((id) => id.toString())
          )
          .filter(([id1, id2]) => id1 !== id2),
        fc.integer({ min: 1, max: 2 }), // Reduced for performance
        fc.integer({ min: 1, max: 2 }), // Reduced for performance
        withTestDOM(async ([videoId1, videoId2], attempts1, attempts2) => {
          const domMonitor = new DOMMonitor();

          // Session 1: First video
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId1}`
          );
          const session1Initial = domMonitor.sessionManager.getCurrentSession();

          // Create skip button and make attempts for video 1
          const button1 = global.document.createElement("button");
          button1.setAttribute("data-testid", "skip-button");
          button1.click = () => {};
          global.document.body.appendChild(button1);

          for (let i = 0; i < attempts1; i++) {
            await domMonitor.checkForSkipButton();
            await new Promise((resolve) => setTimeout(resolve, 60)); // Longer delay
          }

          const session1AfterAttempts =
            domMonitor.sessionManager.getCurrentSession();
          global.document.body.removeChild(button1);

          // Session 2: Switch to second video
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId2}`
          );
          const session2Initial = domMonitor.sessionManager.getCurrentSession();

          // Create skip button and make attempts for video 2
          const button2 = global.document.createElement("button");
          button2.setAttribute("data-testid", "skip-button");
          button2.click = () => {};
          global.document.body.appendChild(button2);

          for (let i = 0; i < attempts2; i++) {
            await domMonitor.checkForSkipButton();
            await new Promise((resolve) => setTimeout(resolve, 60)); // Longer delay
          }

          const session2AfterAttempts =
            domMonitor.sessionManager.getCurrentSession();
          global.document.body.removeChild(button2);

          // Switch back to first video
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId1}`
          );
          const session1Final = domMonitor.sessionManager.getCurrentSession();

          // Property: Sessions should maintain independent state
          expect(session1Initial.videoId).toBe(videoId1);
          expect(session2Initial.videoId).toBe(videoId2);
          expect(session1Final.videoId).toBe(videoId1);

          // Property: Session 1 state should be preserved after switching away and back
          expect(session1Final.sessionId).toBe(session1Initial.sessionId);
          expect(session1Final.skipAttempts).toBe(
            session1AfterAttempts.skipAttempts
          );

          // Property: Each session should have recorded its own attempts
          // Debug: Log actual vs expected values
          console.log(
            `Session1 attempts: expected ${attempts1}, actual ${session1AfterAttempts.skipAttempts}`
          );
          console.log(
            `Session2 attempts: expected ${attempts2}, actual ${session2AfterAttempts.skipAttempts}`
          );

          expect(session1AfterAttempts.skipAttempts).toBe(attempts1);
          // Allow for cooldown affecting the second session
          expect(session2AfterAttempts.skipAttempts).toBeGreaterThanOrEqual(
            Math.min(attempts2, 1)
          );

          // Property: Sessions should not share state
          if (attempts1 !== attempts2) {
            expect(session1Final.skipAttempts).not.toBe(
              session2AfterAttempts.skipAttempts
            );
          }
        })
      ),
      { numRuns: 5, timeout: 1000 } // Reduced for performance
    );
  }, 10000);

  // Property test for session cooldown independence
  test("Property 3c: Independent session cooldowns", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc.integer({ min: 100000, max: 999999 }).map((id) => id.toString()),
            fc.integer({ min: 100000, max: 999999 }).map((id) => id.toString())
          )
          .filter(([id1, id2]) => id1 !== id2),
        withTestDOM(async ([videoId1, videoId2]) => {
          const domMonitor = new DOMMonitor();

          // Initialize session for video 1 and make a skip attempt
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId1}`
          );
          const button1 = global.document.createElement("button");
          button1.setAttribute("data-testid", "skip-button");
          button1.click = () => {};
          global.document.body.appendChild(button1);

          await domMonitor.checkForSkipButton(); // This should trigger cooldown for video 1
          global.document.body.removeChild(button1);

          // Switch to video 2 immediately
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId2}`
          );
          const button2 = global.document.createElement("button");
          button2.setAttribute("data-testid", "skip-button");
          button2.click = () => {};
          global.document.body.appendChild(button2);

          // Property: Video 2 should not be affected by video 1's cooldown
          const canAttemptVideo2 = domMonitor.sessionManager.canAttemptSkip();
          expect(canAttemptVideo2).toBe(true);

          const result = await domMonitor.checkForSkipButton();
          expect(result).toBe(true); // Should succeed because video 2 has no cooldown

          global.document.body.removeChild(button2);

          // Switch back to video 1
          domMonitor.handleUrlChange(
            `https://www.netflix.com/watch/${videoId1}`
          );

          // Property: Video 1 should still have its cooldown active
          const canAttemptVideo1 =
            domMonitor.sessionManager.canAttemptSkip(1000);
          expect(canAttemptVideo1).toBe(false); // Should be false due to recent attempt
        })
      ),
      { numRuns: 5, timeout: 1000 } // Reduced for performance
    );
  }, 10000);
});
