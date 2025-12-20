// Feature: netflix-intro-skipper, Property 6: 設定の永続化
// Property-based test for settings persistence across browser sessions

const fc = require("fast-check");
const SettingsManager = require("../src/settings.js");

describe("Settings Persistence Property Tests", () => {
  let settingsManager;
  let mockStorage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock storage that persists data
    mockStorage = new Map();

    // Mock Chrome storage API with persistent behavior
    global.chrome.storage.sync.get = jest.fn((keys) => {
      const result = {};
      if (typeof keys === "object" && keys !== null) {
        // Handle default values object
        Object.keys(keys).forEach((key) => {
          result[key] = mockStorage.has(key) ? mockStorage.get(key) : keys[key];
        });
      } else if (Array.isArray(keys)) {
        // Handle array of keys
        keys.forEach((key) => {
          if (mockStorage.has(key)) {
            result[key] = mockStorage.get(key);
          }
        });
      } else if (typeof keys === "string") {
        // Handle single key
        if (mockStorage.has(keys)) {
          result[keys] = mockStorage.get(keys);
        }
      }
      return Promise.resolve(result);
    });

    global.chrome.storage.sync.set = jest.fn((data) => {
      Object.keys(data).forEach((key) => {
        mockStorage.set(key, data[key]);
      });
      return Promise.resolve();
    });

    settingsManager = new SettingsManager();
  });

  // Property 6: 設定の永続化
  // For any user settings, the extension maintains the same setting values across browser sessions
  test("Property 6: Settings persistence across sessions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          autoSkipEnabled: fc.boolean(),
          customSetting: fc.string(),
          numericSetting: fc.integer({ min: 0, max: 1000 }),
        }),
        async (testSettings) => {
          // Simulate first session - save settings
          await settingsManager.updateSettings(testSettings);

          // Verify settings were stored
          const storedSettings = await settingsManager.getSettings();
          expect(storedSettings.autoSkipEnabled).toBe(
            testSettings.autoSkipEnabled
          );

          // Simulate new session - create new settings manager instance
          const newSessionManager = new SettingsManager();

          // Verify settings persist across sessions
          const persistedSettings = await newSessionManager.getSettings();

          // The core setting should persist
          expect(persistedSettings.autoSkipEnabled).toBe(
            testSettings.autoSkipEnabled
          );

          // lastUpdated should be present and be a number
          expect(typeof persistedSettings.lastUpdated).toBe("number");
          expect(persistedSettings.lastUpdated).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6a: Enabled status persistence", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (enabledStatus) => {
        // Set enabled status in first session
        await settingsManager.setEnabled(enabledStatus);

        // Simulate new session
        const newSessionManager = new SettingsManager();

        // Verify enabled status persists
        const persistedEnabled = await newSessionManager.getEnabled();
        expect(persistedEnabled).toBe(enabledStatus);
      }),
      { numRuns: 100 }
    );
  });

  test("Property 6b: Settings update persistence", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          autoSkipEnabled: fc.boolean(),
          additionalData: fc.string(),
        }),
        fc.record({
          autoSkipEnabled: fc.boolean(),
          newData: fc.integer(),
        }),
        async (initialSettings, updateSettings) => {
          // Set initial settings
          await settingsManager.updateSettings(initialSettings);

          // Update settings
          await settingsManager.updateSettings(updateSettings);

          // Simulate new session
          const newSessionManager = new SettingsManager();
          const finalSettings = await newSessionManager.getSettings();

          // Verify the updated autoSkipEnabled persists
          expect(finalSettings.autoSkipEnabled).toBe(
            updateSettings.autoSkipEnabled
          );

          // Verify lastUpdated was updated
          expect(typeof finalSettings.lastUpdated).toBe("number");
        }
      ),
      { numRuns: 100 }
    );
  });
});
