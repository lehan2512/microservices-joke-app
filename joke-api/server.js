const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static HTML/JS for the UI
app.use(express.static('public'));

// Endpoint: Get Jokes
app.get('/joke/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const count = parseInt(req.query.count) || 1; // Default to 1 if not provided
        
        const jokes = await db.getRandomJokes(type, count);
        res.json(jokes);
    } catch (error) {
        console.error("Error fetching joke:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint: Get Joke Types
app.get('/types', async (req, res) => {
    try {
        const types = await db.getTypes();
        res.json(types);
    } catch (error) {
        console.error("Error fetching types:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Joke API running on port ${PORT} using ${process.env.DB_TYPE || 'MYSQL'}`);
});