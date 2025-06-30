import { Response } from 'express';

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

/**
 * Standard error response utility
 */
export class ErrorHandler {
  /**
   * Send standardized error response
   */
  static sendError(
    res: Response, 
    statusCode: number, 
    error: string, 
    message: string, 
    code?: string, 
    details?: any
  ): void {
    const errorResponse: ErrorResponse = {
      error,
      message,
      timestamp: new Date().toISOString()
    };

    if (code) errorResponse.code = code;
    if (details && process.env.NODE_ENV === 'development') {
      errorResponse.details = details;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle validation errors
   */
  static validationError(res: Response, message: string, details?: any): void {
    this.sendError(res, 400, 'Validation Error', message, 'VALIDATION_FAILED', details);
  }

  /**
   * Handle authentication errors
   */
  static authenticationError(res: Response, message: string = 'Authentication required'): void {
    this.sendError(res, 401, 'Unauthorized', message, 'AUTH_FAILED');
  }

  /**
   * Handle authorization errors
   */
  static authorizationError(res: Response, message: string = 'Insufficient permissions'): void {
    this.sendError(res, 403, 'Forbidden', message, 'ACCESS_DENIED');
  }

  /**
   * Handle not found errors
   */
  static notFoundError(res: Response, resource: string = 'Resource'): void {
    this.sendError(res, 404, 'Not Found', `${resource} not found`, 'NOT_FOUND');
  }

  /**
   * Handle server errors
   */
  static serverError(res: Response, message: string = 'Internal server error', error?: Error): void {
    this.sendError(
      res, 
      500, 
      'Internal Server Error', 
      message, 
      'SERVER_ERROR',
      error?.stack
    );
  }

  /**
   * Handle rate limiting errors
   */
  static rateLimitError(res: Response, message: string = 'Too many requests'): void {
    this.sendError(res, 429, 'Too Many Requests', message, 'RATE_LIMIT_EXCEEDED');
  }

  /**
   * Handle bad request errors
   */
  static badRequestError(res: Response, message: string, code?: string): void {
    this.sendError(res, 400, 'Bad Request', message, code || 'BAD_REQUEST');
  }
}