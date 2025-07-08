import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { TooManyRequestsError } from './errorHandler';

// Rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      throw new TooManyRequestsError(message);
    }
  });
};

// Different rate limiters for different endpoints
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests per window
  'Too many authentication attempts, please try again later'
);

export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100 // 100 requests per window
);

export const strictLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 requests per hour
  'Too many requests, please try again in an hour'
);

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
});

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query as any);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Helper function to sanitize objects
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Remove any keys that start with $ or contain dots (MongoDB operators)
      if (!key.startsWith('$') && !key.includes('.')) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
  }
  
  return sanitized;
}

// Helper function to sanitize individual values
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Remove null bytes
    value = value.replace(/\0/g, '');
    
    // Trim whitespace
    value = value.trim();
    
    // Encode HTML entities for basic XSS prevention
    value = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  return value;
}

// SQL injection prevention middleware (for raw queries)
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
    /(\bor\b\s*\d+\s*=\s*\d+)/i,
    /(\band\b\s*\d+\s*=\s*\d+)/i,
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj !== 'object' || obj === null) {
      return checkValue(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    
    return Object.values(obj).some(checkObject);
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid input detected'
    });
    return;
  }
  
  next();
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// Request size limiting
export const requestSizeLimiter = {
  json: '10mb',
  urlencoded: { extended: true, limit: '10mb' }
};

// Security middleware bundle
export const securityMiddleware = [
  securityHeaders,
  sanitizeInput,
  mongoSanitize(),
  hpp(), // Prevent HTTP Parameter Pollution
];