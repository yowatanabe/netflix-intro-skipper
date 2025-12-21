// Netflix Intro Skipper - Version Management
// Centralized version information utilities

/**
 * Get version information from manifest.json
 * @returns {Object} Version information
 */
function getVersionInfo() {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.getManifest
    ) {
      const manifest = chrome.runtime.getManifest();
      return {
        version: manifest.version,
        name: manifest.name,
        description: manifest.description,
        manifestVersion: manifest.manifest_version,
      };
    } else {
      // Fallback for environments where chrome API is not available
      return {
        version: "unknown",
        name: "Netflix Intro Skipper",
        description: "Chrome extension version info unavailable",
        manifestVersion: 3,
      };
    }
  } catch (error) {
    console.warn("[Version] Failed to get version info:", error.message);
    return {
      version: "error",
      name: "Netflix Intro Skipper",
      description: "Error retrieving version info",
      manifestVersion: 3,
    };
  }
}

/**
 * Get formatted version string
 * @returns {string} Formatted version (e.g., "v1.0.1")
 */
function getFormattedVersion() {
  const versionInfo = getVersionInfo();
  return `v${versionInfo.version}`;
}

/**
 * Get full version string with name
 * @returns {string} Full version string (e.g., "Netflix Intro Skipper v1.0.1")
 */
function getFullVersionString() {
  const versionInfo = getVersionInfo();
  return `${versionInfo.name} v${versionInfo.version}`;
}

// Export for different module systems
if (typeof module !== "undefined" && module.exports) {
  // Node.js/CommonJS
  module.exports = {
    getVersionInfo,
    getFormattedVersion,
    getFullVersionString,
  };
} else if (typeof window !== "undefined") {
  // Browser global
  window.VersionUtils = {
    getVersionInfo,
    getFormattedVersion,
    getFullVersionString,
  };
}
