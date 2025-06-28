import { create } from 'zustand';
import type { Alert } from '../types/api';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (alert: Alert) => void;
  markAsRead: (alertId: string) => void;
  markAllAsRead: () => void;
  removeAlert: (alertId: string) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  unreadCount: 0,
  
  addAlert: (alert: Alert) => set((state) => {
    const newAlerts = [alert, ...state.alerts];
    const unreadCount = newAlerts.filter(a => !a.acknowledged).length;
    return { alerts: newAlerts, unreadCount };
  }),
  
  markAsRead: (alertId: string) => set((state) => {
    const alerts = state.alerts.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    const unreadCount = alerts.filter(a => !a.acknowledged).length;
    return { alerts, unreadCount };
  }),
  
  markAllAsRead: () => set((state) => {
    const alerts = state.alerts.map(alert => ({ ...alert, acknowledged: true }));
    return { alerts, unreadCount: 0 };
  }),
  
  removeAlert: (alertId: string) => set((state) => {
    const alerts = state.alerts.filter(alert => alert.id !== alertId);
    const unreadCount = alerts.filter(a => !a.acknowledged).length;
    return { alerts, unreadCount };
  }),
  
  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
}));