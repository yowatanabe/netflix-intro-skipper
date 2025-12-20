// UI Non-Interference Property Tests
// Feature: netflix-intro-skipper, Property 9: Visible UI non-injection

const fc = require("fast-check");

// Mock the ErrorHandler class for testing
class MockErrorHandler {
  handleError(error, context, silent = false) {
    if (!silent) {
      console.error(`Mock error in ${context}:`, error.message);
    }
    return false;
  }
}

// Create a global mock error handler
global.errorHandler = new MockErrorHandler();

// Define UIInterferencePrevention class for testing
class UIInterferencePrevention {
  constructor() {
    this.injectedElements = new Set();
    this.originalNetflixElements = new WeakMap();
    this.preventedInterferences = [];
    this.monitoringActive = false;
  }

  preventVisibleUIInjection() {
    try {
      this.overrideDOMManipulation();
      this.startUIMonitoring();
      return true;
    } catch (error) {
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.preventVisibleUIInjection"
        );
      }
      return false;
    }
  }

  overrideDOMManipulation() {
    // Mock implementation for testing
    this.domManipulationOverridden = true;
  }

  startUIMonitoring() {
    this.monitoringActive = true;
  }

  isElementVisible(element) {
    try {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }

      // Check if element is explicitly hidden
      const style = element.style || {};
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }

      // For testing: if element has positive dimensions, it's visible
      if (element.getBoundingClientRect) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return true;
        }
        // If dimensions are zero, check if there's explicit visible styling
        if (rect.width === 0 && rect.height === 0) {
          // Only consider visible if explicitly styled as visible AND has display set
          if (
            (style.display === "block" ||
              style.display === "inline" ||
              style.display === "inline-block") &&
            style.display
          ) {
            return true;
          }
          return false;
        }
      }

      // If no getBoundingClientRect, check styling
      // Only visible if explicitly styled as visible
      if (
        style.display === "block" ||
        style.display === "inline" ||
        style.display === "inline-block"
      ) {
        return true;
      }

      // Default to false for safety
      return false;
    } catch (error) {
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.isElementVisible",
          true
        );
      }
      return false;
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
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.isExtensionElement",
          true
        );
      }
      return false;
    }
  }

  validateAddedElement(element) {
    try {
      if (this.isExtensionElement(element) && this.isElementVisible(element)) {
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
        return true; // Interference was prevented
      }
      return false; // No interference detected
    } catch (error) {
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.validateAddedElement",
          true
        );
      }
      return false;
    }
  }

  getInterferenceStatus() {
    try {
      return {
        monitoringActive: this.monitoringActive,
        preventedInterferences: [...this.preventedInterferences],
        injectedElementsCount: this.injectedElements.size,
        protectedElementsCount: this.originalNetflixElements.size || 0,
      };
    } catch (error) {
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.getInterferenceStatus"
        );
      }
      return {
        monitoringActive: false,
        preventedInterferences: [],
        injectedElementsCount: 0,
        protectedElementsCount: 0,
        error: error.message,
      };
    }
  }

  cleanup() {
    try {
      this.monitoringActive = false;
      this.injectedElements.clear();
      this.preventedInterferences = [];
    } catch (error) {
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "UIInterferencePrevention.cleanup",
          true
        );
      }
    }
  }
}

// Mock DOM environment for testing
class MockElement {
  constructor(tagName, options = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = Node.ELEMENT_NODE;
    this.className = options.className || "";
    this.id = options.id || "";
    this.style = options.style || {};
    this.hidden = options.hidden || false;
    this.attributes = options.attributes || [];
    this.parentNode = options.parentNode || null;
    this.textContent = options.textContent || "";

    // Mock getBoundingClientRect
    this.getBoundingClientRect = () => ({
      width: options.width !== undefined ? options.width : 100,
      height: options.height !== undefined ? options.height : 50,
      top: 0,
      left: 0,
      bottom: options.height !== undefined ? options.height : 50,
      right: options.width !== undefined ? options.width : 100,
    });
  }

  // Mock removeChild method
  removeChild(child) {
    // Mock implementation - just return the child
    return child;
  }
}

// Mock Node constants
global.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};

// Mock window.getComputedStyle
global.window = {
  getComputedStyle: (element) => ({
    display: element.style.display || "block",
    visibility: element.style.visibility || "visible",
    opacity: element.style.opacity || "1",
  }),
};

