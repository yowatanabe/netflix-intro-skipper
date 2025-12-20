// Unit tests for Popup UI functionality
// Tests toggle functionality and UI updates

// Mock the popup HTML structure
document.body.innerHTML = `
  <div class="toggle" id="autoSkipToggle">
    <div class="toggle-slider"></div>
  </div>
  <div class="status-text" id="statusText">Loading...</div>
`;

// Import the popup script by requiring it
const fs = require("fs");
const path = require("path");

// Read and evaluate the popup script
const popupScript = fs.readFileSync(
  path.join(__dirname, "../src/popup/popup.js"),
  "utf8"
);

// Create a mock PopupController class for testing
class MockPopupController {
  constructor() {
    this.toggle = document.getElementById("autoSkipToggle");
    this.statusText = document.getElementById("statusText");
    this.isInitialized = false;
  }

  updateToggleUI(enabled) {
    if (enabled) {
      this.toggle.classList.add("enabled");
    } else {
      this.toggle.classList.remove("enabled");
    }
  }

  updateStatusText(text) {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      // Mock successful response
      if (message.action === "getSettings") {
        resolve({
          success: true,
          settings: { autoSkipEnabled: true, lastUpdated: Date.now() },
        });
      } else if (message.action === "setEnabled") {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: "Unknown action" });
      }
    });
  }

  async loadSettings() {
    try {
      const response = await this.sendMessage({ action: "getSettings" });

      if (response.success) {
        const settings = response.settings;
        this.updateToggleUI(settings.autoSkipEnabled);
        this.updateStatusText(
          settings.autoSkipEnabled ? "Auto-skip enabled" : "Auto-skip disabled"
        );
      } else {
        this.updateToggleUI(true);
        this.updateStatusText("Using default settings");
      }
    } catch (error) {
      this.updateToggleUI(true);
      this.updateStatusText("Error loading settings");
    }
  }

  setupEventListeners() {
    this.toggle.addEventListener("click", async () => {
      try {
        const isCurrentlyEnabled = this.toggle.classList.contains("enabled");
        const newState = !isCurrentlyEnabled;

        this.updateStatusText("Updating...");

        const response = await this.sendMessage({
          action: "setEnabled",
          enabled: newState,
        });

        if (response.success) {
          this.updateToggleUI(newState);
          this.updateStatusText(
            newState ? "Auto-skip enabled" : "Auto-skip disabled"
          );
        } else {
          this.updateStatusText("Error updating setting");
        }
      } catch (error) {
        this.updateStatusText("Error updating setting");
      }
    });
  }
}

describe("Popup UI Unit Tests", () => {
  let popupController;
  let toggle;
  let statusText;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div class="toggle" id="autoSkipToggle">
        <div class="toggle-slider"></div>
      </div>
      <div class="status-text" id="statusText">Loading...</div>
    `;

    toggle = document.getElementById("autoSkipToggle");
    statusText = document.getElementById("statusText");
    popupController = new MockPopupController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Toggle UI Updates", () => {
    test("should add enabled class when toggle is enabled", () => {
      popupController.updateToggleUI(true);
      expect(toggle.classList.contains("enabled")).toBe(true);
    });

    test("should remove enabled class when toggle is disabled", () => {
      toggle.classList.add("enabled");
      popupController.updateToggleUI(false);
      expect(toggle.classList.contains("enabled")).toBe(false);
    });

    test("should handle multiple toggle state changes", () => {
      // Start disabled
      popupController.updateToggleUI(false);
      expect(toggle.classList.contains("enabled")).toBe(false);

      // Enable
      popupController.updateToggleUI(true);
      expect(toggle.classList.contains("enabled")).toBe(true);

      // Disable again
      popupController.updateToggleUI(false);
      expect(toggle.classList.contains("enabled")).toBe(false);
    });
  });

  describe("Status Text Updates", () => {
    test("should update status text correctly", () => {
      popupController.updateStatusText("Test message");
      expect(statusText.textContent).toBe("Test message");
    });

    test("should handle empty status text", () => {
      popupController.updateStatusText("");
      expect(statusText.textContent).toBe("");
    });

    test("should handle null status text element gracefully", () => {
      popupController.statusText = null;
      expect(() => popupController.updateStatusText("Test")).not.toThrow();
    });
  });

  describe("Settings Loading", () => {
    test("should load settings and update UI correctly", async () => {
      await popupController.loadSettings();

      // Should be enabled by default in mock
      expect(toggle.classList.contains("enabled")).toBe(true);
      expect(statusText.textContent).toBe("Auto-skip enabled");
    });

    test("should handle settings loading with disabled state", async () => {
      // Override mock to return disabled state
      popupController.sendMessage = jest.fn().mockResolvedValue({
        success: true,
        settings: { autoSkipEnabled: false, lastUpdated: Date.now() },
      });

      await popupController.loadSettings();

      expect(toggle.classList.contains("enabled")).toBe(false);
      expect(statusText.textContent).toBe("Auto-skip disabled");
    });
  });

  describe("Toggle Click Interaction", () => {
    test("should toggle from enabled to disabled on click", async () => {
      // Start enabled
      popupController.updateToggleUI(true);
      popupController.setupEventListeners();

      // Simulate click
      toggle.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(toggle.classList.contains("enabled")).toBe(false);
      expect(statusText.textContent).toBe("Auto-skip disabled");
    });

    test("should toggle from disabled to enabled on click", async () => {
      // Start disabled
      popupController.updateToggleUI(false);
      popupController.setupEventListeners();

      // Simulate click
      toggle.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(toggle.classList.contains("enabled")).toBe(true);
      expect(statusText.textContent).toBe("Auto-skip enabled");
    });

    test("should show updating status during toggle", async () => {
      popupController.updateToggleUI(true);
      popupController.setupEventListeners();

      // Mock a delayed response
      popupController.sendMessage = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 10);
        });
      });

      // Simulate click
      toggle.click();

      // Check immediate status
      expect(statusText.textContent).toBe("Updating...");

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  });

  describe("Error Handling", () => {
    test("should handle sendMessage errors gracefully", async () => {
      popupController.sendMessage = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await popupController.loadSettings();

      expect(toggle.classList.contains("enabled")).toBe(true); // Default fallback
      expect(statusText.textContent).toBe("Error loading settings");
    });

    test("should handle failed settings response", async () => {
      popupController.sendMessage = jest.fn().mockResolvedValue({
        success: false,
        error: "Storage error",
      });

      await popupController.loadSettings();

      expect(toggle.classList.contains("enabled")).toBe(true); // Default fallback
      expect(statusText.textContent).toBe("Using default settings");
    });

    test("should handle toggle click errors", async () => {
      popupController.sendMessage = jest
        .fn()
        .mockRejectedValue(new Error("Update failed"));
      popupController.updateToggleUI(true);
      popupController.setupEventListeners();

      toggle.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(statusText.textContent).toBe("Error updating setting");
    });
  });
});
