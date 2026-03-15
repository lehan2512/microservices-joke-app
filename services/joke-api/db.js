require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

const dbType = process.env.DB_TYPE || 'MYSQL';

// MySQL Connection Pool (Best practice for performance)
let mysqlPool;
if (dbType === 'MYSQL') {
    mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'jokes_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

// MongoDB Connection
let mongoClient;
let mongoDb;
if (dbType === 'MONGO') {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(uri);
    mongoClient.connect().then(() => {
        mongoDb = mongoClient.db(process.env.DB_NAME || 'jokes_db');
        console.log("Connected to MongoDB");
    }).catch(console.error);
}

async function getRandomJokes(type, count) {
    if (dbType === 'MYSQL') {
        // Helper: resolve requested type to actual type name using strict case-insensitive match
        async function resolveTypeName(requested) {
            if (!requested) return null;
            const [rows] = await mysqlPool.query('SELECT id, name FROM types');
            const lowered = requested.toLowerCase();
            return rows.find(r => String(r.name).toLowerCase() === lowered) || null;
        }

        const n = Number(count);

        if (n === 1) {
            // Use COUNT + OFFSET sampling to pick one random row uniformly
            if (type.toLowerCase() !== 'any') {
                const typeRow = await resolveTypeName(type);
                if (!typeRow) return [];
                const typeId = typeRow.id;

                const [[{ cnt }]] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM jokes WHERE type_id = ?', [typeId]);
                if (!cnt || cnt === 0) return [];

                const offset = Math.floor(Math.random() * cnt);
                const [rows] = await mysqlPool.query(
                    'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id WHERE j.type_id = ? ORDER BY j.id LIMIT 1 OFFSET ?',
                    [typeId, offset]
                );
                return rows;
            } else {
                const [[{ cnt }]] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM jokes');
                if (!cnt || cnt === 0) return [];

                const offset = Math.floor(Math.random() * cnt);
                const [rows] = await mysqlPool.query(
                    'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id ORDER BY j.id LIMIT 1 OFFSET ?',
                    [offset]
                );
                return rows;
            }
        }

        // Fallback for multi-row sampling
        let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
        let params = [];
        if (type.toLowerCase() !== 'any') {
            const typeRow = await resolveTypeName(type);
            if (!typeRow) return [];
            query += ' WHERE t.name = ?';
            params.push(typeRow.name);
        }
        query += ' ORDER BY RAND() LIMIT ?';
        params.push(n);

        const [rows] = await mysqlPool.query(query, params);
        return rows;

    } else {
        // Ensure Mongo client is connected before running queries
        if (!mongoDb) {
            try {
                if (!mongoClient) {
                    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
                    mongoClient = new MongoClient(uri);
                }
                await mongoClient.connect();
                mongoDb = mongoClient.db(process.env.DB_NAME || 'jokes_db');
                console.log('MongoDB connection established (late-init)');
            } catch (err) {
                console.error('Failed to connect to MongoDB:', err);
                throw err;
            }
        }

        // Strict case-insensitive match for MongoDB
        let matchStage = {};
        if (type.toLowerCase() !== 'any') {
            const typesList = await mongoDb.collection('types').find({}).toArray();
            const lowered = type.toLowerCase();
            const matched = typesList.find(t => String(t.name).toLowerCase() === lowered);
            
            if (!matched) return [];
            matchStage = { type: matched.name };
        }
        
        // Use MongoDB aggregation for random selection
        return await mongoDb.collection('jokes')
            .aggregate([
                { $match: matchStage },
                { $sample: { size: Number(count) } },
                { $project: { _id: 0, setup: 1, punchline: 1, type: 1 } }
            ]).toArray();
    }
}

async function getTypes() {
    if (dbType === 'MYSQL') {
        const [rows] = await mysqlPool.execute('SELECT name FROM types');
        return rows.map(r => r.name);
    } else {
        if (!mongoDb) {
            try {
                if (!mongoClient) {
                    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
                    mongoClient = new MongoClient(uri);
                }
                await mongoClient.connect();
                mongoDb = mongoClient.db(process.env.DB_NAME || 'jokes_db');
                console.log('MongoDB connection established (late-init)');
            } catch (err) {
                console.error('Failed to connect to MongoDB:', err);
                throw err;
            }
        }

        const types = await mongoDb.collection('types').find({}).toArray();
        return types.map(t => t.name);
    }
}

module.exports = { getRandomJokes, getTypes };