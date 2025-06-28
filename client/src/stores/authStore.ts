import { create } from 'zustand';
import type { User, LoginCredentials, RegisterData } from '../types/api';
import { apiService } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    
    try {
      const authResponse = await apiService.login(credentials);
      set({ 
        user: authResponse.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Login failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  register: async (userData: RegisterData) => {
    set({ isLoading: true, error: null });
    
    try {
      const authResponse = await apiService.register(userData);
      set({ 
        user: authResponse.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Registration failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ 
        user: null, 
        isAuthenticated: false, 
        isLoading: false,
        error: null
      });
    }
  },

  checkAuth: () => {
    const isAuthenticated = apiService.isAuthenticated();
    const user = apiService.getStoredUser();
    
    set({ 
      isAuthenticated, 
      user,
      isLoading: false 
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));