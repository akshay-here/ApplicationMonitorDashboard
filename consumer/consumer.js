const { Kafka } = require("kafkajs");
const { Client } = require("pg");

// Kafka setup
const kafka = new Kafka({
    brokers: ["kafka:9092"],
});
// Create a Kafka Consumer
const consumer = kafka.consumer({ groupId: "log-group" });


// create a postgres connection
const client = new Client({
    host: "postgres", 
    user: "user", 
    password: "password", 
    database: "logsDB", 
    port: 5432, 
});

const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: "logs", fromBeginning: true });

    console.log("Consumer is listening for logs...");

    // connect to postgres
    await client.connect()

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const logmsg = JSON.parse(message.value. toString());

            // storing the log into postgres
            const values = [
                logmsg.endpoint, 
                logmsg.method, 
                logmsg.status, 
                new Date(logmsg.timestamp), 
                logmsg.details || null, 
            ]; 

            const query = `
            INSERT INTO logs (endpoint, method, status, timestamp, details) 
            VALUES ($1, $2, $3, $4, $5)
            `;

            // save the new record into the table
            await client.query(query, values);
            
            console.log(`Saved the log into PostgresSQL: ${JSON.stringify(logmsg)}`);
        },
    });
};

run().catch(console.error);
