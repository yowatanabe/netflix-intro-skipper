// Netflix Intro Skipper - Background Service Worker
// Handles extension lifecycle and settings management

// Enhanced Error Handler for background script
class BackgroundErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 20; // Higher threshold for background script
    this.errorLog = [];
    this.maxLogSize = 100;
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

      // Add to error log
      this.errorLog.push(errorInfo);
      if (this.errorLog.length > this.maxLogSize) {
        this.errorLog.shift(); // Remove oldest error
      }

      // Log to console for debugging
      if (!silent) {
        console.error(
          `[Netflix Intro Skipper Background] Error in ${context}:`,
          error.message || error.toString(),
          errorInfo
        );
      }

      return false; // Indicate error was handled
    } catch (handlerError) {
      // Error in error handler - fail silently
      console.warn(
        "[Netflix Intro Skipper Background] Error handler failed:",
        handlerError.message
      );
      return false;
    }
  }

  getErrorLog() {
    return [...this.errorLog];
  }

  reset() {
    this.errorCount = 0;
    this.errorLog = [];
  }

  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }
}

// Global error handler instance
const backgroundErrorHandler = new BackgroundErrorHandler();

// Settings Manager for background script (simplified version)
class BackgroundSettingsManager {
  constructor() {
    this.defaultSettings = {
      autoSkipEnabled: true,
      lastUpdated: Date.now(),
    };
  }

  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(this.defaultSettings);
      return result;
    } catch (error) {
      backgroundErrorHandler.handleError(
        error,
        "BackgroundSettingsManager.getSettings"
      );
      return this.defaultSettings;
    }
  }

  async setEnabled(enabled) {
    try {
      const settings = await this.getSettings();
      const updatedSettings = {
        ...settings,
        autoSkipEnabled: enabled,
        lastUpdated: Date.now(),
      };
      await chrome.storage.sync.set(updatedSettings);
    } catch (error) {
      backgroundErrorHandler.handleError(
        error,
        "BackgroundSettingsManager.setEnabled"
      );
      throw error;
    }
  }

  async updateSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        lastUpdated: Date.now(),
      };
      await chrome.storage.sync.set(updatedSettings);
    } catch (error) {
      backgroundErrorHandler.handleError(
        error,
        "BackgroundSettingsManager.updateSettings"
      );
      throw error;
    }
  }

  async resetSettings() {
    try {
      await chrome.storage.sync.set(this.defaultSettings);
    } catch (error) {
      backgroundErrorHandler.handleError(
        error,
        "BackgroundSettingsManager.resetSettings"
      );
      throw error;
    }
  }
}

// Initialize settings manager
const settingsManager = new BackgroundSettingsManager();

// Extension lifecycle management
let isExtensionActive = false;
let connectedTabs = new Map(); // Track connected content scripts

// Extension installation/startup handler
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    // Initialize default settings on first install
    if (details.reason === "install") {
      await settingsManager.resetSettings();
    }

    // Update settings on extension update if needed
    if (details.reason === "update") {
      const currentSettings = await settingsManager.getSettings();
    }

    isExtensionActive = true;
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.runtime.onInstalled");
  }
});

// Service worker startup handler
chrome.runtime.onStartup.addListener(() => {
  try {
    isExtensionActive = true;
    backgroundErrorHandler.reset(); // Reset error count on startup
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.runtime.onStartup");
  }
});

// Service worker activation handler (for wake-up after sleep)
self.addEventListener("activate", (event) => {
  try {
    isExtensionActive = true;
    backgroundErrorHandler.reset();
    console.log("[Background] Service worker activated");
  } catch (error) {
    backgroundErrorHandler.handleError(error, "service-worker-activate");
  }
});

// Service worker wake-up handler
self.addEventListener("message", (event) => {
  try {
    if (event.data && event.data.type === "WAKE_UP") {
      isExtensionActive = true;
      backgroundErrorHandler.reset();
      console.log("[Background] Service worker woken up");
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "service-worker-message");
  }
});

