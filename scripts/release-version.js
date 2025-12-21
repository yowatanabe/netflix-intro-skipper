#!/usr/bin/env node

/**
 * Release Version Management Script
 * Checks version consistency and synchronizes version from package.json to manifest.json
 */

const fs = require("fs");
const path = require("path");

function checkVersionConsistency() {
  try {
    // Read package.json
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const packageVersion = packageJson.version;

    // Read manifest.json
    const manifestPath = path.join(__dirname, "..", "manifest.json");
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const manifestVersion = manifestJson.version;

    console.log(`📦 Package version: ${packageVersion}`);
    console.log(`📋 Manifest version: ${manifestVersion}`);

    if (packageVersion !== manifestVersion) {
      console.error("❌ Version mismatch detected!");
      console.error(`   package.json: ${packageVersion}`);
      console.error(`   manifest.json: ${manifestVersion}`);
      console.error("");
      console.error(
        "Please ensure both files have the same version before running version commands."
      );
      console.error(
        "You can manually edit one of the files to match the other."
      );
      process.exit(1);
    }

    console.log("✅ Versions are consistent!");
    return true;
  } catch (error) {
    console.error("❌ Version check failed:", error.message);
    process.exit(1);
  }
}

function syncVersion(dryRun = false) {
  try {
    // Read package.json
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const version = packageJson.version;

    console.log(`📦 Package version: ${version}`);

    // Read manifest.json
    const manifestPath = path.join(__dirname, "..", "manifest.json");
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    // Update manifest version
    const oldVersion = manifestJson.version;

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No files will be modified");
      console.log(`🔄 Would update manifest.json: ${oldVersion} → ${version}`);
      if (oldVersion === version) {
        console.log("ℹ️  No changes needed - versions are already in sync");
      }
      console.log("✅ Dry run completed successfully!");
      return true;
    }

    manifestJson.version = version;

    // Write updated manifest.json
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifestJson, null, 2) + "\n"
    );

    console.log(`🔄 Updated manifest.json: ${oldVersion} → ${version}`);
    console.log("✅ Version sync completed successfully!");

    return true;
  } catch (error) {
    console.error("❌ Version sync failed:", error.message);
    process.exit(1);
  }
}

function getNextVersion(currentVersion, type) {
  const parts = currentVersion.split(".").map(Number);

  switch (type) {
    case "patch":
      parts[2]++;
      break;
    case "minor":
      parts[1]++;
      parts[2] = 0;
      break;
    case "major":
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    default:
      throw new Error(`Unknown version type: ${type}`);
  }

  return parts.join(".");
}

function dryRunVersion(type) {
  try {
    console.log("🔍 DRY RUN MODE - No files will be modified");
    console.log("");

    // Check version consistency first
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const currentVersion = packageJson.version;

    const manifestPath = path.join(__dirname, "..", "manifest.json");
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const manifestVersion = manifestJson.version;

    console.log("📋 Current state:");
    console.log(`   📦 package.json: ${currentVersion}`);
    console.log(`   📋 manifest.json: ${manifestVersion}`);
    console.log("");

    if (currentVersion !== manifestVersion) {
      console.error("❌ Version mismatch detected!");
      console.error("   This would cause the version command to fail.");
      console.error("   Please fix the version mismatch first.");
      return false;
    }

    const nextVersion = getNextVersion(currentVersion, type);

    console.log("🚀 Planned operations:");
    console.log(`   1. Run tests (npm test)`);
    console.log(
      `   2. Update package.json: ${currentVersion} → ${nextVersion}`
    );
    console.log(
      `   3. Update manifest.json: ${currentVersion} → ${nextVersion}`
    );
    console.log("");
    console.log("✅ Dry run completed successfully!");
    console.log(`💡 To execute: npm run version:${type}`);

    return true;
  } catch (error) {
    console.error("❌ Dry run failed:", error.message);
    process.exit(1);
  }
}

// Check command line arguments
const command = process.argv[2];
const isDryRun = process.argv.includes("--dry-run");

if (command === "check") {
  checkVersionConsistency();
} else if (command === "sync") {
  syncVersion(isDryRun);
} else if (command === "dry-run" && process.argv[3]) {
  const versionType = process.argv[3];
  if (["patch", "minor", "major"].includes(versionType)) {
    dryRunVersion(versionType);
  } else {
    console.error("Usage: node release-version.js dry-run [patch|minor|major]");
    process.exit(1);
  }
} else {
  console.error(
    "Usage: node release-version.js [check|sync|dry-run] [--dry-run]"
  );
  console.error("Examples:");
  console.error("  node release-version.js check");
  console.error("  node release-version.js sync");
  console.error("  node release-version.js sync --dry-run");
  console.error("  node release-version.js dry-run patch");
  console.error("  node release-version.js dry-run minor");
  console.error("  node release-version.js dry-run major");
  process.exit(1);
}

module.exports = { checkVersionConsistency, syncVersion, dryRunVersion };
