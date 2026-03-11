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
        let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
        let params = [];
        
        // Handle the "any" type requirement
        if (type.toLowerCase() !== 'any') {
            query += ' WHERE t.name = ?';
            params.push(type);
        }
        
        query += ' ORDER BY RAND() LIMIT ?';
        params.push(Number(count));

        const [rows] = await mysqlPool.query(query, params);
        return rows;
    } else {
        let matchStage = {};
        if (type.toLowerCase() !== 'any') {
            matchStage = { type: type };
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
        const types = await mongoDb.collection('types').find({}).toArray();
        return types.map(t => t.name);
    }
}

module.exports = { getRandomJokes, getTypes };