// @ts-check
const path = require("node:path");

/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@parcel-flow/contract$": path.resolve(__dirname, "../src/features/mobile-api/contract.ts"),
    // Same as metro.config.js: the contract must use this app's zod.
    "^zod$": require.resolve("zod"),
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
