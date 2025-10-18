/**
 * Jest Configuration for Unit Tests
 * Configures TypeScript compilation and test environment
 */

import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  displayName: "Unit Tests",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  testMatch: ["**/tests/**/*.test.ts", "**/src/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.ts",
    "!node_modules/**",
    "!coverage/**",
    "!dist/**",
    "!**/*.d.ts",
    "!tests/**",
    "!frontend-src/**",
    "!**/*.config.ts",
    "!**/*.config.js",
  ],
  coverageDirectory: "./coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  testTimeout: 10000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  transformIgnorePatterns: ["node_modules/(?!(.*\\.mjs$))"],
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};

export default config;
