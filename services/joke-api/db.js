require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

class MySQLProvider {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'jokes_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async resolveTypeName(requested) {
        if (!requested) return null;
        const [rows] = await this.pool.query('SELECT id, name FROM types');
        const lowered = requested.toLowerCase();
        
        let match = rows.find(r => String(r.name).toLowerCase() === lowered);
        if (match) return match;
        
        match = rows.find(r => String(r.name).toLowerCase() === lowered + 's');
        if (match) return match;
        
        if (lowered.endsWith('s')) {
            match = rows.find(r => String(r.name).toLowerCase() === lowered.slice(0, -1));
            if (match) return match;
        }
        
        match = rows.find(r => String(r.name).toLowerCase().includes(lowered));
        return match || null;
    }

    async getRandomJokes(type, count) {
        const n = Number(count);

        if (n === 1) {
            if (type.toLowerCase() !== 'any') {
                const typeRow = await this.resolveTypeName(type);
                if (!typeRow) return [];
                const typeId = typeRow.id;

                const [[{ cnt }]] = await this.pool.query('SELECT COUNT(*) as cnt FROM jokes WHERE type_id = ?', [typeId]);
                if (!cnt || cnt === 0) return [];

                const offset = Math.floor(Math.random() * cnt);
                const [rows] = await this.pool.query(
                    'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id WHERE j.type_id = ? ORDER BY j.id LIMIT 1 OFFSET ?',
                    [typeId, offset]
                );
                return rows;
            } else {
                const [[{ cnt }]] = await this.pool.query('SELECT COUNT(*) as cnt FROM jokes');
                if (!cnt || cnt === 0) return [];

                const offset = Math.floor(Math.random() * cnt);
                const [rows] = await this.pool.query(
                    'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id ORDER BY j.id LIMIT 1 OFFSET ?',
                    [offset]
                );
                return rows;
            }
        }

        let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
        let params = [];
        if (type.toLowerCase() !== 'any') {
            const [types] = await this.pool.query('SELECT name FROM types');
            const typeRow = types.find(r => String(r.name).toLowerCase() === type.toLowerCase()) || { name: type };
            query += ' WHERE t.name = ?';
            params.push(typeRow.name);
        }
        query += ' ORDER BY RAND() LIMIT ?';
        params.push(n);

        const [rows] = await this.pool.query(query, params);
        return rows;
    }

    async getTypes() {
        const [rows] = await this.pool.execute('SELECT name FROM types');
        return rows.map(r => r.name);
    }
}

class MongoProvider {
    constructor() {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
        this.client = new MongoClient(uri);
        this.db = null;
        this.connectPromise = this.client.connect().then(() => {
            this.db = this.client.db(process.env.DB_NAME || 'jokes_db');
            console.log("Connected to MongoDB");
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

    async getRandomJokes(type, count) {
        await this.ensureConnected();

        let matchStage = {};
        if (type.toLowerCase() !== 'any') {
            const typesList = await this.db.collection('types').find({}).toArray();
            const lowered = type.toLowerCase();
            let matched = typesList.find(t => String(t.name).toLowerCase() === lowered);
            if (!matched) matched = typesList.find(t => String(t.name).toLowerCase() === lowered + 's');
            if (!matched && lowered.endsWith('s')) matched = typesList.find(t => String(t.name).toLowerCase() === lowered.slice(0, -1));
            if (!matched) matched = typesList.find(t => String(t.name).toLowerCase().includes(lowered));
            if (!matched) return [];
            matchStage = { type: matched.name };
        }

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
let provider;

if (dbType === 'MONGO') {
    provider = new MongoProvider();
} else {
    provider = new MySQLProvider();
}

module.exports = provider;
