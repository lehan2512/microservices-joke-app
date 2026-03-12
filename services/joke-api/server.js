const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static HTML/JS for the UI
app.use(express.static('public'));

/**
 * Robustness: If the DB pool encounters a fatal error, 
 * we exit the process so Docker can restart us with a fresh pool.
 */
if (db.pool && typeof db.pool.on === 'function') {
    db.pool.on('error', (err) => {
        console.error('CRITICAL: API Database pool error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
            process.exit(1);
        }
    });
}

// Endpoint: Get Random Joke(s)
app.get('/joke/:type', async (req, res) => {
    const type = req.params.type;
    const count = req.query.count || 1;

    try {
        const jokes = await db.getRandomJokes(type, count);
        res.json(jokes);
    } catch (error) {
        console.error("Error fetching joke:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint: Get Types
app.get('/types', async (req, res) => {
    try {
        const types = await db.getTypes();
        res.json(types);
    } catch (error) {
        console.error("Error fetching types:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Joke API running on port ${PORT} using ${process.env.DB_TYPE || 'MYSQL'}`);
    });
}
