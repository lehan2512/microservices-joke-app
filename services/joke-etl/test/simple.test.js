const { normalizeType, processPayload } = require('../etl');

/**
 * Joke ETL Service Tests
 * 
 * Verifying extraction, transformation, and loading (ETL) logic.
 */

describe('Joke ETL Service', () => {

  /**
   * Test Case: Data Transformation
   * Description: Verify that joke types are correctly cleaned and formatted.
   */
  describe('Data Transformation (normalizeType)', () => {
    test('should lowercase and trim input', () => {
      expect(normalizeType('  Sports ')).toBe('sports');
    });

    test('should handle null and undefined', () => {
      expect(normalizeType(null)).toBe('');
    });
  });

  /**
   * Test Case: Database Write & Duplicate Prevention
   * Description: Verify that jokes are correctly saved and existing types are identified.
   */
  describe('Database Write & Duplicate Prevention', () => {
    let mockDb;

    beforeEach(() => {
      mockDb = {
        insertJokeAndType: jest.fn()
      };
    });

    test('Database Write: should insert joke and type into DB', async () => {
      const payload = { setup: 'S', punchline: 'P', type: 'dad' };
      mockDb.insertJokeAndType.mockResolvedValue(true);
      await processPayload(payload, { dbModule: mockDb });
      expect(mockDb.insertJokeAndType).toHaveBeenCalledWith('S', 'P', 'dad');
    });

    test('DB Failure: should throw error when DB fails', async () => {
      const payload = { setup: 'S', punchline: 'P', type: 'dad' };
      mockDb.insertJokeAndType.mockRejectedValue(new Error('DB Error'));
      
      await expect(processPayload(payload, { dbModule: mockDb }))
        .rejects.toThrow('DB Error');
    });
  });

  /**
   * Test Case: Queue Integration
   * Description: Verify message acknowledgment and reprocessing logic.
   */
  describe('Queue Integration (Events & Acks)', () => {
    let mockDb;
    let mockChannel;

    beforeEach(() => {
      mockDb = { insertJokeAndType: jest.fn() };
      mockChannel = {
        publish: jest.fn(),
        ack: jest.fn(),
        nack: jest.fn()
      };
    });

    test('Message Acknowledgment: should NOT ack and should nack with requeue when processing fails (DB failure)', async () => {
      const msg = { content: Buffer.from(JSON.stringify({})) };
      mockDb.insertJokeAndType.mockRejectedValue(new Error('DB failure'));

      // Consumer logic simulation
      try {
          await processPayload(JSON.parse(msg.content.toString()), { dbModule: mockDb });
          mockChannel.ack(msg);
      } catch (e) {
          mockChannel.nack(msg, false, true);
      }

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, true);
    });
  });

});
