require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

/**
 * Robust MySQL Provider for ETL.
 * Uses aggressive eviction and keep-alive to handle IP changes in Docker.
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
            connectTimeout: 10000,     // Wait 10s for initial connection
            idleTimeout: 1000,         // Evict idle connections after 1s to force fresh DNS lookup
            maxIdle: 0,                // Don't keep any idle connections in the pool
            enableKeepAlive: true      // Periodically probe connections
        };
        this.pool = mysql.createPool(this.config);
    }

    /**
     * Recovery Helper: Forcibly recreate the pool if a fatal connection error occurs.
     */
    async handleConnectionError(err) {
        if (err.code === 'ECONNREFUSED' || err.fatal || err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[ETL DB] Fatal error (${err.code}). Resetting pool for host: ${this.config.host}`);
            try { await this.pool.end(); } catch (e) {}
            this.pool = mysql.createPool(this.config);
        }
    }

    async insertJokeAndType(setup, punchline, typeName) {
        let connection;
        try {
            connection = await this.pool.getConnection();
            await connection.beginTransaction();

            // Atomic Insert/Get for Type
            await connection.execute('INSERT IGNORE INTO types (name) VALUES (?)', [typeName]);
            const [typeRows] = await connection.execute('SELECT id FROM types WHERE name = ?', [typeName]);
            if (typeRows.length === 0) throw new Error("Could not resolve type ID");
            const typeId = typeRows[0].id;
            
            // Insert Joke
            await connection.execute(
                'INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)', 
                [typeId, setup, punchline]
            );

            await connection.commit();
            return true;
        } catch (err) {
            if (connection) await connection.rollback();
            await this.handleConnectionError(err);
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
        const typesCol = this.db.collection('types');
        const jokesCol = this.db.collection('jokes');
        const existingType = await typesCol.findOne({ name: typeName });
        if (!existingType) {
            await typesCol.insertOne({ name: typeName });
        }
        await jokesCol.insertOne({ type: typeName, setup, punchline });
        return true;
    }
}

const dbType = process.env.DB_TYPE || 'MYSQL';
module.exports = (dbType === 'MONGO') ? new MongoProvider() : new MySQLProvider();
