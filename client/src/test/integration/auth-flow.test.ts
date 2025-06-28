import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '../../services/api';
import type { AuthResponse, LoginCredentials, RegisterData } from '../../types/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getStoredUser: vi.fn(),
    isAuthenticated: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

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

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('Complete Login Flow', () => {
    it('should handle successful login with persistent session', async () => {
      vi.mocked(apiService.login).mockResolvedValue(mockAuthResponse);
      vi.mocked(apiService.getStoredUser).mockReturnValue(mockUser);
      vi.mocked(apiService.isAuthenticated).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      // Simulate login
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password',
        });
      });

      // Verify login state
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();

      // Simulate page refresh - check auth persistence
      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle login failure gracefully', async () => {
      const errorMessage = 'Invalid credentials';
      vi.mocked(apiService.login).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password',
        });
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Complete Registration Flow', () => {
    it('should handle successful registration and immediate login', async () => {
      vi.mocked(apiService.register).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuthStore());

      const registrationData: RegisterData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      };

      await act(async () => {
        await result.current.register(registrationData);
      });

      // Should be logged in immediately after registration
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle registration failure', async () => {
      const errorMessage = 'Email already exists';
      vi.mocked(apiService.register).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuthStore());

      const registrationData: RegisterData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      };

      await act(async () => {
        await result.current.register(registrationData);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Logout Flow', () => {
    it('should handle complete logout and cleanup', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      vi.mocked(apiService.logout).mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
      expect(apiService.logout).toHaveBeenCalled();
    });
  });

  describe('Session Persistence', () => {
    it('should maintain session across page loads', () => {
      vi.mocked(apiService.getStoredUser).mockReturnValue(mockUser);
      vi.mocked(apiService.isAuthenticated).mockReturnValue(true);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle expired or invalid sessions', () => {
      vi.mocked(apiService.getStoredUser).mockReturnValue(null);
      vi.mocked(apiService.isAuthenticated).mockReturnValue(false);

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should clear errors when retrying operations', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set an error state
      act(() => {
        useAuthStore.setState({ error: 'Previous error' });
      });

      // Successful login should clear the error
      vi.mocked(apiService.login).mockResolvedValue(mockAuthResponse);

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password',
        });
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(apiService.login).mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password',
        });
      });

      expect(result.current.error).toBe('Network Error');
      expect(result.current.isLoading).toBe(false);
    });
  });
});