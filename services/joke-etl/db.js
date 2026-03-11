require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

const dbType = process.env.DB_TYPE || 'MYSQL';

// MySQL Connection Pool
let mysqlPool;
if (dbType === 'MYSQL') {
    mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'jokes_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

// MongoDB Connection
let mongoDb;
if (dbType === 'MONGO') {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    const mongoClient = new MongoClient(uri);
    mongoClient.connect().then(() => {
        mongoDb = mongoClient.db(process.env.DB_NAME || 'jokes_db');
        console.log("ETL connected to MongoDB");
    }).catch(console.error);
}

// Returns true if a NEW type was added, false if it already existed
async function insertJokeAndType(setup, punchline, typeName) {
    let isNewType = false;

    if (dbType === 'MYSQL') {
        const connection = await mysqlPool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Check if type exists to prevent duplicates
            const [typeRows] = await connection.execute('SELECT id FROM types WHERE name = ?', [typeName]);
            let typeId;

            if (typeRows.length === 0) {
                // Type doesn't exist, insert it
                const [insertTypeResult] = await connection.execute('INSERT INTO types (name) VALUES (?)', [typeName]);
                typeId = insertTypeResult.insertId;
                isNewType = true;
            } else {
                typeId = typeRows[0].id;
            }

            // 2. Insert the joke
            await connection.execute('INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)', [typeId, setup, punchline]);

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } else {
        // MongoDB Logic
        const typesCol = mongoDb.collection('types');
        const jokesCol = mongoDb.collection('jokes');

        // 1. Check if type exists
        const existingType = await typesCol.findOne({ name: typeName });
        if (!existingType) {
            await typesCol.insertOne({ name: typeName });
            isNewType = true;
        }

        // 2. Insert the joke
        await jokesCol.insertOne({ type: typeName, setup, punchline });
    }

    return isNewType;
}

module.exports = { insertJokeAndType };