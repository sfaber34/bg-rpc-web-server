const express = require('express');
const router = express.Router();
const axios = require('axios');
const host = process.env.HOST;

router.get("/requestortable", async (req, res) => {
  try {
    const response = await axios.get(`https://${host}:3001/requestorTable`);
    const data = response.data;

    let tableRows = '';
    for (const [domain, stats] of Object.entries(data)) {
      tableRows += `
        <tr>
          <td>${domain}</td>
          <td>${stats.nAllRequestsAllTime}</td>
          <td>${stats.nCacheRequestsAllTime}</td>
          <td>${stats.nPoolRequestsAllTime}</td>
          <td>${stats.nFallbackRequestsAllTime}</td>
          <td>${stats.nAllRequestsLastWeek}</td>
          <td>${stats.nCacheRequestsLastWeek}</td>
          <td>${stats.nPoolRequestsLastWeek}</td>
          <td>${stats.nFallbackRequestsLastWeek}</td>
        </tr>
      `;
    }

    res.send(`
      <html>
        <head>
          <title>RPC Request Statistics</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 0px;
            }
            table { 
              font-size: 14px;
              width: 100%;
              max-width: 1000px;
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
              background-color: #f5f5f5;
            }
            h1 { 
              color: #333;
              margin-bottom: 30px;
              padding: 0px 20px;
            }
          </style>
        </head>
        <body>
          <h1>RPC Request Statistics</h1>
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>All Requests (All Time)</th>
                <th>Cache Requests (All Time)</th>
                <th>Pool Requests (All Time)</th>
                <th>Fallback Requests (All Time)</th>
                <th>All Requests (Last Week)</th>
                <th>Cache Requests (Last Week)</th>
                <th>Pool Requests (Last Week)</th>
                <th>Fallback Requests (Last Week)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching requestor table data:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - RPC Request Statistics</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Error Fetching RPC Request Statistics</h1>
          <p class="error">${error.message}</p>
          <p>Please try refreshing the page.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;