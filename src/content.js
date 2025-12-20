// Netflix Intro Skipper - Content Script

// Enhanced Error Handler for Netflix compatibility
class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10; // Maximum errors before disabling
    this.errorCooldown = 60000; // 1 minute cooldown between error reports
    this.lastErrorReport = 0;
  }

  handleError(error, context = "unknown", silent = false) {
    try {
      this.errorCount++;

      // Log error details for debugging
      const errorInfo = {
        message: error.message || "Unknown error",
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        errorCount: this.errorCount,
      };

      // Always log to console for debugging, but don't spam
      if (!silent && Date.now() - this.lastErrorReport > this.errorCooldown) {
        console.error(
          `[Netflix Intro Skipper] Error in ${context}:`,
          error.message || error.toString(),
          errorInfo
        );
        this.lastErrorReport = Date.now();
      }

      // Report to background script (with rate limiting)
      if (Date.now() - this.lastErrorReport > this.errorCooldown) {
        this.reportErrorToBackground(errorInfo).catch(() => {
          // Silent failure - don't break Netflix if background communication fails
        });
      }

      // Check if we should disable the extension due to too many errors
      if (this.errorCount >= this.maxErrors) {
        console.warn(
          "[Netflix Intro Skipper] Too many errors, temporarily disabling"
        );
        this.disableTemporarily();
      }

      return false; // Indicate error was handled
    } catch (handlerError) {
      // Error in error handler - fail silently to avoid breaking Netflix
      console.warn(
        "[Netflix Intro Skipper] Error handler failed:",
        handlerError.message
      );
      return false;
    }
  }

  async reportErrorToBackground(errorInfo) {
    try {
      await sendMessageToBackground({
        action: "logActivity",
        message: "Content script error",
        data: errorInfo,
      });
    } catch (error) {
      // Silent failure - don't break Netflix
    }
  }

  disableTemporarily() {
    try {
      // Notify background script to temporarily disable
      sendMessageToBackground({
        action: "temporaryDisable",
        reason: "Too many errors",
        duration: 300000, // 5 minutes
      }).catch(() => {
        // Silent failure
      });
    } catch (error) {
      // Silent failure
    }
  }

  reset() {
    this.errorCount = 0;
  }

  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }
}

// Global error handler instance
const errorHandler = new ErrorHandler();

// Skip Button Detection (from previous tasks)
class SkipButtonDetector {
  constructor() {
    this.skipTextPatterns = {
      ja: ["イントロをスキップ", "スキップ", "イントロスキップ"],
      en: ["Skip Intro", "Skip", "Skip intro"],
      es: ["Saltar intro", "Saltar"],
      fr: ["Passer l'intro", "Passer"],
      de: ["Intro überspringen", "Überspringen"],
      pt: ["Pular intro", "Pular"],
      it: ["Salta intro", "Salta"],
      ko: ["인트로 건너뛰기", "건너뛰기"],
      zh: ["跳过片头", "跳过"],
    };

    this.cssSelectors = [
      ".skip-credits-button",
      '[data-uia="player-skip-intro"]',
      ".watch-video--skip-content-button",
      '[data-uia="player-skip-credits"]',
      '.PlayerControlsNeo__button-control-row button[data-uia*="skip"]',
      'button[aria-label*="skip" i]',
      'button[aria-label*="スキップ"]',
    ];

    // Fallback selectors for when primary methods fail
    this.fallbackSelectors = [
      'button:contains("Skip")',
      'button:contains("スキップ")',
      '[role="button"]:contains("Skip")',
      '[role="button"]:contains("スキップ")',
      ".player-controls button",
      ".watch-video button",
      'button[class*="skip"]',
      'button[class*="Skip"]',
    ];

    // Detection method priorities (higher number = higher priority)
    this.detectionMethods = [
      { method: "detectByCssSelector", priority: 3, name: "selector" },
      { method: "detectByText", priority: 2, name: "text" },
      { method: "detectByAriaLabel", priority: 2, name: "aria-label" },
      { method: "detectByFallbackSelectors", priority: 1, name: "fallback" },
      { method: "detectByAdvancedHeuristics", priority: 1, name: "heuristics" },
    ];
  }

  detectButton() {
    try {
      if (!errorHandler.shouldContinue()) {
        return null;
      }

      // Try detection methods in priority order with retry logic
      const sortedMethods = this.detectionMethods.sort(
        (a, b) => b.priority - a.priority
      );

      for (const methodInfo of sortedMethods) {
        try {
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
          console.error(`[DEBUG] Error in method ${methodInfo.method}:`, error);
          errorHandler.handleError(
            error,
            `SkipButtonDetector.${methodInfo.method}`,
            true
          );
          // Continue to next method on error
        }
      }

      return null;
    } catch (error) {
      console.error("[DEBUG] Error in detectButton:", error);
      errorHandler.handleError(error, "SkipButtonDetector.detectButton");
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
    for (const selector of this.cssSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button && this.isValidSkipButton(button)) {
          return button;
        }
      } catch (error) {
        errorHandler.handleError(
          error,
          `SkipButtonDetector.detectByCssSelector(${selector})`,
          true
        );
      }
    }
    return null;
  }

  detectByText() {
    try {
      const buttons = document.querySelectorAll(
        'button, [role="button"], .button'
      );

      for (const button of buttons) {
        try {
          if (this.isValidSkipButton(button)) {
            const text = button.textContent?.trim().toLowerCase() || "";

            for (const patterns of Object.values(this.skipTextPatterns)) {
              for (const pattern of patterns) {
                if (text.includes(pattern.toLowerCase())) {
                  return button;
                }
              }
            }
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            "SkipButtonDetector.detectByText.buttonCheck",
            true
          );
        }
      }
      return null;
    } catch (error) {
      errorHandler.handleError(error, "SkipButtonDetector.detectByText");
      return null;
    }
  }

  detectByAriaLabel() {
    try {
      const elements = document.querySelectorAll("[aria-label]");

      for (const element of elements) {
        try {
          if (this.isValidSkipButton(element)) {
            const ariaLabel =
              element.getAttribute("aria-label")?.toLowerCase() || "";

            for (const patterns of Object.values(this.skipTextPatterns)) {
              for (const pattern of patterns) {
                if (ariaLabel.includes(pattern.toLowerCase())) {
                  return element;
                }
              }
            }
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            "SkipButtonDetector.detectByAriaLabel.elementCheck",
            true
          );
        }
      }
      return null;
    } catch (error) {
      errorHandler.handleError(error, "SkipButtonDetector.detectByAriaLabel");
      return null;
    }
  }

  isValidSkipButton(button) {
    try {
      if (!button || button.style.display === "none" || button.hidden) {
        return false;
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
      errorHandler.handleError(
        error,
        "SkipButtonDetector.isValidSkipButton",
        true
      );
      return false;
    }
  }

  // Fallback detection method using alternative selectors
  detectByFallbackSelectors() {
    try {
      // Use more generic selectors when specific ones fail
      const genericSelectors = [
        'button[class*="skip" i]',
        'button[id*="skip" i]',
        '[role="button"][class*="skip" i]',
        ".player-controls button",
        ".video-controls button",
      ];

      for (const selector of genericSelectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            // Check if button text contains skip-related keywords
            const text = (button.textContent || "").toLowerCase();
            const hasSkipKeyword = [
              "skip",
              "スキップ",
              "intro",
              "イントロ",
            ].some((kw) => text.includes(kw));

            if (hasSkipKeyword && this.isValidSkipButton(button)) {
              return button;
            }
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            `SkipButtonDetector.detectByFallbackSelectors(${selector})`,
            true
          );
        }
      }
      return null;
    } catch (error) {
      errorHandler.handleError(
        error,
        "SkipButtonDetector.detectByFallbackSelectors"
      );
      return null;
    }
  }

  // Advanced heuristics for when all other methods fail
  detectByAdvancedHeuristics() {
    try {
      // Look for buttons that appear during video playback and have skip-like characteristics
      const allButtons = document.querySelectorAll('button, [role="button"]');

      let bestCandidate = null;
      let bestScore = 0.6; // Minimum threshold

      for (const button of allButtons) {
        try {
          if (!this.isValidSkipButton(button)) {
            continue;
          }

          // Check for skip-like characteristics
          const score = this.calculateHeuristicScore(button);
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = button;
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            "SkipButtonDetector.detectByAdvancedHeuristics.buttonCheck",
            true
          );
        }
      }
      return bestCandidate;
    } catch (error) {
      errorHandler.handleError(
        error,
        "SkipButtonDetector.detectByAdvancedHeuristics"
      );
      return null;
    }
  }

  calculateHeuristicScore(button) {
    try {
      let score = 0;

      // Check text content for skip-related keywords
      const text = (button.textContent || "").toLowerCase();
      const skipKeywords = ["skip", "スキップ", "intro", "イントロ"];
      for (const keyword of skipKeywords) {
        if (text.includes(keyword)) {
          score += 0.4;
          break;
        }
      }

      // Check class names and IDs
      const className = (button.className || "").toLowerCase();
      const id = (button.id || "").toLowerCase();
      if (className.includes("skip") || id.includes("skip")) {
        score += 0.3;
      }

      // Check data attributes
      const dataAttrs = Array.from(button.attributes)
        .filter((attr) => attr.name.startsWith("data-"))
        .map((attr) => attr.value.toLowerCase())
        .join(" ");
      if (dataAttrs.includes("skip") || dataAttrs.includes("intro")) {
        score += 0.2;
      }

      // Check position (skip buttons are usually in lower part of screen)
      try {
        const rect = button.getBoundingClientRect();
        if (rect.bottom > window.innerHeight * 0.6) {
          score += 0.1;
        }
      } catch (error) {
        // Ignore positioning errors
      }

      return Math.min(score, 1.0); // Cap at 1.0
    } catch (error) {
      errorHandler.handleError(
        error,
        "SkipButtonDetector.calculateHeuristicScore",
        true
      );
      return 0;
    }
  }
}

