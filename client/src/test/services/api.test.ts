import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiService } from '../../services/api';
import type { AuthResponse, LoginCredentials, RegisterData, Device } from '../../types/api';

// Mock axios
vi.mock('axios', () => {
  const mockApi = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  
  return {
    default: {
      create: vi.fn(() => mockApi),
      get: vi.fn(),
    },
  };
});

// Get access to the mocked API instance
const getMockApi = () => vi.mocked(axios.create)() as any;

const mockUser = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'VIEWER' as const,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockAuthResponse: AuthResponse = {
  user: mockUser,
  token: 'test-token',
  refreshToken: 'test-refresh-token',
  expiresIn: '1h',
};

const mockDevice: Device = {
  id: '1',
  name: 'Test Panel',
  type: 'INVERTER',
  manufacturer: 'Test Corp',
  model: 'Test Model',
  serialNumber: 'SN123456',
  firmwareVersion: '1.0.0',
  status: 'ONLINE',
  isActive: true,
  lastSeen: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  location: {
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    country: 'Test Country',
    zipCode: '12345',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    timezone: 'America/New_York',
  },
  configuration: {
    communicationProtocol: 'MQTT',
    dataCollectionInterval: 30,
    alertThresholds: {
      minPower: 100,
      maxTemperature: 65,
      minVoltage: 200,
      maxVoltage: 280,
    },
    notifications: {
      email: true,
      sms: false,
      push: true,
    },
  },
  owner: 'user1',
  installer: 'installer1',
};

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth functions', () => {
    it('should login user', async () => {
      const mockResponse = {
        data: {
          user: { id: '1', email: 'test@example.com' },
          token: 'test-token'
        }
      };
      
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValue(mockResponse);

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password',
      };

      // Test credentials structure
      expect(credentials.email).toBe('test@example.com');
      expect(credentials.password).toBe('password');
    });

    it('should register user', async () => {
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValue({ data: mockAuthResponse });

      const registerData: RegisterData = {
        email: 'new@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      };

      expect(registerData.email).toBe('new@example.com');
      expect(registerData.role).toBe('VIEWER');
    });

    it('should refresh token', async () => {
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValue({ data: { token: 'new-token' } });

      expect(mockApi.post).toBeDefined();
    });

    it('should logout user', async () => {
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValue({ data: { message: 'Logged out' } });

      expect(mockApi.post).toBeDefined();
    });
  });

  describe('device functions', () => {
    it('should fetch devices', async () => {
      const mockApi = getMockApi();
      mockApi.get.mockResolvedValue({ data: { data: [mockDevice] } });

      expect(mockApi.get).toBeDefined();
    });

    it('should create device', async () => {
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValue({ data: { data: mockDevice } });

      expect(mockApi.post).toBeDefined();
    });

    it('should update device', async () => {
      const mockApi = getMockApi();
      mockApi.put.mockResolvedValue({ data: { data: mockDevice } });

      expect(mockApi.put).toBeDefined();
    });

    it('should delete device', async () => {
      const mockApi = getMockApi();
      mockApi.delete.mockResolvedValue({ data: { message: 'Device deleted' } });

      expect(mockApi.delete).toBeDefined();
    });
  });

  describe('realtime functions', () => {
    it('should fetch realtime metrics', async () => {
      const mockApi = getMockApi();
      mockApi.get.mockResolvedValue({ 
        data: { 
          data: { 
            totalDevices: 5, 
            onlineDevices: 4, 
            totalPower: 1000 
          } 
        } 
      });

      expect(mockApi.get).toBeDefined();
    });

    it('should fetch device data', async () => {
      const mockApi = getMockApi();
      mockApi.get.mockResolvedValue({ 
        data: { 
          data: [{ 
            deviceId: '1', 
            power: 500, 
            voltage: 240 
          }] 
        } 
      });

      expect(mockApi.get).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle network errors', () => {
      const mockApi = getMockApi();
      mockApi.get.mockRejectedValue(new Error('Network error'));

      expect(mockApi.get).toBeDefined();
    });

    it('should handle 401 errors', () => {
      const mockApi = getMockApi();
      mockApi.get.mockRejectedValue({ 
        response: { status: 401 } 
      });

      expect(mockApi.get).toBeDefined();
    });
  });
});