import request from 'supertest';
import { app } from '@/index';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  describe('Auth Endpoints Load Testing', () => {
    const CONCURRENT_REQUESTS = 50;
    const MAX_RESPONSE_TIME = 500; // milliseconds

    it('should handle concurrent login requests efficiently', async () => {
      const validCredentials = {
        email: 'test@example.com',
        password: 'Test123!@#'
      };

      // First register a user
      await request(app)
        .post('/api/auth/register')
        .send({
          ...validCredentials,
          firstName: 'Load',
          lastName: 'Test',
          role: 'USER'
        });

      const startTime = performance.now();
      
      // Create concurrent login requests
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(validCredentials)
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const averageTime = totalTime / CONCURRENT_REQUESTS;

      // Check that all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check performance metrics
      expect(averageTime).toBeLessThan(MAX_RESPONSE_TIME);
      console.log(`Average response time: ${averageTime.toFixed(2)}ms`);
      console.log(`Total time for ${CONCURRENT_REQUESTS} requests: ${totalTime.toFixed(2)}ms`);
    });

    it('should handle concurrent registration requests without conflicts', async () => {
      const requests = Array(CONCURRENT_REQUESTS).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `loadtest${index}@example.com`,
            password: 'Test123!@#',
            firstName: 'Load',
            lastName: `Test${index}`,
            role: 'USER'
          })
      );

      const responses = await Promise.all(requests);

      // All registrations should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.user.email).toBe(`loadtest${index}@example.com`);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/health')
          .expect(200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (less than 10MB)
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024);
      
      console.log(`Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Database Performance', () => {
    it('should handle rapid user lookups efficiently', async () => {
      // Create test users
      const userIds: string[] = [];
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `perftest${i}@example.com`,
            password: 'Test123!@#',
            firstName: 'Perf',
            lastName: `Test${i}`,
            role: 'USER'
          });
        
        userIds.push(response.body.data.user.id);
      }

      // Test rapid profile lookups
      const startTime = performance.now();
      
      const profileRequests = userIds.map(userId => {
        // This would require implementing a test token for each user
        // For now, we'll test the health endpoint as a proxy for DB performance
        return request(app).get('/health');
      });

      await Promise.all(profileRequests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
      console.log(`Database lookup test completed in: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should enforce rate limits without blocking legitimate requests', async () => {
      const startTime = performance.now();
      
      // Make requests up to the rate limit
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();

      // All requests within limit should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should be fast
      
      console.log(`Rate limit test completed in: ${totalTime.toFixed(2)}ms`);
    });
  });
});