// Auto Click Handler (Task 3.1)
class AutoClickHandler {
  constructor(skipButtonDetector, settingsManager) {
    this.skipButtonDetector = skipButtonDetector;
    this.settingsManager = settingsManager;
    this.maxRetries = 3;
    this.retryDelay = 500; // milliseconds
    this.clickTimeout = 1000; // 1 second as per requirements 3.4
    this.fallbackRetries = 2; // Additional retries for fallback methods
  }

  async clickButton(button, retryCount = 0) {
    try {
      if (!errorHandler.shouldContinue()) {
        return false;
      }

      if (!button || !this.skipButtonDetector.isValidSkipButton(button)) {
        console.warn("Invalid button provided for clicking");
        return false;
      }

      // Check if auto-skip is enabled before clicking
      const isEnabled = await this.settingsManager.getEnabled();

      if (!isEnabled) {
        return false;
      }

      // Check timing constraint (1 second from detection)
      const clickPromise = new Promise((resolve) => {
        setTimeout(() => {
          try {
            // Simulate user click with proper event dispatching
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            });

            button.dispatchEvent(clickEvent);

            // Also try direct click as fallback
            if (typeof button.click === "function") {
              button.click();
            }

            resolve(true);
          } catch (error) {
            errorHandler.handleError(
              error,
              "AutoClickHandler.clickButton.clickExecution"
            );
            resolve(false);
          }
        }, Math.min(this.clickTimeout, 100)); // Small delay to ensure button is ready
      });

      const success = await clickPromise;

