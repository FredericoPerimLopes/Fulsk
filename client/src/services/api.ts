import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  AuthResponse, 
  LoginCredentials, 
  RegisterData, 
  User, 
  Device, 
  DeviceData, 
  DeviceStats,
  RealtimeMetrics,
  Alert,
  ApiResponse
} from '../types/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
      timeout: 10000,
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const response = await this.refreshToken(refreshToken);
              localStorage.setItem('auth_token', response.data.data.token);
              localStorage.setItem('refresh_token', response.data.data.refreshToken);
              
              // Retry original request
              error.config.headers.Authorization = `Bearer ${response.data.data.token}`;
              return this.api.request(error.config);
            } catch (refreshError) {
              // Refresh failed, redirect to login
              this.clearAuth();
              window.location.href = '/login';
            }
          } else {
            // No refresh token, redirect to login
            this.clearAuth();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response: AxiosResponse<ApiResponse<AuthResponse>> = await this.api.post('/auth/login', credentials);
    const authData = response.data.data;
    
    // Store tokens in localStorage
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('refresh_token', authData.refreshToken);
    localStorage.setItem('user', JSON.stringify(authData.user));
    
    return authData;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const response: AxiosResponse<ApiResponse<AuthResponse>> = await this.api.post('/auth/register', userData);
    const authData = response.data.data;
    
    // Store tokens in localStorage
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('refresh_token', authData.refreshToken);
    localStorage.setItem('user', JSON.stringify(authData.user));
    
    return authData;
  }

  async refreshToken(refreshToken: string): Promise<AxiosResponse<ApiResponse<AuthResponse>>> {
    return this.api.post('/auth/refresh', { refreshToken });
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await this.api.post('/auth/logout', { refreshToken });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearAuth();
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.get('/auth/profile');
    return response.data.data;
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    const response: AxiosResponse<ApiResponse<Device[]>> = await this.api.get('/devices');
    return response.data.data;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response: AxiosResponse<ApiResponse<Device>> = await this.api.get(`/devices/${deviceId}`);
    return response.data.data;
  }

  async createDevice(deviceData: Partial<Device>): Promise<Device> {
    const response: AxiosResponse<ApiResponse<Device>> = await this.api.post('/devices', deviceData);
    return response.data.data;
  }

  async updateDevice(deviceId: string, deviceData: Partial<Device>): Promise<Device> {
    const response: AxiosResponse<ApiResponse<Device>> = await this.api.put(`/devices/${deviceId}`, deviceData);
    return response.data.data;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.api.delete(`/devices/${deviceId}`);
  }

  async getDeviceData(deviceId: string, limit: number = 100): Promise<DeviceData[]> {
    const response: AxiosResponse<ApiResponse<DeviceData[]>> = await this.api.get(
      `/devices/${deviceId}/data?limit=${limit}`
    );
    return response.data.data;
  }

  async getDeviceStats(deviceId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<DeviceStats> {
    const response: AxiosResponse<ApiResponse<DeviceStats>> = await this.api.get(
      `/devices/${deviceId}/stats?period=${period}`
    );
    return response.data.data;
  }

  // Real-time methods
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    const response: AxiosResponse<ApiResponse<RealtimeMetrics>> = await this.api.get('/realtime/metrics');
    return response.data.data;
  }

  async getCurrentDeviceData(deviceId: string): Promise<DeviceData> {
    const response: AxiosResponse<ApiResponse<DeviceData>> = await this.api.get(`/realtime/devices/${deviceId}/current`);
    return response.data.data;
  }

  async getAlerts(): Promise<Alert[]> {
    const response: AxiosResponse<ApiResponse<Alert[]>> = await this.api.get('/realtime/alerts');
    return response.data.data;
  }

  // Health check
  async getHealth(): Promise<any> {
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/health`);
    return response.data;
  }

  // Utility methods
  clearAuth(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  getStoredUser(): User | null {
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : null;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }
}

export const apiService = new ApiService();
export default apiService;