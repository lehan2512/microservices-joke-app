let amqp;
try {
    amqp = require('amqplib');
} catch (e) {
    // amqplib is optional for tests; queue functions will gracefully no-op when missing
    amqp = null;
}
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const SUBMIT_QUEUE = 'submit';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';
const CACHE_QUEUE = 'mod_type_update'; // Unique queue for Moderate's cache updates
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}
const CACHE_FILE = path.join(cacheDir, 'types.json');

let channel;

// Initialize cache file
if (!fs.existsSync(CACHE_FILE)) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(["dad", "sports", "love"]));
}

async function connectQueue() {
    try {
        if (!amqp) {
            console.warn('amqplib not installed; connectQueue will be skipped');
            return;
        }
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        await channel.assertQueue(SUBMIT_QUEUE, { durable: true });
        await channel.assertQueue(MODERATED_QUEUE, { durable: true });

        // ECST Cache Update Logic
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
        await channel.assertQueue(CACHE_QUEUE, { durable: true });
        await channel.bindQueue(CACHE_QUEUE, TYPE_UPDATE_EXCHANGE, '');

        console.log("Moderate Service connected to RabbitMQ.");

        // Consume events to update the local file cache
        channel.consume(CACHE_QUEUE, (msg) => {
            if (msg !== null) {
                const event = JSON.parse(msg.content.toString());
                const currentCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
                
                if (!currentCache.includes(event.type)) {
                    currentCache.push(event.type);
                    fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCache));
                    console.log(`Updated local cache with new type: ${event.type}`);
                }
                channel.ack(msg);
            }
        });

    } catch (error) {
        console.error("RabbitMQ connection failed. Retrying in 5s...", error);
        setTimeout(connectQueue, 5000);
    }
}

// Fetch a single joke for the UI
async function getJokeFromQueue() {
    if (!channel) return null;
    // noAck: true removes it from the queue immediately upon reading
    const msg = await channel.get(SUBMIT_QUEUE, { noAck: true }); 
    if (msg) {
        return JSON.parse(msg.content.toString());
    }
    return null;
}

// Publish the approved joke
async function publishModeratedJoke(jokeData) {
    if (!channel) throw new Error("RabbitMQ channel not established");
    channel.sendToQueue(MODERATED_QUEUE, Buffer.from(JSON.stringify(jokeData)), { persistent: true });
    console.log("Published approved joke to moderated queue:", jokeData);
}

module.exports = { connectQueue, getJokeFromQueue, publishModeratedJoke, CACHE_FILE };