import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, optionalAuthenticate } from '@middleware/auth';
import { verifyToken } from '@utils/auth';
import { UserRole } from '@models/User';

// Mock the auth utility
jest.mock('@utils/auth');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', () => {
      const mockUser = { userId: '123', email: 'test@example.com', role: UserRole.USER };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (verifyToken as jest.Mock).mockReturnValue(mockUser);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject missing token', () => {
      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Access token is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed authorization header', () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    it('should authorize user with correct role', () => {
      mockRequest.user = { userId: '123', email: 'test@example.com', role: UserRole.ADMIN };
      const middleware = authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject user with incorrect role', () => {
      mockRequest.user = { userId: '123', email: 'test@example.com', role: UserRole.USER };
      const middleware = authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when no user is present', () => {
      const middleware = authorize(UserRole.ADMIN);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple roles correctly', () => {
      mockRequest.user = { userId: '123', email: 'test@example.com', role: UserRole.TECHNICIAN };
      const middleware = authorize(UserRole.TECHNICIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuthenticate middleware', () => {
    it('should authenticate valid token', () => {
      const mockUser = { userId: '123', email: 'test@example.com', role: UserRole.USER };
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (verifyToken as jest.Mock).mockReturnValue(mockUser);

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without token', () => {
      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue with invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuthenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});