import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDeviceStore } from '../../stores/deviceStore';
import { apiService } from '../../services/api';
import type { Device, DeviceData, RealtimeMetrics } from '../../types/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    getDevices: vi.fn(),
    getDevice: vi.fn(),
    createDevice: vi.fn(),
    updateDevice: vi.fn(),
    deleteDevice: vi.fn(),
    getDeviceData: vi.fn(),
    getRealtimeMetrics: vi.fn(),
  },
}));

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

const mockDeviceData: DeviceData = {
  deviceId: '1',
  timestamp: '2024-01-01T12:00:00Z',
  power: 1500,
  voltage: 220,
  current: 6.8,
  temperature: 45,
  irradiance: 800,
  efficiency: 0.85,
  energyToday: 12.5,
  energyTotal: 1250,
  status: 'ONLINE',
};

const mockMetrics: RealtimeMetrics = {
  totalDevices: 5,
  onlineDevices: 4,
  errorDevices: 1,
  offlineDevices: 0,
  totalPower: 7500,
  totalEnergyToday: 62.5,
  averageEfficiency: 0.82,
  timestamp: '2024-01-01T12:00:00Z',
};

describe('deviceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.setState({
      devices: [],
      currentDevice: null,
      deviceData: [],
      metrics: null,
      isLoading: false,
      error: null,
    });
  });

  describe('fetchDevices', () => {
    it('should fetch devices successfully', async () => {
      vi.mocked(apiService.getDevices).mockResolvedValue([mockDevice]);

      const { fetchDevices } = useDeviceStore.getState();
      await fetchDevices();

      const state = useDeviceStore.getState();
      expect(state.devices).toEqual([mockDevice]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle fetch devices error', async () => {
      const errorMessage = 'Failed to fetch devices';
      vi.mocked(apiService.getDevices).mockRejectedValue(new Error(errorMessage));

      const { fetchDevices } = useDeviceStore.getState();
      await fetchDevices();

      const state = useDeviceStore.getState();
      expect(state.devices).toEqual([]);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('fetchDevice', () => {
    it('should fetch single device successfully', async () => {
      vi.mocked(apiService.getDevice).mockResolvedValue(mockDevice);

      const { fetchDevice } = useDeviceStore.getState();
      await fetchDevice('1');

      const state = useDeviceStore.getState();
      expect(state.currentDevice).toEqual(mockDevice);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle fetch device error', async () => {
      const errorMessage = 'Device not found';
      vi.mocked(apiService.getDevice).mockRejectedValue(new Error(errorMessage));

      const { fetchDevice } = useDeviceStore.getState();
      await fetchDevice('1');

      const state = useDeviceStore.getState();
      expect(state.currentDevice).toBeNull();
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('createDevice', () => {
    it('should create device successfully', async () => {
      vi.mocked(apiService.createDevice).mockResolvedValue(mockDevice);

      const { createDevice } = useDeviceStore.getState();
      await createDevice(mockDevice);

      const state = useDeviceStore.getState();
      expect(state.devices).toContain(mockDevice);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle create device error', async () => {
      const errorMessage = 'Failed to create device';
      vi.mocked(apiService.createDevice).mockRejectedValue(new Error(errorMessage));

      const { createDevice } = useDeviceStore.getState();
      await createDevice(mockDevice);

      const state = useDeviceStore.getState();
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('updateDevice', () => {
    it('should update device successfully', async () => {
      const updatedDevice = { ...mockDevice, name: 'Updated Panel' };
      
      // Set initial state with the device
      useDeviceStore.setState({ devices: [mockDevice] });
      
      vi.mocked(apiService.updateDevice).mockResolvedValue(updatedDevice);

      const { updateDevice } = useDeviceStore.getState();
      await updateDevice('1', { name: 'Updated Panel' });

      const state = useDeviceStore.getState();
      expect(state.devices[0]).toEqual(updatedDevice);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('deleteDevice', () => {
    it('should delete device successfully', async () => {
      // Set initial state with the device
      useDeviceStore.setState({ devices: [mockDevice] });
      
      vi.mocked(apiService.deleteDevice).mockResolvedValue();

      const { deleteDevice } = useDeviceStore.getState();
      await deleteDevice('1');

      const state = useDeviceStore.getState();
      expect(state.devices).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchDeviceData', () => {
    it('should fetch device data successfully', async () => {
      vi.mocked(apiService.getDeviceData).mockResolvedValue([mockDeviceData]);

      const { fetchDeviceData } = useDeviceStore.getState();
      await fetchDeviceData('1');

      const state = useDeviceStore.getState();
      expect(state.deviceData).toEqual([mockDeviceData]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchMetrics', () => {
    it('should fetch metrics successfully', async () => {
      vi.mocked(apiService.getRealtimeMetrics).mockResolvedValue(mockMetrics);

      const { fetchMetrics } = useDeviceStore.getState();
      await fetchMetrics();

      const state = useDeviceStore.getState();
      expect(state.metrics).toEqual(mockMetrics);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('addDeviceData', () => {
    it('should add device data to store', () => {
      const { addDeviceData } = useDeviceStore.getState();
      addDeviceData(mockDeviceData);

      const state = useDeviceStore.getState();
      expect(state.deviceData).toContain(mockDeviceData);
    });

    it('should limit device data to 1000 entries', () => {
      // Create 1001 data points
      const manyDataPoints = Array.from({ length: 1001 }, (_, i) => ({
        ...mockDeviceData,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }));

      const { addDeviceData } = useDeviceStore.getState();
      
      // Add all data points
      manyDataPoints.forEach(data => addDeviceData(data));

      const state = useDeviceStore.getState();
      expect(state.deviceData).toHaveLength(1000);
      // Should keep the most recent 1000 entries
      expect(state.deviceData[0].timestamp).toBe(manyDataPoints[1000].timestamp);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useDeviceStore.setState({ error: 'Some error' });

      const { clearError } = useDeviceStore.getState();
      clearError();

      expect(useDeviceStore.getState().error).toBeNull();
    });
  });

  describe('setCurrentDevice', () => {
    it('should set current device', () => {
      const { setCurrentDevice } = useDeviceStore.getState();
      setCurrentDevice(mockDevice);

      expect(useDeviceStore.getState().currentDevice).toEqual(mockDevice);
    });

    it('should clear current device when passing null', () => {
      useDeviceStore.setState({ currentDevice: mockDevice });

      const { setCurrentDevice } = useDeviceStore.getState();
      setCurrentDevice(null);

      expect(useDeviceStore.getState().currentDevice).toBeNull();
    });
  });
});