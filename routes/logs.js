const express = require('express');
const router = express.Router();
const axios = require('axios');

const ITEMS_PER_PAGE = 30;

async function fetchLogs(url) {
  try {
    const response = await axios.get(`http://localhost:3001${url}`);
    const logs = Array.isArray(response.data) ? response.data : [];
    
    return logs
      .map(log => ({
        timestamp: log.timestamp,
        origin: log.requester,
        method: log.method,
        params: log.params,
        duration: log.elapsed,
        status: log.status
      }))
      .slice(0, 30); // Get latest 30 entries
  } catch (error) {
    console.error(`Error fetching logs from ${url}:`, error);
    return [];
  }
}

function renderTable(logs, title) {
  return `
    <div style="margin-bottom: 40px;">
      <h2>${title}</h2>
      <table border="1" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th>Timestamp</th>
            <th>Origin</th>
            <th>Method</th>
            <th>Params</th>
            <th>Duration (ms)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${log.timestamp}</td>
              <td>${log.origin}</td>
              <td>${log.method}</td>
              <td>${log.params}</td>
              <td>${log.duration}</td>
              <td>${log.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

router.get("/logs", async (req, res) => {
  try {
    const [fallbackLogs, cacheLogs] = await Promise.all([
      fetchLogs('/fallbackRequests'),
      fetchLogs('/cacheRequests')
    ]);

    res.send(`
      <html>
        <head>
          <title>RPC Logs</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            table { font-size: 14px; width: 100%; }
            th, td { padding: 8px; text-align: left; }
            h1 { margin-bottom: 30px; }
            h2 { color: #333; margin-bottom: 15px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:hover { background-color: #f5f5f5; }
          </style>
          <script>
            function refreshLogs() {
              fetch('/logs')
                .then(response => response.text())
                .then(html => {
                  const parser = new DOMParser();
                  const newDoc = parser.parseFromString(html, 'text/html');
                  document.body.innerHTML = newDoc.body.innerHTML;
                })
                .catch(error => console.error('Error refreshing logs:', error));
            }
          </script>
        </head>
        <body>
          <h1>RPC Logs</h1>
          ${renderTable(fallbackLogs, 'Fallback Request Logs (Latest 30 Entries)')}
          ${renderTable(cacheLogs, 'Cache Request Logs (Latest 30 Entries)')}
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - RPC Logs</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Error Fetching Logs</h1>
          <p class="error">${error.message}</p>
          <p>Please try refreshing the page.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;