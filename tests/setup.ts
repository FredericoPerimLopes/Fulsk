import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(() => {
  console.log('🧪 Test suite starting...');
});

afterAll(() => {
  console.log('🏁 Test suite completed');
});

// Mock external services for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  })),
}));

// Export test utilities
export const testConfig = {
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_pass@localhost:5432/fulsk_test',
  },
  jwt: {
    secret: 'test-jwt-secret',
    expiresIn: '1h',
  },
};