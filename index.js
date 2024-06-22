// Import necessary modules
const express = require('express');
const os = require('os');
const responseTime = require('response-time');
const client = require('prom-client'); // For Prometheus metrics collection
const app = express();

// Import Winston for logging
const { createLogger, transports } = require("winston");
const LokiTransport = require("winston-loki");

// Configure Winston to use Loki transport for logging
const options = {
  transports: [
    new LokiTransport({
      host: "http://127.0.0.1:3100"
    })
  ]
};
const logger = createLogger(options);

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default metrics collection to the registry
client.collectDefaultMetrics({ register });

// Define custom histogram metric for response time
const reqresTime = new client.Histogram({
  name: 'http_express_req_res_time',
  help: 'Histogram of HTTP request response time in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000]
});

// Define custom counter metric for total requests
const totalreq = new client.Counter({
  name: "total_req",
  help: "Tells total req"
});

// Register the custom metrics with the registry
register.registerMetric(reqresTime);
register.registerMetric(totalreq);

// Middleware to measure response time and increment request counter
app.use(responseTime((req, res, time) => {
  totalreq.inc();
  reqresTime.labels(req.method, req.route ? req.route.path : req.url, res.statusCode).observe(time);
}));

// Handle GET request on root URL (/)
app.get('/', (req, res) => {
  logger.info({ message: '/' });
  res.send('Welcome to my Express server!');
});

// Define /metrics endpoint to return Prometheus metrics
app.get('/metrics', async (req, res) => {
  logger.info({ message: '/metrics' });
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
});

// Handle /slow endpoint for heavy computation
app.get('/slow', (req, res) => {
  function heavyComputation() {
    const iterations = 1e7;
    for (let i = 0; i < iterations; i++) {
      Math.sqrt(Math.random());
    }
  }

  function randomError() {
    const shouldThrowError = Math.random() < 0.1; // 10% chance to throw an error
    if (shouldThrowError) {
      throw new Error('Something went wrong!');
    }
  }

  try {
    logger.info({ message: '/slow' });
    console.log('Starting heavy computation...');
    heavyComputation();
    randomError();
    
    const cpuLoad = os.loadavg();
    res.status(200).json({ message: 'Heavy computation completed successfully', cpuLoad });
  } catch (error) {
    logger.error(error.message);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Start server on port 4000
const port = 4000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
