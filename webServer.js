const https = require("https");
const express = require("express");
const fs = require("fs");
var cors = require("cors");
var bodyParser = require("body-parser");
const app = express();

const { webServerPort } = require('./config');

https.globalAgent.options.ca = require("ssl-root-cas").create(); // For sql connection

// Set up middleware first
app.use(bodyParser.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add navigation bar middleware
app.use((req, res, next) => {
  // Store the original send function
  const originalSend = res.send;
  
  // Override the send function
  res.send = function (body) {
    // Only modify HTML responses
    if (typeof body === 'string' && body.includes('<html')) {
      // Create navigation bar HTML
      const navBar = `
        <div style="background-color: #f8f9fa; padding: 10px; margin-bottom: 20px; font-size: 12pt;">
          <a href="/dashboard" style="margin-right: 15px; color: #333; text-decoration: none;">Dashboard</a>
          <a href="/logs" style="margin-right: 15px; color: #333; text-decoration: none;">Logs</a>
          <a href="/activenodes" style="margin-right: 15px; color: #333; text-decoration: none;">Active Nodes</a>
          <a href="/requestortable" style="margin-right: 15px; color: #333; text-decoration: none;">Requestor Table</a>
          <a href="/points" style="margin-right: 15px; color: #333; text-decoration: none;">Points</a>
          <a href="/cachemap" style="margin-right: 15px; color: #333; text-decoration: none;">Cache Map</a>
          <a href="/fallbackurl" style="color: #333; text-decoration: none;">Fallback URL</a>
        </div>
      `;
      
      // Insert navigation bar after the body tag
      body = body.replace('<body>', '<body>' + navBar);
    }
    
    // Call the original send function
    return originalSend.call(this, body);
  };
  
  next();
});

// Then mount routes
const dashboardRouter = require('./routes/dashboard');
const logsRouter = require('./routes/logs');
const activeNodesRouter = require('./routes/activenodes');
const requestorTableRouter = require('./routes/requestortable');
const pointsRouter = require('./routes/points');
const cacheMapRouter = require('./routes/cachemap');
const fallbackUrlRouter = require('./routes/fallbackurl');
const nodeContinentsRouter = require('./routes/nodecontinents');

app.use(dashboardRouter);
app.use(logsRouter);
app.use(activeNodesRouter);
app.use(requestorTableRouter);
app.use(pointsRouter);
app.use(cacheMapRouter);
app.use(fallbackUrlRouter);
app.use(nodeContinentsRouter);

// Add root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

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