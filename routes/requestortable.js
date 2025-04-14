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
          <td data-value="${stats.nAllRequestsAllTime}">${stats.nAllRequestsAllTime}</td>
          <td data-value="${stats.nCacheRequestsAllTime}">${stats.nCacheRequestsAllTime}</td>
          <td data-value="${stats.nPoolRequestsAllTime}">${stats.nPoolRequestsAllTime}</td>
          <td data-value="${stats.nFallbackRequestsAllTime}">${stats.nFallbackRequestsAllTime}</td>
          <td data-value="${stats.nAllRequestsLastWeek}">${stats.nAllRequestsLastWeek}</td>
          <td data-value="${stats.nCacheRequestsLastWeek}">${stats.nCacheRequestsLastWeek}</td>
          <td data-value="${stats.nPoolRequestsLastWeek}">${stats.nPoolRequestsLastWeek}</td>
          <td data-value="${stats.nFallbackRequestsLastWeek}">${stats.nFallbackRequestsLastWeek}</td>
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
              background-color:rgb(227, 227, 227);
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
          <table id="statsTable">
            <thead>
              <tr>
                <th data-sort="string">Domain</th>
                <th data-sort="number" class="sort-desc">All Requests (All Time)</th>
                <th data-sort="number">Cache Requests (All Time)</th>
                <th data-sort="number">Pool Requests (All Time)</th>
                <th data-sort="number">Fallback Requests (All Time)</th>
                <th data-sort="number">All Requests (Last Week)</th>
                <th data-sort="number">Cache Requests (Last Week)</th>
                <th data-sort="number">Pool Requests (Last Week)</th>
                <th data-sort="number">Fallback Requests (Last Week)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const table = document.getElementById('statsTable');
              const headers = table.querySelectorAll('th');
              const tbody = table.querySelector('tbody');

              // Sort by All Requests (All Time) by default
              sortTable(1, 'desc');

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
                  let aValue = a.cells[columnIndex].getAttribute('data-value') || a.cells[columnIndex].textContent.trim();
                  let bValue = b.cells[columnIndex].getAttribute('data-value') || b.cells[columnIndex].textContent.trim();

                  if (sortType === 'number') {
                    aValue = parseFloat(aValue) || 0;
                    bValue = parseFloat(bValue) || 0;
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