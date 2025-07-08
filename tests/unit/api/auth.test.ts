import request from 'supertest';
import { app } from '@/index';
import { DatabaseAuthService } from '@services/DatabaseAuthService';
import { UserRole } from '@models/User';
import { generateToken, generateRefreshToken } from '@utils/auth';
import { createMockUser, createMockAuthResponse } from '../../test-helpers/fixtures';

// Mock dependencies
jest.mock('@services/DatabaseAuthService');
jest.mock('@utils/auth');
jest.mock('@utils/logger');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER
    };

    it('should register a new user successfully', async () => {
      const mockAuthResponse = createMockAuthResponse();
      (DatabaseAuthService.register as jest.Mock).mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'User registered successfully',
        data: mockAuthResponse
      });
      expect(DatabaseAuthService.register).toHaveBeenCalledWith(validUserData);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: 'Invalid input data',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' }),
          expect.objectContaining({ field: 'firstName' }),
          expect.objectContaining({ field: 'lastName' }),
          expect.objectContaining({ field: 'role' })
        ])
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, email: 'invalid-email' })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Please provide a valid email address'
        })
      );
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, password: 'weak' })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'password',
          message: expect.stringContaining('Password must')
        })
      );
    });

    it('should handle existing user error', async () => {
      (DatabaseAuthService.register as jest.Mock).mockRejectedValue(
        new Error('User with this email already exists')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'User with this email already exists'
      });
    });

    it('should apply rate limiting', async () => {
      // Make multiple requests to trigger rate limit
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/register')
          .send(validUserData)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse?.body).toMatchObject({
        error: 'Too Many Requests'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Test123!@#'
    };

    it('should login successfully with valid credentials', async () => {
      const mockAuthResponse = createMockAuthResponse();
      (DatabaseAuthService.login as jest.Mock).mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        data: mockAuthResponse
      });
      expect(DatabaseAuthService.login).toHaveBeenCalledWith(validCredentials);
    });

    it('should reject invalid credentials', async () => {
      (DatabaseAuthService.login as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' })
      );
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockAuthResponse = createMockAuthResponse();
      (DatabaseAuthService.refreshToken as jest.Mock).mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Token refreshed successfully',
        data: mockAuthResponse
      });
      expect(DatabaseAuthService.refreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      (DatabaseAuthService.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const mockUser = createMockUser();
      const token = 'valid-token';
      
      (generateToken as jest.Mock).mockReturnValue(token);
      (DatabaseAuthService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Profile retrieved successfully',
        data: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email
        })
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Access token is required'
      });
    });

    it('should handle non-existent user', async () => {
      const token = 'valid-token';
      (generateToken as jest.Mock).mockReturnValue(token);
      (DatabaseAuthService.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'User not found'
      });
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update profile successfully', async () => {
      const token = 'valid-token';
      const updates = { firstName: 'Jane' };
      const updatedUser = { ...createMockUser(), firstName: 'Jane' };

      (generateToken as jest.Mock).mockReturnValue(token);
      (DatabaseAuthService.updateProfile as jest.Mock).mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Profile updated successfully',
        data: expect.objectContaining({
          firstName: 'Jane'
        })
      });
    });

    it('should validate update fields', async () => {
      const token = 'valid-token';
      (generateToken as jest.Mock).mockReturnValue(token);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Please provide a valid email address'
        })
      );
    });

    it('should require at least one field to update', async () => {
      const token = 'valid-token';
      (generateToken as jest.Mock).mockReturnValue(token);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          message: 'At least one field must be provided for update'
        })
      );
    });
  });

  describe('GET /api/auth/users', () => {
    it('should get all users for admin', async () => {
      const token = 'admin-token';
      const mockUsers = [createMockUser(), createMockUser({ id: 'user-456' })];
      
      (generateToken as jest.Mock).mockReturnValue(token);
      (DatabaseAuthService.getAllUsers as jest.Mock).mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Users retrieved successfully',
        data: mockUsers
      });
    });

    it('should reject non-admin users', async () => {
      const token = 'user-token';
      const mockUser = createMockUser({ role: UserRole.USER });
      
      (generateToken as jest.Mock).mockReturnValue(token);

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      (DatabaseAuthService.logout as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Logout successful'
      });
      expect(DatabaseAuthService.logout).toHaveBeenCalledWith(refreshToken);
    });

    it('should validate refresh token presence', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(400);

      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'refreshToken',
          message: 'Refresh token is required'
        })
      );
    });
  });
});