#!/usr/bin/env node
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const MODERATED_QUEUE = 'moderated';

async function publish(setup, punchline, type) {
    let connection;
    try {
        const joke = { setup, punchline, type };
        console.log("Connecting to RabbitMQ at:", RABBITMQ_URL);
        connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(MODERATED_QUEUE, { durable: true });
        
        const sent = channel.sendToQueue(MODERATED_QUEUE, Buffer.from(JSON.stringify(joke)), { persistent: true });
        if (sent) {
            console.log("Published to moderated queue:", setup);
        } else {
            console.error("Failed to enqueue message");
        }
        
        // Wait for message to be sent before closing
        await new Promise(r => setTimeout(r, 1000));
        await connection.close();
        console.log("Connection closed.");
    } catch (error) {
        console.error("Failed to publish to moderated queue:", error.message);
        if (connection && typeof connection.close === 'function') {
            await connection.close();
        }
        process.exit(1);
    }
}

const setup = process.argv[2];
const punchline = process.argv[3];
const type = process.argv[4];

if (!setup || !punchline || !type) {
    console.error("Usage: publish-moderated.js <setup> <punchline> <type>");
    process.exit(1);
}

publish(setup, punchline, type);
