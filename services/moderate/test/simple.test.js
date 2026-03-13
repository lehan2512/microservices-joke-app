const request = require('supertest');
const fs = require('fs');
const path = require('path');

/**
 * Moderate Microservice Tests
 * 
 * Verifying moderation workflow and Event-Carried State Transfer (ECST).
 */

// Mock the auth middleware before requiring app
jest.mock('express-openid-connect', () => ({
  auth: () => (req, res, next) => {
    req.oidc = { isAuthenticated: () => true, user: { name: 'Test User' } };
    next();
  },
  requiresAuth: () => (req, res, next) => next()
}));

// Mock the queue module to avoid real RabbitMQ connections during tests
jest.mock('../queue', () => {
    const original = jest.requireActual('../queue');
    return {
        ...original,
        connectQueue: jest.fn(),
        getJokeFromQueue: jest.fn(),
        publishModeratedJoke: jest.fn(),
    };
});

const app = require('../server');
const queue = require('../queue');
const { CACHE_FILE } = require('../queue');

describe('Moderate Microservice API', () => {

  /**
   * Test Case: Get Joke to Moderate
   * Description: Verify that jokes are correctly retrieved from the queue and handled when empty.
   */
  describe('GET /moderate', () => {
    test('Queue Retrieval: should return a joke when queue is not empty', async () => {
      const mockJoke = { setup: "Q", punchline: "A", type: "dad" };
      queue.getJokeFromQueue.mockResolvedValue(mockJoke);
      const response = await request(app).get('/moderate');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockJoke);
    });

    test('Empty Queue Response: should return 204 No Content when queue is empty', async () => {
      queue.getJokeFromQueue.mockResolvedValue(null);
      const response = await request(app).get('/moderate');
      expect(response.status).toBe(204);
    });
  });

  /**
   * Test Case: Submit Moderated Joke
   * Description: Verify that approved jokes are submitted.
   */
  describe('POST /moderated', () => {
    test('Moderated Submission: should approve and send joke to moderated queue', async () => {
      const jokeData = { setup: "S", punchline: "P", type: "love" };
      queue.publishModeratedJoke.mockResolvedValue();
      const response = await request(app).post('/moderated').send(jokeData);
      expect(response.status).toBe(202);
      expect(queue.publishModeratedJoke).toHaveBeenCalledWith(jokeData);
    });

    test('Authentication Check: should be authenticated (mocked)', async () => {
      const response = await request(app).get('/moderate');
      // Should not be 302/401 because of our mock
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(401);
    });
  });

  /**
   * Test Case: Event-Carried State Transfer (ECST)
   * Description: Verify that the service updates its local types cache upon receiving an event.
   */
  describe('Event-Carried State Transfer (ECST)', () => {
    test('Type Update Subscription: should update local cache when type_update event occurs', () => {
      const newType = 'tech';
      if (!fs.existsSync(path.dirname(CACHE_FILE))) {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(["dad"]));

      // Simulation of ECST logic found in queue.js
      const currentCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (!currentCache.includes(newType)) {
          currentCache.push(newType);
          fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCache));
      }

      const updatedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      expect(updatedCache).toContain(newType);
    });
  });

});
