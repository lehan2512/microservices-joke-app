require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

/**
 * Robust MySQL Provider for API.
 * Uses aggressive eviction to handle IP changes in Docker.
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
            connectTimeout: 5000,
            idleTimeout: 1000,
            maxIdle: 0,
            enableKeepAlive: true
        };
        this.pool = mysql.createPool(this.config);
    }

    async handleConnectionError(err) {
        if (err.code === 'ECONNREFUSED' || err.fatal || err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[API DB] Fatal error (${err.code}), resetting pool...`);
            try { await this.pool.end(); } catch (e) {}
            this.pool = mysql.createPool(this.config);
        }
    }

    async resolveTypeName(requested) {
        if (!requested) return null;
        try {
            const [rows] = await this.pool.query('SELECT id, name FROM types');
            const lowered = requested.toLowerCase();
            let match = rows.find(r => String(r.name).toLowerCase() === lowered);
            return match || null;
        } catch (err) {
            await this.handleConnectionError(err);
            throw err;
        }
    }

    async getRandomJokes(type, count) {
        try {
            const n = Number(count);
            let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
            let params = [];
            if (type.toLowerCase() !== 'any') {
                const typeRow = await this.resolveTypeName(type);
                if (!typeRow) return [];
                query += ' WHERE t.id = ?';
                params.push(typeRow.id);
            }
            query += ' ORDER BY RAND() LIMIT ?';
            params.push(n);
            const [rows] = await this.pool.query(query, params);
            return rows;
        } catch (err) {
            await this.handleConnectionError(err);
            throw err;
        }
    }

    async getTypes() {
        try {
            const [rows] = await this.pool.execute('SELECT name FROM types');
            return rows.map(r => r.name);
        } catch (err) {
            await this.handleConnectionError(err);
            throw err;
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

    async getRandomJokes(type, count) {
        await this.ensureConnected();
        let matchStage = {};
        if (type.toLowerCase() !== 'any') matchStage = { type: type };
        return await this.db.collection('jokes')
            .aggregate([
                { $match: matchStage },
                { $sample: { size: Number(count) } },
                { $project: { _id: 0, setup: 1, punchline: 1, type: 1 } }
            ]).toArray();
    }

    async getTypes() {
        await this.ensureConnected();
        const types = await this.db.collection('types').find({}).toArray();
        return types.map(t => t.name);
    }
}

const dbType = process.env.DB_TYPE || 'MYSQL';
module.exports = (dbType === 'MONGO') ? new MongoProvider() : new MySQLProvider();
