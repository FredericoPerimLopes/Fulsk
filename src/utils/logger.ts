import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      format
    ),
  }),
  // Error log file
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Combined log file
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
});

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logError = (error: Error, context?: any) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

export const logHttp = (message: string, meta?: any) => {
  logger.http(message, meta);
};

// Database query logger
export const logQuery = (query: string, params?: any[], duration?: number) => {
  if (process.env.LOG_DB_QUERIES === 'true') {
    logger.debug('Database Query', {
      query,
      params,
      duration: duration ? `${duration}ms` : undefined,
    });
  }
};

// Performance logger
export const logPerformance = (operation: string, duration: number, meta?: any) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, `Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...meta,
  });
};

// Audit logger
export const logAudit = (action: string, userId: string, details?: any) => {
  logger.info('Audit Log', {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Security logger
export const logSecurity = (event: string, details: any) => {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export default logger;