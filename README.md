# Netflix Intro Skipper

**English** | [日本語](README.ja.md)

A Chrome extension that automatically clicks Netflix's "Skip Intro" button for you.

## 🎯 Features

- ✅ Detects and clicks Netflix's "Skip Intro" button automatically
- ✅ Toggle auto-skip on and off from the popup
- ✅ Works on Netflix domains around the world
- ✅ Lightweight and non-intrusive: it never alters the page's look or playback
- ✅ Multi-language support (English, Japanese, and others)
- ✅ Session handling for multiple videos
- ✅ Robust error handling
- ✅ No data collection: settings are stored locally with `chrome.storage`, and the extension makes no network requests

> The extension only presses the button Netflix already shows. It does not work on titles where Netflix does not display a "Skip Intro" button.

## 🚀 Installation

**Note**: The extension is not published on the Chrome Web Store yet. Install it manually:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Turn on **Developer mode** in the top right
4. Click **Load unpacked**
5. Select the extension directory (the one that contains `manifest.json`)
6. The extension is installed and ready to use

## 📖 Usage

1. Open Netflix and start watching a video
2. When the intro appears, the extension skips it automatically
3. Use the extension popup to turn auto-skip on or off
4. Your settings are kept across browser sessions

## ⚠️ Disclaimer

- This extension is not affiliated with, endorsed by, or sponsored by Netflix, Inc.
- Netflix is a trademark of Netflix, Inc.
- Netflix's Terms of Use restrict inserting code into its service and using automated means. Using this extension may conflict with those terms. Use it at your own risk.
- The extension does not collect or transmit any user data.

## 🛠️ Development

You only need this section if you want to modify the code or run the tests.

### Setup

```bash
# Install dependencies (for development and testing)
npm install

# Run all tests
npm test

# Run a specific test
npm test -- integration.test.js

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

### Workflow

1. **Source code**: edit the files in `src/`
2. **Tests**: write and run tests in `tests/` (Jest + jsdom, with property-based tests using fast-check)
3. **Icons**: manage icon files in `assets/icons/`
4. **Try it in Chrome**: reload the extension from `chrome://extensions/`

jsdom tests cannot cover the popup UI or content script behavior in a real browser, so check those manually in Chrome.

### Releasing a version

`package.json` is the source of truth for the version. The script syncs it to `manifest.json`. **Do not edit `version` in `manifest.json` by hand.**

```bash
# Patch (bug fixes: 1.0.1 → 1.0.2)
npm run version:patch

# Minor (new features: 1.0.1 → 1.1.0)
npm run version:minor

# Major (breaking changes: 1.0.1 → 2.0.0)
npm run version:major
```

Dry run (see what would happen first):

```bash
npm run version:dry-run:patch
npm run version:dry-run:minor
npm run version:dry-run:major
```

The command checks that the versions are consistent, runs `npm version` (which runs `npm test` in `preversion`), then syncs `manifest.json`. No git tag is created, so add a tag such as `v1.0.2` yourself.

### Project structure

```none
netflix-intro-skipper/
├── .kiro/specs/netflix-intro-skipper/  # Requirements, design, and tasks (Kiro specs)
├── assets/icons/                       # Extension icons
├── scripts/
│   └── release-version.js              # Release version management script
├── src/
│   ├── popup/                          # Popup UI (popup.html, popup.js)
│   ├── background.js                   # Background service worker
│   ├── content.js                      # Content script for Netflix pages
│   ├── integration.js                  # Messaging and state sync between components
│   ├── settings.js                     # Settings management
│   └── version.js                      # Version utility
├── tests/                              # Jest tests
├── LICENSE                             # MIT license
├── manifest.json                       # Extension manifest (Manifest V3)
├── package.json                        # Project and test configuration
├── README.md                           # README (English)
└── README.ja.md                        # README (Japanese)
```

The content scripts are loaded in the order listed in `manifest.json` (`version.js` → `settings.js` → `integration.js` → `content.js`). If you add or split files, update that list too.

## 🏗️ Technical details

- **Manifest V3**: the current Chrome extension platform
- **Permissions**: `storage` and `activeTab`, plus host access to Netflix domains only

## 📋 Requirements

- Google Chrome (Manifest V3 support)
- A Netflix subscription

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Kiro](https://kiro.dev): the agentic IDE that supported development, from specs, design, and tasks through implementation and testing
- [Lovart AI](https://lovart.ai): used to design the extension icon