      if (!success && retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1);
      }

      return success;
    } catch (error) {
      errorHandler.handleError(error, "AutoClickHandler.clickButton");

      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay);
        return this.clickButton(button, retryCount + 1);
      }

      return false;
    }
  }

  async clickWithAlternativeMethods(button, retryCount = 0) {
    try {
      if (!errorHandler.shouldContinue()) {
        return false;
      }

      // Enhanced alternative methods with more sophisticated approaches
      const methods = [
        () => this.clickWithMouseEvent(button),
        () => this.clickWithDirectCall(button),
        () => this.clickWithFocus(button),
        () => this.clickWithKeyboardEvent(button),
        () => this.clickWithTouchEvent(button),
        () => this.clickWithCustomEvent(button),
      ];

      for (let i = 0; i < methods.length; i++) {
        try {
          const success = await methods[i]();
          if (success) {
            return true;
          }

          // Small delay between methods
          await this.delay(50);
        } catch (error) {
          errorHandler.handleError(
            error,
            `AutoClickHandler.clickWithAlternativeMethods.method${i + 1}`,
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
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithAlternativeMethods"
      );
      return false;
    }
  }

  async clickWithMouseEvent(button) {
    try {
      const events = ["mousedown", "mouseup", "click"];

      for (const eventType of events) {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        button.dispatchEvent(event);
      }

      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithMouseEvent",
        true
      );
      return false;
    }
  }

  async clickWithDirectCall(button) {
    try {
      if (typeof button.click === "function") {
        button.click();
        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithDirectCall",
        true
      );
      return false;
    }
  }

  async clickWithFocus(button) {
    try {
      if (typeof button.focus === "function") {
        button.focus();

        // Simulate Enter key press
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        });
        button.dispatchEvent(enterEvent);

        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleError(error, "AutoClickHandler.clickWithFocus", true);
      return false;
    }
  }

  // Additional alternative click methods for enhanced retry mechanism
  async clickWithKeyboardEvent(button) {
    try {
      // Try Space key as alternative to Enter
      if (typeof button.focus === "function") {
        button.focus();

        const spaceEvent = new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          bubbles: true,
          cancelable: true,
        });
        button.dispatchEvent(spaceEvent);

        // Also dispatch keyup for completeness
        const spaceUpEvent = new KeyboardEvent("keyup", {
          key: " ",
          code: "Space",
          bubbles: true,
          cancelable: true,
        });
        button.dispatchEvent(spaceUpEvent);

        return true;
      }
      return false;
    } catch (error) {
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithKeyboardEvent",
        true
      );
      return false;
    }
  }

  async clickWithTouchEvent(button) {
    try {
      // Simulate touch events for mobile-like interaction
      // Use a simpler approach that doesn't rely on Touch constructor
      const rect = button.getBoundingClientRect();

      // Create touch events without Touch constructor (for compatibility)
      const touchStartEvent = new Event("touchstart", {
        bubbles: true,
        cancelable: true,
      });

      const touchEndEvent = new Event("touchend", {
        bubbles: true,
        cancelable: true,
      });

      // Add touch properties manually
      Object.defineProperty(touchStartEvent, "touches", {
        value: [
          {
            clientX: rect.left + 10,
            clientY: rect.top + 10,
            target: button,
          },
        ],
        writable: false,
      });

      Object.defineProperty(touchEndEvent, "changedTouches", {
        value: [
          {
            clientX: rect.left + 10,
            clientY: rect.top + 10,
            target: button,
          },
        ],
        writable: false,
      });

      button.dispatchEvent(touchStartEvent);
      await this.delay(10);
      button.dispatchEvent(touchEndEvent);

      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithTouchEvent",
        true
      );
      return false;
    }
  }

  async clickWithCustomEvent(button) {
    try {
      // Try custom events that might trigger click handlers
      const customEvents = [
        new Event("activate", { bubbles: true, cancelable: true }),
        new Event("trigger", { bubbles: true, cancelable: true }),
        new Event("execute", { bubbles: true, cancelable: true }),
      ];

      for (const event of customEvents) {
        button.dispatchEvent(event);
        await this.delay(10);
      }

      // Also try programmatic form submission if button is in a form
      const form = button.closest("form");
      if (form && typeof form.submit === "function") {
        form.submit();
      }

      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "AutoClickHandler.clickWithCustomEvent",
        true
      );
      return false;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Session State Manager for handling multiple video sessions
class SessionStateManager {
  constructor() {
    this.sessions = new Map(); // videoId -> session state
    this.currentVideoId = null;
    this.sessionIdCounter = 0;
  }

  // Generate a unique session ID for each video
  generateSessionId() {
    return `session_${++this.sessionIdCounter}_${Date.now()}`;
  }

  // Detect current video ID from Netflix page
  getCurrentVideoId() {
    try {
      // Try multiple methods to get video ID
      const url = window.location.href;

      // Method 1: Extract from URL path
      const watchMatch = url.match(/\/watch\/(\d+)/);
      if (watchMatch) {
        return watchMatch[1];
      }

      // Method 2: Extract from URL query parameters
      const titleMatch = url.match(/[?&]title=(\d+)/);
      if (titleMatch) {
        return titleMatch[1];
      }

      // Method 3: Look for Netflix data attributes
      const videoElement = document.querySelector("video");
      if (videoElement) {
        const videoSrc = videoElement.src || videoElement.currentSrc;
        if (videoSrc) {
          const srcMatch = videoSrc.match(/\/(\d+)\//);
          if (srcMatch) {
            return srcMatch[1];
          }
        }
      }

      // Method 4: Look for Netflix-specific elements with video info
      const playerElement = document.querySelector('[data-uia="player"]');
      if (playerElement) {
        const dataAttrs = Array.from(playerElement.attributes)
          .filter((attr) => attr.name.startsWith("data-"))
          .map((attr) => attr.value)
          .join(" ");

        const dataMatch = dataAttrs.match(/(\d{7,})/); // Netflix IDs are typically 7+ digits
        if (dataMatch) {
          return dataMatch[1];
        }
      }

      // Method 5: Fallback to URL-based ID
      return url.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.getCurrentVideoId",
        true
      );
      return "unknown_video";
    }
  }

  // Initialize or get session for current video
  initializeSession() {
    try {
      const videoId = this.getCurrentVideoId();

      // Check if video changed
      if (this.currentVideoId !== videoId) {
        this.currentVideoId = videoId;
      }

      // Get or create session
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
    } catch (error) {
      errorHandler.handleError(error, "SessionStateManager.initializeSession");
      return null;
    }
  }

  // Get current session state
  getCurrentSession() {
    try {
      const videoId = this.getCurrentVideoId();
      return this.sessions.get(videoId) || null;
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.getCurrentSession",
        true
      );
      return null;
    }
  }

  // Update session state
  updateSession(updates) {
    try {
      const session = this.getCurrentSession();
      if (session) {
        Object.assign(session, updates);
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.updateSession",
        true
      );
    }
  }

  // Record skip attempt for current session
  recordSkipAttempt(success, detectionMethod, confidence) {
    try {
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

        // Keep only last 10 detection attempts
        if (session.detectionHistory.length > 10) {
          session.detectionHistory = session.detectionHistory.slice(-10);
        }
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.recordSkipAttempt",
        true
      );
    }
  }

  // Record error for current session
  recordError(error, context) {
    try {
      const session = this.getCurrentSession();
      if (session) {
        session.errors.push({
          timestamp: Date.now(),
          error: error.message,
          context: context,
        });

        // Keep only last 5 errors
        if (session.errors.length > 5) {
          session.errors = session.errors.slice(-5);
        }
      }
    } catch (recordError) {
      errorHandler.handleError(
        recordError,
        "SessionStateManager.recordError",
        true
      );
    }
  }

  // Check if session should allow skip attempt (cooldown logic)
  canAttemptSkip(cooldownMs = 5000) {
    try {
      const session = this.getCurrentSession();
      if (!session) {
        return true; // Allow if no session (first attempt)
      }

      const timeSinceLastAttempt = Date.now() - session.lastSkipAttempt;
      return timeSinceLastAttempt >= cooldownMs;
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.canAttemptSkip",
        true
      );
      return true; // Allow on error
    }
  }

  // Reset session state (for new video)
  resetCurrentSession() {
    try {
      const session = this.getCurrentSession();
      if (session) {
        session.skipAttempts = 0;
        session.lastSkipAttempt = 0;
        session.skipSuccessful = false;
        session.detectionHistory = [];
        session.errors = [];
        session.sessionStartTime = Date.now();
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.resetCurrentSession",
        true
      );
    }
  }

  // Clean up old sessions (memory management)
  cleanupOldSessions(maxAge = 3600000) {
    // 1 hour default
    try {
      const now = Date.now();
      const sessionsToDelete = [];

      for (const [videoId, session] of this.sessions.entries()) {
        if (now - session.sessionStartTime > maxAge) {
          sessionsToDelete.push(videoId);
        }
      }

      for (const videoId of sessionsToDelete) {
        this.sessions.delete(videoId);
      }

      // Also limit total number of sessions
      if (this.sessions.size > 50) {
        const sortedSessions = Array.from(this.sessions.entries()).sort(
          (a, b) => a[1].sessionStartTime - b[1].sessionStartTime
        );

        const toDelete = sortedSessions.slice(0, this.sessions.size - 50);
        for (const [videoId] of toDelete) {
          this.sessions.delete(videoId);
        }
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.cleanupOldSessions",
        true
      );
    }
  }

  // Get session statistics
  getSessionStats() {
    try {
      const session = this.getCurrentSession();
      if (!session) {
        return null;
      }

      return {
        sessionId: session.sessionId,
        videoId: session.videoId,
        skipAttempts: session.skipAttempts,
        skipSuccessful: session.skipSuccessful,
        sessionDuration: Date.now() - session.sessionStartTime,
        detectionMethods: session.detectionHistory.map((h) => h.method),
        errorCount: session.errors.length,
        isActive: session.isActive,
      };
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.getSessionStats",
        true
      );
      return null;
    }
  }

  // Get all sessions (for debugging)
  getAllSessions() {
    try {
      return Array.from(this.sessions.entries()).map(([videoId, session]) => ({
        videoId,
        ...session,
      }));
    } catch (error) {
      errorHandler.handleError(
        error,
        "SessionStateManager.getAllSessions",
        true
      );
      return [];
    }
  }
}

// DOM Monitor (from previous tasks)
class DOMMonitor {
  constructor(skipButtonDetector, autoClickHandler, settingsManager) {
    this.skipButtonDetector = skipButtonDetector;
    this.autoClickHandler = autoClickHandler;
    this.settingsManager = settingsManager;
    this.sessionManager = new SessionStateManager();
    this.observer = null;
    this.isEnabled = true;
    this.debounceTimeout = null;
    this.debounceDelay = 300;
    this.lastSkipAttempt = 0;
    this.skipCooldown = 5000; // 5 seconds between skip attempts
    this.urlChangeObserver = null;
    this.lastUrl = window.location.href;
  }

  start() {
    try {
      if (this.observer) {
        this.stop();
      }

      // Initialize session for current video
      this.sessionManager.initializeSession();

      // Start monitoring URL changes for new video sessions
      this.startUrlChangeMonitoring();

      this.checkForSkipButton();

      this.observer = new MutationObserver((mutations) => {
        try {
          this.handleMutations(mutations);
        } catch (error) {
          errorHandler.handleError(
            error,
            "DOMMonitor.MutationObserver.callback"
          );
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "aria-hidden"],
      });
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.start");
    }
  }

