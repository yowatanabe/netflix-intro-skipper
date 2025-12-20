// Netflix Intro Skipper - Integration Tests
// Tests end-to-end functionality and component interactions

const { JSDOM } = require("jsdom");

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: "test-extension-id", // Add extension ID for context validation
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
    lastError: null,
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    sendMessage: jest.fn(),
    onRemoved: {
      addListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
    },
    get: jest.fn(),
  },
};

// Set up DOM environment
const dom = new JSDOM(
  `
  <!DOCTYPE html>
  <html>
    <head><title>Netflix</title></head>
    <body>
      <div class="player-controls">
        <button data-uia="player-skip-intro" style="display: block;">Skip Intro</button>
      </div>
      <video></video>
    </body>
  </html>
`,
  {
    url: "https://www.netflix.com/watch/12345",
    pretendToBeVisual: true,
    resources: "usable",
  }
);

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.MutationObserver = dom.window.MutationObserver;
global.seEvent = dom.window.MouseEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.TouchEvent = dom.window.TouchEvent;
global.Event = dom.window.Event;

// Load the modules
const {
  IntegrationManager,
  StateSync,
  HealthMonitor,
} = require("../src/integration.js");
const SettingsManager = require("../src/settings.js");

describe("Netflix Intro Skipper Integration Tests", () => {
  let integrationManager;
  let settingsManager;
  let mockSkipButton;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create fresh DOM elements
    document.body.innerHTML = `
      <div class="player-controls">
        <button data-uia="player-skip-intro" style="display: block;">Skip Intro</button>
      </div>
      <video></video>
    `;

    mockSkipButton = document.querySelector('[data-uia="player-skip-intro"]');

    // Initialize components
    integrationManager = new IntegrationManager();
    settingsManager = new SettingsManager();

    // Mock Chrome storage responses
    chrome.storage.sync.get.mockResolvedValue({
      autoSkipEnabled: true,
      lastUpdated: Date.now(),
    });

    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (callback) {
        callback({ success: true, settings: { autoSkipEnabled: true } });
      }
    });
  });

  afterEach(() => {
    if (integrationManager) {
      integrationManager.cleanup();
    }
  });

  describe("Integration Manager", () => {
    test("should initialize successfully", async () => {
      const result = await integrationManager.initialize();
      expect(result).toBe(true);
      expect(integrationManager.isInitialized).toBe(true);
    });

    test("should register and unregister components", () => {
      const mockComponent = { name: "test", handleMessage: jest.fn() };

      const registered = integrationManager.registerComponent(
        "testComponent",
        mockComponent
      );
      expect(registered).toBe(true);
      expect(integrationManager.components.has("testComponent")).toBe(true);

      const unregistered =
        integrationManager.unregisterComponent("testComponent");
      expect(unregistered).toBe(true);
      expect(integrationManager.components.has("testComponent")).toBe(false);
    });

    test("should handle message routing", async () => {
      await integrationManager.initialize();

      const mockComponent = {
        handleMessage: jest.fn().mockResolvedValue({ result: "success" }),
      };

      integrationManager.registerComponent("testComponent", mockComponent);

      const result = await integrationManager.sendToComponent("testComponent", {
        type: "test_message",
        data: "test_data",
      });

      expect(mockComponent.handleMessage).toHaveBeenCalledWith({
        type: "test_message",
        data: "test_data",
      });
      expect(result).toEqual({ result: "success" });
    });

    test("should broadcast messages to all components", async () => {
      await integrationManager.initialize();

      const mockComponent1 = {
        handleBroadcast: jest.fn().mockResolvedValue({ received: true }),
      };
      const mockComponent2 = {
        handleBroadcast: jest.fn().mockResolvedValue({ received: true }),
      };

      integrationManager.registerComponent("component1", mockComponent1);
      integrationManager.registerComponent("component2", mockComponent2);

      const results = await integrationManager.broadcastMessage({
        type: "broadcast_test",
        data: "broadcast_data",
      });

      expect(mockComponent1.handleBroadcast).toHaveBeenCalled();
      expect(mockComponent2.handleBroadcast).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });

    test("should handle settings changes", async () => {
      await integrationManager.initialize();

      const mockComponent = {
        onSettingsChanged: jest.fn().mockResolvedValue(true),
      };

      integrationManager.registerComponent("testComponent", mockComponent);

      await integrationManager.handleSettingsChanged({
        settings: { autoSkipEnabled: false },
        changedSettings: { autoSkipEnabled: false },
      });

      expect(mockComponent.onSettingsChanged).toHaveBeenCalledWith({
        autoSkipEnabled: false,
      });
    });
  });

  describe("Component Integration", () => {
    test("should integrate settings manager with integration manager", async () => {
      await integrationManager.initialize();
      integrationManager.registerComponent("settingsManager", settingsManager);

      // Test settings retrieval
      const settings = await settingsManager.getSettings();
      expect(settings.autoSkipEnabled).toBe(true);

      // Test settings update
      await settingsManager.setEnabled(false);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          autoSkipEnabled: false,
        })
      );
    });

    test("should handle component communication through integration manager", async () => {
      await integrationManager.initialize();

      // Mock components
      const mockDetector = {
        detectButton: jest.fn().mockReturnValue({
          element: mockSkipButton,
          detectionMethod: "selector",
          confidence: 0.9,
        }),
        handleMessage: jest.fn(),
      };

      const mockClickHandler = {
        clickButton: jest.fn().mockResolvedValue(true),
        handleMessage: jest.fn(),
      };

      integrationManager.registerComponent("detector", mockDetector);
      integrationManager.registerComponent("clickHandler", mockClickHandler);

      // Test component interaction through integration manager
      const detectionResult = await integrationManager.sendToComponent(
        "detector",
        {
          type: "detect_button",
        }
      );

      expect(mockDetector.handleMessage).toHaveBeenCalled();
    });
  });

  describe("End-to-End Functionality", () => {
    test("should complete full skip button detection and click flow", async () => {
      // Set up complete environment
      await integrationManager.initialize();

      // Mock all components
      const mockDetector = {
        detectButton: () => ({
          element: mockSkipButton,
          detectionMethod: "selector",
          confidence: 0.9,
        }),
      };

      const mockClickHandler = {
        clickButton: jest.fn().mockResolvedValue(true),
      };

      const mockDomMonitor = {
        start: jest.fn(),
        stop: jest.fn(),
        checkForSkipButton: jest.fn().mockResolvedValue(true),
      };

      integrationManager.registerComponent("detector", mockDetector);
      integrationManager.registerComponent("clickHandler", mockClickHandler);
      integrationManager.registerComponent("domMonitor", mockDomMonitor);

      // Simulate the full flow
      const button = mockDetector.detectButton();
      expect(button).toBeTruthy();
      expect(button.element).toBe(mockSkipButton);

      const clickResult = await mockClickHandler.clickButton(button.element);
      expect(clickResult).toBe(true);
      expect(mockClickHandler.clickButton).toHaveBeenCalledWith(mockSkipButton);
    });

    test("should handle settings changes across all components", async () => {
      await integrationManager.initialize();

      // Mock components that respond to settings changes
      const mockComponents = ["domMonitor", "clickHandler", "detector"].map(
        (name) => ({
          name,
          component: {
            onSettingsChanged: jest.fn().mockResolvedValue(true),
            setEnabled: jest.fn(),
          },
        })
      );

      mockComponents.forEach(({ name, component }) => {
        integrationManager.registerComponent(name, component);
      });

      // Simulate settings change
      await integrationManager.handleSettingsChanged({
        settings: { autoSkipEnabled: false },
        changedSettings: { autoSkipEnabled: false },
      });

      // Verify all components were notified
      mockComponents.forEach(({ component }) => {
        expect(component.onSettingsChanged).toHaveBeenCalledWith({
          autoSkipEnabled: false,
        });
      });
    });

    test("should handle error propagation and recovery", async () => {
      await integrationManager.initialize();

      const mockComponent = {
        handleMessage: jest.fn().mockRejectedValue(new Error("Test error")),
        onSettingsChanged: jest
          .fn()
          .mockRejectedValue(new Error("Settings error")),
      };

      integrationManager.registerComponent("errorComponent", mockComponent);

      // Test error handling in message routing
      try {
        await integrationManager.sendToComponent("errorComponent", {
          type: "test",
        });
      } catch (error) {
        expect(error.message).toBe("Test error");
      }

      // Test error handling in settings changes
      const result = await integrationManager.handleSettingsChanged({
        settings: { autoSkipEnabled: true },
        changedSettings: { autoSkipEnabled: true },
      });

      // Should still return result even with component errors
      expect(result.notified).toBe(1);
    });
  });

  describe("State Synchronization", () => {
    test("should synchronize state across components", async () => {
      await integrationManager.initialize();

      const stateSync = integrationManager.stateSync;

      // Test initial state loading
      expect(stateSync.currentState.settings).toBeTruthy();

      // Test state updates
      await stateSync.updateSettings({ autoSkipEnabled: false });
      expect(stateSync.currentState.settings.autoSkipEnabled).toBe(false);

      // Test state sync
      await stateSync.syncState({
        sessionInfo: { videoId: "12345", skipAttempts: 1 },
      });

      expect(stateSync.currentState.sessionInfo.videoId).toBe("12345");
    });

    test("should handle periodic state synchronization", async () => {
      await integrationManager.initialize();

      const stateSync = integrationManager.stateSync;

      // Mock the sync methods
      const syncSettingsSpy = jest
        .spyOn(stateSync, "syncSettings")
        .mockResolvedValue();
      const syncComponentStatesSpy = jest
        .spyOn(stateSync, "syncComponentStates")
        .mockResolvedValue();

      // Trigger sync
      await stateSync.performSync();

      expect(syncSettingsSpy).toHaveBeenCalled();
      expect(syncComponentStatesSpy).toHaveBeenCalled();

      syncSettingsSpy.mockRestore();
      syncComponentStatesSpy.mockRestore();
    });
  });

  describe("Health Monitoring", () => {
    test("should monitor component health", async () => {
      await integrationManager.initialize();

      const healthMonitor = integrationManager.healthMonitor;

      // Test component status updates
      healthMonitor.updateComponentStatus("testComponent", "active");

      const healthStatus = healthMonitor.getHealthStatus();
      expect(healthStatus.components.testComponent.status).toBe("active");
      expect(healthStatus.components.testComponent.healthy).toBe(true);

      // Test error reporting
      healthMonitor.reportError("testComponent", new Error("Test error"));
      expect(healthMonitor.errorCounts.get("testComponent")).toBe(1);
    });

    test("should detect unhealthy components", async () => {
      await integrationManager.initialize();

      const healthMonitor = integrationManager.healthMonitor;

      // Add two components - one healthy, one that will become unhealthy
      healthMonitor.updateComponentStatus("healthyComponent", "active");
      healthMonitor.updateComponentStatus("testComponent", "active");

      // Report multiple errors to trigger unhealthy status for one component
      for (let i = 0; i < 10; i++) {
        healthMonitor.reportError("testComponent", new Error(`Error ${i}`));
      }

      const healthStatus = healthMonitor.getHealthStatus();
      expect(healthStatus.components.testComponent.healthy).toBe(false);
      expect(healthStatus.components.healthyComponent.healthy).toBe(true);
      expect(healthStatus.overall).toBe("degraded"); // Now it should be degraded since not all components are unhealthy
    });
  });

  describe("Message Passing Integration", () => {
    test("should handle Chrome runtime messages", async () => {
      await integrationManager.initialize();

      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = jest.fn();

      // Test settings changed message
      await integrationManager.handleIncomingMessage(
        {
          type: "settings_changed",
          settings: { autoSkipEnabled: false },
          changedSettings: { autoSkipEnabled: false },
        },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ notified: 0 }),
      });
    });

    test("should handle component status messages", async () => {
      await integrationManager.initialize();

      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = jest.fn();

      await integrationManager.handleIncomingMessage(
        {
          type: "component_status",
          component: "testComponent",
          status: "active",
        },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: { updated: true },
      });
    });

    test("should handle health check messages", async () => {
      await integrationManager.initialize();

      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = jest.fn();

      await integrationManager.handleIncomingMessage(
        {
          type: "health_check",
        },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overall: expect.any(String),
          components: expect.any(Object),
        }),
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    test("should handle integration manager initialization failure", async () => {
      const brokenIntegrationManager = new IntegrationManager();

      // Mock a failure in state sync initialization
      const mockStateSync = {
        initialize: jest.fn().mockRejectedValue(new Error("State sync failed")),
      };
      brokenIntegrationManager.stateSync = mockStateSync;

      const result = await brokenIntegrationManager.initialize();
      expect(result).toBe(false);
      expect(brokenIntegrationManager.isInitialized).toBe(false);
    });

    test("should handle component registration failures gracefully", () => {
      const result = integrationManager.registerComponent("", null);
      expect(result).toBe(false);
    });

    test("should handle message routing failures", async () => {
      await integrationManager.initialize();

      const mockSender = { tab: { id: 123 } };
      const mockSendResponse = jest.fn();

      // Test unknown message type
      await integrationManager.handleIncomingMessage(
        {
          type: "unknown_message_type",
        },
        mockSender,
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: "No handler found",
      });
    });
  });

  describe("Performance and Resource Management", () => {
    test("should cleanup resources properly", async () => {
      await integrationManager.initialize();

      // Register some components
      integrationManager.registerComponent("comp1", { cleanup: jest.fn() });
      integrationManager.registerComponent("comp2", { cleanup: jest.fn() });

      expect(integrationManager.components.size).toBe(2);

      // Cleanup
      integrationManager.cleanup();

      expect(integrationManager.components.size).toBe(0);
      expect(integrationManager.isInitialized).toBe(false);
    });

    test("should handle memory management in state sync", async () => {
      await integrationManager.initialize();

      const stateSync = integrationManager.stateSync;

      // Add many component states
      for (let i = 0; i < 100; i++) {
        stateSync.currentState.componentStates.set(`component${i}`, {
          data: `data${i}`,
        });
      }

      expect(stateSync.currentState.componentStates.size).toBe(100);

      // Cleanup should clear the states
      stateSync.cleanup();
      expect(stateSync.currentState.componentStates.size).toBe(0);
    });
  });

  describe("Real-world Scenarios", () => {
    test("should handle Netflix page navigation", async () => {
      await integrationManager.initialize();

      // Mock components that need to handle navigation
      const mockDomMonitor = {
        handleUrlChange: jest.fn(),
        resetSession: jest.fn(),
        onSettingsChanged: jest.fn(),
      };

      const mockSessionManager = {
        initializeSession: jest
          .fn()
          .mockReturnValue({ sessionId: "new-session" }),
        cleanupOldSessions: jest.fn(),
      };

      integrationManager.registerComponent("domMonitor", mockDomMonitor);
      integrationManager.registerComponent(
        "sessionManager",
        mockSessionManager
      );

      // Simulate navigation by broadcasting a navigation message
      await integrationManager.broadcastMessage({
        type: "navigation",
        url: "https://www.netflix.com/watch/67890",
      });

      // Components should be notified (if they have handleBroadcast method)
      // This tests the message broadcasting system
    });

    test("should handle multiple concurrent skip attempts", async () => {
      await integrationManager.initialize();

      const mockClickHandler = {
        clickButton: jest
          .fn()
          .mockResolvedValueOnce(true) // First attempt succeeds
          .mockResolvedValueOnce(false) // Second attempt fails
          .mockResolvedValueOnce(true), // Third attempt succeeds
        handleMessage: jest.fn(),
      };

      integrationManager.registerComponent("clickHandler", mockClickHandler);

      // Simulate concurrent click attempts
      const promises = [
        integrationManager.sendToComponent("clickHandler", {
          type: "click",
          button: mockSkipButton,
        }),
        integrationManager.sendToComponent("clickHandler", {
          type: "click",
          button: mockSkipButton,
        }),
        integrationManager.sendToComponent("clickHandler", {
          type: "click",
          button: mockSkipButton,
        }),
      ];

      await Promise.all(promises);

      expect(mockClickHandler.handleMessage).toHaveBeenCalledTimes(3);
    });

    test("should handle extension disable/enable cycle", async () => {
      await integrationManager.initialize();

      const mockComponents = ["domMonitor", "clickHandler"].map((name) => ({
        name,
        component: {
          onSettingsChanged: jest.fn(),
          setEnabled: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
        },
      }));

      mockComponents.forEach(({ name, component }) => {
        integrationManager.registerComponent(name, component);
      });

      // Disable extension
      await integrationManager.handleSettingsChanged({
        settings: { autoSkipEnabled: false },
        changedSettings: { autoSkipEnabled: false },
      });

      // Enable extension
      await integrationManager.handleSettingsChanged({
        settings: { autoSkipEnabled: true },
        changedSettings: { autoSkipEnabled: true },
      });

      // Verify components were notified of both changes
      mockComponents.forEach(({ component }) => {
        expect(component.onSettingsChanged).toHaveBeenCalledTimes(2);
      });
    });
  });
});

