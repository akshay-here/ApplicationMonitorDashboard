const bodyParser = require("body-parser");
const express = require("express");
const { Kafka } = require("kafkajs");
const winston = require("winston");
const client = require("prom-client");

const app = express()
const PORT = 5000

app.use(bodyParser.json())

// create the logger using winston
const logger = winston.createLogger({
    level: "info", 
    format: winston.format.json(), 
    transports: [new winston.transports.Console()], 
}); 

// kafka setup
const kafka = new Kafka({
    brokers: ["kafka:9092"]
});

// setting up the prom client registry for prometheus scraping at the metrics endpoint
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Default counter metric for HTTP requests
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'endpoint', 'status'],
});

register.registerMetric(httpRequestsTotal);
register.setDefaultLabels({ app: 'nodejs-server' });

// create a kafka producer and await for its connection
const producer = kafka.producer()
producer.connect()


// creating a function to log to kafka
async function logKafka(endpoint, method, status, details=null) {
    // the log message contains these fields
    const log = {
        endpoint, 
        method, 
        status, 
        timestamp: new Date().toISOString(), 
        details, 
    }; 

    // send the log to all the consumers undcer the topic "logs"
    await producer.send({
        topic: "logs", 
        messages: [{value: JSON.stringify(log)}]
    });

    // log the info using the winston logger
    logger.info(`Logged the request: ${JSON.stringify(log)}`);

    // Increment Prometheus counter
    httpRequestsTotal.inc({ method, endpoint, status });
}


// init sample data for example in our case we are doing e commerce platform
users = [
    {id: 1, name: "akshay"}, 
    {id: 2, name: "adarsh"}, 
    {id: 3, name: "abhinav"}, 
    {id: 4, name: "abhijan"},  
]; 

products = ["laptop", "TV", "Phone", "Bag"]; 

orders = [
    {id: 1, product: "Laptop", quantity: 2}, 
    {id: 2, product: "TV", quantity: 1}, 
]; 


// creating the routes or the endpoints we have to target

// creating /metrics for prometheus scraping
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// 1. Getting the Users list
app.get("/api/users", async (req, res) => {

    // first send the log to kafka 
    await logKafka("/api/users", "GET", 200, "Displaying the Users!");
    
    // then send the users list response back to the user
    res.json(users); 
});

// 2. Getting the Orders list
app.get("/api/orders", async (req, res) => {
    // send the log to kafka
    await logKafka("/api/orders", "GET", 200, "Displaying the Orders!");

    // send the Orders response back to the user
    res.send(orders);
});

// 3. Getting the user by user ID
app.get("/api/users/:id", async (req, res) => {

    userid = users.find(u => u.id === parseInt(req.params.id));

    // incase the user does not exist
    if (!userid) {
        await logKafka(`/api/users/${req.params.id}`, "GET", 404, "User Not Found! ");
        return res.status(404).json({error: "User not found"});
    }

    // if the user exists
    // send the log to kafka
    await logKafka(`/api/users/${req.params.id}`, "GET", 200, "Fetching user details!");

    // send the user data back
    res.send(userid);
});

// 4 .Getting the order by order ID
app.get("/api/orders/:id", async (req, res) => {

    orderid = orders.find(o => o.id === parseInt(req.params.id));

    // incase the order does not exist
    if (!orderid) {
        await logKafka(`/api/orders/${req.params.id}`, "GET", 404, "Order Not Found! ");
        return res.status(404).json({error: "Order not found"});
    }

    // if the order exists

    // first log to kafka 
    await logKafka(`/api/orders/${req.params.id}`, "GET", 200, "Fetching order details!");

    // send the order response back
    res.send(orderid);
});

// 5. Getting the products list
app.get("/api/products", async (req, res) => {
    
    // first log to kafka
    await logKafka("/api/products", "GET", 200, "Displaying the products");

    // send the products list back to the user
    res.send(products);
});

// 6. Posting a new order
app.post("/api/orders", async (req, res) => {

    const { product, quantity } = req.body; 

    // in case there are insufficient items
    if (!product  || !quantity) {
        // log to kafka that there are insufficient products or quantity
        await logKafka("/api/orders", "POST", 400, "Insufficient Items");

        return res.status(400).json({error: "Insufficient Items"});
    }

    // If items are available then create a new order
    const newOrder = {id: orders.length + 1, product, quantity}; 
    orders.push(newOrder);

    // log to kafka
    await logKafka("/api/orders", "POST", 201, newOrder);

    res.status(201).json(newOrder);
});




// Starting the server
app.listen(PORT, () => {
    console.log(`The API Server is running on PORT: ${PORT}`);
});