  stop() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = null;
      }

      // Stop URL change monitoring
      this.stopUrlChangeMonitoring();
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.stop", true);
    }
  }

  // Monitor URL changes to detect new video sessions
  startUrlChangeMonitoring() {
    try {
      // Monitor for URL changes (Netflix is a SPA)
      this.urlChangeObserver = new MutationObserver(() => {
        try {
          const currentUrl = window.location.href;
          if (currentUrl !== this.lastUrl) {
            this.lastUrl = currentUrl;
            this.handleUrlChange();
          }
        } catch (error) {
          errorHandler.handleError(error, "DOMMonitor.urlChangeObserver", true);
        }
      });

      // Observe changes to the document title and body that might indicate navigation
      this.urlChangeObserver.observe(document, {
        childList: true,
        subtree: true,
      });

      // Also listen for popstate events
      window.addEventListener("popstate", () => {
        try {
          this.handleUrlChange();
        } catch (error) {
          errorHandler.handleError(error, "DOMMonitor.popstate", true);
        }
      });

      // Listen for pushstate/replacestate (Netflix navigation)
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const self = this; // Store reference to this

      history.pushState = function (...args) {
        originalPushState.apply(history, args);
        setTimeout(() => {
          try {
            self.handleUrlChange();
          } catch (error) {
            errorHandler.handleError(error, "DOMMonitor.pushState", true);
          }
        }, 100);
      };

      history.replaceState = function (...args) {
        originalReplaceState.apply(history, args);
        setTimeout(() => {
          try {
            self.handleUrlChange();
          } catch (error) {
            errorHandler.handleError(error, "DOMMonitor.replaceState", true);
          }
        }, 100);
      };
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.startUrlChangeMonitoring");
    }
  }

  stopUrlChangeMonitoring() {
    try {
      if (this.urlChangeObserver) {
        this.urlChangeObserver.disconnect();
        this.urlChangeObserver = null;
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "DOMMonitor.stopUrlChangeMonitoring",
        true
      );
    }
  }

  // Handle URL change (new video session)
  handleUrlChange() {
    try {
      // Clean up old sessions periodically
      this.sessionManager.cleanupOldSessions();

      // Initialize session for new video
      const newSession = this.sessionManager.initializeSession();

      if (newSession) {
        // Reset skip attempt timing for new video
        this.lastSkipAttempt = 0;

        // Check for skip button after a short delay (let page load)
        setTimeout(() => {
          this.checkForSkipButton();
        }, 1000);
      }
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.handleUrlChange");
    }
  }

  handleMutations(mutations) {
    try {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(() => {
        try {
          this.processMutations(mutations);
        } catch (error) {
          errorHandler.handleError(error, "DOMMonitor.processMutations");
        }
      }, this.debounceDelay);
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.handleMutations");
    }
  }

  processMutations(mutations) {
    try {
      if (!errorHandler.shouldContinue()) {
        return;
      }

      let shouldCheckForSkipButton = false;

      for (const mutation of mutations) {
        try {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (this.couldBeSkipButton(node)) {
                  shouldCheckForSkipButton = true;
                  break;
                }
              }
            }
          } else if (mutation.type === "attributes") {
            const target = mutation.target;
            if (
              target.nodeType === Node.ELEMENT_NODE &&
              this.couldBeSkipButton(target)
            ) {
              shouldCheckForSkipButton = true;
            }
          }

          if (shouldCheckForSkipButton) {
            break;
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            "DOMMonitor.processMutations.mutationLoop",
            true
          );
        }
      }

      if (shouldCheckForSkipButton) {
        this.checkForSkipButton();
      }
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.processMutations");
    }
  }

  couldBeSkipButton(element) {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      const tagName = element.tagName?.toLowerCase();
      if (tagName === "button" || element.getAttribute("role") === "button") {
        return true;
      }

      const text = element.textContent?.toLowerCase() || "";
      const skipKeywords = ["skip", "スキップ", "intro", "イントロ"];

      return skipKeywords.some((keyword) => text.includes(keyword));
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.couldBeSkipButton", true);
      return false;
    }
  }

  async checkForSkipButton(retryCount = 0) {
    try {
      if (!errorHandler.shouldContinue()) {
        return;
      }

      // Initialize session if not exists
      const session = this.sessionManager.initializeSession();
      if (!session) {
        console.warn("Could not initialize session for skip button check");
        return;
      }

      // Check session-based cooldown instead of global cooldown
      if (!this.sessionManager.canAttemptSkip(this.skipCooldown)) {
        return;
      }

      // Check if auto-skip is enabled before proceeding
      const isEnabled = await this.settingsManager.getEnabled();

      if (!isEnabled) {
        return;
      }

      const result = this.skipButtonDetector.detectButton();

      if (result && result.element) {
        const success = await this.autoClickHandler.clickButton(result.element);

        // Record the attempt in session state
        this.sessionManager.recordSkipAttempt(
          success,
          result.detectionMethod,
          result.confidence
        );

        if (success) {
          this.lastSkipAttempt = Date.now();

          // Log activity to background script
          try {
            await sendMessageToBackground({
              action: "logActivity",
              message: "Skip button clicked successfully",
              data: {
                detectionMethod: result.detectionMethod,
                confidence: result.confidence,
                url: window.location.href,
                retryCount: retryCount,
                sessionId: session.sessionId,
                videoId: session.videoId,
                sessionStats: this.sessionManager.getSessionStats(),
              },
            });
          } catch (error) {
            errorHandler.handleError(
              error,
              "DOMMonitor.checkForSkipButton.logActivity",
              true
            );
          }
        } else {
          console.warn(
            `Failed to click skip button (attempt ${
              retryCount + 1
            }) for session ${session.sessionId}`
          );

          // Record error in session
          this.sessionManager.recordError(
            new Error("Click failed"),
            `checkForSkipButton.retry${retryCount}`
          );

          // Retry with a short delay if click failed and we haven't exceeded retry limit
          if (retryCount < 2) {
            // Allow 2 retries for detection/click failures
            setTimeout(() => {
              this.checkForSkipButton(retryCount + 1);
            }, 1000); // 1 second delay before retry
          }
        }
      } else if (retryCount === 0) {
        // If no button detected on first attempt, try once more after a short delay
        // This handles cases where the button appears slightly later
        setTimeout(() => {
          this.checkForSkipButton(1);
        }, 500); // 500ms delay for button to appear
      } else {
        // No skip button found - this is normal behavior, not an error
      }
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.checkForSkipButton");

      // Record error in session
      const session = this.sessionManager.getCurrentSession();
      if (session) {
        this.sessionManager.recordError(
          error,
          `checkForSkipButton.error${retryCount}`
        );
      }

      // Retry on error if we haven't exceeded retry limit
      if (retryCount < 1) {
        setTimeout(() => {
          this.checkForSkipButton(retryCount + 1);
        }, 1000);
      }
    }
  }

  setEnabled(enabled) {
    try {
      this.isEnabled = enabled;
      if (enabled && !this.observer) {
        this.start();
      } else if (!enabled && this.observer) {
        this.stop();
      }
    } catch (error) {
      errorHandler.handleError(error, "DOMMonitor.setEnabled");
    }
  }
}

// UI Interference Prevention (Task 8.3)
class UIInterferencePrevention {
  constructor() {
    this.injectedElements = new Set();
    this.originalNetflixElements = new WeakMap();
    this.preventedInterferences = [];
    this.monitoringActive = false;
  }

