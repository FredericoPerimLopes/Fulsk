import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  createSafeUser
} from '@utils/auth';
import { User, UserRole } from '@models/User';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid')
}));

// Set up environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '24h';
process.env.BCRYPT_ROUNDS = '10';

describe('Auth Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'Test123!@#';
      const hashedPassword = 'hashed-password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle bcrypt errors', async () => {
      const password = 'Test123!@#';
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      await expect(hashPassword(password)).rejects.toThrow('Bcrypt error');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'Test123!@#';
      const hashedPassword = 'hashed-password';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await comparePassword(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      const password = 'Test123!@#';
      const hashedPassword = 'hashed-password';
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await comparePassword(password, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockToken = 'jwt-token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = generateToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        },
        'test-secret',
        { expiresIn: '24h' }
      );
      expect(result).toBe(mockToken);
    });

    it('should handle missing JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => generateToken(mockUser)).toThrow('JWT_SECRET is not defined');

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token', () => {
      const userId = 'user-123';
      const mockToken = 'refresh-token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = generateRefreshToken(userId);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId,
          tokenId: 'mock-uuid'
        },
        'test-refresh-secret',
        { expiresIn: '7d' }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = 'valid-token';
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = 'valid-refresh-token';
      const mockPayload = {
        userId: 'user-123',
        tokenId: 'token-123'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = verifyRefreshToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-refresh-secret');
      expect(result).toEqual(mockPayload);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const header = 'Bearer valid-token';
      const result = extractTokenFromHeader(header);
      expect(result).toBe('valid-token');
    });

    it('should return null for missing header', () => {
      const result = extractTokenFromHeader(undefined);
      expect(result).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const header = 'Invalid header';
      const result = extractTokenFromHeader(header);
      expect(result).toBeNull();
    });

    it('should return null for empty Bearer token', () => {
      const header = 'Bearer ';
      const result = extractTokenFromHeader(header);
      expect(result).toBeNull();
    });

    it('should handle case-insensitive Bearer prefix', () => {
      const header = 'bearer valid-token';
      const result = extractTokenFromHeader(header);
      expect(result).toBe('valid-token');
    });
  });

  describe('createSafeUser', () => {
    it('should remove password from user object', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date()
      };

      const result = createSafeUser(user);

      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      });
    });

    it('should handle user without optional fields', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = createSafeUser(user);

      expect(result).not.toHaveProperty('lastLogin');
      expect(result).toHaveProperty('isActive', true);
    });
  });
});