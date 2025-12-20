// Netflix Intro Skipper - Settings Storage Module
// Handles Chrome Storage API integration and settings persistence

/**
 * Settings Storage Module
 * Provides interface for managing extension settings with Chrome Storage API
 */
class SettingsManager {
  constructor() {
    this.defaultSettings = {
      autoSkipEnabled: true,
      lastUpdated: Date.now(),
    };
    this.errorCount = 0;
    this.maxErrors = 10;
  }

  handleError(error, context = "unknown", silent = false) {
    try {
      this.errorCount++;

      const errorInfo = {
        message: error.message || "Unknown error",
        context: context,
        timestamp: new Date().toISOString(),
        errorCount: this.errorCount,
      };

      if (!silent) {
        console.error(
          `[Netflix Intro Skipper Settings] Error in ${context}:`,
          error.message || error.toString(),
          errorInfo
        );
      }

      return false;
    } catch (handlerError) {
      console.warn(
        "[Netflix Intro Skipper Settings] Error handler failed:",
        handlerError.message
      );
      return false;
    }
  }

  /**
   * Get current settings from Chrome storage
   * @returns {Promise<Object>} Current settings object
   */
  async getSettings() {
    try {
      if (this.errorCount >= this.maxErrors) {
        console.warn(
          "[Netflix Intro Skipper Settings] Too many errors, using defaults"
        );
        return this.defaultSettings;
      }

      const result = await chrome.storage.sync.get(this.defaultSettings);
      return result;
    } catch (error) {
      this.handleError(error, "SettingsManager.getSettings");
      return this.defaultSettings;
    }
  }

  /**
   * Get auto-skip enabled status
   * @returns {Promise<boolean>} Whether auto-skip is enabled
   */
  async getEnabled() {
    try {
      const settings = await this.getSettings();
      return settings.autoSkipEnabled;
    } catch (error) {
      this.handleError(error, "SettingsManager.getEnabled");
      return this.defaultSettings.autoSkipEnabled;
    }
  }

  /**
   * Set auto-skip enabled status
   * @param {boolean} enabled - Whether auto-skip should be enabled
   * @returns {Promise<void>}
   */
  async setEnabled(enabled) {
    try {
      if (this.errorCount >= this.maxErrors) {
        throw new Error("Settings manager disabled due to too many errors");
      }

      const settings = await this.getSettings();
      const updatedSettings = {
        ...settings,
        autoSkipEnabled: enabled,
        lastUpdated: Date.now(),
      };
      await chrome.storage.sync.set(updatedSettings);
    } catch (error) {
      this.handleError(error, "SettingsManager.setEnabled");
      throw error;
    }
  }

  /**
   * Update multiple settings at once
   * @param {Object} newSettings - Settings to update
   * @returns {Promise<void>}
   */
  async updateSettings(newSettings) {
    try {
      if (this.errorCount >= this.maxErrors) {
        throw new Error("Settings manager disabled due to too many errors");
      }

      const currentSettings = await this.getSettings();
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        lastUpdated: Date.now(),
      };
      await chrome.storage.sync.set(updatedSettings);
    } catch (error) {
      this.handleError(error, "SettingsManager.updateSettings");
      throw error;
    }
  }

  /**
   * Listen for settings changes
   * @param {Function} callback - Callback function to execute on settings change
   */
  onSettingsChanged(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        try {
          if (namespace === "sync") {
            const settingsChanged = Object.keys(changes).some((key) =>
              ["autoSkipEnabled", "lastUpdated"].includes(key)
            );

            if (settingsChanged) {
              // Get the new values
              const newSettings = {};
              Object.keys(changes).forEach((key) => {
                if (changes[key].newValue !== undefined) {
                  newSettings[key] = changes[key].newValue;
                }
              });
              callback(newSettings);
            }
          }
        } catch (error) {
          this.handleError(
            error,
            "SettingsManager.onSettingsChanged.callback",
            true
          );
        }
      });
    } catch (error) {
      this.handleError(error, "SettingsManager.onSettingsChanged");
    }
  }

  /**
   * Reset settings to default values
   * @returns {Promise<void>}
   */
  async resetSettings() {
    try {
      await chrome.storage.sync.set(this.defaultSettings);
      this.errorCount = 0; // Reset error count on successful reset
    } catch (error) {
      this.handleError(error, "SettingsManager.resetSettings");
      throw error;
    }
  }

  /**
   * Reset error count (for recovery)
   */
  resetErrors() {
    this.errorCount = 0;
  }

  /**
   * Check if settings manager is functional
   * @returns {boolean} Whether the settings manager should continue operating
   */
  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }
}

// Export for use in other modules
// Only export to window if we're in a browser context (not service worker)
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = SettingsManager;
  } else if (typeof window !== "undefined" && window) {
    window.SettingsManager = SettingsManager;
  } else if (typeof self !== "undefined" && self) {
    // For service workers
    self.SettingsManager = SettingsManager;
  }
} catch (e) {
  // Silently fail if we can't export
  console.debug("SettingsManager export failed:", e.message);
}
