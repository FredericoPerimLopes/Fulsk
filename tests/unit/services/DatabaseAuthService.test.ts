import { DatabaseAuthService } from '@services/DatabaseAuthService';
import { prisma } from '@utils/database';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyRefreshToken } from '@utils/auth';
import { UserRole } from '@models/User';

// Mock dependencies
jest.mock('@utils/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    }
  }
}));

jest.mock('@utils/auth');

describe('DatabaseAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER
    };

    it('should register a new user successfully', async () => {
      const mockHashedPassword = 'hashed-password';
      const mockUser = {
        id: 'user-123',
        ...mockUserData,
        password: mockHashedPassword,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (generateToken as jest.Mock).mockReturnValue(mockToken);
      (generateRefreshToken as jest.Mock).mockReturnValue(mockRefreshToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await DatabaseAuthService.register(mockUserData);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockUserData.email }
      });
      expect(hashPassword).toHaveBeenCalledWith(mockUserData.password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: mockUserData.email,
          password: mockHashedPassword,
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          role: mockUserData.role
        }
      });
      expect(generateToken).toHaveBeenCalledWith(mockUser);
      expect(generateRefreshToken).toHaveBeenCalledWith(mockUser.id);
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        }),
        token: mockToken,
        refreshToken: mockRefreshToken,
        expiresIn: '24h'
      });
    });

    it('should throw error if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-user' });

      await expect(DatabaseAuthService.register(mockUserData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (hashPassword as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.user.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(DatabaseAuthService.register(mockUserData)).rejects.toThrow('Database error');
    });
  });

  describe('login', () => {
    const mockCredentials = {
      email: 'test@example.com',
      password: 'Test123!@#'
    };

    const mockUser = {
      id: 'user-123',
      email: mockCredentials.email,
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should login user successfully', async () => {
      const mockToken = 'access-token';
      const mockRefreshToken = 'refresh-token';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (generateToken as jest.Mock).mockReturnValue(mockToken);
      (generateRefreshToken as jest.Mock).mockReturnValue(mockRefreshToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await DatabaseAuthService.login(mockCredentials);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockCredentials.email }
      });
      expect(comparePassword).toHaveBeenCalledWith(mockCredentials.password, mockUser.password);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) }
      });
      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: mockUser.email
        }),
        token: mockToken,
        refreshToken: mockRefreshToken,
        expiresIn: '24h'
      });
    });

    it('should throw error for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(DatabaseAuthService.login(mockCredentials)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      await expect(DatabaseAuthService.login(mockCredentials)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(DatabaseAuthService.login(mockCredentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'refresh-token-123';
    const mockStoredToken = {
      id: 'token-id',
      token: mockRefreshToken,
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      user: {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true
      }
    };

    it('should refresh token successfully', async () => {
      const newToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockStoredToken);
      (verifyRefreshToken as jest.Mock).mockReturnValue({ userId: mockStoredToken.userId });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (generateToken as jest.Mock).mockReturnValue(newToken);
      (generateRefreshToken as jest.Mock).mockReturnValue(newRefreshToken);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await DatabaseAuthService.refreshToken(mockRefreshToken);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: mockRefreshToken },
        include: { user: true }
      });
      expect(verifyRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id }
      });
      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: mockStoredToken.user.email
        }),
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: '24h'
      });
    });

    it('should throw error for non-existent token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(DatabaseAuthService.refreshToken(mockRefreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000)
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(expiredToken);

      await expect(DatabaseAuthService.refreshToken(mockRefreshToken)).rejects.toThrow('Refresh token expired');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id }
      });
    });

    it('should handle invalid token verification', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockStoredToken);
      (verifyRefreshToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(DatabaseAuthService.refreshToken(mockRefreshToken)).rejects.toThrow('Invalid refresh token');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id }
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const refreshToken = 'refresh-token-123';
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await DatabaseAuthService.logout(refreshToken);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: refreshToken }
      });
    });
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await DatabaseAuthService.getUserById('user-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName
      });
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await DatabaseAuthService.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    const userId = 'user-123';
    const updates = {
      firstName: 'Jane',
      email: 'newemail@example.com'
    };

    it('should update user profile successfully', async () => {
      const existingUser = {
        id: userId,
        email: 'oldemail@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const updatedUser = {
        ...existingUser,
        ...updates
      };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null); // For email uniqueness check
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await DatabaseAuthService.updateProfile(userId, updates);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updates
      });
      expect(result).toMatchObject({
        firstName: updates.firstName,
        email: updates.email
      });
    });

    it('should throw error if email is already taken', async () => {
      const existingUser = {
        id: userId,
        email: 'oldemail@example.com'
      };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ id: 'other-user', email: updates.email });

      await expect(DatabaseAuthService.updateProfile(userId, updates)).rejects.toThrow('Email already in use');
    });

    it('should hash password when updating', async () => {
      const passwordUpdate = { password: 'NewPassword123!' };
      const hashedPassword = 'new-hashed-password';

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId });
      (hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: userId });

      await DatabaseAuthService.updateProfile(userId, passwordUpdate);

      expect(hashPassword).toHaveBeenCalledWith(passwordUpdate.password);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: hashedPassword }
      });
    });
  });

  describe('cleanExpiredTokens', () => {
    it('should clean expired tokens', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await DatabaseAuthService.cleanExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date)
          }
        }
      });
      expect(result).toBe(5);
    });
  });
});