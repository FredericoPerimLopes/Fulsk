import { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.constant.ts',
    '!src/**/constants/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Test projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      testTimeout: 30000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      testTimeout: 60000
    }
  ],

  // Global configuration
  verbose: true,
  testTimeout: 30000,
  maxWorkers: '50%',
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },

  // File patterns to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/client/'
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Detect open handles (useful for debugging)
  detectOpenHandles: true,
  forceExit: true,

  // Error handling
  errorOnDeprecated: true,
  
  // Silent mode (reduce noise in test output)
  silent: false,
  
  // Watch mode configuration (for development)
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/logs/'
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts'
};

export default config;