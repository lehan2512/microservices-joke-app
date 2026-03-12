require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

class MySQLProvider {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'jokes_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async insertJokeAndType(setup, punchline, typeName) {
        let isNewType = false;
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const [typeRows] = await connection.execute('SELECT id FROM types WHERE name = ?', [typeName]);
            let typeId;

            if (typeRows.length === 0) {
                const [insertTypeResult] = await connection.execute('INSERT INTO types (name) VALUES (?)', [typeName]);
                typeId = insertTypeResult.insertId;
                isNewType = true;
            } else {
                typeId = typeRows[0].id;
            }

            await connection.execute('INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)', [typeId, setup, punchline]);

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
        return isNewType;
    }
}

class MongoProvider {
    constructor() {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
        this.client = new MongoClient(uri);
        this.db = null;
        this.connectPromise = this.client.connect().then(() => {
            this.db = this.client.db(process.env.DB_NAME || 'jokes_db');
            console.log("ETL connected to MongoDB");
        }).catch(console.error);
    }

    async ensureConnected() {
        if (!this.db) {
            await this.connectPromise;
            if (!this.db) {
                this.db = this.client.db(process.env.DB_NAME || 'jokes_db');
            }
        }
    }

    async insertJokeAndType(setup, punchline, typeName) {
        await this.ensureConnected();
        let isNewType = false;
        
        const typesCol = this.db.collection('types');
        const jokesCol = this.db.collection('jokes');

        const existingType = await typesCol.findOne({ name: typeName });
        if (!existingType) {
            await typesCol.insertOne({ name: typeName });
            isNewType = true;
        }

        await jokesCol.insertOne({ type: typeName, setup, punchline });
        return isNewType;
    }
}

const dbType = process.env.DB_TYPE || 'MYSQL';
let provider;

if (dbType === 'MONGO') {
    provider = new MongoProvider();
} else {
    provider = new MySQLProvider();
}

module.exports = provider;
