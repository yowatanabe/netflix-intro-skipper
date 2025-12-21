// Netflix Intro Skipper - Popup Script
// Handles settings toggle interface and user interactions

class PopupController {
  constructor() {
    this.toggle = document.getElementById("autoSkipToggle");
    this.statusText = document.getElementById("statusText");
    this.versionInfo = document.getElementById("versionInfo");
    this.isInitialized = false;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.init();
  }

  handleError(error, context = "unknown", silent = false) {
    try {
      this.errorCount++;

      // Handle different error types
      let errorMessage;
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error && error.message) {
        errorMessage = error.message;
      } else if (error && typeof error === "object") {
        errorMessage = JSON.stringify(error);
      } else {
        errorMessage = String(error) || "Unknown error";
      }

      const errorInfo = {
        message: errorMessage,
        context: context,
        timestamp: new Date().toISOString(),
        errorCount: this.errorCount,
      };

      if (!silent) {
        console.error(
          `[Netflix Intro Skipper Popup] Error in ${context}:`,
          errorMessage,
          error
        );
      }

      // Update UI to show error state
      if (this.errorCount < this.maxErrors) {
        this.updateStatusText("Error occurred, retrying...");
      } else {
        this.updateStatusText("Multiple errors occurred");
      }

      return false;
    } catch (handlerError) {
      console.warn(
        "[Netflix Intro Skipper Popup] Error handler failed:",
        handlerError.message
      );
      return false;
    }
  }

  async init() {
    try {
      // Load version information first
      this.loadVersionInfo();

      // Load current settings and update UI
      await this.loadSettings();

      // Set up event listeners
      this.setupEventListeners();

      // Listen for settings changes from other sources
      this.setupSettingsListener();

      this.isInitialized = true;
    } catch (error) {
      this.handleError(error, "PopupController.init");
      this.updateStatusText("Error loading settings");
    }
  }

  loadVersionInfo() {
    try {
      // Get version from manifest.json
      const manifest = chrome.runtime.getManifest();
      const version = manifest.version;

      if (this.versionInfo) {
        this.versionInfo.textContent = `v${version}`;
      }
    } catch (error) {
      this.handleError(error, "PopupController.loadVersionInfo", true);
      if (this.versionInfo) {
        this.versionInfo.textContent = "v?.?.?";
      }
    }
  }

  async loadSettings() {
    try {
      // Get settings from background script
      const response = await this.sendMessage({ action: "getSettings" });

      if (response.success) {
        const settings = response.settings;
        this.updateToggleUI(settings.autoSkipEnabled);
        this.updateStatusText(
          settings.autoSkipEnabled ? "Auto-skip enabled" : "Auto-skip disabled"
        );

        // Also get integration status for enhanced debugging
        const integrationResponse = await this.sendMessage({
          action: "getIntegrationStatus",
        });
        if (integrationResponse.success) {
        }
      } else {
        // Create a more descriptive error message
        const errorMsg = response.error || "Failed to load settings";
        this.handleError(errorMsg, "PopupController.loadSettings.response");
        // Default to enabled if we can't load settings
        this.updateToggleUI(true);
        this.updateStatusText("Using default settings");
      }
    } catch (error) {
      this.handleError(error, "PopupController.loadSettings");
      // Default to enabled if we can't load settings
      this.updateToggleUI(true);
      this.updateStatusText("Error loading settings");
    }
  }

  updateToggleUI(enabled) {
    try {
      if (enabled) {
        this.toggle.classList.add("enabled");
      } else {
        this.toggle.classList.remove("enabled");
      }
    } catch (error) {
      this.handleError(error, "PopupController.updateToggleUI", true);
    }
  }

  updateStatusText(text) {
    try {
      if (this.statusText) {
        this.statusText.textContent = text;
      }
    } catch (error) {
      this.handleError(error, "PopupController.updateStatusText", true);
    }
  }

  setupEventListeners() {
    try {
      this.toggle.addEventListener("click", async () => {
        try {
          // Get current state
          const isCurrentlyEnabled = this.toggle.classList.contains("enabled");
          const newState = !isCurrentlyEnabled;

          // Show loading state
          this.updateStatusText("Updating...");

          // Update backend
          const response = await this.sendMessage({
            action: "setEnabled",
            enabled: newState,
          });

          if (response.success) {
            // Update UI
            this.updateToggleUI(newState);
            this.updateStatusText(
              newState ? "Auto-skip enabled" : "Auto-skip disabled"
            );
          } else {
            this.handleError(
              new Error(response.error),
              "PopupController.toggleClick.response"
            );
            this.updateStatusText("Error updating setting");
          }
        } catch (error) {
          this.handleError(error, "PopupController.toggleClick");
          this.updateStatusText("Error updating setting");
        }
      });
    } catch (error) {
      this.handleError(error, "PopupController.setupEventListeners");
    }
  }

  setupSettingsListener() {
    try {
      // Listen for settings changes from background script
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          if (
            request.action === "settingsChanged" ||
            request.type === "settings_changed"
          ) {
            if (
              request.changedSettings &&
              request.changedSettings.autoSkipEnabled !== undefined
            ) {
              this.updateToggleUI(request.changedSettings.autoSkipEnabled);
              this.updateStatusText(
                request.changedSettings.autoSkipEnabled
                  ? "Auto-skip enabled"
                  : "Auto-skip disabled"
              );
            }

            sendResponse({ success: true });
          } else if (request.action === "broadcastMessage") {
            // Handle broadcast messages from integration manager
            sendResponse({ success: true });
          }
        } catch (error) {
          this.handleError(
            error,
            "PopupController.settingsListener.callback",
            true
          );
          sendResponse({ success: false, error: error.message });
        }
      });
    } catch (error) {
      this.handleError(error, "PopupController.setupSettingsListener");
    }
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        this.handleError(error, "PopupController.sendMessage", true);
        resolve({ success: false, error: error.message });
      }
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  try {
    new PopupController();
  } catch (error) {
    console.error("[Netflix Intro Skipper Popup] Failed to initialize:", error);
  }
});