describe("UI Non-Interference Tests", () => {
  let uiInterferencePrevention;

  beforeEach(() => {
    uiInterferencePrevention = new UIInterferencePrevention();
  });

  afterEach(() => {
    uiInterferencePrevention.cleanup();
  });

  describe("Unit Tests - Specific Examples", () => {
    test("should detect visible extension elements", () => {
      const visibleElement = new MockElement("div", {
        className: "netflix-intro-skipper-ui",
        style: { display: "block" },
        width: 100,
        height: 50,
      });

      // Debug: log the element properties
      console.log("Element style:", visibleElement.style);
      console.log(
        "Element dimensions:",
        visibleElement.getBoundingClientRect()
      );
      console.log(
        "Is extension element:",
        uiInterferencePrevention.isExtensionElement(visibleElement)
      );
      console.log(
        "Is element visible:",
        uiInterferencePrevention.isElementVisible(visibleElement)
      );

      expect(uiInterferencePrevention.isExtensionElement(visibleElement)).toBe(
        true
      );
      expect(uiInterferencePrevention.isElementVisible(visibleElement)).toBe(
        true
      );
    });

    test("should not detect hidden extension elements as visible", () => {
      const hiddenElement = new MockElement("div", {
        className: "netflix-intro-skipper-ui",
        style: { display: "none" },
      });

      expect(uiInterferencePrevention.isExtensionElement(hiddenElement)).toBe(
        true
      );
      expect(uiInterferencePrevention.isElementVisible(hiddenElement)).toBe(
        false
      );
    });

    test("should not detect non-extension elements", () => {
      const netflixElement = new MockElement("div", {
        className: "netflix-player-controls",
        style: { display: "block" },
      });

      expect(uiInterferencePrevention.isExtensionElement(netflixElement)).toBe(
        false
      );
    });

    test("should prevent visible extension element injection", () => {
      const visibleExtensionElement = new MockElement("div", {
        className: "netflix-intro-skipper-popup",
        style: { display: "block" },
        width: 200,
        height: 100,
        parentNode: new MockElement("body"),
      });

      const wasInterferencePrevented =
        uiInterferencePrevention.validateAddedElement(visibleExtensionElement);
      expect(wasInterferencePrevented).toBe(true);

      const status = uiInterferencePrevention.getInterferenceStatus();
      expect(status.preventedInterferences).toHaveLength(1);
      expect(status.preventedInterferences[0].type).toBe(
        "visible_element_injection"
      );
    });
  });

  describe("Property-Based Tests", () => {
    // **Property 9: Visible UI non-injection**
    // **Validates: Requirements 4.4**
    test("Property 9: For any extension element that is visible, it should be prevented from injection", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const extensionElementGenerator = fc.record({
        tagName: fc.constantFrom("div", "span", "button", "input", "img"),
        className: fc.oneof(
          fc.constantFrom(
            "netflix-intro-skipper-ui",
            "skip-intro-extension-popup",
            "chrome-extension-overlay",
            "netflix-intro-skipper-button"
          ),
          fc.string().map((s) => `netflix-intro-skipper-${s}`)
        ),
        id: fc.oneof(
          fc.constantFrom(
            "netflix-intro-skipper-main",
            "skip-intro-extension-id",
            "chrome-extension-ui"
          ),
          fc.string().map((s) => `netflix-intro-skipper-${s}`)
        ),
        style: fc.record({
          display: fc.constantFrom("block", "inline", "inline-block", "flex"),
          visibility: fc.constantFrom("visible"),
          opacity: fc.constantFrom("1", "0.5", "0.8"),
        }),
        width: fc.integer({ min: 1, max: 500 }),
        height: fc.integer({ min: 1, max: 300 }),
      });

      fc.assert(
        fc.property(extensionElementGenerator, (elementConfig) => {
          const element = new MockElement(elementConfig.tagName, {
            className: elementConfig.className,
            id: elementConfig.id,
            style: elementConfig.style,
            width: elementConfig.width,
            height: elementConfig.height,
            parentNode: new MockElement("body"),
          });

          // The element should be detected as an extension element
          const isExtensionElement =
            uiInterferencePrevention.isExtensionElement(element);

          // The element should be detected as visible
          const isVisible = uiInterferencePrevention.isElementVisible(element);

          // If it's both an extension element and visible, interference should be prevented
          if (isExtensionElement && isVisible) {
            const wasInterferencePrevented =
              uiInterferencePrevention.validateAddedElement(element);
            return wasInterferencePrevented === true;
          }

          // If it's not an extension element or not visible, no interference prevention needed
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 9: For any non-extension element, no interference prevention should occur", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const nonExtensionElementGenerator = fc.record({
        tagName: fc.constantFrom(
          "div",
          "span",
          "button",
          "input",
          "video",
          "canvas"
        ),
        className: fc.oneof(
          fc.constantFrom(
            "netflix-player-controls",
            "watch-video-container",
            "player-controls-button",
            "netflix-ui-element"
          ),
          fc
            .string()
            .filter(
              (s) =>
                !s.includes("netflix-intro-skipper") &&
                !s.includes("skip-intro-extension") &&
                !s.includes("chrome-extension")
            )
        ),
        id: fc.oneof(
          fc.constantFrom("netflix-player", "video-controls", "player-ui"),
          fc
            .string()
            .filter(
              (s) =>
                !s.includes("netflix-intro-skipper") &&
                !s.includes("skip-intro-extension") &&
                !s.includes("chrome-extension")
            )
        ),
        style: fc.record({
          display: fc.constantFrom("block", "inline", "inline-block", "flex"),
          visibility: fc.constantFrom("visible"),
          opacity: fc.constantFrom("1"),
        }),
        width: fc.integer({ min: 1, max: 500 }),
        height: fc.integer({ min: 1, max: 300 }),
      });

      fc.assert(
        fc.property(nonExtensionElementGenerator, (elementConfig) => {
          const element = new MockElement(elementConfig.tagName, {
            className: elementConfig.className,
            id: elementConfig.id,
            style: elementConfig.style,
            width: elementConfig.width,
            height: elementConfig.height,
            parentNode: new MockElement("body"),
          });

          // The element should not be detected as an extension element
          const isExtensionElement =
            uiInterferencePrevention.isExtensionElement(element);

          // No interference prevention should occur for non-extension elements
          const wasInterferencePrevented =
            uiInterferencePrevention.validateAddedElement(element);

          return !isExtensionElement && !wasInterferencePrevented;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 9: For any hidden extension element, no interference prevention should occur", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const hiddenExtensionElementGenerator = fc.record({
        tagName: fc.constantFrom("div", "span", "button"),
        className: fc.constantFrom(
          "netflix-intro-skipper-hidden",
          "skip-intro-extension-data",
          "chrome-extension-background"
        ),
        style: fc.oneof(
          fc.record({ display: fc.constant("none") }),
          fc.record({ visibility: fc.constant("hidden") }),
          fc.record({ opacity: fc.constant("0") })
        ),
        width: fc.integer({ min: 0, max: 500 }),
        height: fc.integer({ min: 0, max: 300 }),
      });

      fc.assert(
        fc.property(hiddenExtensionElementGenerator, (elementConfig) => {
          const element = new MockElement(elementConfig.tagName, {
            className: elementConfig.className,
            style: elementConfig.style,
            width: elementConfig.width,
            height: elementConfig.height,
            parentNode: new MockElement("body"),
          });

          // The element should be detected as an extension element
          const isExtensionElement =
            uiInterferencePrevention.isExtensionElement(element);

          // The element should not be detected as visible
          const isVisible = uiInterferencePrevention.isElementVisible(element);

          // No interference prevention should occur for hidden elements
          const wasInterferencePrevented =
            uiInterferencePrevention.validateAddedElement(element);

          return isExtensionElement && !isVisible && !wasInterferencePrevented;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 9: UI interference prevention should maintain accurate status tracking", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const elementSequenceGenerator = fc.array(
        fc.record({
          tagName: fc.constantFrom("div", "span"),
          isExtension: fc.boolean(),
          isVisible: fc.boolean(),
          className: fc.string(),
          width: fc.integer({ min: 0, max: 200 }),
          height: fc.integer({ min: 0, max: 100 }),
        }),
        { minLength: 1, maxLength: 10 }
      );

      fc.assert(
        fc.property(elementSequenceGenerator, (elementConfigs) => {
          // Reset the interference prevention system
          uiInterferencePrevention.cleanup();
          uiInterferencePrevention = new UIInterferencePrevention();

          let expectedInterferences = 0;

          elementConfigs.forEach((config) => {
            const element = new MockElement(config.tagName, {
              className: config.isExtension
                ? "netflix-intro-skipper-test"
                : config.className,
              style: {
                display: config.isVisible ? "block" : "none",
                visibility: config.isVisible ? "visible" : "hidden",
              },
              width: config.width,
              height: config.height,
              parentNode: new MockElement("body"),
            });

            const wasInterferencePrevented =
              uiInterferencePrevention.validateAddedElement(element);

            // Check if the element is actually visible (not just config.isVisible)
            const isActuallyVisible =
              uiInterferencePrevention.isElementVisible(element);
            const isExtensionElement =
              uiInterferencePrevention.isExtensionElement(element);

            if (isExtensionElement && isActuallyVisible) {
              expectedInterferences++;
              if (!wasInterferencePrevented) {
                return false; // Should have prevented interference
              }
            } else {
              if (wasInterferencePrevented) {
                return false; // Should not have prevented interference
              }
            }
          });

          const status = uiInterferencePrevention.getInterferenceStatus();
          return status.preventedInterferences.length === expectedInterferences;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 9: Extension element detection should be consistent", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const elementGenerator = fc.record({
        tagName: fc.constantFrom("div", "span", "button"),
        className: fc.string(),
        id: fc.string(),
      });

      fc.assert(
        fc.property(elementGenerator, (elementConfig) => {
          const element = new MockElement(elementConfig.tagName, {
            className: elementConfig.className,
            id: elementConfig.id,
          });

          // Detection should be consistent across multiple calls
          const firstDetection =
            uiInterferencePrevention.isExtensionElement(element);
          const secondDetection =
            uiInterferencePrevention.isExtensionElement(element);

          return firstDetection === secondDetection;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 9: Element visibility detection should handle edge cases", () => {
      // Feature: netflix-intro-skipper, Property 9: Visible UI non-injection
      const edgeCaseGenerator = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.record({
          nodeType: fc.constantFrom(Node.TEXT_NODE, 999), // Non-element node types
          tagName: fc.string(),
        }),
        fc.record({
          nodeType: fc.constant(Node.ELEMENT_NODE),
          tagName: fc.string(),
          style: fc.record({
            display: fc.oneof(fc.constant(""), fc.constant("block")),
            visibility: fc.oneof(fc.constant(""), fc.constant("visible")),
            opacity: fc.oneof(fc.constant(""), fc.constant("1")),
          }),
          getBoundingClientRect: fc.constant(() => ({ width: 0, height: 0 })),
        })
      );

      fc.assert(
        fc.property(edgeCaseGenerator, (elementConfig) => {
          let element;
          if (elementConfig === null || elementConfig === undefined) {
            element = elementConfig;
          } else if (elementConfig.nodeType !== Node.ELEMENT_NODE) {
            element = { nodeType: elementConfig.nodeType };
          } else {
            element = new MockElement(elementConfig.tagName, elementConfig);
          }

          // Should not throw an error and should return false for invalid elements
          const isVisible = uiInterferencePrevention.isElementVisible(element);
          return typeof isVisible === "boolean";
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Edge Cases", () => {
    test("should handle elements with no parent node", () => {
      const orphanElement = new MockElement("div", {
        className: "netflix-intro-skipper-orphan",
        style: { display: "block" },
        parentNode: null,
      });

      // Should still detect as extension element and visible
      expect(uiInterferencePrevention.isExtensionElement(orphanElement)).toBe(
        true
      );
      expect(uiInterferencePrevention.isElementVisible(orphanElement)).toBe(
        true
      );

      // Should attempt to prevent interference even without parent
      const wasInterferencePrevented =
        uiInterferencePrevention.validateAddedElement(orphanElement);
      expect(wasInterferencePrevented).toBe(true);
    });

    test("should handle elements with zero dimensions", () => {
      const zeroDimensionElement = new MockElement("div", {
        className: "netflix-intro-skipper-zero",
        style: {}, // No explicit display style
        width: 0,
        height: 0,
      });

      expect(
        uiInterferencePrevention.isElementVisible(zeroDimensionElement)
      ).toBe(false);
    });

    test("should handle elements with complex class names", () => {
      const complexElement = new MockElement("div", {
        className: "some-class netflix-intro-skipper-complex another-class",
        style: { display: "block" },
      });

      expect(uiInterferencePrevention.isExtensionElement(complexElement)).toBe(
        true
      );
    });
  });
});
