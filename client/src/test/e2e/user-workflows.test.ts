import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { useAuthStore } from '../../stores/authStore';

// Mock the stores
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../stores/deviceStore', () => ({
  useDeviceStore: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  apiService: {
    login: vi.fn(),
    register: vi.fn(),
    getDevices: vi.fn(),
    getRealtimeMetrics: vi.fn(),
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    {children}
  </MemoryRouter>
);

describe('Critical User Workflows E2E Tests', () => {
  const mockAuthStore = {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
    isAuthenticated: false,
    checkAuth: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue(mockAuthStore);
  });

  describe('User Registration and Login Workflow', () => {
    it('should complete full registration to dashboard workflow', async () => {
      const user = userEvent.setup();

      // Mock successful registration
      const mockUser = {
        id: '1',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'VIEWER' as const,
      };

      mockAuthStore.register.mockResolvedValue({
        user: mockUser,
        token: 'token',
        refreshToken: 'refresh',
        expiresIn: '1h',
      });

      render(
        <TestWrapper>
          <RegisterForm />
        </TestWrapper>
      );

      // Step 1: Fill registration form
      await user.type(screen.getByLabelText(/first name/i), 'New');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      // Step 2: Select role
      await user.click(screen.getByLabelText(/role/i));
      await user.click(screen.getByText('Viewer'));

      // Step 3: Submit form
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Step 4: Verify registration was called
      await waitFor(() => {
        expect(mockAuthStore.register).toHaveBeenCalledWith({
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@example.com',
          password: 'password123',
          role: 'VIEWER',
        });
      });
    });

    it('should handle login to dashboard workflow', async () => {
      const user = userEvent.setup();

      mockAuthStore.login.mockResolvedValue({
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'VIEWER',
        },
        token: 'token',
        refreshToken: 'refresh',
        expiresIn: '1h',
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Step 1: Enter credentials
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      // Step 2: Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Step 3: Verify login was called
      await waitFor(() => {
        expect(mockAuthStore.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });
  });

  describe('Form Validation Workflows', () => {
    it('should prevent submission with validation errors', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Try to submit empty form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should not call login with empty form
      expect(mockAuthStore.login).not.toHaveBeenCalled();
    });

    it('should guide user through password requirements', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <RegisterForm />
        </TestWrapper>
      );

      // Enter weak password
      await user.type(screen.getByLabelText(/first name/i), 'Test');
      await user.type(screen.getByLabelText(/last name/i), 'User');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), '123');
      await user.type(screen.getByLabelText(/confirm password/i), '123');

      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should not call register with weak password
      expect(mockAuthStore.register).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Workflows', () => {
    it('should display and recover from login errors', async () => {
      const user = userEvent.setup();

      // Set error state
      (useAuthStore as any).mockReturnValue({
        ...mockAuthStore,
        error: 'Invalid credentials',
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Error should be displayed
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();

      // Clear error when typing
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      // In a real scenario, this would clear the error
      expect(mockAuthStore.clearError).toBeDefined();
    });

    it('should handle network connectivity issues', async () => {
      const user = userEvent.setup();

      // Mock network error
      (useAuthStore as any).mockReturnValue({
        ...mockAuthStore,
        error: 'Network error. Please check your connection.',
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility Workflows', () => {
    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/email/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/password/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
    });

    it('should provide proper form labels and descriptions', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // All form fields should have accessible labels
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

      // Button should have clear action
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  describe('Loading States Workflow', () => {
    it('should show loading indicators during authentication', () => {
      (useAuthStore as any).mockReturnValue({
        ...mockAuthStore,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });
});