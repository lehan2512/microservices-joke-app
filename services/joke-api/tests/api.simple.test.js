const request = require('supertest');
const app = require('../server');
const db = require('../db');

/**
 * Joke Microservice Tests
 * 
 * These tests verify the core functionality of the Joke API.
 * We use supertest to call the endpoints directly and check the responses.
 */

describe('Joke Microservice API', () => {

  /**
   * Test Case: Fetch All Types
   * Description: Verify that GET /types returns a list of unique joke types.
   */
  describe('GET /types', () => {
    test('Standard Retrieval: should fetch all types without duplicates', async () => {
      const response = await request(app).get('/types');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Check for duplicates
      const uniqueTypes = new Set(response.body);
      expect(uniqueTypes.size).toBe(response.body.length);
    });

    test('DB Failure: should return 500 when DB fails', async () => {
        // Mock getTypes to reject
        const original = db.getTypes;
        db.getTypes = jest.fn().mockRejectedValueOnce(new Error('DB Error'));
        
        const response = await request(app).get('/types');
        expect(response.status).toBe(500);
        
        // Restore original for other tests
        db.getTypes = original;
    });
  });

  /**
   * Test Case: Get Jokes
   * Description: Verify that GET /joke/:type returns the correct number and type of jokes.
   */
  describe('GET /joke/:type', () => {
    
    test('Single Random Joke: should return exactly 1 joke when count is not specified', async () => {
      const response = await request(app).get('/joke/dad');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });

    test('Multiple Jokes: should return the requested number of jokes', async () => {
      const count = 2;
      const response = await request(app).get(`/joke/dad?count=${count}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(count);
    });

    test('Insufficient Data: should return all available jokes if count > pool size', async () => {
      const response = await request(app).get('/joke/dad?count=100');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    test('"Any" Type: should return a joke of any type when "any" is requested', async () => {
      const response = await request(app).get('/joke/any');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });

    test('DB Failure: should return 500 when DB fails', async () => {
        // Mock getRandomJokes to reject
        const original = db.getRandomJokes;
        db.getRandomJokes = jest.fn().mockRejectedValueOnce(new Error('DB Error'));
        
        const response = await request(app).get('/joke/any');
        expect(response.status).toBe(500);
        
        db.getRandomJokes = original;
    });
  });

  /**
   * Test Case: Database Toggle & Connectivity
   */
  describe('Database Implementation', () => {
    test('Provider Logic: should return the mock provider in test environment', () => {
        expect(db.constructor.name).toBe('MockProvider');
    });

    test('Connectivity Check: should be able to fetch data from the provider', async () => {
        const types = await db.getTypes();
        expect(Array.isArray(types)).toBe(true);
    });
  });

});
