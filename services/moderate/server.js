require('dotenv').config();
const express = require('express');
const fs = require('fs');
const { auth, requiresAuth } = require('express-openid-connect');
const { connectQueue, getJokeFromQueue, publishModeratedJoke, CACHE_FILE } = require('./queue');

const app = express();
const PORT = process.env.PORT || 3003;

const config = {
  authRequired: true,
  auth0Logout: true,
  secret: 'a-long-randomly-generated-string-for-session-encryption-12345',
  baseURL: 'http://localhost:8000/moderate-api',
  clientID: 'w7DnLzgXwsOG8XgORbCVHH3LhGIMMsc6',
  issuerBaseURL: 'https://dev-kxm5q64g5rqu48xu.us.auth0.com'
};

app.use(auth(config));
app.use(express.static('public'));
app.use(express.json());

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