  // Ensure no visible UI elements are added to Netflix pages
  preventVisibleUIInjection() {
    try {
      // Override common DOM manipulation methods to prevent visible UI injection
      this.overrideDOMManipulation();

      // Monitor for any accidentally injected elements
      this.startUIMonitoring();

      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.preventVisibleUIInjection"
      );
      return false;
    }
  }

  overrideDOMManipulation() {
    try {
      // Store original methods
      const originalAppendChild = Element.prototype.appendChild;
      const originalInsertBefore = Element.prototype.insertBefore;
      const originalInsertAdjacentElement =
        Element.prototype.insertAdjacentElement;
      const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;

      // Override appendChild to prevent visible element injection
      Element.prototype.appendChild = function (child) {
        if (this.isVisibleUIElement && this.isVisibleUIElement(child)) {
          console.warn(
            "[Netflix Intro Skipper] Prevented visible UI element injection:",
            child
          );
          return child; // Return child without appending
        }
        return originalAppendChild.call(this, child);
      };

      // Override insertBefore to prevent visible element injection
      Element.prototype.insertBefore = function (newNode, referenceNode) {
        if (this.isVisibleUIElement && this.isVisibleUIElement(newNode)) {
          console.warn(
            "[Netflix Intro Skipper] Prevented visible UI element injection:",
            newNode
          );
          return newNode; // Return newNode without inserting
        }
        return originalInsertBefore.call(this, newNode, referenceNode);
      };

      // Override insertAdjacentElement to prevent visible element injection
      Element.prototype.insertAdjacentElement = function (position, element) {
        if (this.isVisibleUIElement && this.isVisibleUIElement(element)) {
          console.warn(
            "[Netflix Intro Skipper] Prevented visible UI element injection:",
            element
          );
          return element; // Return element without inserting
        }
        return originalInsertAdjacentElement.call(this, position, element);
      };

      // Override insertAdjacentHTML to prevent visible HTML injection
      Element.prototype.insertAdjacentHTML = function (position, text) {
        if (this.containsVisibleUI && this.containsVisibleUI(text)) {
          console.warn(
            "[Netflix Intro Skipper] Prevented visible HTML injection:",
            text
          );
          return; // Don't insert the HTML
        }
        return originalInsertAdjacentHTML.call(this, position, text);
      };

      // Add helper methods to check for visible UI elements
      Element.prototype.isVisibleUIElement = function (element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
          return false;
        }

        // Check if element would be visible
        const style = element.style || {};
        const computedStyle = window.getComputedStyle
          ? window.getComputedStyle(element)
          : {};

        // Element is visible if it's not explicitly hidden
        const isVisible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          computedStyle.display !== "none" &&
          computedStyle.visibility !== "hidden" &&
          computedStyle.opacity !== "0";

        // Check if element has dimensions that would make it visible
        const hasVisibleDimensions =
          element.offsetWidth > 0 ||
          element.offsetHeight > 0 ||
          element.clientWidth > 0 ||
          element.clientHeight > 0;

        // Check if element contains visible content
        const hasVisibleContent =
          element.textContent && element.textContent.trim().length > 0;

        // Check if element has background or border that would be visible
        const hasVisibleStyling =
          (computedStyle.backgroundColor &&
            computedStyle.backgroundColor !== "transparent" &&
            computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)") ||
          (computedStyle.borderWidth && computedStyle.borderWidth !== "0px");

        return (
          isVisible &&
          (hasVisibleDimensions || hasVisibleContent || hasVisibleStyling)
        );
      };

      Element.prototype.containsVisibleUI = function (htmlString) {
        if (!htmlString || typeof htmlString !== "string") {
          return false;
        }

        // Check for common visible UI patterns
        const visibleUIPatterns = [
          /<div[^>]*style[^>]*display\s*:\s*block/i,
          /<span[^>]*style[^>]*display\s*:\s*inline/i,
          /<button[^>]*>/i,
          /<input[^>]*>/i,
          /<select[^>]*>/i,
          /<textarea[^>]*>/i,
          /<img[^>]*>/i,
          /<canvas[^>]*>/i,
          /<svg[^>]*>/i,
          /style\s*=\s*["'][^"']*background-color\s*:\s*(?!transparent|rgba\(0,\s*0,\s*0,\s*0\))/i,
          /style\s*=\s*["'][^"']*border\s*:\s*(?!none|0)/i,
        ];

        return visibleUIPatterns.some((pattern) => pattern.test(htmlString));
      };
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.overrideDOMManipulation"
      );
    }
  }

  startUIMonitoring() {
    try {
      if (this.monitoringActive) {
        return;
      }

      this.monitoringActive = true;

      // Monitor for any elements that might be accidentally injected
      const observer = new MutationObserver((mutations) => {
        try {
          this.checkForUIInterference(mutations);
        } catch (error) {
          errorHandler.handleError(
            error,
            "UIInterferencePrevention.MutationObserver",
            true
          );
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "id"],
      });

      // Store observer for cleanup
      this.uiMonitorObserver = observer;
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.startUIMonitoring"
      );
    }
  }

  checkForUIInterference(mutations) {
    try {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              this.validateAddedElement(addedNode);
            }
          }
        } else if (mutation.type === "attributes") {
          this.validateElementAttributes(mutation.target);
        }
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.checkForUIInterference",
        true
      );
    }
  }

  validateAddedElement(element) {
    try {
      // Check if this element was added by our extension
      if (this.isExtensionElement(element)) {
        // If it's a visible element, log and potentially remove it
        if (this.isElementVisible(element)) {
          console.warn(
            "[Netflix Intro Skipper] Detected visible UI element injection by extension:",
            element
          );
          this.preventedInterferences.push({
            type: "visible_element_injection",
            element: element.tagName,
            className: element.className,
            id: element.id,
            timestamp: Date.now(),
          });

          // Remove the element to prevent UI interference
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.validateAddedElement",
        true
      );
    }
  }

  validateElementAttributes(element) {
    try {
      // Check if attribute changes might make an element visible
      if (this.isExtensionElement(element) && this.isElementVisible(element)) {
        console.warn(
          "[Netflix Intro Skipper] Detected visible styling on extension element:",
          element
        );
        this.preventedInterferences.push({
          type: "visible_styling",
          element: element.tagName,
          className: element.className,
          id: element.id,
          timestamp: Date.now(),
        });

        // Hide the element
        element.style.display = "none";
        element.style.visibility = "hidden";
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.validateElementAttributes",
        true
      );
    }
  }

  isExtensionElement(element) {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      // Check for extension-specific markers
      const extensionMarkers = [
        "netflix-intro-skipper",
        "skip-intro-extension",
        "chrome-extension",
      ];

      const className = element.className || "";
      const id = element.id || "";
      const dataAttrs = Array.from(element.attributes || [])
        .filter((attr) => attr.name.startsWith("data-"))
        .map((attr) => attr.value)
        .join(" ");

      const allText = (className + " " + id + " " + dataAttrs).toLowerCase();

      return extensionMarkers.some((marker) => allText.includes(marker));
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.isExtensionElement",
        true
      );
      return false;
    }
  }

  isElementVisible(element) {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      // Check computed styles
      const computedStyle = window.getComputedStyle(element);

      // Element is hidden if any of these conditions are true
      if (
        computedStyle.display === "none" ||
        computedStyle.visibility === "hidden" ||
        computedStyle.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }

      // Check dimensions
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }

      // Element is considered visible
      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.isElementVisible",
        true
      );
      return false;
    }
  }

  // Ensure Netflix functionality is not interfered with
  preventNetflixFunctionInterference() {
    try {
      // Store references to original Netflix functions to prevent interference
      this.preserveNetflixFunctions();

      // Monitor for any interference with Netflix controls
      this.monitorNetflixControls();

      return true;
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.preventNetflixFunctionInterference"
      );
      return false;
    }
  }

  preserveNetflixFunctions() {
    try {
      // Preserve common Netflix player functions
      const netflixElements = document.querySelectorAll(
        "[data-uia], .player-controls, .watch-video"
      );

      netflixElements.forEach((element) => {
        // Store original event listeners and properties
        if (element.onclick) {
          this.originalNetflixElements.set(element, {
            onclick: element.onclick,
            preserved: true,
          });
        }
      });
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.preserveNetflixFunctions",
        true
      );
    }
  }

  monitorNetflixControls() {
    try {
      // Monitor Netflix control elements for interference
      const controlSelectors = [
        ".player-controls",
        ".watch-video--player-view",
        '[data-uia="player"]',
        '[data-uia="control-row"]',
        ".PlayerControlsNeo__all-controls",
        ".PlayerControlsNeo__button-control-row",
      ];

      controlSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          this.protectNetflixElement(element);
        });
      });
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.monitorNetflixControls",
        true
      );
    }
  }

  protectNetflixElement(element) {
    try {
      if (!element) return;

      // Add protection against accidental modification
      const originalStyle = element.style.cssText;
      const originalClassName = element.className;

      // Monitor for changes to protected elements
      const protectionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes") {
            // Restore original attributes if they were modified by extension
            if (
              mutation.attributeName === "style" &&
              element.style.cssText !== originalStyle
            ) {
              console.warn(
                "[Netflix Intro Skipper] Restored Netflix element styling"
              );
              element.style.cssText = originalStyle;
            }
            if (
              mutation.attributeName === "class" &&
              element.className !== originalClassName
            ) {
              console.warn(
                "[Netflix Intro Skipper] Restored Netflix element class"
              );
              element.className = originalClassName;
            }
          }
        });
      });

      protectionObserver.observe(element, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.protectNetflixElement",
        true
      );
    }
  }

  // Get interference prevention status
  getInterferenceStatus() {
    try {
      return {
        monitoringActive: this.monitoringActive,
        preventedInterferences: [...this.preventedInterferences],
        injectedElementsCount: this.injectedElements.size,
        protectedElementsCount: this.originalNetflixElements.size || 0,
      };
    } catch (error) {
      errorHandler.handleError(
        error,
        "UIInterferencePrevention.getInterferenceStatus"
      );
      return {
        monitoringActive: false,
        preventedInterferences: [],
        injectedElementsCount: 0,
        protectedElementsCount: 0,
        error: error.message,
      };
    }
  }

  // Cleanup method
  cleanup() {
    try {
      this.monitoringActive = false;

      if (this.uiMonitorObserver) {
        this.uiMonitorObserver.disconnect();
        this.uiMonitorObserver = null;
      }

      // Clear collections
      this.injectedElements.clear();
      this.preventedInterferences = [];
    } catch (error) {
      errorHandler.handleError(error, "UIInterferencePrevention.cleanup", true);
    }
  }
}

