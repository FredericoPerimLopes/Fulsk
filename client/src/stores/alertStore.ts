import { create } from 'zustand';
import type { Alert } from '../types/api';

interface AlertState {
  alerts: Alert[];
  notifications: Alert[];
  unreadCount: number;
  isNotificationsEnabled: boolean;
  soundEnabled: boolean;
  addAlert: (alert: Alert) => void;
  markAsRead: (alertId: string) => void;
  markAllAsRead: () => void;
  removeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;
  toggleNotifications: () => void;
  toggleSound: () => void;
  getAlertsBySeverity: (severity?: Alert['severity']) => Alert[];
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  notifications: [],
  unreadCount: 0,
  isNotificationsEnabled: true,
  soundEnabled: true,
  
  addAlert: (alert: Alert) => set((state) => {
    const newAlert = { ...alert, isNew: true };
    const newAlerts = [newAlert, ...state.alerts];
    const notifications = [newAlert, ...state.notifications];
    const unreadCount = newAlerts.filter(a => !a.acknowledged).length;
    return { alerts: newAlerts, notifications, unreadCount };
  }),
  
  markAsRead: (alertId: string) => set((state) => {
    const alerts = state.alerts.map(alert => 
      alert.id === alertId ? { ...alert, read: true, isNew: false } : alert
    );
    const notifications = state.notifications.map(alert => 
      alert.id === alertId ? { ...alert, read: true, isNew: false } : alert
    );
    const unreadCount = alerts.filter(a => !a.acknowledged).length;
    return { alerts, notifications, unreadCount };
  }),
  
  markAllAsRead: () => set((state) => {
    const alerts = state.alerts.map(alert => ({ ...alert, read: true, isNew: false }));
    const notifications = state.notifications.map(alert => ({ ...alert, read: true, isNew: false }));
    return { alerts, notifications, unreadCount: 0 };
  }),
  
  acknowledgeAlert: (alertId: string) => set((state) => {
    const alerts = state.alerts.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    const notifications = state.notifications.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    const unreadCount = alerts.filter(a => !a.acknowledged).length;
    return { alerts, notifications, unreadCount };
  }),
  
  acknowledgeAllAlerts: () => set((state) => {
    const alerts = state.alerts.map(alert => ({ ...alert, acknowledged: true }));
    const notifications = state.notifications.map(alert => ({ ...alert, acknowledged: true }));
    return { alerts, notifications, unreadCount: 0 };
  }),
  
  removeAlert: (alertId: string) => set((state) => {
    const alerts = state.alerts.filter(alert => alert.id !== alertId);
    const notifications = state.notifications.filter(alert => alert.id !== alertId);
    const unreadCount = alerts.filter(a => !a.acknowledged).length;
    return { alerts, notifications, unreadCount };
  }),
  
  clearAlerts: () => set({ alerts: [], notifications: [], unreadCount: 0 }),
  
  toggleNotifications: () => set((state) => ({
    isNotificationsEnabled: !state.isNotificationsEnabled
  })),
  
  toggleSound: () => set((state) => ({
    soundEnabled: !state.soundEnabled
  })),
  
  getAlertsBySeverity: (severity?: Alert['severity']) => {
    const { alerts } = get();
    if (!severity) return alerts;
    return alerts.filter(alert => alert.severity === severity);
  },
}));