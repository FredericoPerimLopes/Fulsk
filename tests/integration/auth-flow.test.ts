import request from 'supertest';
import { app } from '@/index';
import { prisma } from '@utils/database';
import { UserRole } from '@models/User';
import { DatabaseAuthService } from '@services/DatabaseAuthService';

describe('Authentication Flow Integration', () => {
  let testUser: any;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-integration' } }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-integration' } }
    });
  });

  describe('Complete User Registration and Authentication Flow', () => {
    const userData = {
      email: 'test-integration@example.com',
      password: 'TestPassword123!',
      firstName: 'Integration',
      lastName: 'Test',
      role: UserRole.USER
    };

    it('should complete full registration flow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body).toMatchObject({
        message: 'User registered successfully',
        data: {
          user: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            isActive: true
          },
          token: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: '24h'
        }
      });

      testUser = registerResponse.body.data.user;
      accessToken = registerResponse.body.data.token;
      refreshToken = registerResponse.body.data.refreshToken;

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(userData.email);
      expect(dbUser?.isActive).toBe(true);

      // Verify refresh token was stored
      const dbRefreshToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      expect(dbRefreshToken).toBeTruthy();
      expect(dbRefreshToken?.userId).toBe(testUser.id);
    });

    it('should prevent duplicate registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Conflict',
        message: 'A record with this value already exists'
      });
    });

    it('should login with registered credentials', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        message: 'Login successful',
        data: {
          user: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role
          },
          token: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: '24h'
        }
      });

      // Update tokens for subsequent tests
      accessToken = loginResponse.body.data.token;
      refreshToken = loginResponse.body.data.refreshToken;

      // Verify lastLogin was updated
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      expect(dbUser?.lastLogin).toBeTruthy();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    });

    it('should access protected profile endpoint', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Profile retrieved successfully',
        data: {
          id: testUser.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role
        }
      });

      // Ensure password is not included
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should update user profile', async () => {
      const updates = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Profile updated successfully',
        data: {
          id: testUser.id,
          email: userData.email,
          firstName: updates.firstName,
          lastName: updates.lastName,
          role: userData.role
        }
      });

      // Verify changes in database
      const dbUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });

      expect(dbUser?.firstName).toBe(updates.firstName);
      expect(dbUser?.lastName).toBe(updates.lastName);
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Token refreshed successfully',
        data: {
          user: {
            id: testUser.id,
            email: userData.email
          },
          token: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: '24h'
        }
      });

      // Verify old refresh token was removed
      const oldDbRefreshToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      expect(oldDbRefreshToken).toBeNull();

      // Verify new refresh token was created
      const newRefreshToken = response.body.data.refreshToken;
      const newDbRefreshToken = await prisma.refreshToken.findUnique({
        where: { token: newRefreshToken }
      });

      expect(newDbRefreshToken).toBeTruthy();

      // Update tokens for logout test
      refreshToken = newRefreshToken;
    });

    it('should logout and invalidate refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Logout successful'
      });

      // Verify refresh token was removed from database
      const dbRefreshToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      expect(dbRefreshToken).toBeNull();
    });

    it('should reject requests with invalidated refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    });
  });

  describe('Admin User Flow', () => {
    let adminUser: any;
    let adminToken: string;

    const adminData = {
      email: 'admin-integration@example.com',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN
    };

    beforeAll(async () => {
      // Create admin user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      adminUser = registerResponse.body.data.user;
      adminToken = registerResponse.body.data.token;
    });

    it('should access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Users retrieved successfully',
        data: expect.arrayContaining([
          expect.objectContaining({
            email: adminData.email,
            role: UserRole.ADMIN
          })
        ])
      });

      // Verify at least our test users are included
      const userEmails = response.body.data.map((user: any) => user.email);
      expect(userEmails).toContain(adminData.email);
    });

    it('should prevent regular user from accessing admin endpoints', async () => {
      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test-integration@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      const userToken = loginResponse.body.data.token;

      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    });
  });

  describe('Token Expiry and Cleanup', () => {
    it('should clean up expired refresh tokens', async () => {
      // Create a refresh token that expires immediately
      const expiredToken = await prisma.refreshToken.create({
        data: {
          token: 'expired-test-token',
          userId: testUser.id,
          expiresAt: new Date(Date.now() - 1000) // 1 second ago
        }
      });

      expect(expiredToken).toBeTruthy();

      // Run cleanup
      const deletedCount = await DatabaseAuthService.cleanExpiredTokens();

      expect(deletedCount).toBeGreaterThan(0);

      // Verify expired token was removed
      const deletedToken = await prisma.refreshToken.findUnique({
        where: { token: 'expired-test-token' }
      });

      expect(deletedToken).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection issues gracefully', async () => {
      // Mock a database error (this would be more complex in a real test)
      const originalCreate = prisma.user.create;
      prisma.user.create = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'error-test@example.com',
          password: 'TestPassword123!',
          firstName: 'Error',
          lastName: 'Test',
          role: UserRole.USER
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error'
      });

      // Restore original method
      prisma.user.create = originalCreate;
    });

    it('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'NotBearer invalid-format')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Access token is required'
      });
    });
  });
});