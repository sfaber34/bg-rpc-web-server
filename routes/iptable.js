const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const path = require('path');
const fs = require('fs');
const { lookupIp } = require('../utils/ipLookup');

// Load .env from the project root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function getDbConnection() {
  try {
    if (!process.env.RDS_SECRET_NAME || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.DB_HOST) {
      throw new Error('Required environment variables are missing. Please check your .env file.');
    }

    const secret_name = process.env.RDS_SECRET_NAME;
    const secretsClient = new SecretsManagerClient({ 
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });

    const command = new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT",
    });
    const data = await secretsClient.send(command);
    const secret = JSON.parse(data.SecretString);

    const dbConfig = {
      host: process.env.DB_HOST,
      user: secret.username,
      password: secret.password,
      database: secret.dbname || 'postgres',
      port: 5432,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync('/home/ubuntu/shared/rds-ca-bundle.pem')
      }
    };

    return new Pool(dbConfig);
  } catch (error) {
    console.error('Error setting up database connection:', error);
    throw error;
  }
}

async function getIpTableData() {
  let pool;
  try {
    pool = await getDbConnection();
    const result = await pool.query(`
      SELECT 
        ip,
        requests_total,
        origins,
        requests_last_hour,
        origins_last_hour,
        requests_previous_hour,
        origins_previous_hour,
        requests_today,
        origins_today,
        requests_this_month,
        last_reset_timestamp,
        last_day_reset_timestamp,
        last_month_reset_timestamp,
        updated_at
      FROM ip_table 
      ORDER BY requests_total DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting IP table data:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// API endpoint for IP lookup
router.get("/iptable/lookup/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const ipInfo = await lookupIp(ip);
    res.json(ipInfo);
  } catch (error) {
    console.error('Error in IP lookup endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/iptable", async (req, res) => {
  try {
    // Query the RDS database - get top 200 by requests total
    const data = await getIpTableData();

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

    // Build table rows from RDS data - map fields to columns in correct order
    let tableRows = '';
    
    // Format timestamps - handle epoch timestamps (numbers/strings), Date objects, and string formats
    const formatTimestamp = (ts) => {
      if (!ts) return '';
      try {
        let date;
        // Check if it's a number or numeric string (epoch timestamp in seconds)
        const numericValue = Number(ts);
        if (!isNaN(numericValue) && numericValue > 1000000000 && numericValue < 10000000000) {
          // Likely an epoch timestamp in seconds (10 digits)
          date = new Date(numericValue * 1000); // Convert seconds to milliseconds
        } else if (ts instanceof Date) {
          date = ts;
        } else {
          date = new Date(ts);
        }
        return isNaN(date.getTime()) ? ts : date.toLocaleString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        });
      } catch (e) {
        return ts;
      }
    };

    // Format JSONB fields
    const formatJsonb = (val) => {
      if (!val) return '{}';
      return typeof val === 'object' ? JSON.stringify(val) : val;
    };

    data.forEach((rowData) => {
      // Extract fields in the correct order matching headers
      const ip = rowData.ip || '';
      const requestsTotal = rowData.requests_total || 0;
      const origins = formatJsonb(rowData.origins);
      const requestsLastHour = rowData.requests_last_hour || 0;
      const originsLastHour = formatJsonb(rowData.origins_last_hour);
      const requestsPreviousHour = rowData.requests_previous_hour || 0;
      const originsPreviousHour = formatJsonb(rowData.origins_previous_hour);
      const requestsToday = rowData.requests_today || 0;
      const originsToday = formatJsonb(rowData.origins_today);
      const requestsThisMonth = rowData.requests_this_month || 0;
      
      // Timestamps at the far right
      const lastResetTimestamp = formatTimestamp(rowData.last_reset_timestamp);
      const lastDayResetTimestamp = formatTimestamp(rowData.last_day_reset_timestamp);
      const lastMonthResetTimestamp = formatTimestamp(rowData.last_month_reset_timestamp);
      const updatedAt = formatTimestamp(rowData.updated_at);
      
      tableRows += `
        <tr>
          <td><a href="#" class="ip-link" data-ip="${ip}">${ip}</a></td>
          <td>${requestsTotal}</td>
          <td>${origins}</td>
          <td>${requestsLastHour}</td>
          <td>${originsLastHour}</td>
          <td>${requestsPreviousHour}</td>
          <td>${originsPreviousHour}</td>
          <td>${requestsToday}</td>
          <td>${originsToday}</td>
          <td>${requestsThisMonth}</td>
          <td>${lastResetTimestamp}</td>
          <td>${lastDayResetTimestamp}</td>
          <td>${lastMonthResetTimestamp}</td>
          <td>${updatedAt}</td>
        </tr>
      `;
    });

    // Calculate total requests last hour
    const totalRequestsLastHour = data.reduce((sum, row) => sum + (row.requests_last_hour || 0), 0);

    // Define custom header names
    const headerCells = `
      <th data-sort="string">IP</th>
      <th data-sort="number">Requests Total</th>
      <th data-sort="string">Origins</th>
      <th data-sort="number">Requests Last Hour</th>
      <th data-sort="string">Origins Last Hour</th>
      <th data-sort="number">Requests Previous Hour</th>
      <th data-sort="string">Origins Previous Hour</th>
      <th data-sort="number">Requests Today</th>
      <th data-sort="string">Origins Today</th>
      <th data-sort="number">Requests This Month</th>
      <th data-sort="string">Last Hourly Reset</th>
      <th data-sort="string">Last Daily Reset</th>
      <th data-sort="string">Last Monthly Reset</th>
      <th data-sort="string">Updated At</th>
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
              font-size: 12px;
              width: 100%;
              margin: 20px auto;
              border-collapse: collapse;
            }
            th, td { 
              padding: 8px;
              text-align: left;
              vertical-align: top;
              border: 1px solid #ddd;
              word-wrap: break-word;
              max-width: 200px;
              white-space: nowrap;
            }
            .table-container {
              overflow-x: auto;
              margin: 20px;
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
            .ip-link {
              color: #1f77b4;
              cursor: pointer;
              text-decoration: none;
            }
            .ip-link:hover {
              text-decoration: underline;
            }
            .modal {
              display: none;
              position: fixed;
              z-index: 1000;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              overflow: auto;
              background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
              background-color: #fefefe;
              margin: 5% auto;
              padding: 20px;
              border: 1px solid #888;
              border-radius: 8px;
              width: 80%;
              max-width: 600px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #f0f0f0;
              padding-bottom: 10px;
            }
            .modal-header h2 {
              margin: 0;
              color: #333;
            }
            .close {
              color: #aaa;
              font-size: 28px;
              font-weight: bold;
              cursor: pointer;
              line-height: 20px;
            }
            .close:hover,
            .close:focus {
              color: #000;
            }
            .modal-body {
              color: #333;
            }
            .ip-info-table {
              width: 100%;
              border-collapse: collapse;
            }
            .ip-info-table td {
              padding: 10px;
              border-bottom: 1px solid #f0f0f0;
            }
            .ip-info-table td:first-child {
              font-weight: bold;
              width: 40%;
              color: #666;
            }
            .loading {
              text-align: center;
              padding: 20px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h1>IP Table</h1>
          <div class="stats">Total entries: ${data.length} | Total requests last hour: ${totalRequestsLastHour}</div>
          
          <!-- IP Info Modal -->
          <div id="ipModal" class="modal">
            <div class="modal-content">
              <div class="modal-header">
                <h2>IP Information</h2>
                <span class="close">&times;</span>
              </div>
              <div class="modal-body" id="modalBody">
                <div class="loading">Loading...</div>
              </div>
            </div>
          </div>
          
          <div class="table-container">
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
          </div>

          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const table = document.getElementById('ipTable');
              const headers = table.querySelectorAll('th');
              const tbody = table.querySelector('tbody');
              const modal = document.getElementById('ipModal');
              const modalBody = document.getElementById('modalBody');
              const closeBtn = document.querySelector('.close');

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

              // IP lookup functionality
              async function fetchIpInfo(ip) {
                try {
                  modalBody.innerHTML = '<div class="loading">Loading...</div>';
                  modal.style.display = 'block';
                  
                  const response = await fetch(\`/iptable/lookup/\${ip}\`);
                  if (!response.ok) {
                    throw new Error('Failed to fetch IP information');
                  }
                  
                  const data = await response.json();
                  displayIpInfo(data);
                } catch (error) {
                  modalBody.innerHTML = \`<div class="loading" style="color: red;">Error: \${error.message}</div>\`;
                }
              }

              function displayIpInfo(data) {
                const fields = [
                  { key: 'query', label: 'IP Address' },
                  { key: 'country', label: 'Country' },
                  { key: 'countryCode', label: 'Country Code' },
                  { key: 'region', label: 'Region' },
                  { key: 'regionName', label: 'Region Name' },
                  { key: 'city', label: 'City' },
                  { key: 'zip', label: 'Zip Code' },
                  { key: 'lat', label: 'Latitude' },
                  { key: 'lon', label: 'Longitude' },
                  { key: 'timezone', label: 'Timezone' },
                  { key: 'isp', label: 'ISP' },
                  { key: 'org', label: 'Organization' },
                  { key: 'as', label: 'AS Number' },
                  { key: 'mobile', label: 'Mobile' },
                  { key: 'proxy', label: 'Proxy' },
                  { key: 'hosting', label: 'Hosting' }
                ];

                let html = '<table class="ip-info-table">';
                fields.forEach(field => {
                  const value = data[field.key];
                  if (value !== undefined && value !== null && value !== '') {
                    const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
                    html += \`<tr><td>\${field.label}</td><td>\${displayValue}</td></tr>\`;
                  }
                });
                html += '</table>';
                modalBody.innerHTML = html;
              }

              // Event delegation for IP links
              tbody.addEventListener('click', function(e) {
                if (e.target.classList.contains('ip-link')) {
                  e.preventDefault();
                  const ip = e.target.getAttribute('data-ip');
                  fetchIpInfo(ip);
                }
              });

              // Close modal handlers
              closeBtn.onclick = function() {
                modal.style.display = 'none';
              };

              window.onclick = function(event) {
                if (event.target === modal) {
                  modal.style.display = 'none';
                }
              };

              // ESC key to close modal
              document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && modal.style.display === 'block') {
                  modal.style.display = 'none';
                }
              });
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching IP table data from RDS:', error);
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
          <p>Please check your RDS database connection and ip_table schema.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