// Domain Filter for Netflix domains (Task 8.1)
class NetflixDomainFilter {
  constructor() {
    // Comprehensive list of Netflix domains including regional variants
    this.allowedDomains = [
      // Main Netflix domains
      "netflix.com",
      "www.netflix.com",

      // Regional Netflix domains
      "netflix.ca", // Canada
      "netflix.co.uk", // United Kingdom
      "netflix.de", // Germany
      "netflix.fr", // France
      "netflix.it", // Italy
      "netflix.es", // Spain
      "netflix.nl", // Netherlands
      "netflix.be", // Belgium
      "netflix.ch", // Switzerland
      "netflix.at", // Austria
      "netflix.se", // Sweden
      "netflix.no", // Norway
      "netflix.dk", // Denmark
      "netflix.fi", // Finland
      "netflix.pl", // Poland
      "netflix.cz", // Czech Republic
      "netflix.hu", // Hungary
      "netflix.ro", // Romania
      "netflix.bg", // Bulgaria
      "netflix.hr", // Croatia
      "netflix.si", // Slovenia
      "netflix.sk", // Slovakia
      "netflix.lt", // Lithuania
      "netflix.lv", // Latvia
      "netflix.ee", // Estonia
      "netflix.ie", // Ireland
      "netflix.pt", // Portugal
      "netflix.gr", // Greece
      "netflix.cy", // Cyprus
      "netflix.mt", // Malta
      "netflix.lu", // Luxembourg
      "netflix.is", // Iceland
      "netflix.li", // Liechtenstein
      "netflix.mc", // Monaco
      "netflix.sm", // San Marino
      "netflix.va", // Vatican City
      "netflix.ad", // Andorra

      // Asia-Pacific
      "netflix.co.jp", // Japan
      "netflix.co.kr", // South Korea
      "netflix.com.au", // Australia
      "netflix.co.nz", // New Zealand
      "netflix.com.sg", // Singapore
      "netflix.com.my", // Malaysia
      "netflix.co.th", // Thailand
      "netflix.com.ph", // Philippines
      "netflix.co.id", // Indonesia
      "netflix.com.vn", // Vietnam
      "netflix.com.tw", // Taiwan
      "netflix.com.hk", // Hong Kong
      "netflix.co.in", // India
      "netflix.com.pk", // Pakistan
      "netflix.com.bd", // Bangladesh
      "netflix.lk", // Sri Lanka
      "netflix.com.np", // Nepal
      "netflix.bt", // Bhutan
      "netflix.mv", // Maldives

      // Americas
      "netflix.com.mx", // Mexico
      "netflix.com.br", // Brazil
      "netflix.com.ar", // Argentina
      "netflix.cl", // Chile
      "netflix.com.co", // Colombia
      "netflix.com.pe", // Peru
      "netflix.com.ve", // Venezuela
      "netflix.com.ec", // Ecuador
      "netflix.com.bo", // Bolivia
      "netflix.com.py", // Paraguay
      "netflix.com.uy", // Uruguay
      "netflix.com.gf", // French Guiana
      "netflix.sr", // Suriname
      "netflix.gy", // Guyana

      // Caribbean
      "netflix.com.do", // Dominican Republic
      "netflix.com.pr", // Puerto Rico
      "netflix.com.cu", // Cuba
      "netflix.ht", // Haiti
      "netflix.jm", // Jamaica
      "netflix.tt", // Trinidad and Tobago
      "netflix.bb", // Barbados
      "netflix.gd", // Grenada
      "netflix.lc", // Saint Lucia
      "netflix.vc", // Saint Vincent and the Grenadines
      "netflix.ag", // Antigua and Barbuda
      "netflix.kn", // Saint Kitts and Nevis
      "netflix.dm", // Dominica
      "netflix.bs", // Bahamas
      "netflix.bz", // Belize
      "netflix.cr", // Costa Rica
      "netflix.gt", // Guatemala
      "netflix.hn", // Honduras
      "netflix.ni", // Nicaragua
      "netflix.pa", // Panama
      "netflix.sv", // El Salvador

      // Middle East & Africa
      "netflix.com.tr", // Turkey
      "netflix.co.il", // Israel
      "netflix.com.sa", // Saudi Arabia
      "netflix.ae", // United Arab Emirates
      "netflix.com.kw", // Kuwait
      "netflix.com.qa", // Qatar
      "netflix.bh", // Bahrain
      "netflix.om", // Oman
      "netflix.jo", // Jordan
      "netflix.lb", // Lebanon
      "netflix.com.eg", // Egypt
      "netflix.co.za", // South Africa
      "netflix.com.ng", // Nigeria
      "netflix.co.ke", // Kenya
      "netflix.com.gh", // Ghana
      "netflix.co.ug", // Uganda
      "netflix.co.tz", // Tanzania
      "netflix.co.zw", // Zimbabwe
      "netflix.co.zm", // Zambia
      "netflix.co.bw", // Botswana
      "netflix.na", // Namibia
      "netflix.sz", // Eswatini
      "netflix.ls", // Lesotho
      "netflix.mw", // Malawi
      "netflix.mz", // Mozambique
      "netflix.mg", // Madagascar
      "netflix.mu", // Mauritius
      "netflix.sc", // Seychelles
      "netflix.com.et", // Ethiopia
      "netflix.so", // Somalia
      "netflix.dj", // Djibouti
      "netflix.er", // Eritrea
      "netflix.sd", // Sudan
      "netflix.ss", // South Sudan
      "netflix.td", // Chad
      "netflix.cf", // Central African Republic
      "netflix.cm", // Cameroon
      "netflix.ga", // Gabon
      "netflix.gq", // Equatorial Guinea
      "netflix.st", // São Tomé and Príncipe
      "netflix.cv", // Cape Verde
      "netflix.gw", // Guinea-Bissau
      "netflix.gn", // Guinea
      "netflix.sl", // Sierra Leone
      "netflix.lr", // Liberia
      "netflix.ci", // Côte d'Ivoire
      "netflix.bf", // Burkina Faso
      "netflix.ml", // Mali
      "netflix.ne", // Niger
      "netflix.sn", // Senegal
      "netflix.gm", // Gambia
      "netflix.mr", // Mauritania
      "netflix.ma", // Morocco
      "netflix.dz", // Algeria
      "netflix.tn", // Tunisia
      "netflix.ly", // Libya
    ];

    // Pattern-based matching for subdomains
    this.domainPatterns = [
      /^(www\.)?netflix\.com$/,
      /^[a-z0-9-]+\.netflix\.com$/, // Subdomains of netflix.com
      /^netflix\.[a-z]{2,3}$/, // Country code TLDs
      /^netflix\.co\.[a-z]{2}$/, // .co.xx domains
      /^netflix\.com\.[a-z]{2}$/, // .com.xx domains
    ];
  }

