const express = require('express');
const router = express.Router();
const axios = require('axios');

require('dotenv').config();

router.get("/blackliststatus", async (req, res) => {
  try {
    const proxyHost = process.env.RPC_PROXY_HOST;
    const adminKey = process.env.RPC_PROXY_ADMIN_KEY;

    if (!proxyHost || !adminKey) {
      throw new Error('RPC_PROXY_HOST or RPC_PROXY_ADMIN_KEY not configured');
    }

    const response = await axios.get(`${proxyHost}/blackliststatus`, {
      headers: {
        'X-Admin-Key': adminKey
      }
    });

    const data = response.data;

    // Build table rows from the JSON data
    let tableRows = '';
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const displayValue = typeof value === 'object' 
          ? `<pre class="json-cell">${JSON.stringify(value, null, 2)}</pre>`
          : value;
        tableRows += `
          <tr>
            <td>${key}</td>
            <td>${displayValue}</td>
          </tr>
        `;
      }
    }

    res.send(`
      <html>
        <head>
          <title>Blacklist Status</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 0px;
            }
            table { 
              font-size: 14px;
              width: 100%;
              max-width: 2000px;
              margin: 20px auto;
              border-collapse: collapse;
            }
            th, td { 
              padding: 12px;
              text-align: left;
              vertical-align: top;
              border: 1px solid #ddd;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) { 
              background-color: #f9f9f9;
            }
            tr:hover { 
              background-color: rgb(227, 227, 227);
            }
            h1 { 
              color: #333;
              margin-bottom: 30px;
              padding: 0px 20px;
            }
            .json-cell {
              white-space: pre-wrap;
              word-break: break-all;
              margin: 0;
              background-color: #f5f5f5;
              padding: 10px;
              border-radius: 4px;
            }
            .refresh-btn {
              margin: 20px;
              padding: 10px 20px;
              background-color: #667eea;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
            }
            .refresh-btn:hover {
              background-color: #5568d3;
            }
            .raw-json {
              margin: 20px;
              padding: 20px;
              background-color: #f5f5f5;
              border-radius: 5px;
              overflow-x: auto;
            }
            .raw-json pre {
              margin: 0;
              white-space: pre-wrap;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <h1>🚫 Blacklist Status</h1>
          <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
          
          ${tableRows ? `
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          ` : ''}
          
          <div class="raw-json">
            <h3>Raw JSON Response:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching blacklist status:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - Blacklist Status</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; margin: 0; }
            .error { color: red; }
            h1 { padding: 0 20px; }
          </style>
        </head>
        <body>
          <h1>Error Fetching Blacklist Status</h1>
          <p class="error">${error.message}</p>
          <p>Please try refreshing the page.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;
