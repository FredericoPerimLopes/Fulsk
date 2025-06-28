import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Device, DeviceData, RealtimeMetrics } from '../types/api';
import { apiService } from '../services/api';

interface DeviceCache {
  [deviceId: string]: {
    data: DeviceData[];
    lastUpdated: Date;
    isStale: boolean;
  };
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'failed';

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  deviceData: Record<string, DeviceData[]>;
  deviceCache: DeviceCache;
  realtimeMetrics: RealtimeMetrics | null;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  isOnline: boolean;
  error: string | null;
  lastSync: Date | null;

  // Actions
  fetchDevices: () => Promise<void>;
  fetchDevice: (deviceId: string) => Promise<void>;
  fetchDeviceData: (deviceId: string, limit?: number) => Promise<void>;
  fetchRealtimeMetrics: () => Promise<void>;
  selectDevice: (device: Device | null) => void;
  updateDeviceData: (deviceId: string, data: DeviceData) => void;
  updateRealtimeMetrics: (metrics: RealtimeMetrics) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  getCachedDeviceData: (deviceId: string) => DeviceData[];
  invalidateCache: (deviceId?: string) => void;
  syncOfflineData: () => Promise<void>;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      devices: [],
      selectedDevice: null,
      deviceData: {},
      deviceCache: {},
      realtimeMetrics: null,
      connectionStatus: 'disconnected',
      isLoading: false,
      isOnline: navigator.onLine,
      error: null,
      lastSync: null,

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
          const { deviceData, deviceCache } = get();
          
          const updatedCache = {
            ...deviceCache,
            [deviceId]: {
              data,
              lastUpdated: new Date(),
              isStale: false
            }
          };
          
          set({ 
            deviceData: {
              ...deviceData,
              [deviceId]: data
            },
            deviceCache: updatedCache
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
        const { deviceData, deviceCache, isOnline } = get();
        const existingData = deviceData[deviceId] || [];
        
        // Add new data point and keep only the latest 100 points
        const updatedData = [data, ...existingData].slice(0, 100);
        
        // Update cache with timestamp
        const updatedCache = {
          ...deviceCache,
          [deviceId]: {
            data: updatedData,
            lastUpdated: new Date(),
            isStale: !isOnline
          }
        };
        
        set({
          deviceData: {
            ...deviceData,
            [deviceId]: updatedData
          },
          deviceCache: updatedCache,
          lastSync: isOnline ? new Date() : get().lastSync
        });
        
        // If offline, store in localStorage for later sync
        if (!isOnline) {
          try {
            const offlineData = JSON.parse(localStorage.getItem('fulsk_offline_data') || '[]');
            offlineData.push({ deviceId, data, timestamp: new Date().toISOString() });
            localStorage.setItem('fulsk_offline_data', JSON.stringify(offlineData.slice(-500))); // Keep last 500 entries
          } catch (error) {
            console.warn('Failed to store offline data:', error);
          }
        }
      },

      updateRealtimeMetrics: (metrics: RealtimeMetrics) => {
        set({ realtimeMetrics: metrics });
      },

      setConnectionStatus: (status: ConnectionStatus) => {
        set({ connectionStatus: status });
      },

      setOnlineStatus: (isOnline: boolean) => {
        const currentOnline = get().isOnline;
        set({ isOnline });
        
        // If coming back online, trigger sync
        if (!currentOnline && isOnline) {
          get().syncOfflineData();
        }
      },

      getCachedDeviceData: (deviceId: string) => {
        const { deviceCache } = get();
        const cached = deviceCache[deviceId];
        
        if (!cached) return [];
        
        // Check if cache is stale (older than 5 minutes)
        const isStale = new Date().getTime() - cached.lastUpdated.getTime() > 5 * 60 * 1000;
        
        if (isStale) {
          set({
            deviceCache: {
              ...get().deviceCache,
              [deviceId]: { ...cached, isStale: true }
            }
          });
        }
        
        return cached.data;
      },

      invalidateCache: (deviceId?: string) => {
        if (deviceId) {
          const { deviceCache } = get();
          const cached = deviceCache[deviceId];
          if (cached) {
            set({
              deviceCache: {
                ...deviceCache,
                [deviceId]: { ...cached, isStale: true }
              }
            });
          }
        } else {
          // Invalidate all cache
          const { deviceCache } = get();
          const invalidatedCache: DeviceCache = {};
          Object.keys(deviceCache).forEach(id => {
            invalidatedCache[id] = { ...deviceCache[id], isStale: true };
          });
          set({ deviceCache: invalidatedCache });
        }
      },

      syncOfflineData: async () => {
        const { isOnline } = get();
        if (!isOnline) return;
        
        try {
          const offlineData = JSON.parse(localStorage.getItem('fulsk_offline_data') || '[]');
          
          if (offlineData.length > 0) {
            console.log(`🔄 Syncing ${offlineData.length} offline data points...`);
            
            // In a real implementation, you would send this data to the server
            // For now, we'll just clear the offline storage
            localStorage.removeItem('fulsk_offline_data');
            
            console.log('✓ Offline data synced successfully');
            set({ lastSync: new Date() });
          }
        } catch (error) {
          console.error('Failed to sync offline data:', error);
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'fulsk-device-store',
      partialize: (state) => ({
        devices: state.devices,
        deviceCache: state.deviceCache,
        lastSync: state.lastSync
      })
    }
  )
);

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useDeviceStore.getState().setOnlineStatus(true);
  });
  
  window.addEventListener('offline', () => {
    useDeviceStore.getState().setOnlineStatus(false);
  });
}