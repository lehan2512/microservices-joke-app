// jest.setup.js
// Automatically mock the ../db module using small in-repo fixtures so tests
// run deterministically in CI without real databases.

// Note: this file must live outside of __tests__ so Jest doesn't pick it up
// as a test file. It's specified in package.json -> jest.setupFiles.

// Mock the local DB module so tests use the manual mock in tests/__mocks__/db.js
// Use a factory so we mock './db' (the real module path) with the test mock.
jest.mock('../db', () => require('./mock/db'));
