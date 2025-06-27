import { prisma } from '@utils/database';
import { User, UserRole, CreateUserDto, LoginDto, AuthResponse } from '@models/User';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateRefreshToken, 
  createSafeUser,
  verifyRefreshToken 
} from '@utils/auth';

export class DatabaseAuthService {
  /**
   * Register a new user
   */
  static async register(userData: CreateUserDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const hashedPassword = await hashPassword(userData.password);
    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role as UserRole,
      }
    });

    // Generate tokens
    const token = generateToken(newUser as User);
    const refreshToken = generateRefreshToken(newUser.id);
    
    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: newUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return {
      user: createSafeUser(newUser as User),
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  /**
   * Login user
   */
  static async login(credentials: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await comparePassword(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const token = generateToken(user as User);
    const refreshToken = generateRefreshToken(user.id);
    
    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return {
      user: createSafeUser(user as User),
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    // Find refresh token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || !storedToken.user || !storedToken.user.isActive) {
      throw new Error('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Remove expired token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });
      throw new Error('Refresh token expired');
    }

    try {
      // Verify refresh token
      verifyRefreshToken(refreshToken);
      
      // Remove old refresh token and generate new ones
      await prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });
      
      const newToken = generateToken(storedToken.user as User);
      const newRefreshToken = generateRefreshToken(storedToken.user.id);
      
      // Store new refresh token
      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      return {
        user: createSafeUser(storedToken.user as User),
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      };
    } catch (error) {
      // Remove invalid token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    });
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    return user ? createSafeUser(user as User) : null;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<CreateUserDto>): Promise<Omit<User, 'password'>> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is already taken by another user
    if (updates.email && updates.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updates.email }
      });
      
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.firstName) updateData.firstName = updates.firstName;
    if (updates.lastName) updateData.lastName = updates.lastName;
    if (updates.email) updateData.email = updates.email;
    if (updates.password) updateData.password = await hashPassword(updates.password);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    return createSafeUser(updatedUser as User);
  }

  /**
   * Get all users (Admin only)
   */
  static async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return users.map(user => createSafeUser(user as User));
  }

  /**
   * Deactivate user (Admin only)
   */
  static async deactivateUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    // Invalidate all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean expired refresh tokens
   */
  static async cleanExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    return result.count;
  }
}