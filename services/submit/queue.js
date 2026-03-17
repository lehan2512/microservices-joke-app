/**
 * @file queue.js
 * @description RabbitMQ interaction logic for the Joke Submission service.
 * Handles publishing submitted jokes to the queue and synchronizing the joke types cache.
 */

let amqp;
try {
    amqp = require('amqplib');
} catch (e) {
    amqp = null;
}
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const SUBMIT_QUEUE = 'submit';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';
const CACHE_QUEUE = 'sub_type_update';
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}
const CACHE_FILE = path.join(cacheDir, 'types.json');

let connection;
let channel;

// Initialize cache file
if (!fs.existsSync(CACHE_FILE)) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(["dad", "sports", "love"]));
}

/**
 * Establishes connection to RabbitMQ, sets up required queues and exchanges.
 * Listens for joke type updates to keep the local cache synchronized.
 * @returns {Promise<void>}
 */
async function connectQueue() {
    try {
        if (!amqp) return;
        
        console.log("Submit Service connecting to RabbitMQ...");
        connection = await amqp.connect(RABBITMQ_URL);
        
        connection.on('error', (err) => {
            console.error("RabbitMQ Connection Error:", err.message);
            channel = null;
        });

        connection.on('close', () => {
            console.warn("RabbitMQ Connection closed. Retrying in 5s...");
            channel = null;
            setTimeout(connectQueue, 5000);
        });

        channel = await connection.createChannel();
        
        await channel.assertQueue(SUBMIT_QUEUE, { durable: true });
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
        await channel.assertQueue(CACHE_QUEUE, { durable: true });
        await channel.bindQueue(CACHE_QUEUE, TYPE_UPDATE_EXCHANGE, '');

        console.log("Submit Service connected and ready.");

        channel.consume(CACHE_QUEUE, (msg) => {
            if (msg !== null) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    const currentCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                    if (!currentCache.includes(event.type)) {
                        currentCache.push(event.type);
                        fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCache));
                    }
                    channel.ack(msg);
                } catch (e) {
                    console.error("Error updating local cache:", e.message);
                }
            }
        });

    } catch (error) {
        console.error("RabbitMQ connection failed. Retrying in 5s...", error.message);
        setTimeout(connectQueue, 5000);
    }
}

/**
 * Publishes a new joke to the submission queue for moderation.
 * @param {Object} jokeData - The joke to be submitted.
 * @param {string} jokeData.setup - The setup of the joke.
 * @param {string} jokeData.punchline - The punchline of the joke.
 * @param {string} jokeData.type - The category/type of the joke.
 * @throws {Error} - Throws error if RabbitMQ channel is not available.
 * @returns {Promise<void>}
 */
async function publishJoke(jokeData) {
    if (!channel) {
        throw new Error("RabbitMQ channel not established. Service may be reconnecting.");
    }
    channel.sendToQueue(SUBMIT_QUEUE, Buffer.from(JSON.stringify(jokeData)), { persistent: true });
    console.log("Published joke to submit queue.");
}

module.exports = { connectQueue, publishJoke, CACHE_FILE };
