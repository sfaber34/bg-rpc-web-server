const express = require('express');
const router = express.Router();
const axios = require('axios');

const { cachedDataModalCharLim } = require('../config');

require('dotenv').config();

router.get("/cacheddata", async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.HOST}:3002/cacheMap`);
    const cacheMapData = response.data;

    // Convert the cacheMap data into table rows
    let tableRows = '';
    for (const [key, data] of Object.entries(cacheMapData)) {
      // Display null if timestamp is null in the data
      const timestamp = data.timestamp === null ? 'null' : new Date(data.timestamp).toLocaleString();
      // Calculate timestamp age in milliseconds
      const timestampAge = data.timestamp === null ? 'null' : Date.now() - data.timestamp;
      // Strip the key to only show the method name
      const displayKey = key.split(':')[0];
      
      // Format the value to show as a link if it's too long
      const valueStr = JSON.stringify(data.value);
      const displayValue = valueStr.length > cachedDataModalCharLim ? 
        `<a class="view-object-link" onclick='showModal(${valueStr.replace(/'/g, "\\'")})'>View Value</a>` : 
        valueStr;

      // Format the params to show as a link if it's too long
      const paramsStr = JSON.stringify(data.params);
      const displayParams = paramsStr.length > cachedDataModalCharLim ? 
        `<a class="view-object-link" onclick='showModal(${paramsStr.replace(/'/g, "\\'")})'>View Params</a>` : 
        paramsStr;

      tableRows += `
        <tr>
          <td>${displayKey}</td>
          <td>${displayParams}</td>
          <td>${displayValue}</td>
          <td>${timestamp}</td>
          <td>${timestampAge === 'null' ? 'null' : timestampAge}</td>
        </tr>
      `;
    }
    
    res.send(`
      <html>
        <head>
          <title>Cached Data</title>
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
            /* Modal styles */
            .modal {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0,0,0,0.5);
              z-index: 1000;
            }
            .modal-content {
              position: relative;
              background-color: #fefefe;
              margin: 5% auto;
              padding: 20px;
              border: 1px solid #888;
              max-width: 80%;
              max-height: 80vh;
              overflow-y: auto;
              border-radius: 5px;
            }
            .close-modal {
              position: absolute;
              right: 10px;
              top: 5px;
              color: #aaa;
              font-size: 28px;
              font-weight: bold;
              cursor: pointer;
            }
            .close-modal:hover {
              color: #000;
            }
            .view-object-link {
              color: #007bff;
              text-decoration: underline;
              cursor: pointer;
            }
            .view-object-link:hover {
              color: #0056b3;
            }
          </style>
        </head>
        <body>
          <!-- Modal -->
          <div id="objectModal" class="modal">
            <div class="modal-content">
              <span class="close-modal" onclick="closeModal()">&times;</span>
              <div id="modalContent"></div>
            </div>
          </div>

          <h1>Cached Data</h1>
          <table id="cacheTable">
            <thead>
              <tr>
                <th data-sort="string" class="sort-asc">Key</th>
                <th data-sort="string">Params</th>
                <th data-sort="string">Value</th>
                <th data-sort="number">Timestamp</th>
                <th data-sort="number">Age (ms)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            function showModal(content) {
              const modal = document.getElementById('objectModal');
              const modalContent = document.getElementById('modalContent');
              modalContent.innerHTML = '<pre>' + JSON.stringify(content, null, 2) + '</pre>';
              modal.style.display = 'block';
            }

            function closeModal() {
              const modal = document.getElementById('objectModal');
              modal.style.display = 'none';
            }

            // Close modal when clicking outside
            window.onclick = function(event) {
              const modal = document.getElementById('objectModal');
              if (event.target === modal) {
                modal.style.display = 'none';
              }
            }

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
          <title>Error - Cached Data</title>
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