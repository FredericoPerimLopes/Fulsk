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
const getMockApi = () => vi.mocked(axios.create)();

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
  type: 'PANEL',
  manufacturer: 'Test Manufacturer',
  model: 'Test Model',
  serialNumber: 'TEST123',
  status: 'ONLINE',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  location: {
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    zipCode: '12345',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    timezone: 'America/New_York',
  },
  configuration: {
    communicationProtocol: 'MQTT',
    dataCollectionInterval: 300,
    alertThresholds: {
      minPower: 0,
      maxTemperature: 85,
      minVoltage: 200,
      maxVoltage: 250,
    },
    notifications: {
      email: true,
      sms: false,
      push: true,
    },
  },
  owner: 'user1',
};

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage  
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Authentication', () => {
    describe('login', () => {
      it('should login successfully and store tokens', async () => {
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password',
        };

        const mockApi = getMockApi();
        mockApi.post.mockResolvedValue({
          data: { data: mockAuthResponse },
        });

        const result = await apiService.login(credentials);

        expect(mockApi.post).toHaveBeenCalledWith('/auth/login', credentials);
        expect(result).toEqual(mockAuthResponse);
        expect(localStorage.getItem('auth_token')).toBe('test-token');
        expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
        expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
      });

      it('should handle login error', async () => {
        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'wrong-password',
        };

        mockApi.post.mockRejectedValue(new Error('Invalid credentials'));

        await expect(apiService.login(credentials)).rejects.toThrow('Invalid credentials');
        expect(localStorage.getItem('auth_token')).toBeNull();
      });
    });

    describe('register', () => {
      it('should register successfully and store tokens', async () => {
        const userData: RegisterData = {
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
          role: 'VIEWER',
        };

        mockApi.post.mockResolvedValue({
          data: { data: mockAuthResponse },
        });

        const result = await apiService.register(userData);

        expect(mockApi.post).toHaveBeenCalledWith('/auth/register', userData);
        expect(result).toEqual(mockAuthResponse);
        expect(localStorage.getItem('auth_token')).toBe('test-token');
        expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
        expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
      });
    });

    describe('logout', () => {
      it('should logout and clear tokens', async () => {
        localStorage.setItem('refresh_token', 'test-refresh-token');
        localStorage.setItem('auth_token', 'test-token');
        localStorage.setItem('user', JSON.stringify(mockUser));

        mockApi.post.mockResolvedValue({});

        await apiService.logout();

        expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', {
          refreshToken: 'test-refresh-token',
        });
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
      });

      it('should clear tokens even if logout API fails', async () => {
        localStorage.setItem('refresh_token', 'test-refresh-token');
        localStorage.setItem('auth_token', 'test-token');

        mockApi.post.mockRejectedValue(new Error('Server error'));

        await apiService.logout();

        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
      });
    });

    describe('getProfile', () => {
      it('should get user profile', async () => {
        mockApi.get.mockResolvedValue({
          data: { data: mockUser },
        });

        const result = await apiService.getProfile();

        expect(mockApi.get).toHaveBeenCalledWith('/auth/profile');
        expect(result).toEqual(mockUser);
      });
    });
  });

  describe('Device Management', () => {
    describe('getDevices', () => {
      it('should fetch all devices', async () => {
        const mockDevices = [mockDevice];
        mockApi.get.mockResolvedValue({
          data: { data: mockDevices },
        });

        const result = await apiService.getDevices();

        expect(mockApi.get).toHaveBeenCalledWith('/devices');
        expect(result).toEqual(mockDevices);
      });
    });

    describe('getDevice', () => {
      it('should fetch single device', async () => {
        mockApi.get.mockResolvedValue({
          data: { data: mockDevice },
        });

        const result = await apiService.getDevice('1');

        expect(mockApi.get).toHaveBeenCalledWith('/devices/1');
        expect(result).toEqual(mockDevice);
      });
    });

    describe('createDevice', () => {
      it('should create new device', async () => {
        const deviceData = { name: 'New Panel', type: 'PANEL' as const };
        mockApi.post.mockResolvedValue({
          data: { data: mockDevice },
        });

        const result = await apiService.createDevice(deviceData);

        expect(mockApi.post).toHaveBeenCalledWith('/devices', deviceData);
        expect(result).toEqual(mockDevice);
      });
    });

    describe('updateDevice', () => {
      it('should update existing device', async () => {
        const updates = { name: 'Updated Panel' };
        const updatedDevice = { ...mockDevice, ...updates };
        
        mockApi.put.mockResolvedValue({
          data: { data: updatedDevice },
        });

        const result = await apiService.updateDevice('1', updates);

        expect(mockApi.put).toHaveBeenCalledWith('/devices/1', updates);
        expect(result).toEqual(updatedDevice);
      });
    });

    describe('deleteDevice', () => {
      it('should delete device', async () => {
        mockApi.delete.mockResolvedValue({});

        await apiService.deleteDevice('1');

        expect(mockApi.delete).toHaveBeenCalledWith('/devices/1');
      });
    });
  });

  describe('Utility Methods', () => {
    describe('clearAuth', () => {
      it('should clear all auth data from localStorage', () => {
        localStorage.setItem('auth_token', 'test-token');
        localStorage.setItem('refresh_token', 'test-refresh-token');
        localStorage.setItem('user', JSON.stringify(mockUser));

        apiService.clearAuth();

        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
      });
    });

    describe('getStoredUser', () => {
      it('should return stored user', () => {
        localStorage.setItem('user', JSON.stringify(mockUser));

        const result = apiService.getStoredUser();

        expect(result).toEqual(mockUser);
      });

      it('should return null when no user stored', () => {
        const result = apiService.getStoredUser();

        expect(result).toBeNull();
      });
    });

    describe('isAuthenticated', () => {
      it('should return true when token exists', () => {
        localStorage.setItem('auth_token', 'test-token');

        const result = apiService.isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when no token exists', () => {
        const result = apiService.isAuthenticated();

        expect(result).toBe(false);
      });
    });
  });

  describe('Health Check', () => {
    it('should check API health', async () => {
      const healthData = { status: 'healthy', timestamp: new Date().toISOString() };
      vi.mocked(axios.get).mockResolvedValue({ data: healthData });

      const result = await apiService.getHealth();

      expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/health');
      expect(result).toEqual(healthData);
    });
  });
});