const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

router.get("/cachemap", async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.HOST}:3002/cacheMap`);
    const cacheMapData = response.data;

    // Convert the cacheMap data into table rows
    let tableRows = '';
    for (const [key, data] of Object.entries(cacheMapData)) {
      // Display null if timestamp is null in the data
      const timestamp = data.timestamp === null ? 'null' : new Date(data.timestamp).toLocaleString();
      // Strip the key to only show the method name
      const displayKey = key.split(':')[0];
      tableRows += `
        <tr>
          <td>${displayKey}</td>
          <td>${JSON.stringify(data.params)}</td>
          <td>${JSON.stringify(data.value)}</td>
          <td>${timestamp}</td>
        </tr>
      `;
    }
    
    res.send(`
      <html>
        <head>
          <title>Cache Map Data</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 0px;
            }
            table { 
              font-size: 14px;
              width: 100%;
              max-width: 1480px;
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
              cursor: pointer;
              position: relative;
            }
            th:hover {
              background-color: #e5e5e5;
            }
            th::after {
              content: '';
              position: absolute;
              right: 8px;
              top: 50%;
              transform: translateY(-50%);
            }
            th.sort-desc::after {
              content: '▼';
            }
            th.sort-asc::after {
              content: '▲';
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
            .json-cell {
              white-space: pre-wrap;
              word-break: break-all;
            }
            .timestamp {
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <h1>Cache Map Data</h1>
          <table id="cacheTable">
            <thead>
              <tr>
                <th data-sort="string" class="sort-asc">Key</th>
                <th data-sort="string">Params</th>
                <th data-sort="string">Value</th>
                <th data-sort="number">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const table = document.getElementById('cacheTable');
              const headers = table.querySelectorAll('th');
              const tbody = table.querySelector('tbody');

              // Sort by Key (asc) by default
              sortTable(0, 'asc');

              headers.forEach((header, index) => {
                header.addEventListener('click', () => {
                  const currentDirection = header.classList.contains('sort-desc') ? 'asc' : 'desc';
                  headers.forEach(h => {
                    h.classList.remove('sort-desc', 'sort-asc');
                  });
                  header.classList.add(\`sort-\${currentDirection}\`);
                  sortTable(index, currentDirection);
                });
              });

              function sortTable(columnIndex, direction) {
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const sortType = headers[columnIndex].getAttribute('data-sort');

                rows.sort((a, b) => {
                  let aValue = a.cells[columnIndex].textContent.trim();
                  let bValue = b.cells[columnIndex].textContent.trim();

                  if (sortType === 'number') {
                    // For timestamp column, convert to number for proper sorting
                    // Handle null values by converting them to 0
                    aValue = aValue === 'null' ? 0 : new Date(aValue).getTime();
                    bValue = bValue === 'null' ? 0 : new Date(bValue).getTime();
                  }

                  if (direction === 'asc') {
                    return aValue > bValue ? 1 : -1;
                  } else {
                    return aValue < bValue ? 1 : -1;
                  }
                });

                tbody.innerHTML = '';
                rows.forEach(row => tbody.appendChild(row));
              }
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching cacheMap:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - Cache Map Data</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Error Fetching Cache Map Data</h1>
          <p class="error">${error.message}</p>
          <p>Please try refreshing the page.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;