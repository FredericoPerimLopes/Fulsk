import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from '@api/auth';
import deviceRoutes from '@api/devices';
import realtimeRoutes from '@api/realtime';
import { DataCollectionService } from '@services/DataCollectionService';
import { connectDatabase, checkDatabaseHealth } from '@utils/database';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || 'localhost';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3001",
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Fulsk Solar Panel Monitoring API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      devices: '/api/devices',
      realtime: '/api/realtime'
    }
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe-device', (deviceId: string) => {
    socket.join(`device-${deviceId}`);
    console.log(`Client ${socket.id} subscribed to device ${deviceId}`);
  });
  
  socket.on('unsubscribe-device', (deviceId: string) => {
    socket.leave(`device-${deviceId}`);
    console.log(`Client ${socket.id} unsubscribed from device ${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Initialize database and services
async function startServer() {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Initialize data collection service
    const dataCollectionService = new DataCollectionService(io);

    // Start server
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Fulsk API server running on http://${HOST}:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: Connected and ready`);
      console.log(`🔌 WebSocket server ready for real-time connections`);
      console.log(`📡 Data collection service initialized`);
    });
    
    return dataCollectionService;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (dataCollectionService) {
    dataCollectionService.cleanup();
  }
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

export { app, io };