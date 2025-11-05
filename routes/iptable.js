const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

router.get("/iptable", async (req, res) => {
  try {
    // Get Firestore database instance
    const db = admin.firestore();
    
    // Query the Firebase Firestore collection - get top 100 by requests total
    const collectionName = process.env.FIREBASE_COLLECTION;
    const snapshot = await db.collection(collectionName)
      .orderBy('requestsTotal', 'desc')
      .limit(100)
      .get();
    
    // Convert Firestore snapshot to array of objects
    const data = [];
    snapshot.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });

    if (data.length === 0) {
      return res.send(`
        <html>
          <head>
            <title>IP Table</title>
            <style>
              body { 
                font-family: Arial, sans-serif;
                margin: 0px;
                padding: 20px;
              }
              .message {
                color: #666;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <h1>IP Table</h1>
            <p class="message">No data found in the database.</p>
          </body>
        </html>
      `);
    }

    // Build table rows from Firestore data - map fields to columns in correct order
    let tableRows = '';
    data.forEach((rowData) => {
      // Extract fields in the correct order matching headers
      const ip = rowData.id || rowData.ip || '';
      const origins = typeof rowData.origins === 'object' ? JSON.stringify(rowData.origins) : (rowData.origins || '');
      const requestsLastHour = rowData.requestsLastHour || 0;
      const requestsTotal = rowData.requestsTotal || 0;
      
      tableRows += `
        <tr>
          <td>${ip}</td>
          <td>${origins}</td>
          <td>${requestsLastHour}</td>
          <td>${requestsTotal}</td>
        </tr>
      `;
    });

    // Define custom header names
    const headerCells = `
      <th data-sort="string">IP</th>
      <th data-sort="string">Origins</th>
      <th data-sort="number">Requests Last Hour</th>
      <th data-sort="number">Requests Total</th>
    `;

    res.send(`
      <html>
        <head>
          <title>IP Table</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              margin: 0px;
            }
            table { 
              font-size: 14px;
              width: 100%;
              max-width: 1200px;
              margin: 20px auto;
              border-collapse: collapse;
            }
            th, td { 
              padding: 12px;
              text-align: left;
              vertical-align: top;
              border: 1px solid #ddd;
              word-wrap: break-word;
              max-width: 300px;
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
            .stats {
              padding: 0px 20px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>IP Table</h1>
          <div class="stats">Total entries: ${data.length}</div>
          <table id="ipTable">
            <thead>
              <tr>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const table = document.getElementById('ipTable');
              const headers = table.querySelectorAll('th');
              const tbody = table.querySelector('tbody');

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
    console.error('Error fetching IP table data from Firestore:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - IP Table</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Error Fetching IP Table Data</h1>
          <p class="error">${error.message}</p>
          <p>Please check your Firebase configuration and Firestore collection name.</p>
          <p>Collection: ${process.env.FIREBASE_COLLECTION || 'stageIps'}</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

