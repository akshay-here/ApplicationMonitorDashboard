const { Kafka } = require("kafkajs");

// Kafka setup
const kafka = new Kafka({
    brokers: ["kafka:9092"],
});

// Create a Kafka Consumer
const consumer = kafka.consumer({ groupId: "log-group" });

const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: "logs", fromBeginning: true });

    console.log("Consumer is listening for logs...");

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(`Received log: ${message.value.toString()}`);
        },
    });
};

run().catch(console.error);
