import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'joi';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Custom error classes
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationErrorResponse extends AppError {
  errors: any[];

  constructor(errors: any[]) {
    super('Validation failed', 400);
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.userId
  });

  // Handle Joi validation errors
  if (err instanceof ValidationError) {
    const errors = err.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      errors
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired'
    });
    return;
  }

  // Handle Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'A record with this value already exists'
      });
      return;
    }
    if (prismaError.code === 'P2025') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Record not found'
      });
      return;
    }
  }

  // Handle operational errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.name,
      message: error.message,
      ...(error instanceof ValidationErrorResponse && { errors: error.errors })
    });
    return;
  }

  // Handle unexpected errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });
  
  next();
};