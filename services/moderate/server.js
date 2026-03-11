require('dotenv').config();
const express = require('express');
const fs = require('fs');
const { connectQueue, getJokeFromQueue, publishModeratedJoke, CACHE_FILE } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(express.static('public'));

connectQueue();

// Endpoint: Get Types (Reads purely from local cache)
app.get('/types', (req, res) => {
    try {
        const types = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: "Could not read types cache" });
    }
});

// Endpoint: Get a single joke to moderate
app.get('/moderate', async (req, res) => {
    try {
        const joke = await getJokeFromQueue();
        if (joke) {
            res.json(joke);
        } else {
            res.status(204).send(); // 204 No Content if queue is empty
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch joke" });
    }
});

// Endpoint: Submit the moderated joke
app.post('/moderated', async (req, res) => {
    const { setup, punchline, type } = req.body;
    
    if (!setup || !punchline || !type) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await publishModeratedJoke({ setup, punchline, type });
        res.status(202).json({ message: "Joke approved and sent to ETL!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to process moderated joke" });
    }
});

app.listen(PORT, () => {
    console.log(`Moderate Microservice running on port ${PORT}`);
});