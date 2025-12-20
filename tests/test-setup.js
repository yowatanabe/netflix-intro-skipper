// Test setup for Jest
const { TextEncoder, TextDecoder } = require("util");

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys) => Promise.resolve({ autoSkipEnabled: true })),
      set: jest.fn((data) => Promise.resolve()),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
