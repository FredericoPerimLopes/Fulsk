import { PrismaClient } from '@prisma/client';

// Prisma Client singleton instance
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.__prisma;
}

export { prisma };

/**
 * Connect to the database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('🗄️ Database connected successfully');
    
    // Test database connection
    const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database`;
    console.log('📊 Database info:', result);
    
    // Check if TimescaleDB is available
    const timescaleCheck = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname = 'timescaledb'
    `;
    
    if (Array.isArray(timescaleCheck) && timescaleCheck.length > 0) {
      console.log('⏰ TimescaleDB extension detected');
    } else {
      console.log('⚠️ TimescaleDB extension not found - some features may be limited');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnection error:', error);
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<any> {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables 
      ORDER BY live_tuples DESC
    `;
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get database stats:', error);
    return null;
  }
}