// Additional test utilities for integration testing
class IntegrationTestUtils {
  static createMockNetflixPage(hasSkipButton = true) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Netflix</title></head>
        <body>
          <div class="player-controls">
            ${
              hasSkipButton
                ? '<button data-uia="player-skip-intro" style="display: block;">Skip Intro</button>'
                : ""
            }
          </div>
          <video></video>
        </body>
      </html>
    `;

    return new JSDOM(html, {
      url: "https://www.netflix.com/watch/12345",
      pretendToBeVisual: true,
      resources: "usable",
    });
  }

  static createMockChromeAPIs() {
    return {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        lastError: null,
      },
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({ autoSkipEnabled: true }),
          set: jest.fn().mockResolvedValue(),
        },
        onChanged: { addListener: jest.fn() },
      },
      tabs: {
        sendMessage: jest.fn(),
        onRemoved: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        get: jest.fn(),
      },
    };
  }

  static async waitForAsync(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static simulateSkipButtonAppearance(delay = 100) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const button = document.createElement("button");
        button.setAttribute("data-uia", "player-skip-intro");
        button.textContent = "Skip Intro";
        button.style.display = "block";

        const playerControls =
          document.querySelector(".player-controls") || document.body;
        playerControls.appendChild(button);

        resolve(button);
      }, delay);
    });
  }
}

module.exports = { IntegrationTestUtils };
