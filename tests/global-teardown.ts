import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');

  try {
    await prisma.$connect();

    // Clean up test data
    console.log('🗑️ Removing test data...');
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

    console.log('✅ Test cleanup complete');
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
    // Don't throw error to avoid failing tests
  } finally {
    await prisma.$disconnect();
  }
}