// Domain Filtering Property Tests
// Feature: netflix-intro-skipper, Property 8: Domain restriction

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

// Define NetflixDomainFilter class for testing
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
      "netf", // Croatia
      "netflix.si", // Slovenia
      "netflix.sk", // Slovakia
      "netflix.lt", // Lithuania
      "netflix.lv", // Latvia
      "netflix.ee", // Estonia
      "netflix.ie", // Ireland
      "netflix.pt", // Portugal
      "netflix.gr", // Greece
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
      "netflix.com.mx", // Mexico
      "netflix.com.br", // Brazil
      "netflix.com.ar", // Argentina
      "netflix.cl", // Chile
      "netflix.com.co", // Colombia
      "netflix.com.pe", // Peru
      "netflix.com.tr", // Turkey
      "netflix.co.il", // Israel
      "netflix.co.za", // South Africa
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

  isNetflixDomain(hostname) {
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
      if (global.errorHandler) {
        global.errorHandler.handleError(
          error,
          "NetflixDomainFilter.isNetflixDomain",
          true
        );
      }
      return false;
    }
  }

  getAllowedDomains() {
    return [...this.allowedDomains];
  }
}

describe("Domain Filtering Tests", () => {
  let domainFilter;

  beforeEach(() => {
    domainFilter = new NetflixDomainFilter();
  });

  describe("Unit Tests - Specific Examples", () => {
    test("should allow main Netflix domains", () => {
      expect(domainFilter.isNetflixDomain("netflix.com")).toBe(true);
      expect(domainFilter.isNetflixDomain("www.netflix.com")).toBe(true);
    });

    test("should allow regional Netflix domains", () => {
      expect(domainFilter.isNetflixDomain("netflix.co.uk")).toBe(true);
      expect(domainFilter.isNetflixDomain("netflix.de")).toBe(true);
      expect(domainFilter.isNetflixDomain("netflix.co.jp")).toBe(true);
      expect(domainFilter.isNetflixDomain("netflix.com.br")).toBe(true);
    });

    test("should reject non-Netflix domains", () => {
      expect(domainFilter.isNetflixDomain("youtube.com")).toBe(false);
      expect(domainFilter.isNetflixDomain("amazon.com")).toBe(false);
      expect(domainFilter.isNetflixDomain("hulu.com")).toBe(false);
      expect(domainFilter.isNetflixDomain("disney.com")).toBe(false);
    });

    test("should reject Netflix-like but invalid domains", () => {
      expect(domainFilter.isNetflixDomain("netflix-fake.com")).toBe(false);
      expect(domainFilter.isNetflixDomain("fake-netflix.com")).toBe(false);
      expect(domainFilter.isNetflixDomain("netflixfake.com")).toBe(false);
    });

    test("should handle edge cases", () => {
      expect(domainFilter.isNetflixDomain("")).toBe(false);
      expect(domainFilter.isNetflixDomain(null)).toBe(false);
      expect(domainFilter.isNetflixDomain(undefined)).toBe(false);
    });
  });

  describe("Property-Based Tests", () => {
    // **Property 8: Domain restriction**
    // **Validates: Requirements 4.1**
    test("Property 8: For any Netflix domain, isNetflixDomain should return true", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      fc.assert(
        fc.property(
          fc.constantFrom(...domainFilter.getAllowedDomains()),
          (netflixDomain) => {
            const result = domainFilter.isNetflixDomain(netflixDomain);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property 8: For any non-Netflix domain, isNetflixDomain should return false", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      const nonNetflixDomains = fc.oneof(
        // Common non-Netflix domains
        fc.constantFrom(
          "youtube.com",
          "amazon.com",
          "hulu.com",
          "disney.com",
          "apple.com",
          "google.com",
          "facebook.com",
          "twitter.com",
          "instagram.com",
          "tiktok.com",
          "twitch.tv",
          "reddit.com",
          "wikipedia.org",
          "github.com",
          "stackoverflow.com"
        ),
        // Random domains that don't contain netflix
        fc
          .tuple(
            fc.stringOf(
              fc
                .char()
                .filter((c) => c !== "." && c !== "-" && /[a-z0-9]/.test(c)),
              { minLength: 3, maxLength: 10 }
            ),
            fc.constantFrom(
              "com",
              "org",
              "net",
              "edu",
              "gov",
              "co.uk",
              "de",
              "fr"
            )
          )
          .map(([name, tld]) => `${name}.${tld}`)
          .filter((domain) => !domain.includes("netflix")),
        // Fake Netflix-like domains
        fc.constantFrom(
          "netflix-fake.com",
          "fake-netflix.com",
          "netflixfake.com",
          "notnetflix.com",
          "netflix.fake",
          "netflix.invalid"
        )
      );

      fc.assert(
        fc.property(nonNetflixDomains, (nonNetflixDomain) => {
          const result = domainFilter.isNetflixDomain(nonNetflixDomain);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 8: For any valid Netflix subdomain, isNetflixDomain should return true", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      const netflixSubdomains = fc
        .tuple(
          fc.stringOf(
            fc.char().filter((c) => /[a-z0-9-]/.test(c)),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom("netflix.com")
        )
        .map(([subdomain, domain]) => `${subdomain}.${domain}`);

      fc.assert(
        fc.property(netflixSubdomains, (subdomain) => {
          const result = domainFilter.isNetflixDomain(subdomain);
          return result === true;
        }),
        { numRuns: 100 }
      );
    });

    test("Property 8: Domain filtering should be case insensitive", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      fc.assert(
        fc.property(
          fc.constantFrom(...domainFilter.getAllowedDomains()),
          fc.constantFrom("upper", "lower", "mixed"),
          (netflixDomain, caseType) => {
            let testDomain;
            switch (caseType) {
              case "upper":
                testDomain = netflixDomain.toUpperCase();
                break;
              case "lower":
                testDomain = netflixDomain.toLowerCase();
                break;
              case "mixed":
                testDomain = netflixDomain
                  .split("")
                  .map((c, i) =>
                    i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
                  )
                  .join("");
                break;
              default:
                testDomain = netflixDomain;
            }

            const result = domainFilter.isNetflixDomain(testDomain);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property 8: www prefix should not affect Netflix domain detection", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      fc.assert(
        fc.property(
          fc.constantFrom(
            ...domainFilter
              .getAllowedDomains()
              .filter((d) => !d.startsWith("www."))
          ),
          (netflixDomain) => {
            const withWww = `www.${netflixDomain}`;
            const withoutWww = netflixDomain;

            const resultWith = domainFilter.isNetflixDomain(withWww);
            const resultWithout = domainFilter.isNetflixDomain(withoutWww);

            // Both should return true for Netflix domains
            return resultWith === true && resultWithout === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test("Property 8: Invalid input should always return false", () => {
      // Feature: netflix-intro-skipper, Property 8: Domain restriction
      const invalidInputs = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.constant(""),
        fc.constant("   "),
        fc.integer(),
        fc.boolean(),
        fc.array(fc.string()),
        fc.object()
      );

      fc.assert(
        fc.property(invalidInputs, (invalidInput) => {
          const result = domainFilter.isNetflixDomain(invalidInput);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe("Edge Cases", () => {
    test("should handle domains with special characters", () => {
      expect(domainFilter.isNetflixDomain("netflix.com/")).toBe(false);
      expect(domainFilter.isNetflixDomain("netflix.com?")).toBe(false);
      expect(domainFilter.isNetflixDomain("netflix.com#")).toBe(false);
    });

    test("should handle very long domain names", () => {
      const longDomain = "a".repeat(100) + ".netflix.com";
      expect(domainFilter.isNetflixDomain(longDomain)).toBe(true);
    });

    test("should handle domains with numbers and hyphens", () => {
      expect(domainFilter.isNetflixDomain("test-123.netflix.com")).toBe(true);
      expect(domainFilter.isNetflixDomain("123-test.netflix.com")).toBe(true);
    });
  });
});
