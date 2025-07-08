import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';
import authRoutes from '@api/auth';
import deviceRoutes from '@api/devices';
import realtimeRoutes from '@api/realtime';
import sunspecRoutes from '@api/sunspec';
import aiRoutes from '@api/routes/ai';
import weatherRoutes from '@api/routes/weather';
import energyRoutes from '@api/routes/energy';
import { DataCollectionService } from '@services/DataCollectionService';
import { connectDatabase, checkDatabaseHealth } from '@utils/database';
import { errorHandler, notFoundHandler, requestLogger } from '@middleware/errorHandler';
import { securityMiddleware, corsOptions, requestSizeLimiter, apiLimiter } from '@middleware/security';
import logger, { stream, logInfo, logError } from '@utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || 'localhost';

// Apply security middleware
app.use(securityMiddleware);
app.use(cors(corsOptions));

// Request logging
app.use(morgan('combined', { stream }));
app.use(requestLogger);

// Body parsing middleware with size limits
app.use(express.json({ limit: requestSizeLimiter.json }));
app.use(express.urlencoded(requestSizeLimiter.urlencoded));

// Apply general rate limiting
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Fulsk Solar Monitoring API',
    version: '1.0.0',
    database: dbHealth ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/sunspec', sunspecRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/energy', energyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Fulsk Solar Panel Monitoring API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      devices: '/api/devices',
      realtime: '/api/realtime',
      sunspec: '/api/sunspec',
      ai: '/api/ai',
      weather: '/api/weather',
      energy: '/api/energy'
    }
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logInfo('Client connected', { socketId: socket.id });
  
  socket.on('subscribe-device', (deviceId: string) => {
    // Validate deviceId format
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
      socket.emit('error', { message: 'Invalid device ID' });
      return;
    }
    
    socket.join(`device-${deviceId}`);
    logInfo('Client subscribed to device', { socketId: socket.id, deviceId });
  });
  
  socket.on('unsubscribe-device', (deviceId: string) => {
    socket.leave(`device-${deviceId}`);
    logInfo('Client unsubscribed from device', { socketId: socket.id, deviceId });
  });
  
  socket.on('disconnect', () => {
    logInfo('Client disconnected', { socketId: socket.id });
  });
  
  socket.on('error', (error) => {
    logError(error, { socketId: socket.id });
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and services
async function startServer() {
  try {
    // Connect to database first
    await connectDatabase();
    logInfo('Database connected successfully');
    
    // Initialize data collection service
    const dataCollectionService = new DataCollectionService(io);
    logInfo('Data collection service initialized');

    // Start server
    server.listen(PORT, HOST, () => {
      logInfo(`🚀 Fulsk API server running on http://${HOST}:${PORT}`);
      logInfo(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logInfo(`🗄️ Database: Connected and ready`);
      logInfo(`🔌 WebSocket server ready for real-time connections`);
      logInfo(`📡 Data collection service initialized`);
    });
    
    return dataCollectionService;
  } catch (error) {
    logError(error as Error, { context: 'Server startup failed' });
    process.exit(1);
  }
}

// Global reference for cleanup
let dataCollectionService: any = null;

// Start the server
startServer().then((service) => {
  dataCollectionService = service;
}).catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('🛑 SIGTERM received, shutting down gracefully');
  if (dataCollectionService) {
    dataCollectionService.cleanup();
  }
  server.close(() => {
    logInfo('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('🛑 SIGINT received, shutting down gracefully');
  if (dataCollectionService) {
    dataCollectionService.cleanup();
  }
  server.close(() => {
    logInfo('👋 Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logError(error, { context: 'Uncaught Exception' });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(new Error(`Unhandled Rejection: ${reason}`), { promise });
  process.exit(1);
});

export { app, io };