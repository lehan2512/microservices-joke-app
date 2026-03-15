require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

/**
 * Robust MySQL Provider with IP logging and Pool Refresh.
 */
class MySQLProvider {
    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'jokes_mysql',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'jokes_db',
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: 5000
        };
        this.pool = mysql.createPool(this.config);
        console.log(`[DB] Initialized pool for host: ${this.config.host}`);
    }

    async refreshPool() {
        console.warn(`[DB] Connection lost. Purging stale pool and re-resolving ${this.config.host}...`);
        try {
            await this.pool.end();
        } catch (e) {}
        this.pool = mysql.createPool(this.config);
    }

    async insertJokeAndType(setup, punchline, typeName) {
        let connection;
        try {
            connection = await this.pool.getConnection();
            
            // Safely log connection address if available
            const addr = (connection.connection && connection.connection._address) 
                ? connection.connection._address.address 
                : 'unknown';
            console.log(`[DB] Using connection to ${this.config.host} at IP: ${addr}`);

            await connection.beginTransaction();
            await connection.execute('INSERT IGNORE INTO types (name) VALUES (?)', [typeName]);
            const [typeRows] = await connection.execute('SELECT id FROM types WHERE name = ?', [typeName]);
            const typeId = typeRows[0].id;
            await connection.execute('INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)', [typeId, setup, punchline]);
            await connection.commit();
            return true;
        } catch (err) {
            console.error(`[DB] FAILURE: ${err.message} (Code: ${err.code})`);
            if (connection) await connection.rollback();

            // Refresh the pool immediately on connection issues
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.fatal) {
                await this.refreshPool();
            }
            throw err;
        } finally {
            if (connection) connection.release();
        }
    }
}

class MongoProvider {
    constructor() {
        const uri = process.env.MONGO_URI || 'mongodb://jokes_mongo:27017';
        this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        this.db = null;
        this.connectPromise = this.client.connect().then(() => {
            this.db = this.client.db(process.env.DB_NAME || 'jokes_db');
        }).catch(() => {});
    }

    async ensureConnected() {
        if (!this.db) await this.connectPromise;
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
module.exports = (dbType === 'MONGO') ? new MongoProvider() : new MySQLProvider();