  isNetflixDomain(hostname = window.location.hostname) {
    try {
      if (!hostname) {
        return false;
      }

      // Normalize hostname (remove www. prefix for comparison)
      const normalizedHostname = hostname.toLowerCase().replace(/^www\./, "");

      // Check exact matches first (most common case)
      if (
        this.allowedDomains.includes(normalizedHostname) ||
        this.allowedDomains.includes(hostname.toLowerCase())
      ) {
        return true;
      }

      // Check pattern matches for flexibility
      for (const pattern of this.domainPatterns) {
        if (pattern.test(hostname.toLowerCase())) {
          return true;
        }
      }

      return false;
    } catch (error) {
      errorHandler.handleError(
        error,
        "NetflixDomainFilter.isNetflixDomain",
        true
      );
      return false;
    }
  }

  getAllowedDomains() {
    return [...this.allowedDomains];
  }

  // Check if current page is on Netflix and ready for extension
  isValidNetflixPage() {
    try {
      // Check domain first
      if (!this.isNetflixDomain()) {
        return false;
      }

      // Additional checks for Netflix video pages
      const url = window.location.href.toLowerCase();

      // Check if we're on a video watch page or browse page where intros might appear
      const validPaths = [
        "/watch/",
        "/browse",
        "/latest",
        "/my-list",
        "/search",
        "/title/",
        "/player",
      ];

      const isValidPath = validPaths.some((path) => url.includes(path));

      // Also check for presence of Netflix-specific elements
      const hasNetflixElements =
        document.querySelector(".netflix-sans") ||
        document.querySelector("[data-uia]") ||
        document.querySelector(".player-controls") ||
        document.querySelector(".watch-video");

      return isValidPath || hasNetflixElements;
    } catch (error) {
      errorHandler.handleError(
        error,
        "NetflixDomainFilter.isValidNetflixPage",
        true
      );
      return this.isNetflixDomain(); // Fallback to basic domain check
    }
  }

  // Log domain information for debugging
  logDomainInfo() {
    try {
      const hostname = window.location.hostname;
      const isValid = this.isNetflixDomain(hostname);
      const isValidPage = this.isValidNetflixPage();

      return {
        hostname,
        isNetflixDomain: isValid,
        isValidNetflixPage: isValidPage,
        url: window.location.href,
      };
    } catch (error) {
      errorHandler.handleError(
        error,
        "NetflixDomainFilter.logDomainInfo",
        true
      );
      return null;
    }
  }
}

