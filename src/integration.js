// Netflix Intro Skipper - Integration Layer
// Ensures proper communication and state synchronization between all components

/**
 * Integration Manager
 * Coordinates communication between content script, popup, and background worker
 */
class IntegrationManager {
  constructor() {
    this.components = new Map();
    this.messageHandlers = new Map();
    this.stateSync = new StateSync();
    this.healthMonitor = new HealthMonitor();
    this.isInitialized = false;
  }

  /**
   * Initialize the integration manager
   */
  async initialize() {
    try {
      // Try to wake up service worker if it's sleeping
      try {
        await chrome.runtime.sendMessage({ action: "contentScriptReady" });
      } catch (error) {
        console.log(
          "[Integration] Service worker may be sleeping, attempting wake-up"
        );
      }

      // Set up message routing
      this.setupMessageRouting();

      // Initialize state synchronization
      await this.stateSync.initialize();

      // Start health monitoring
      this.healthMonitor.start();

      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error(
        "[Integration] Failed to initialize integration manager:",
        error
      );
      return false;
    }
  }

  /**
   * Register a component with the integration manager
   */
  registerComponent(name, component) {
    try {
      // Validate inputs
      if (!name || typeof name !== "string" || name.trim() === "") {
        console.error("[Integration] Invalid component name provided");
        return false;
      }

      if (!component) {
        console.error("[Integration] Invalid component provided");
        return false;
      }

      this.components.set(name, {
        instance: component,
        status: "active",
        lastActivity: Date.now(),
        messageQueue: [],
      });

      // Notify other components about new registration
      this.broadcastMessage({
        type: "component_registered",
        component: name,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error(
        `[Integration] Failed to register component ${name}:`,
        error
      );
      return false;
    }
  }

  /**
   * Unregister a component
   */
  unregisterComponent(name) {
    try {
      if (this.components.has(name)) {
        this.components.delete(name);

        // Notify other components about unregistration
        this.broadcastMessage({
          type: "component_unregistered",
          component: name,
          timestamp: Date.now(),
        });
      }
      return true;
    } catch (error) {
      console.error(
        `[Integration] Failed to unregister component ${name}:`,
        error
      );
      return false;
    }
  }

  /**
   * Set up message routing between components
   */
  setupMessageRouting() {
    try {
      // Handle messages from background script
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.addListener(
          (request, sender, sendResponse) => {
            this.handleIncomingMessage(request, sender, sendResponse);
            return true; // Keep message channel open
          }
        );
      }

      // Set up message handlers for different message types
      this.messageHandlers.set(
        "settings_changed",
        this.handleSettingsChanged.bind(this)
      );
      this.messageHandlers.set(
        "component_status",
        this.handleComponentStatus.bind(this)
      );
      this.messageHandlers.set(
        "health_check",
        this.handleHealthCheck.bind(this)
      );
      this.messageHandlers.set("state_sync", this.handleStateSync.bind(this));
      this.messageHandlers.set(
        "error_report",
        this.handleErrorReport.bind(this)
      );
    } catch (error) {
      console.error("[Integration] Failed to set up message routing:", error);
    }
  }

  /**
   * Handle incoming messages
   */
  async handleIncomingMessage(request, sender, sendResponse) {
    try {
      const handler = this.messageHandlers.get(request.type);

      if (handler) {
        const result = await handler(request, sender);
        sendResponse({ success: true, data: result });
      } else {
        // Forward to appropriate component
        const targetComponent = this.components.get(request.targetComponent);

        if (targetComponent && targetComponent.instance.handleMessage) {
          const result = await targetComponent.instance.handleMessage(request);
          sendResponse({ success: true, data: result });
        } else {
          console.warn(
            `[Integration] No handler found for message type: ${request.type}`
          );
          sendResponse({ success: false, error: "No handler found" });
        }
      }
    } catch (error) {
      console.error("[Integration] Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle settings changed messages
   */
  async handleSettingsChanged(request, sender) {
    try {
      // Update state sync
      await this.stateSync.updateSettings(request.settings);

      // Notify all components
      for (const [name, component] of this.components.entries()) {
        try {
          if (component.instance.onSettingsChanged) {
            await component.instance.onSettingsChanged(request.settings);
          }
        } catch (error) {
          console.error(
            `[Integration] Error notifying ${name} of settings change:`,
            error
          );
        }
      }

      return { notified: this.components.size };
    } catch (error) {
      console.error("[Integration] Error handling settings change:", error);
      throw error;
    }
  }

  /**
   * Handle component status updates
   */
  async handleComponentStatus(request, sender) {
    try {
      const componentInfo = this.components.get(request.component);

      if (componentInfo) {
        componentInfo.status = request.status;
        componentInfo.lastActivity = Date.now();

        // Update health monitor
        this.healthMonitor.updateComponentStatus(
          request.component,
          request.status
        );
      }

      return { updated: true };
    } catch (error) {
      console.error("[Integration] Error handling component status:", error);
      throw error;
    }
  }

  /**
   * Handle health check requests
   */
  async handleHealthCheck(request, sender) {
    try {
      const healthStatus = this.healthMonitor.getHealthStatus();
      return healthStatus;
    } catch (error) {
      console.error("[Integration] Error handling health check:", error);
      throw error;
    }
  }

  /**
   * Handle state synchronization
   */
  async handleStateSync(request, sender) {
    try {
      await this.stateSync.syncState(request.state);
      return { synced: true };
    } catch (error) {
      console.error("[Integration] Error handling state sync:", error);
      throw error;
    }
  }

  /**
   * Handle error reports
   */
  async handleErrorReport(request, sender) {
    try {
      console.error(
        `[Integration] Error reported by ${request.component}:`,
        request.error
      );

      // Forward to health monitor
      this.healthMonitor.reportError(request.component, request.error);

      // Optionally forward to background script for logging
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.id
      ) {
        try {
          chrome.runtime.sendMessage(
            {
              action: "logActivity",
              message: `Error in ${request.component}`,
              data: request.error,
            },
            (response) => {
              // Handle response silently - don't log errors for logging failures
              if (chrome.runtime.lastError) {
                // Silently ignore extension context errors
              }
            }
          );
        } catch (error) {
          // Silently ignore Chrome runtime errors
        }
      }

      return { logged: true };
    } catch (error) {
      console.error("[Integration] Error handling error report:", error);
      throw error;
    }
  }

  /**
   * Broadcast message to all components
   */
  async broadcastMessage(message) {
    try {
      const results = [];

      for (const [name, component] of this.components.entries()) {
        try {
          if (component.instance.handleBroadcast) {
            const result = await component.instance.handleBroadcast(message);
            results.push({ component: name, result });
          }
        } catch (error) {
          console.error(`[Integration] Error broadcasting to ${name}:`, error);
          results.push({ component: name, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error("[Integration] Error broadcasting message:", error);
      throw error;
    }
  }
  /**
   * Send message to specific component
   */
  async sendToComponent(componentName, message) {
    try {
      const component = this.components.get(componentName);

      if (!component) {
        throw new Error(`Component ${componentName} not found`);
      }

      if (component.instance.handleMessage) {
        return await component.instance.handleMessage(message);
      } else {
        throw new Error(
          `Component ${componentName} does not support messaging`
        );
      }
    } catch (error) {
      console.error(
        `[Integration] Error sending message to ${componentName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get integration status
   */
  getStatus() {
    try {
      return {
        initialized: this.isInitialized,
        components: Array.from(this.components.keys()),
        componentCount: this.components.size,
        healthStatus: this.healthMonitor.getHealthStatus(),
        stateSync: this.stateSync.getStatus(),
      };
    } catch (error) {
      console.error("[Integration] Error getting status:", error);
      return { error: error.message };
    }
  }

  /**
   * Cleanup integration manager
   */
  cleanup() {
    try {
      // Stop health monitoring
      this.healthMonitor.stop();

      // Clear components
      this.components.clear();

      // Clear message handlers
      this.messageHandlers.clear();

      // Cleanup state sync
      this.stateSync.cleanup();

      this.isInitialized = false;
    } catch (error) {
      console.error("[Integration] Error during cleanup:", error);
    }
  }
}

/**
 * State Synchronization Manager
 * Ensures all components have consistent state
 */
class StateSync {
  constructor() {
    this.currentState = {
      settings: {
        autoSkipEnabled: true,
        lastUpdated: Date.now(),
      },
      sessionInfo: null,
      componentStates: new Map(),
      lastSync: 0,
    };
    this.syncInterval = null;
    this.syncFrequency = 30000; // 30 seconds
  }

  async initialize() {
    try {
      // Load initial state
      await this.loadInitialState();

      // Start periodic sync
      this.startPeriodicSync();

      return true;
    } catch (error) {
      console.error("[StateSync] Failed to initialize state sync:", error);
      return false;
    }
  }

  async loadInitialState() {
    try {
      // Load settings from background script
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.id && // Check if extension context is valid
        chrome.runtime.sendMessage
      ) {
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: "Timeout", silent: true });
          }, 2000); // Increased timeout to 2 seconds

          try {
            chrome.runtime.sendMessage(
              { action: "getSettings" },
              (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  const errorMessage = chrome.runtime.lastError.message;
                  if (
                    errorMessage.includes("Extension context invalidated") ||
                    errorMessage.includes("Could not establish connection") ||
                    errorMessage.includes("Extension not active")
                  ) {
                    resolve({
                      success: false,
                      error: "Extension context invalidated",
                      silent: true,
                    });
                  } else {
                    resolve({ success: false, error: errorMessage });
                  }
                } else {
                  resolve(response || { success: false, error: "No response" });
                }
              }
            );
          } catch (error) {
            clearTimeout(timeout);
            resolve({ success: false, error: error.message, silent: true });
          }
        });

        if (response && response.success) {
          this.currentState.settings = response.settings;
        } else if (response && !response.silent) {
          console.warn(
            "[StateSync] Failed to load initial settings:",
            response.error
          );
        }

        // If background script is not responding, try to wake it up
        if (
          response &&
          response.error &&
          (response.error.includes("Extension not active") ||
            response.error.includes("Extension context invalidated") ||
            response.error.includes("Could not establish connection"))
        ) {
          // Multiple retry attempts with exponential backoff
          let retryResponse = null;
          const maxRetries = 3;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 200));

            retryResponse = await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                resolve({
                  success: false,
                  error: "Retry timeout",
                  silent: true,
                });
              }, 2000);

              try {
                chrome.runtime.sendMessage(
                  { action: "getSettings" },
                  (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                      const errorMessage = chrome.runtime.lastError.message;
                      resolve({
                        success: false,
                        error: errorMessage,
                        silent: true,
                      });
                    } else {
                      resolve(
                        response || { success: false, error: "No response" }
                      );
                    }
                  }
                );
              } catch (error) {
                clearTimeout(timeout);
                resolve({ success: false, error: error.message, silent: true });
              }
            });

            if (retryResponse && retryResponse.success) {
              this.currentState.settings = retryResponse.settings;
              console.log(
                `[StateSync] Settings loaded after ${attempt} retry attempts`
              );
              break;
            }
          }

          // If all retries failed, use fallback settings
          if (!retryResponse || !retryResponse.success) {
            console.warn(
              "[StateSync] All retry attempts failed, using fallback settings"
            );
            this.currentState.settings = {
              autoSkipEnabled: true,
              lastUpdated: Date.now(),
            };
          }
        }
      }

      // Ensure settings have default values if not loaded
      if (!this.currentState.settings) {
        this.currentState.settings = {
          autoSkipEnabled: true,
          lastUpdated: Date.now(),
        };
      }

      this.currentState.lastSync = Date.now();
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || String(error);
      if (
        !errorMessage.includes("Extension context invalidated") &&
        !errorMessage.includes("Could not establish connection") &&
        !errorMessage.includes("Extension not active")
      ) {
        console.error("[StateSync] Error loading initial state:", error);
      }

      // Ensure default settings are available even on error
      if (!this.currentState.settings) {
        this.currentState.settings = {
          autoSkipEnabled: true,
          lastUpdated: Date.now(),
        };
      }
    }
  }

  startPeriodicSync() {
    try {
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, this.syncFrequency);
    } catch (error) {
      console.error("[StateSync] Error starting periodic sync:", error);
    }
  }

  stopPeriodicSync() {
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    } catch (error) {
      console.error("[StateSync] Error stopping periodic sync:", error);
    }
  }

  async performSync() {
    try {
      // Check if extension context is still valid before syncing
      if (
        typeof chrome === "undefined" ||
        !chrome.runtime ||
        !chrome.runtime.id
      ) {
        // Extension context is invalid, stop periodic sync
        this.stopPeriodicSync();
        return;
      }

      // Sync settings
      await this.syncSettings();

      // Sync component states
      await this.syncComponentStates();

      this.currentState.lastSync = Date.now();
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || String(error);
      if (
        errorMessage.includes("Extension context invalidated") ||
        errorMessage.includes("Could not establish connection")
      ) {
        // Extension context is invalid, stop periodic sync
        this.stopPeriodicSync();
      } else {
        console.error("[StateSync] Error performing sync:", error);
      }
    }
  }

  async syncSettings() {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.id && // Check if extension context is valid
        chrome.runtime.sendMessage
      ) {
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: "Timeout" });
          }, 1000); // 1 second timeout

          try {
            chrome.runtime.sendMessage(
              { action: "getSettings" },
              (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  // Handle Chrome runtime errors gracefully
                  const errorMessage = chrome.runtime.lastError.message;
                  if (
                    errorMessage.includes("Extension context invalidated") ||
                    errorMessage.includes("Could not establish connection")
                  ) {
                    // Extension was reloaded - fail silently
                    resolve({
                      success: false,
                      error: "Extension context invalidated",
                      silent: true,
                    });
                  } else {
                    resolve({ success: false, error: errorMessage });
                  }
                } else {
                  resolve(response || { success: false, error: "No response" });
                }
              }
            );
          } catch (error) {
            clearTimeout(timeout);
            resolve({ success: false, error: error.message });
          }
        });

        if (response && response.success) {
          const newSettings = response.settings;

          // Check if settings changed
          if (
            JSON.stringify(this.currentState.settings) !==
            JSON.stringify(newSettings)
          ) {
            this.currentState.settings = newSettings;
          }
        } else if (response && !response.silent) {
          // Only log non-silent errors
          console.warn("[StateSync] Settings sync failed:", response.error);
        }
      }
    } catch (error) {
      // Only log if it's not an extension context error
      const errorMessage = error?.message || error?.toString() || String(error);
      if (
        !errorMessage.includes("Extension context invalidated") &&
        !errorMessage.includes("Could not establish connection")
      ) {
        console.error("[StateSync] Error syncing settings:", error);
      }
    }
  }

  async syncComponentStates() {
    try {
      // This would sync component-specific states
      // Implementation depends on specific component needs
    } catch (error) {
      console.error("[StateSync] Error syncing component states:", error);
    }
  }

  async updateSettings(newSettings) {
    try {
      this.currentState.settings = newSettings;
      this.currentState.lastSync = Date.now();
    } catch (error) {
      console.error("[StateSync] Error updating settings:", error);
    }
  }

  async syncState(state) {
    try {
      // Merge incoming state with current state
      Object.assign(this.currentState, state);
      this.currentState.lastSync = Date.now();
    } catch (error) {
      console.error("[StateSync] Error syncing state:", error);
    }
  }

  getStatus() {
    return {
      lastSync: this.currentState.lastSync,
      hasSettings: !!this.currentState.settings,
      componentStatesCount: this.currentState.componentStates.size,
    };
  }

  cleanup() {
    try {
      this.stopPeriodicSync();
      this.currentState.componentStates.clear();
    } catch (error) {
      console.error("[StateSync] Error during cleanup:", error);
    }
  }
}

/**
 * Health Monitor
 * Monitors the health of all components
 */
class HealthMonitor {
  constructor() {
    this.componentHealth = new Map();
    this.errorCounts = new Map();
    this.monitorInterval = null;
    this.monitorFrequency = 60000; // 1 minute
    this.maxErrors = 10;
  }

  start() {
    try {
      this.monitorInterval = setInterval(() => {
        this.performHealthCheck();
      }, this.monitorFrequency);
    } catch (error) {
      console.error("[HealthMonitor] Error starting health monitor:", error);
    }
  }

  stop() {
    try {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
    } catch (error) {
      console.error("[HealthMonitor] Error stopping health monitor:", error);
    }
  }

  updateComponentStatus(componentName, status) {
    try {
      this.componentHealth.set(componentName, {
        status: status,
        lastUpdate: Date.now(),
        healthy: status === "active" || status === "idle",
      });
    } catch (error) {
      console.error("[HealthMonitor] Error updating component status:", error);
    }
  }

  reportError(componentName, error) {
    try {
      const currentCount = this.errorCounts.get(componentName) || 0;
      this.errorCounts.set(componentName, currentCount + 1);

      // Update health status if too many errors
      if (currentCount + 1 >= this.maxErrors) {
        this.updateComponentStatus(componentName, "unhealthy");
        console.warn(
          `[HealthMonitor] Component ${componentName} marked as unhealthy due to errors`
        );
      }
    } catch (error) {
      console.error("[HealthMonitor] Error reporting error:", error);
    }
  }

  performHealthCheck() {
    try {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [componentName, health] of this.componentHealth.entries()) {
        if (now - health.lastUpdate > staleThreshold) {
          this.updateComponentStatus(componentName, "stale");
        }
      }
    } catch (error) {
      console.error("[HealthMonitor] Error performing health check:", error);
    }
  }

  getHealthStatus() {
    try {
      const status = {
        overall: "healthy",
        components: {},
        errorCounts: Object.fromEntries(this.errorCounts),
        timestamp: Date.now(),
      };

      let unhealthyCount = 0;

      for (const [componentName, health] of this.componentHealth.entries()) {
        status.components[componentName] = health;

        if (!health.healthy) {
          unhealthyCount++;
        }
      }

      // Determine overall health
      if (unhealthyCount > 0) {
        status.overall =
          unhealthyCount === this.componentHealth.size
            ? "critical"
            : "degraded";
      }

      return status;
    } catch (error) {
      console.error("[HealthMonitor] Error getting health status:", error);
      return { overall: "unknown", error: error.message };
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { IntegrationManager, StateSync, HealthMonitor };
} else {
  window.IntegrationManager = IntegrationManager;
  window.StateSync = StateSync;
  window.HealthMonitor = HealthMonitor;
}
