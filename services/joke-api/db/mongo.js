/**
 * @file mongo.js
 * @description MongoDB repository implementation for joke data access.
 */
const { MongoClient } = require('mongodb');
const { DatabaseError } = require('../errors');
const config = require('../config');

/**
 * Repository class for MongoDB operations.
 */
class MongoRepository {
    constructor() {
        // if the database is offline. It fails fast (5s) to return a 503 to the user.
        this.client = new MongoClient(config.mongo.uri, {
            serverSelectionTimeoutMS: 5000 
        });
        this.db = null;
        this.connectionLock = null;
        
        // Eager connection attempt to prevent race conditions during boot
        this.ensureConnected().catch(err => {
            console.warn('Eager MongoDB connection failed. Will retry on next request.');
        });
    }

    /**
     * Ensures that the MongoDB client is connected.
     * Uses a connection lock to prevent multiple simultaneous connection attempts.
     * @returns {Promise<void>}
     * @throws {DatabaseError} If connection fails.
     */
    async ensureConnected() {
        if (this.db) return;

        if (this.connectionLock) {
            await this.connectionLock;
            return;
        }

        // 3. Initiate a new connection attempt and lock it
        this.connectionLock = this.client.connect()
            .then(() => {
                this.db = this.client.db(config.mongo.dbName);
                console.log("Connected to MongoDB successfully");
            })
            .catch(err => {
                this.connectionLock = null;
                throw new DatabaseError('MongoDB connection could not be established', err);
            });

        await this.connectionLock;
    }

    /**
     * Handles network errors by resetting the connection state.
     * Forces reconnection on the next request.
     * @param {Error} err - The error caught during an operation.
     */
    handleConnectionDrop(err) {
        if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError' || err.name === 'MongoTopologyClosedError') {
            console.error("MongoDB network drop detected. Forcing reconnection on next request...");
            this.db = null;
            this.connectionLock = null;
        }
    }

    /**
     * Fetches a joke type by its name.
     * @param {string} name - The name of the type to find.
     * @returns {Promise<Object|null>} The type document or null if not found.
     * @throws {DatabaseError} If the database operation fails.
     */
    async getTypeByName(name) {
        await this.ensureConnected();
        try {
            const type = await this.db.collection('types').findOne({ 
                name: { $regex: new RegExp(`^${name}$`, 'i') } 
            });
            return type || null;
        } catch (err) {
            this.handleConnectionDrop(err);
            throw new DatabaseError(`Failed to fetch Mongo type by name: ${name}`, err);
        }
    }

    /**
     * Gets the total count of jokes, optionally filtered by type.
     * @param {Object} [typeRow=null] - The type document to filter by.
     * @returns {Promise<number>} The number of jokes found.
     * @throws {DatabaseError} If the database operation fails.
     */
    async getJokeCount(typeRow = null) {
        await this.ensureConnected();
        try {
            const query = typeRow ? { type: typeRow.name } : {};
            return await this.db.collection('jokes').countDocuments(query);
        } catch (err) {
            this.handleConnectionDrop(err);
            throw new DatabaseError('Failed to get Mongo joke count', err);
        }
    }

    /**
     * Retrieves a single joke by its offset from the start of the collection (or filtered list).
     * @param {Object} [typeRow=null] - The type document to filter by.
     * @param {number} [offset=0] - The zero-based index of the joke to retrieve.
     * @returns {Promise<Object|null>} The joke document or null if not found.
     * @throws {DatabaseError} If the database operation fails.
     */
    async getJokeByOffset(typeRow = null, offset = 0) {
        await this.ensureConnected();
        try {
            const query = typeRow ? { type: typeRow.name } : {};
            const joke = await this.db.collection('jokes')
                .find(query)
                .project({ _id: 0, setup: 1, punchline: 1, type: 1 }) // Retain original schema projection
                .skip(offset)
                .limit(1)
                .toArray();
            return joke[0] || null;
        } catch (err) {
            this.handleConnectionDrop(err);
            throw new DatabaseError(`Failed to fetch Mongo joke at offset ${offset}`, err);
        }
    }

    /**
     * Retrieves all available joke types from the database.
     * @returns {Promise<Array<string>>} A list of joke type names.
     * @throws {DatabaseError} If the database operation fails.
     */
    async getTypes() {
        await this.ensureConnected();
        try {
            const types = await this.db.collection('types').find({}).toArray();
            return types.map(t => t.name);
        } catch (err) {
            this.handleConnectionDrop(err);
            throw new DatabaseError('Failed to fetch Mongo types list', err);
        }
    }
}

module.exports = MongoRepository;