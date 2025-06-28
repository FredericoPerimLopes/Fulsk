import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '../../services/api';
import type { AuthResponse, User } from '../../types/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getStoredUser: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}));

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'VIEWER',
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

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      vi.mocked(apiService.login).mockResolvedValue(mockAuthResponse);

      const { login } = useAuthStore.getState();
      await login({ email: 'test@example.com', password: 'password' });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle login error', async () => {
      const errorMessage = 'Invalid credentials';
      vi.mocked(apiService.login).mockRejectedValue(new Error(errorMessage));

      const { login } = useAuthStore.getState();
      await login({ email: 'test@example.com', password: 'wrong-password' });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMessage);
    });

    it('should set loading state during login', async () => {
      let resolveLogin: (value: AuthResponse) => void;
      const loginPromise = new Promise<AuthResponse>((resolve) => {
        resolveLogin = resolve;
      });
      vi.mocked(apiService.login).mockReturnValue(loginPromise);

      const { login } = useAuthStore.getState();
      const loginCall = login({ email: 'test@example.com', password: 'password' });

      // Check loading state
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolveLogin!(mockAuthResponse);
      await loginCall;

      // Check final state
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      vi.mocked(apiService.register).mockResolvedValue(mockAuthResponse);

      const { register } = useAuthStore.getState();
      await register({
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle registration error', async () => {
      const errorMessage = 'Email already exists';
      vi.mocked(apiService.register).mockRejectedValue(new Error(errorMessage));

      const { register } = useAuthStore.getState();
      await register({
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      vi.mocked(apiService.logout).mockResolvedValue();

      const { logout } = useAuthStore.getState();
      await logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(apiService.logout).toHaveBeenCalled();
    });
  });

  describe('checkAuth', () => {
    it('should restore authenticated user from storage', () => {
      vi.mocked(apiService.getStoredUser).mockReturnValue(mockUser);
      vi.mocked(apiService.isAuthenticated).mockReturnValue(true);

      const { checkAuth } = useAuthStore.getState();
      checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle no stored authentication', () => {
      vi.mocked(apiService.getStoredUser).mockReturnValue(null);
      vi.mocked(apiService.isAuthenticated).mockReturnValue(false);

      const { checkAuth } = useAuthStore.getState();
      checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      const { clearError } = useAuthStore.getState();
      clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});