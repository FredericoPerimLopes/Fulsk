import { create } from 'zustand';
import { Device, DeviceData, DeviceStats, RealtimeMetrics } from '../types/api';
import { apiService } from '../services/api';

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  deviceData: Record<string, DeviceData[]>;
  realtimeMetrics: RealtimeMetrics | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDevices: () => Promise<void>;
  fetchDevice: (deviceId: string) => Promise<void>;
  fetchDeviceData: (deviceId: string, limit?: number) => Promise<void>;
  fetchRealtimeMetrics: () => Promise<void>;
  selectDevice: (device: Device | null) => void;
  updateDeviceData: (deviceId: string, data: DeviceData) => void;
  updateRealtimeMetrics: (metrics: RealtimeMetrics) => void;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDevice: null,
  deviceData: {},
  realtimeMetrics: null,
  isLoading: false,
  error: null,

  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const devices = await apiService.getDevices();
      set({ devices, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch devices',
        isLoading: false
      });
    }
  },

  fetchDevice: async (deviceId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const device = await apiService.getDevice(deviceId);
      const { devices } = get();
      const updatedDevices = devices.map(d => d.id === deviceId ? device : d);
      
      set({ 
        devices: updatedDevices,
        selectedDevice: device,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch device',
        isLoading: false
      });
    }
  },

  fetchDeviceData: async (deviceId: string, limit = 100) => {
    try {
      const data = await apiService.getDeviceData(deviceId, limit);
      const { deviceData } = get();
      
      set({ 
        deviceData: {
          ...deviceData,
          [deviceId]: data
        }
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch device data'
      });
    }
  },

  fetchRealtimeMetrics: async () => {
    try {
      const metrics = await apiService.getRealtimeMetrics();
      set({ realtimeMetrics: metrics });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Failed to fetch realtime metrics'
      });
    }
  },

  selectDevice: (device: Device | null) => {
    set({ selectedDevice: device });
  },

  updateDeviceData: (deviceId: string, data: DeviceData) => {
    const { deviceData } = get();
    const existingData = deviceData[deviceId] || [];
    
    // Add new data point and keep only the latest 100 points
    const updatedData = [data, ...existingData].slice(0, 100);
    
    set({
      deviceData: {
        ...deviceData,
        [deviceId]: updatedData
      }
    });
  },

  updateRealtimeMetrics: (metrics: RealtimeMetrics) => {
    set({ realtimeMetrics: metrics });
  },

  clearError: () => {
    set({ error: null });
  }
}));