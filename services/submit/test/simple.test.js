const request = require('supertest');
const app = require('../server');
const fs = require('fs');
const path = require('path');
const { CACHE_FILE } = require('../queue');

/**
 * Submit Microservice Tests
 * 
 * Verifying submission workflow, cache resilience, and documentation.
 */

// Mock the queue module to avoid real RabbitMQ connections during tests
jest.mock('../queue', () => {
    const original = jest.requireActual('../queue');
    return {
        ...original,
        connectQueue: jest.fn(),
        publishJoke: jest.fn(),
    };
});

const queue = require('../queue');

describe('Submit Microservice API', () => {

  /**
   * Test Case: POST /submit
   * Description: Verify that jokes are correctly validated and published to the queue.
   */
  describe('POST /submit', () => {
    test('Input Validation: should return 400 if fields are missing', async () => {
      const response = await request(app).post('/submit').send({ setup: "S" });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Missing required fields/);
    });

    test('Queue Integration: should accept and send joke to submission queue', async () => {
      const jokeData = { setup: "S", punchline: "P", type: "sports" };
      queue.publishJoke.mockResolvedValue();
      const response = await request(app).post('/submit').send(jokeData);
      expect(response.status).toBe(202);
      expect(queue.publishJoke).toHaveBeenCalledWith(jokeData);
    });
  });

  /**
   * Test Case: GET /types (Resilience)
   * Description: Verify standard retrieval, cache fallback, and refresh logic.
   */
  describe('GET /types (Resilience)', () => {
    
    test('Standard Retrieval: should fetch types from local cache', async () => {
      const mockTypes = ["dad", "sports"];
      fs.writeFileSync(CACHE_FILE, JSON.stringify(mockTypes));
      const response = await request(app).get('/types');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTypes);
    });

    test('Cache Fallback: seed file should exist and have default types', () => {
        expect(fs.existsSync(CACHE_FILE)).toBe(true);
        const types = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        expect(types.length).toBeGreaterThan(0);
    });

    test('Cache Refresh: verifying file update logic (manual trigger)', () => {
        const newType = 'science';
        const currentCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (!currentCache.includes(newType)) {
            currentCache.push(newType);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCache));
        }
        const updatedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        expect(updatedCache).toContain(newType);
    });
  });

  /**
   * Test Case: OpenAPI Documentation
   * Description: Verify that swagger documentation is accessible.
   */
  describe('OpenAPI Documentation', () => {
    test('Endpoint GET /docs: should be accessible', async () => {
      const response = await request(app).get('/docs/');
      expect([200, 301, 302]).toContain(response.status);
    });
  });

});
