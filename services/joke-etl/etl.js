require('dotenv').config();
const amqp = require('amqplib');
const db = require('./db');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://jokes_rabbitmq';
const MODERATED_QUEUE = 'moderated';
const TYPE_UPDATE_EXCHANGE = 'type_update_exchange';

async function startETL() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        // Ensure the queue exists before trying to consume from it
        await channel.assertQueue(MODERATED_QUEUE, { durable: true });

        // Ensure the fanout exchange exists for publishing ECST events
        await channel.assertExchange(TYPE_UPDATE_EXCHANGE, 'fanout', { durable: true });

        console.log(`ETL Service listening for messages on "${MODERATED_QUEUE}"...`);

        // Register the callback to consume messages
        channel.consume(MODERATED_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const payload = JSON.parse(msg.content.toString());
                    console.log("ETL Received payload:", payload);

                    const { setup, punchline, type } = payload;
                    const safeType = type.toLowerCase().trim();

                    // Transform and Load into Database
                    const isNewType = await db.insertJokeAndType(setup, punchline, safeType);

                    // If a new type was written, publish an event to the fanout exchange
                    if (isNewType) {
                        const eventPayload = JSON.stringify({ type: safeType });
                        channel.publish(TYPE_UPDATE_EXCHANGE, '', Buffer.from(eventPayload));
                        console.log(`Published thick event for new type: ${safeType}`);
                    }

                    // Acknowledge receipt so broker deletes the message
                    channel.ack(msg);
                    console.log("Message successfully processed and acknowledged.");
                } catch (error) {
                    console.error("Error processing message:", error);
                    // In a production app, you might route this to a Dead Letter Queue here
                }
            }
        });
    } catch (error) {
        console.error("RabbitMQ Connection Error. Retrying in 5s...", error.message);
        setTimeout(startETL, 5000); // Basic reconnection logic
    }
}

startETL();