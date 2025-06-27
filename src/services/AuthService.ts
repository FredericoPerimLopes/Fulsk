import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserDto, LoginDto, AuthResponse, UserRole } from '@models/User';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateRefreshToken, 
  createSafeUser,
  verifyRefreshToken 
} from '@utils/auth';

// In-memory user storage (replace with database in production)
const users: User[] = [];

// In-memory refresh token storage (replace with Redis in production)
const refreshTokens: Set<string> = new Set();

export class AuthService {
  /**
   * Register a new user
   */
  static async register(userData: CreateUserDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = users.find(user => user.email === userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const hashedPassword = await hashPassword(userData.password);
    const newUser: User = {
      id: uuidv4(),
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    users.push(newUser);

    // Generate tokens
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser.id);
    refreshTokens.add(refreshToken);

    return {
      user: createSafeUser(newUser),
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
    const user = users.find(u => u.email === credentials.email);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await comparePassword(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    user.updatedAt = new Date();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user.id);
    refreshTokens.add(refreshToken);

    return {
      user: createSafeUser(user),
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthResponse> {
    // Check if refresh token exists
    if (!refreshTokens.has(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

    try {
      // Verify refresh token
      const { userId } = verifyRefreshToken(refreshToken);
      
      // Find user
      const user = users.find(u => u.id === userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Remove old refresh token and generate new ones
      refreshTokens.delete(refreshToken);
      const newToken = generateToken(user);
      const newRefreshToken = generateRefreshToken(user.id);
      refreshTokens.add(newRefreshToken);

      return {
        user: createSafeUser(user),
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      };
    } catch (error) {
      refreshTokens.delete(refreshToken);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(refreshToken: string): Promise<void> {
    refreshTokens.delete(refreshToken);
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = users.find(u => u.id === userId);
    return user ? createSafeUser(user) : null;
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<CreateUserDto>): Promise<Omit<User, 'password'>> {
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user fields
    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.email) {
      // Check if email is already taken
      const existingUser = users.find(u => u.email === updates.email && u.id !== userId);
      if (existingUser) {
        throw new Error('Email already in use');
      }
      user.email = updates.email;
    }
    if (updates.password) {
      user.password = await hashPassword(updates.password);
    }

    user.updatedAt = new Date();

    return createSafeUser(user);
  }

  /**
   * Get all users (Admin only)
   */
  static async getAllUsers(): Promise<Omit<User, 'password'>[]> {
    return users.map(createSafeUser);
  }

  /**
   * Deactivate user (Admin only)
   */
  static async deactivateUser(userId: string): Promise<void> {
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    user.updatedAt = new Date();
  }
}