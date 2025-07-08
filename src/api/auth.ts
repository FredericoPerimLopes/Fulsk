import { Router, Request, Response } from 'express';
import { DatabaseAuthService as AuthService } from '@services/DatabaseAuthService';
import { CreateUserDto, LoginDto, UserRole } from '@models/User';
import { authenticate, authorize } from '@middleware/auth';
import { 
  validateRegister, 
  validateLogin, 
  validateRefresh, 
  validateUpdateProfile 
} from '@middleware/validators/auth.validator';
import { asyncHandler } from '@middleware/errorHandler';
import { authLimiter } from '@middleware/security';
import { logAudit } from '@utils/logger';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validateRegister, asyncHandler(async (req: Request, res: Response) => {
  const userData: CreateUserDto = req.body;
  const authResponse = await AuthService.register(userData);
  
  // Log audit event
  logAudit('USER_REGISTERED', authResponse.user.id, {
    email: authResponse.user.email,
    role: authResponse.user.role
  });

  res.status(201).json({
    message: 'User registered successfully',
    data: authResponse
  });
}));

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', validateLogin, asyncHandler(async (req: Request, res: Response) => {
  const credentials: LoginDto = req.body;
  const authResponse = await AuthService.login(credentials);
  
  // Log audit event
  logAudit('USER_LOGIN', authResponse.user.id, {
    email: authResponse.user.email
  });

  res.json({
    message: 'Login successful',
    data: authResponse
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', validateRefresh, asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const authResponse = await AuthService.refreshToken(refreshToken);

  res.json({
    message: 'Token refreshed successfully',
    data: authResponse
  });
}));

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', validateRefresh, asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await AuthService.logout(refreshToken);
  
  // Log audit event
  if (req.user) {
    logAudit('USER_LOGOUT', req.user.userId, {});
  }

  res.json({
    message: 'Logout successful'
  });
}));

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await AuthService.getUserById(userId);

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User not found'
    });
  }

  res.json({
    message: 'Profile retrieved successfully',
    data: user
  });
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, validateUpdateProfile, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const updates = req.body;

  const updatedUser = await AuthService.updateProfile(userId, updates);
  
  // Log audit event
  logAudit('USER_PROFILE_UPDATED', userId, {
    updatedFields: Object.keys(updates)
  });

  res.json({
    message: 'Profile updated successfully',
    data: updatedUser
  });
}));

/**
 * GET /api/auth/users
 * Get all users (Admin only)
 */
router.get('/users', authenticate, authorize(UserRole.ADMIN), asyncHandler(async (req: Request, res: Response) => {
  const users = await AuthService.getAllUsers();
  
  // Log audit event
  logAudit('ADMIN_VIEWED_USERS', req.user!.userId, {
    userCount: users.length
  });

  res.json({
    message: 'Users retrieved successfully',
    data: users
  });
}));

export default router;