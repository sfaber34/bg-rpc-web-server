const https = require("https");
const express = require("express");
const fs = require("fs");
var cors = require("cors");
var bodyParser = require("body-parser");
const app = express();

const { webServerPort } = require('./config');

const fallbackUrlRouter = require('./routes/fallbackurl');
const logsRouter = require('./routes/logs');

app.use(fallbackUrlRouter);
app.use(logsRouter);

https.globalAgent.options.ca = require("ssl-root-cas").create(); // For sql connection

app.use(bodyParser.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create the HTTPS server
const server = https.createServer(
  {
    key: fs.readFileSync("/home/ubuntu/shared/server.key"),
    cert: fs.readFileSync("/home/ubuntu/shared/server.cert"),
  },
  app
);

server.listen(webServerPort, () => {
  console.log("----------------------------------------------------------------------------------------------------------------");
  console.log("----------------------------------------------------------------------------------------------------------------");
  console.log(`HTTPS server listening on port ${webServerPort}...`);
});