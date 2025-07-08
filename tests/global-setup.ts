import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

const prisma = new PrismaClient();

export default async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  try {
    // Ensure test database exists and is migrated
    console.log('📦 Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Connect to database to verify setup
    await prisma.$connect();
    console.log('✅ Database connection verified');

    // Seed test data if needed
    console.log('🌱 Seeding test data...');
    await seedTestData();

    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function seedTestData() {
  try {
    // Clean up any existing test data
    await prisma.refreshToken.deleteMany({});
    await prisma.deviceData.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });

    console.log('🧹 Cleaned up existing test data');
    
    // You can add common test data here if needed
    // For example, creating default admin users, test devices, etc.
    
  } catch (error) {
    console.warn('⚠️ Warning: Could not clean test data:', error);
    // Don't fail the setup for cleanup issues
  }
}