import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDeviceStore } from '../stores/deviceStore';
import { useAlertStore } from '../stores/alertStore';
import type { DeviceData, RealtimeMetrics, Alert } from '../types/api';

interface ConnectionStats {
  reconnectAttempts: number;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  totalDataReceived: number;
  averageLatency: number;
}

interface UseRealTimeSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionStats: ConnectionStats;
  forceReconnect: () => void;
  subscribeToDevice: (deviceId: string) => void;
  unsubscribeFromDevice: (deviceId: string) => void;
}

export const useRealTimeSocket = (): UseRealTimeSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<number>(0);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    reconnectAttempts: 0,
    lastConnected: null,
    lastDisconnected: null,
    totalDataReceived: 0,
    averageLatency: 0
  });

  const { 
    devices, 
    updateDeviceData, 
    updateRealtimeMetrics,
    fetchRealtimeMetrics,
    setConnectionStatus 
  } = useDeviceStore();
  
  const { addAlert } = useAlertStore();

  const initializeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setIsConnecting(true);
    
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      upgrade: true,
      forceNew: true
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 Connected to real-time server');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionStatus('connected');
      
      const now = new Date();
      setConnectionStats(prev => ({
        ...prev,
        lastConnected: now,
        reconnectAttempts: 0
      }));
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Subscribe to all devices
      devices.forEach(device => {
        socket.emit('subscribe-device', device.id);
      });
      
      // Fetch initial metrics
      fetchRealtimeMetrics();
      
      // Start ping monitoring
      startPingMonitoring();
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from real-time server:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      
      const now = new Date();
      setConnectionStats(prev => ({
        ...prev,
        lastDisconnected: now
      }));
      
      // Stop ping monitoring
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Attempt reconnection for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        scheduleReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setIsConnecting(false);
      setConnectionStatus('error');
      
      setConnectionStats(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
      
      scheduleReconnect();
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected to server after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Attempting to reconnect... (${attemptNumber})`);
      setIsConnecting(true);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection failed:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
      setConnectionStatus('failed');
      scheduleReconnect();
    });

    // Device data updates with caching and performance optimization
    socket.on('device-data', (data: DeviceData) => {
      setConnectionStats(prev => ({
        ...prev,
        totalDataReceived: prev.totalDataReceived + 1
      }));
      
      // Batch update to avoid too frequent re-renders
      updateDeviceData(data.deviceId, data);
    });

    // Device alerts with enhanced handling
    socket.on('device-alerts', (alertData: any) => {
      console.warn('⚠️ Device alert:', alertData);
      
      // Create alert object
      const alert: Alert = {
        id: `alert-${alertData.deviceId}-${Date.now()}`,
        deviceId: alertData.deviceId,
        deviceName: alertData.deviceName || 'Unknown Device',
        type: alertData.type || 'unknown',
        severity: alertData.severity || 'WARNING',
        message: Array.isArray(alertData.alerts) ? alertData.alerts.join(', ') : alertData.message || 'Unknown alert',
        timestamp: alertData.timestamp || new Date().toISOString(),
        acknowledged: false
      };
      
      addAlert(alert);
    });

    // System metrics updates
    socket.on('system-metrics', (metrics: RealtimeMetrics) => {
      updateRealtimeMetrics(metrics);
    });

    // Ping/pong for latency monitoring
    socket.on('pong', () => {
      const latency = Date.now() - lastPingRef.current;
      setConnectionStats(prev => ({
        ...prev,
        averageLatency: prev.averageLatency === 0 ? latency : (prev.averageLatency + latency) / 2
      }));
    });

    return socket;
  }, [devices, updateDeviceData, updateRealtimeMetrics, fetchRealtimeMetrics, setConnectionStatus, addAlert]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;
    
    const delay = Math.min(1000 * Math.pow(2, connectionStats.reconnectAttempts), 30000);
    console.log(`🔄 Scheduling reconnect in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!socketRef.current?.connected) {
        initializeSocket();
      }
    }, delay);
  }, [connectionStats.reconnectAttempts, initializeSocket]);

  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        lastPingRef.current = Date.now();
        socketRef.current.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }, []);

  const forceReconnect = useCallback(() => {
    console.log('🔄 Force reconnecting...');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    initializeSocket();
  }, [initializeSocket]);

  const subscribeToDevice = useCallback((deviceId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-device', deviceId);
      console.log(`📡 Subscribed to device ${deviceId}`);
    }
  }, []);

  const unsubscribeFromDevice = useCallback((deviceId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe-device', deviceId);
      console.log(`📡 Unsubscribed from device ${deviceId}`);
    }
  }, []);

  useEffect(() => {
    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [initializeSocket]);

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
    isConnected,
    isConnecting,
    connectionStats,
    forceReconnect,
    subscribeToDevice,
    unsubscribeFromDevice
  };
};