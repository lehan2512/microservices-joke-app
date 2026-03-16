/**
 * MongoDB Repository
 * Implements the exact same interface as the MySQL Repository.
 */
const { MongoClient } = require('mongodb');
const { DatabaseError } = require('../errors');
const config = require('../config');

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

    handleConnectionDrop(err) {
        if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError' || err.name === 'MongoTopologyClosedError') {
            console.error("MongoDB network drop detected. Forcing reconnection on next request...");
            this.db = null;
            this.connectionLock = null;
        }
    }

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