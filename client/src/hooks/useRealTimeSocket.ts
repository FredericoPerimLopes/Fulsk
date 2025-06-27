import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceData, RealtimeMetrics } from '../types/api';

export const useRealTimeSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { 
    devices, 
    updateDeviceData, 
    updateRealtimeMetrics,
    fetchRealtimeMetrics 
  } = useDeviceStore();

  useEffect(() => {
    // Initialize socket connection
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 Connected to real-time server');
      
      // Subscribe to all devices
      devices.forEach(device => {
        socket.emit('subscribe-device', device.id);
      });
      
      // Fetch initial metrics
      fetchRealtimeMetrics();
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from real-time server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    // Device data updates
    socket.on('device-data', (data: DeviceData) => {
      updateDeviceData(data.deviceId, data);
    });

    // Device alerts
    socket.on('device-alerts', (alertData: any) => {
      console.warn('⚠️ Device alert:', alertData);
      // You can add alert handling here (notifications, toast, etc.)
    });

    // System metrics updates
    socket.on('system-metrics', (metrics: RealtimeMetrics) => {
      updateRealtimeMetrics(metrics);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [devices, updateDeviceData, updateRealtimeMetrics, fetchRealtimeMetrics]);

  // Subscribe to new devices when devices list changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      devices.forEach(device => {
        socketRef.current?.emit('subscribe-device', device.id);
      });
    }
  }, [devices]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false
  };
};