// Handle extension suspension
chrome.runtime.onSuspend.addListener(() => {
  try {
    isExtensionActive = false;
    connectedTabs.clear();
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.runtime.onSuspend", true);
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ensure extension is active - if not, try to reactivate
  if (!isExtensionActive) {
    isExtensionActive = true; // Reactivate on message
    backgroundErrorHandler.reset();
  }

  try {
    if (!backgroundErrorHandler.shouldContinue()) {
      sendResponse({
        success: false,
        error: "Extension temporarily disabled due to errors",
      });
      return false;
    }

    switch (request.action) {
      case "getSettings":
        handleGetSettings(sendResponse);
        return true; // Keep message channel open for async response

      case "setEnabled":
        handleSetEnabled(request, sender, sendResponse);
        return true; // Keep message channel open for async response

      case "updateSettings":
        handleUpdateSettings(request, sender, sendResponse);
        return true; // Keep message channel open for async response

      case "contentScriptReady":
        handleContentScriptReady(request, sender, sendResponse);
        return false; // Synchronous response

      case "contentScriptDisconnected":
        handleContentScriptDisconnected(request, sender, sendResponse);
        return false; // Synchronous response

      case "logActivity":
        handleLogActivity(request, sender, sendResponse);
        return false; // Synchronous response

      case "temporaryDisable":
        handleTemporaryDisable(request, sender, sendResponse);
        return false; // Synchronous response

      case "getErrorLog":
        handleGetErrorLog(request, sender, sendResponse);
        return false; // Synchronous response

      case "getIntegrationStatus":
        handleGetIntegrationStatus(request, sender, sendResponse);
        return false; // Synchronous response

      case "broadcastMessage":
        handleBroadcastMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async response

      case "componentHealthUpdate":
        handleComponentHealthUpdate(request, sender, sendResponse);
        return false; // Synchronous response

      default:
        console.warn("Unknown message action:", request.action);
        sendResponse({ success: false, error: "Unknown action" });
        return false;
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.runtime.onMessage");
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// Handle settings retrieval
async function handleGetSettings(sendResponse) {
  try {
    const settings = await settingsManager.getSettings();
    sendResponse({ success: true, settings });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleGetSettings");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle settings update (enabled/disabled)
async function handleSetEnabled(request, sender, sendResponse) {
  try {
    await settingsManager.setEnabled(request.enabled);

    // Broadcast settings change to all connected tabs
    await broadcastSettingsChange({ autoSkipEnabled: request.enabled });

    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleSetEnabled");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle general settings update
async function handleUpdateSettings(request, sender, sendResponse) {
  try {
    await settingsManager.updateSettings(request.settings);

    // Broadcast settings change to all connected tabs
    await broadcastSettingsChange(request.settings);

    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleUpdateSettings");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle content script registration
function handleContentScriptReady(request, sender, sendResponse) {
  try {
    if (sender.tab && sender.tab.id) {
      connectedTabs.set(sender.tab.id, {
        tabId: sender.tab.id,
        url: sender.tab.url,
        connectedAt: Date.now(),
      });
    }
    sendResponse({ success: true, extensionActive: isExtensionActive });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleContentScriptReady");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle content script disconnection
function handleContentScriptDisconnected(request, sender, sendResponse) {
  try {
    if (sender.tab && sender.tab.id) {
      connectedTabs.delete(sender.tab.id);
    }
    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(
      error,
      "handleContentScriptDisconnected"
    );
    sendResponse({ success: false, error: error.message });
  }
}

// Handle activity logging from content scripts
function handleLogActivity(request, sender, sendResponse) {
  try {
    // Activity logging disabled for production
    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleLogActivity", true);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle temporary disable request
function handleTemporaryDisable(request, sender, sendResponse) {
  try {
    // Could implement temporary disable logic here
    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleTemporaryDisable");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle error log retrieval
function handleGetErrorLog(request, sender, sendResponse) {
  try {
    const errorLog = backgroundErrorHandler.getErrorLog();
    sendResponse({ success: true, errorLog });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleGetErrorLog");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle integration status requests
function handleGetIntegrationStatus(request, sender, sendResponse) {
  try {
    const integrationStatus = {
      connectedTabs: connectedTabs.size,
      extensionActive: isExtensionActive,
      errorCount: backgroundErrorHandler.errorCount,
      tabConnections: Array.from(connectedTabs.entries()).map(
        ([tabId, info]) => ({
          tabId,
          url: info.url,
          connectedAt: info.connectedAt,
          lastUpdated: info.lastUpdated || info.connectedAt,
        })
      ),
      timestamp: Date.now(),
    };
    sendResponse({ success: true, status: integrationStatus });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleGetIntegrationStatus");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle broadcast message requests
async function handleBroadcastMessage(request, sender, sendResponse) {
  try {
    const results = [];

    // Broadcast to all connected tabs
    for (const [tabId, tabInfo] of connectedTabs.entries()) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: "broadcastMessage",
          message: request.message,
          sender: sender.tab ? sender.tab.id : "background",
          timestamp: Date.now(),
        });
        results.push({ tabId, success: true });
      } catch (error) {
        results.push({ tabId, success: false, error: error.message });
        // Clean up disconnected tab
        connectedTabs.delete(tabId);
      }
    }

    sendResponse({ success: true, results });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleBroadcastMessage");
    sendResponse({ success: false, error: error.message });
  }
}

// Handle component health updates
function handleComponentHealthUpdate(request, sender, sendResponse) {
  try {
    const tabId = sender.tab ? sender.tab.id : null;

    if (tabId && connectedTabs.has(tabId)) {
      const tabInfo = connectedTabs.get(tabId);
      tabInfo.componentHealth = request.health;
      tabInfo.lastHealthUpdate = Date.now();
    }

    sendResponse({ success: true });
  } catch (error) {
    backgroundErrorHandler.handleError(error, "handleComponentHealthUpdate");
    sendResponse({ success: false, error: error.message });
  }
}

// Enhanced message broadcasting with integration support
async function broadcastSettingsChange(changedSettings) {
  try {
    const fullSettings = await settingsManager.getSettings();

    // Send to all connected tabs with integration support
    for (const [tabId, tabInfo] of connectedTabs.entries()) {
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: "settingsChanged",
          type: "settings_changed", // For integration manager
          settings: fullSettings,
          changedSettings: changedSettings,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Tab might be closed or content script not ready
        console.warn(
          `Failed to send settings update to tab ${tabId}:`,
          error.message
        );
        connectedTabs.delete(tabId); // Clean up disconnected tab
      }
    }

    // Also broadcast to popup if it's open
    try {
      await chrome.runtime.sendMessage({
        action: "settingsChanged",
        type: "settings_changed", // For integration manager
        settings: fullSettings,
        changedSettings: changedSettings,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Popup might not be open, this is normal
      console.debug(
        "Popup not available for settings broadcast:",
        error.message
      );
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "broadcastSettingsChange");
  }
}

// Listen for tab updates to clean up disconnected tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  try {
    if (connectedTabs.has(tabId)) {
      connectedTabs.delete(tabId);
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.tabs.onRemoved", true);
  }
});

// Listen for tab URL changes to handle Netflix navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab.url) {
      if (connectedTabs.has(tabId)) {
        // Update tab info if it's a connected Netflix tab
        if (tab.url.includes("netflix.com")) {
          connectedTabs.set(tabId, {
            ...connectedTabs.get(tabId),
            url: tab.url,
            lastUpdated: Date.now(),
          });
        } else {
          // Tab navigated away from Netflix, clean up
          connectedTabs.delete(tabId);
        }
      }
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "chrome.tabs.onUpdated", true);
  }
});

// Periodic cleanup of stale connections
setInterval(() => {
  try {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [tabId, tabInfo] of connectedTabs.entries()) {
      if (now - tabInfo.connectedAt > staleThreshold) {
        // Check if tab still exists
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            connectedTabs.delete(tabId);
          }
        });
      }
    }
  } catch (error) {
    backgroundErrorHandler.handleError(error, "periodicCleanup", true);
  }
}, 60000); // Run every minute
