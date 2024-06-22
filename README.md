
# Monitoring with Grafana, Loki, and Prometheus

## Prerequisite
- Basic knowledge of Node.js and Express Framework
- Basic to Intermediate knowledge in Docker and Containerization

## Installation and Setup

### 1. Prometheus Server
- Create a `prometheus-config.yml` file and copy the following configuration. Don't forget to replace `<NODEJS_SERVER_ADDRESS>` with the actual value.
```yaml
global:
  scrape_interval: 4s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["<NODEJS_SERVER_ADDRESS>"]
```
- Start the Prometheus Server using Docker Compose
```yaml
version: "3"

services:
  prom-server:
    image: prom/prometheus
    ports:
      - 9090:9090
    volumes:
      - ./prometheus-config.yml:/etc/prometheus/prometheus.yml
```
Great, the Prometheus server is now up and running at PORT 9090.

### 2. Setup Grafana
```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana-oss
```
![grafana](https://grafana.com/static/img/grafana/showcase_visualize.jpg)

### 3. Setup Loki Server
```bash
docker run -d --name=loki -p 3100:3100 grafana/loki
```

### 4. Setup Node.js Server
- Create an `index.js` file and copy the following code:
```javascript
const express = require('express');
const os = require('os');
const responseTime = require('response-time');
const client = require('prom-client'); // Metric collection
const app = express();

const { createLogger, transports } = require("winston");
const LokiTransport = require("winston-loki");
const options = {
  transports: [
    new LokiTransport({
      host: "http://127.0.0.1:3100"
    })
  ]
};
const logger = createLogger(options);

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const reqresTime = new client.Histogram({
  name: 'http_express_req_res_time',
  help: 'Histogram of HTTP request response time in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000]
});

const totalreq = new client.Counter({
    name: "total_req",
    help: "Tells total req"
});
register.registerMetric(reqresTime);
register.registerMetric(totalreq);

app.use(responseTime((req, res, time) => {
  totalreq.inc();
  reqresTime.labels(req.method, req.route ? req.route.path : req.url, res.statusCode).observe(time);
}));

app.get('/', (req, res) => {
  logger.info({ message: '/' });
  res.send('Welcome to my Express server!');
});

app.get('/metrics', async (req, res) => {
  logger.info({ message: '/metrics' });
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
});

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

const port = 4000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
```

- Install the necessary dependencies:
```bash
npm install express os response-time prom-client winston winston-loki
```

- Run the Node.js server:
```bash
node index.js
```

### Author
- **Kathan Shah** (@kathan-shah1893)
