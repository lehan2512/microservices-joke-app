/**
 * MySQL Repository
 * Handles strictly database CRUD operations. Contains NO business logic.
 */
const mysql = require('mysql2/promise');
const { DatabaseError } = require('../errors');
const config = require('../config');

class MySQLRepository {
    constructor() {
        try {
            this.pool = mysql.createPool(config.mysql);

            this.pool.on('error', (err) => {
                console.error('CRITICAL: API Database pool error:', err.message);
                if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
                    // Force crash so Docker/Kubernetes can spin up a fresh container
                    process.exit(1); 
                }
            });

        } catch (err) {
            throw new DatabaseError('Failed to initialize MySQL connection pool', err);
        }
    }

    async getTypeByName(name) {
        try {
            // Fixes N+1: Fetches only the matching row directly via SQL
            const [rows] = await this.pool.execute(
                'SELECT id, name FROM types WHERE LOWER(name) = LOWER(?) LIMIT 1', 
                [name]
            );
            return rows[0] || null;
        } catch (err) {
            throw new DatabaseError(`Failed to fetch type by name: ${name}`, err);
        }
    }

    async getJokeCount(typeRow = null) {
        try {
            let query = 'SELECT COUNT(*) as cnt FROM jokes';
            let params = [];
            
            if (typeRow) {
                query += ' WHERE type_id = ?';
                params.push(typeRow.id);
            }
            
            const [[{ cnt }]] = await this.pool.execute(query, params);
            return cnt || 0;
        } catch (err) {
            throw new DatabaseError('Failed to get joke count', err);
        }
    }

    async getJokeByOffset(typeRow = null, offset = 0) {
        try {
            let query = 'SELECT j.setup, j.punchline, t.name as type FROM jokes j JOIN types t ON j.type_id = t.id';
            let params = [];
            
            if (typeRow) {
                query += ' WHERE j.type_id = ?';
                params.push(typeRow.id);
            }
            
            // Note: Offset parameterization works securely in mysql2 .execute()
            query += ' ORDER BY j.id LIMIT 1 OFFSET ?';
            params.push(offset.toString()); 

            const [rows] = await this.pool.execute(query, params);
            return rows[0] || null;
        } catch (err) {
            throw new DatabaseError(`Failed to fetch joke at offset ${offset}`, err);
        }
    }

    async getTypes() {
        try {
            const [rows] = await this.pool.execute('SELECT name FROM types');
            return rows.map(r => r.name);
        } catch (err) {
            throw new DatabaseError('Failed to fetch types list', err);
        }
    }
}

module.exports = MySQLRepository;