// Main initialization with Integration Manager
(async function initializeNetflixIntroSkipper() {
  try {
    // Initialize domain filter
    const domainFilter = new NetflixDomainFilter();

    // Check if we're on a valid Netflix domain and page
    if (!domainFilter.isValidNetflixPage()) {
      const domainInfo = domainFilter.logDomainInfo();
      return;
    }

    // Initialize Integration Manager
    const integrationManager = new IntegrationManager();
    await integrationManager.initialize();

    // Initialize UI interference prevention
    const uiInterferencePrevention = new UIInterferencePrevention();
    uiInterferencePrevention.preventVisibleUIInjection();
    uiInterferencePrevention.preventNetflixFunctionInterference();

    // Register with background script
    const registrationResponse = await sendMessageToBackground({
      action: "contentScriptReady",
    });

    if (!registrationResponse.success) {
      // Only log error if it's not a silent failure (like extension reload)
      if (!registrationResponse.silent) {
        errorHandler.handleError(
          new Error(registrationResponse.error),
          "initializeNetflixIntroSkipper.registration",
          true // Silent - don't spam console
        );
      }
      // Continue initialization even if registration fails
      // The extension can still work without background communication
    }

    // Create content script settings manager that communicates with background
    class ContentSettingsManager {
      constructor() {
        this.defaultSettings = {
          autoSkipEnabled: true,
        };
        this.cachedSettings = null;
        this.cacheExpiry = 0;
        this.cacheTimeout = 30000; // 30 seconds cache
      }

      async getEnabled() {
        try {
          const settings = await this.getSettings();
          return settings.autoSkipEnabled;
        } catch (error) {
          errorHandler.handleError(error, "ContentSettingsManager.getEnabled");
          return this.defaultSettings.autoSkipEnabled;
        }
      }

      async setEnabled(enabled) {
        try {
          const response = await this.sendMessage({
            action: "setEnabled",
            enabled: enabled,
          });

          if (response.success) {
            // Update cache
            if (this.cachedSettings) {
              this.cachedSettings.autoSkipEnabled = enabled;
            }
          } else {
            // Check if it's an extension context error
            if (
              response.silent ||
              (response.error &&
                response.error.includes("Extension context invalidated"))
            ) {
              // Update cache silently and return
              if (this.cachedSettings) {
                this.cachedSettings.autoSkipEnabled = enabled;
              }
              return;
            }

            errorHandler.handleError(
              new Error(response.error),
              "ContentSettingsManager.setEnabled.response",
              true
            );
            throw new Error(response.error);
          }
        } catch (error) {
          // Check if it's an extension context error
          const errorMessage =
            error?.message || error?.toString() || String(error);
          const isContextError =
            errorMessage.includes("Extension context invalidated") ||
            errorMessage.includes("Could not establish connection");

          errorHandler.handleError(
            error,
            "ContentSettingsManager.setEnabled",
            isContextError
          );

          if (!isContextError) {
            throw error;
          }
        }
      }

      async getSettings() {
        try {
          // Check cache first
          const now = Date.now();
          if (this.cachedSettings && now < this.cacheExpiry) {
            return this.cachedSettings;
          }

          const response = await this.sendMessage({ action: "getSettings" });

          if (response.success) {
            // Update cache
            this.cachedSettings = response.settings;
            this.cacheExpiry = now + this.cacheTimeout;
            return response.settings;
          } else {
            // Check if it's an extension context error
            if (
              response.silent ||
              (response.error &&
                response.error.includes("Extension context invalidated"))
            ) {
              // Return cached settings or defaults silently
              return this.cachedSettings || this.defaultSettings;
            }

            errorHandler.handleError(
              new Error(response.error),
              "ContentSettingsManager.getSettings.response",
              true // Silent for extension context errors
            );
            return this.defaultSettings;
          }
        } catch (error) {
          // Check if it's an extension context error
          const errorMessage =
            error?.message || error?.toString() || String(error);
          const isContextError =
            errorMessage.includes("Extension context invalidated") ||
            errorMessage.includes("Could not establish connection");

          errorHandler.handleError(
            error,
            "ContentSettingsManager.getSettings",
            isContextError // Silent if it's a context error
          );
          return this.cachedSettings || this.defaultSettings;
        }
      }

      sendMessage(message) {
        return new Promise((resolve) => {
          try {
            if (
              typeof chrome !== "undefined" &&
              chrome.runtime &&
              chrome.runtime.id
            ) {
              chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                  // Handle common Chrome extension errors gracefully
                  const errorMessage = chrome.runtime.lastError.message;
                  if (
                    errorMessage.includes("Extension context invalidated") ||
                    errorMessage.includes("Could not establish connection")
                  ) {
                    // Extension was reloaded or disabled - fail silently
                    resolve({
                      success: false,
                      error: "Extension context invalidated",
                      silent: true,
                    });
                  } else {
                    resolve({
                      success: false,
                      error: errorMessage,
                    });
                  }
                } else {
                  resolve(response || { success: false, error: "No response" });
                }
              });
            } else {
              resolve({
                success: false,
                error: "Chrome runtime not available",
                silent: true,
              });
            }
          } catch (error) {
            errorHandler.handleError(
              error,
              "ContentSettingsManager.sendMessage",
              true
            );
            resolve({ success: false, error: error.message });
          }
        });
      }

      // Listen for settings changes from background script
      onSettingsChanged(callback) {
        try {
          if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.onMessage.addListener(
              (request, sender, sendResponse) => {
                try {
                  if (request.action === "settingsChanged") {
                    // Update cache
                    this.cachedSettings = request.settings;
                    this.cacheExpiry = Date.now() + this.cacheTimeout;

                    // Call the callback
                    callback(request.settings, request.changedSettings);
                    sendResponse({ success: true });
                  }
                } catch (error) {
                  errorHandler.handleError(
                    error,
                    "ContentSettingsManager.onSettingsChanged.callback",
                    true
                  );
                  sendResponse({ success: false, error: error.message });
                }
              }
            );
          }
        } catch (error) {
          errorHandler.handleError(
            error,
            "ContentSettingsManager.onSettingsChanged"
          );
        }
      }
    }

    const settingsManager = new ContentSettingsManager();
    const skipButtonDetector = new SkipButtonDetector();
    const autoClickHandler = new AutoClickHandler(
      skipButtonDetector,
      settingsManager
    );
    const domMonitor = new DOMMonitor(
      skipButtonDetector,
      autoClickHandler,
      settingsManager
    );

    // Register components with integration manager
    integrationManager.registerComponent("settingsManager", settingsManager);
    integrationManager.registerComponent(
      "skipButtonDetector",
      skipButtonDetector
    );
    integrationManager.registerComponent("autoClickHandler", autoClickHandler);
    integrationManager.registerComponent("domMonitor", domMonitor);
    integrationManager.registerComponent(
      "uiInterferencePrevention",
      uiInterferencePrevention
    );
    integrationManager.registerComponent("domainFilter", domainFilter);

    // Check if auto-skip is enabled
    const isEnabled = await settingsManager.getEnabled();

    if (isEnabled) {
      domMonitor.start();
    }

    // Enhanced settings change handler with integration manager
    settingsManager.onSettingsChanged((newSettings, changedSettings) => {
      try {
        if (changedSettings.autoSkipEnabled !== undefined) {
          const newValue = changedSettings.autoSkipEnabled;
          domMonitor.setEnabled(newValue);
        }

        // Notify integration manager of settings change
        integrationManager.broadcastMessage({
          type: "settings_changed",
          settings: newSettings,
          changedSettings: changedSettings,
          timestamp: Date.now(),
        });
      } catch (error) {
        errorHandler.handleError(
          error,
          "initializeNetflixIntroSkipper.settingsChanged"
        );
      }
    });

    // Handle page unload - notify background script and cleanup
    window.addEventListener("beforeunload", () => {
      try {
        // Cleanup UI interference prevention
        uiInterferencePrevention.cleanup();

        // Cleanup integration manager
        integrationManager.cleanup();

        sendMessageToBackground({ action: "contentScriptDisconnected" });
      } catch (error) {
        errorHandler.handleError(
          error,
          "initializeNetflixIntroSkipper.beforeunload",
          true
        );
      }
    });

    // Enhanced global reference for debugging with integration manager
    window.netflixIntroSkipper = {
      domMonitor,
      skipButtonDetector,
      autoClickHandler,
      settingsManager,
      errorHandler,
      domainFilter,
      uiInterferencePrevention,
      integrationManager,
      sessionManager: domMonitor.sessionManager,
      // Utility functions for debugging
      async getStatus() {
        try {
          const settings = await settingsManager.getSettings();
          const domainInfo = domainFilter.logDomainInfo();
          const interferenceStatus =
            uiInterferencePrevention.getInterferenceStatus();
          const sessionStats = domMonitor.sessionManager.getSessionStats();
          const integrationStatus = integrationManager.getStatus();
          return {
            enabled: settings.autoSkipEnabled,
            monitoring: domMonitor.observer !== null,
            lastSkipAttempt: domMonitor.lastSkipAttempt,
            connectedToBackground: true,
            errorCount: errorHandler.errorCount,
            shouldContinue: errorHandler.shouldContinue(),
            domainInfo: domainInfo,
            interferenceStatus: interferenceStatus,
            currentSession: sessionStats,
            allSessions: domMonitor.sessionManager.getAllSessions(),
            integration: integrationStatus,
          };
        } catch (error) {
          errorHandler.handleError(error, "netflixIntroSkipper.getStatus");
          return { error: error.message };
        }
      },
      async toggleEnabled() {
        try {
          const currentSettings = await settingsManager.getSettings();
          const newState = !currentSettings.autoSkipEnabled;
          await settingsManager.setEnabled(newState);
          return newState;
        } catch (error) {
          errorHandler.handleError(error, "netflixIntroSkipper.toggleEnabled");
          throw error;
        }
      },
      resetErrors() {
        errorHandler.reset();
      },
      // Integration manager utilities
      async getIntegrationStatus() {
        return integrationManager.getStatus();
      },
      async sendToComponent(componentName, message) {
        return await integrationManager.sendToComponent(componentName, message);
      },
      async broadcastMessage(message) {
        return await integrationManager.broadcastMessage(message);
      },
    };
  } catch (error) {
    errorHandler.handleError(error, "initializeNetflixIntroSkipper");

    // Log error to background script for debugging
    try {
      await sendMessageToBackground({
        action: "logActivity",
        message: "Content script initialization error",
        data: { error: error.message, stack: error.stack },
      });
    } catch (logError) {
      errorHandler.handleError(
        logError,
        "initializeNetflixIntroSkipper.logError",
        true
      );
    }
  }
})();

// Utility function for sending messages to background script
function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.id
      ) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            // Handle common Chrome extension errors gracefully
            const errorMessage = chrome.runtime.lastError.message;
            if (
              errorMessage.includes("Extension context invalidated") ||
              errorMessage.includes("Could not establish connection")
            ) {
              // Extension was reloaded or disabled - fail silently
              resolve({
                success: false,
                error: "Extension context invalidated",
                silent: true,
              });
            } else {
              resolve({
                success: false,
                error: errorMessage,
              });
            }
          } else {
            resolve(response || { success: false, error: "No response" });
          }
        });
      } else {
        resolve({
          success: false,
          error: "Chrome runtime not available",
          silent: true,
        });
      }
    } catch (error) {
      errorHandler.handleError(error, "sendMessageToBackground", true);
      resolve({ success: false, error: error.message });
    }
  });
}
