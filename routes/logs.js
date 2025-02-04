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
      .reverse(); // Reverse the order so newest entries are first
  } catch (error) {
    console.error(`Error fetching logs from ${url}:`, error);
    return [];
  }
}

function renderPagination(currentPage, totalPages, baseUrl, tableId) {
  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  return `
    <div class="pagination">
      ${currentPage > 1 ? `<a onclick="changePage('${tableId}', 1)" class="page-link">«</a>` : ''}
      ${currentPage > 1 ? `<a onclick="changePage('${tableId}', ${currentPage - 1})" class="page-link">‹</a>` : ''}
      ${Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
        .map(page => `
          <a onclick="changePage('${tableId}', ${page})" 
             class="page-link ${page === currentPage ? 'active' : ''}">${page}</a>
        `).join('')}
      ${currentPage < totalPages ? `<a onclick="changePage('${tableId}', ${currentPage + 1})" class="page-link">›</a>` : ''}
      ${currentPage < totalPages ? `<a onclick="changePage('${tableId}', ${totalPages})" class="page-link">»</a>` : ''}
    </div>
  `;
}

function renderTable(logs, title, currentPage, tableId, isAjax = false) {
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  const pageData = logs.slice(startIndex, endIndex);

  if (isAjax) {
    // For AJAX requests, only return the table body and pagination
    return {
      tbody: pageData.map(log => `
        <tr>
          <td>${log.timestamp}</td>
          <td>${log.origin}</td>
          <td>${log.method}</td>
          <td>${log.params}</td>
          <td>${log.duration}</td>
          <td>${log.status}</td>
        </tr>
      `).join(''),
      pagination: logs.length > ITEMS_PER_PAGE ? renderPagination(currentPage, totalPages, '', tableId) : ''
    };
  }

  // For initial render, return the full table
  return `
    <div id="${tableId}" style="margin-bottom: 40px;">
      <h2>${title} (${logs.length} total entries)</h2>
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
        <tbody id="${tableId}-body">
          ${pageData.map(log => `
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
      <div id="${tableId}-pagination">
        ${logs.length > ITEMS_PER_PAGE ? renderPagination(currentPage, totalPages, '', tableId) : ''}
      </div>
    </div>
  `;
}

router.get("/logs", async (req, res) => {
  try {
    const currentPage = parseInt(req.query.page) || 1;
    const [fallbackLogs, cacheLogs] = await Promise.all([
      fetchLogs('/fallbackRequests'),
      fetchLogs('/cacheRequests')
    ]);

    // If it's an AJAX request for a specific table, return only the updated parts
    if (req.query.tableId) {
      const logs = req.query.tableId === 'fallbackLogs' ? fallbackLogs : cacheLogs;
      const title = req.query.tableId === 'fallbackLogs' ? 
        'Fallback Request Logs' : 
        'Cache Request Logs';
      const rendered = renderTable(logs, title, currentPage, req.query.tableId, true);
      res.setHeader('Content-Type', 'application/json');
      return res.json(rendered);
    }

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
            .pagination { 
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 5px;
              margin-top: 20px;
            }
            .page-link {
              padding: 8px 12px;
              text-decoration: none;
              color: #333;
              border: 1px solid #ddd;
              border-radius: 4px;
              cursor: pointer;
            }
            .page-link:hover {
              background-color: #f5f5f5;
            }
            .page-link.active {
              background-color: #007bff;
              color: white;
              border-color: #007bff;
            }
          </style>
          <script>
            let fallbackCurrentPage = 1;
            let cacheCurrentPage = 1;

            async function changePage(tableId, page) {
              try {
                if (tableId === 'fallbackLogs') {
                  fallbackCurrentPage = page;
                } else {
                  cacheCurrentPage = page;
                }

                const response = await fetch(\`/logs?page=\${page}&tableId=\${tableId}\`, {
                  headers: {
                    'Accept': 'application/json'
                  }
                });
                const data = await response.json();
                
                // Update only the table body and pagination
                document.getElementById(\`\${tableId}-body\`).innerHTML = data.tbody;
                document.getElementById(\`\${tableId}-pagination\`).innerHTML = data.pagination;
              } catch (error) {
                console.error('Error changing page:', error);
              }
            }
          </script>
        </head>
        <body>
          <h1>RPC Logs</h1>
          ${renderTable(fallbackLogs, 'Fallback Request Logs', currentPage, 'fallbackLogs')}
          ${renderTable(cacheLogs, 'Cache Request Logs', currentPage, 'cacheLogs')}
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