/**
 * Joke API Server
 * Entry point for the Express application. Handles HTTP requests,
 * routes them to the Service layer, and formats HTTP responses/errors.
 */
const express = require('express');
const jokeService = require('./db'); // The factory now exports the configured Service
const { DatabaseError, NotFoundError } = require('./errors');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static HTML/JS for the UI
app.use(express.static('public'));

// Endpoint: Get Random Joke(s)
app.get('/joke/:type', async (req, res) => {
    const type = req.params.type;
    const count = req.query.count || 1;

    try {
        const jokes = await jokeService.getRandomJokes(type, count);
        
        // Handle the case where the type doesn't exist or has no jokes
        if (!jokes || jokes.length === 0) {
            return res.status(404).json({ error: `No jokes found for type: ${type}` });
        }

        res.json(jokes);
    } catch (error) {
        console.error("Error fetching joke:", error.message);
        
        // Route specific backend errors to appropriate HTTP status codes
        if (error instanceof DatabaseError) {
            return res.status(503).json({ error: "Service Unavailable: Database connection failed" });
        }
        
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint: Get Types
app.get('/types', async (req, res) => {
    try {
        const types = await jokeService.getTypes();
        res.json(types);
    } catch (error) {
        console.error("Error fetching types:", error.message);
        
        if (error instanceof DatabaseError) {
            return res.status(503).json({ error: "Service Unavailable: Database connection failed" });
        }

        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        // Now dynamically logs which database engine is actually running
        console.log(`Joke API running on port ${PORT} using ${config.dbType}`);
    });
}