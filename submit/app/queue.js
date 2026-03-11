const amqp = require('amqplib');
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://127.0.0.1';
const SUBMIT_QUEUE = 'submit';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';
const CACHE_QUEUE = 'sub_type_update'; // Unique queue for Submit's cache updates
const CACHE_FILE = path.join(__dirname, 'types.json');

let channel;

// Initialize cache file if it doesn't exist
if (!fs.existsSync(CACHE_FILE)) {
    // Seed with our default test data types
    fs.writeFileSync(CACHE_FILE, JSON.stringify(["dad", "sports", "love"]));
}

async function connectQueue() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        // Ensure the queue we publish to exists
        await channel.assertQueue(SUBMIT_QUEUE, { durable: true });

        // ECST Cache Update Logic: Listen to the fanout exchange
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });
        await channel.assertQueue(CACHE_QUEUE, { durable: true });
        await channel.bindQueue(CACHE_QUEUE, TYPE_UPDATE_EXCHANGE, '');

        console.log("Submit Service connected to RabbitMQ.");

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

async function publishJoke(jokeData) {
    if (!channel) throw new Error("RabbitMQ channel not established");
    channel.sendToQueue(SUBMIT_QUEUE, Buffer.from(JSON.stringify(jokeData)), { persistent: true });
    console.log("Published new joke to submit queue:", jokeData);
}

module.exports = { connectQueue, publishJoke, CACHE_FILE };