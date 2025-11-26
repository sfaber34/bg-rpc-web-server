const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const path = require('path');
const fs = require('fs');

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

async function getIpTimeseriesData(days = 7) {
  let pool;
  try {
    pool = await getDbConnection();
    
    // Step 1: Get top 30 IPs by total request count
    const topIpsResult = await pool.query(
      `SELECT ip, SUM(request_count) as total_requests
       FROM ip_history_table
       WHERE hour_timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '${days} days')
       GROUP BY ip
       ORDER BY total_requests DESC
       LIMIT 30`
    );
    
    const topIps = topIpsResult.rows.map(row => row.ip);
    
    if (topIps.length === 0) {
      return [];
    }
    
    // Step 2: Get timeseries data for those top 30 IPs
    const timeseriesResult = await pool.query(
      `SELECT hour_timestamp, ip, request_count
       FROM ip_history_table
       WHERE hour_timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '${days} days')
         AND ip = ANY($1)
       ORDER BY hour_timestamp ASC, ip`,
      [topIps]
    );
    
    return timeseriesResult.rows;
  } catch (error) {
    console.error('Error getting IP timeseries data:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

router.get("/iptimeseries", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 1;
    const data = await getIpTimeseriesData(days);

    if (data.length === 0) {
      return res.send(`
        <html>
          <head>
            <title>IP Timeseries</title>
            <style>
              body { 
                font-family: Arial, sans-serif;
                margin: 0px;
                padding: 0px;
              }
              .message {
                color: #666;
                font-size: 16px;
              }
            </style>
          </head>
          <body>
            <h1>IP Request Timeseries - Top 30 IPs</h1>
            <p class="message">No data found in the database for the selected time range.</p>
          </body>
        </html>
      `);
    }

    // First, collect all unique timestamps and organize data by IP
    const allTimestamps = new Set();
    const ipDataMap = {};
    
    data.forEach(row => {
      const timestamp = row.hour_timestamp;
      allTimestamps.add(timestamp);
      
      if (!ipDataMap[row.ip]) {
        ipDataMap[row.ip] = {};
      }
      ipDataMap[row.ip][timestamp] = row.request_count;
    });
    
    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // Fill in missing timestamps with 0 for each IP
    const ipData = {};
    Object.keys(ipDataMap).forEach(ip => {
      ipData[ip] = {
        timestamps: [],
        counts: []
      };
      
      sortedTimestamps.forEach(timestamp => {
        // Convert epoch timestamp (seconds) to milliseconds for JavaScript Date
        ipData[ip].timestamps.push(new Date(timestamp * 1000).toISOString());
        // If this IP has data for this timestamp, use it; otherwise use 0
        ipData[ip].counts.push(ipDataMap[ip][timestamp] || 0);
      });
    });

    // Escape the data for safe injection into script tag
    const safeData = JSON.stringify(ipData).replace(/\//g, '\\/').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

    res.send(`
      <html>
        <head>
          <title>IP Timeseries</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            html, body { 
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              height: 100%;
              overflow: hidden;
            }
            body {
              display: flex;
              flex-direction: column;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px;
              flex-shrink: 0;
            }
            h1 {
              color: #333;
              margin: 0;
            }
            .controls {
              display: flex;
              gap: 5px;
            }
            .time-filter-btn {
              padding: 8px 16px;
              margin: 0 5px;
              border: 1px solid #ccc;
              background-color: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
            }
            .time-filter-btn:hover {
              background-color: #f0f0f0;
            }
            .time-filter-btn.active {
              background-color: #1f77b4;
              color: white;
              border-color: #1f77b4;
            }
            #ipTimeseriesPlot {
              width: 100%;
              flex: 1;
              min-height: 0;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <h1>IP Request Timeseries - Top 30 IPs</h1>
            <div class="controls">
              <button class="time-filter-btn active" data-days="1">1 Day</button>
              <button class="time-filter-btn" data-days="3">3 Days</button>
              <button class="time-filter-btn" data-days="7">1 Week</button>
              <button class="time-filter-btn" data-days="14">2 Weeks</button>
              <button class="time-filter-btn" data-days="30">1 Month</button>
            </div>
          </div>
          <div id="ipTimeseriesPlot"></div>

          <script>
            const ipData = ${safeData};

            // Define a color palette for the traces
            const colors = [
              '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
              '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
              '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
              '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
              '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#1f77b4',
              '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'
            ];

            // Create traces for each IP
            const traces = Object.entries(ipData).map(([ip, data], index) => {
              // Determine marker symbol based on ranking
              let markerSymbol;
              if (index < 10) {
                markerSymbol = 'circle';  // Top 10
              } else if (index < 20) {
                markerSymbol = 'square';  // Middle 10
              } else {
                markerSymbol = 'diamond'; // Bottom 10
              }
              
              // Create array of marker sizes: 0 for zero requests, 12 for non-zero
              const markerSizes = data.counts.map(count => count > 0 ? 12 : 0);
              
              return {
                name: ip,
                x: data.timestamps,
                y: data.counts,
                type: 'scatter',
                mode: 'lines+markers',
                line: {
                  color: colors[index % colors.length],
                  width: 3
                },
                marker: {
                  size: markerSizes,
                  symbol: markerSymbol
                },
                hovertemplate: '<b>' + ip + '</b><br>Requests: %{y}<extra></extra>'
              };
            });

            const layout = {
              xaxis: {
                title: 'Time (UTC)',
                type: 'date',
                showgrid: true
              },
              yaxis: {
                title: 'Request Count',
                showgrid: true
              },
              hovermode: 'closest',
              showlegend: true,
              legend: {
                orientation: 'v',
                x: 1.02,
                y: 1,
                xanchor: 'left',
                yanchor: 'top'
              },
              margin: {
                l: 60,
                r: 200,
                t: 80,
                b: 60
              }
            };

            Plotly.newPlot('ipTimeseriesPlot', traces, layout);

            // Add hover effect to highlight traces
            const plotElement = document.getElementById('ipTimeseriesPlot');
            
            plotElement.on('plotly_hover', function(data) {
              const curveNumber = data.points[0].curveNumber;
              const update = {
                'line.width': traces.map((trace, idx) => idx === curveNumber ? 6 : 3),
                'opacity': traces.map((trace, idx) => idx === curveNumber ? 1.0 : 0.3),
                'marker.size': traces.map((trace, idx) => {
                  return trace.y.map(count => {
                    if (count === 0) return 0;
                    return idx === curveNumber ? 18 : 12;
                  });
                })
              };
              Plotly.restyle('ipTimeseriesPlot', update);
            });

            plotElement.on('plotly_unhover', function(data) {
              const update = {
                'line.width': traces.map(() => 3),
                'opacity': traces.map(() => 1.0),
                'marker.size': traces.map(trace => trace.y.map(count => count > 0 ? 12 : 0))
              };
              Plotly.restyle('ipTimeseriesPlot', update);
            });

            // Add hover effect to legend items
            setTimeout(() => {
              // Try multiple selectors to find legend items
              let legendItems = null;
              const selectors = [
                '#ipTimeseriesPlot .legend .traces .trace',
                '#ipTimeseriesPlot g.traces > g.trace',
                '#ipTimeseriesPlot .legend text.legendtext'
              ];
              
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                  console.log('Found legend items with selector:', selector, 'Count:', elements.length);
                  legendItems = elements;
                  break;
                }
              }
              
              if (!legendItems) {
                console.log('Could not find legend items. Available classes:', 
                  Array.from(document.querySelectorAll('#ipTimeseriesPlot *'))
                    .filter(el => el.classList.length > 0)
                    .map(el => el.className)
                    .slice(0, 20)
                );
                return;
              }
              
              legendItems.forEach((item, index) => {
                // Find the parent group element if we selected text elements
                const targetElement = item.tagName === 'text' ? item.closest('g.trace') || item.parentElement : item;
                targetElement.style.cursor = 'pointer';
                
                targetElement.addEventListener('mouseenter', () => {
                  const update = {
                    'line.width': traces.map((trace, idx) => idx === index ? 6 : 3),
                    'opacity': traces.map((trace, idx) => idx === index ? 1.0 : 0.3),
                    'marker.size': traces.map((trace, idx) => {
                      return trace.y.map(count => {
                        if (count === 0) return 0;
                        return idx === index ? 18 : 12;
                      });
                    })
                  };
                  Plotly.restyle('ipTimeseriesPlot', update);
                });
                
                targetElement.addEventListener('mouseleave', () => {
                  const update = {
                    'line.width': traces.map(() => 3),
                    'opacity': traces.map(() => 1.0),
                    'marker.size': traces.map(trace => trace.y.map(count => count > 0 ? 12 : 0))
                  };
                  Plotly.restyle('ipTimeseriesPlot', update);
                });
              });
            }, 200);

            // Add time filter button handlers
            document.querySelectorAll('.time-filter-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const days = btn.getAttribute('data-days');
                window.location.href = \`/iptimeseries?days=\${days}\`;
              });
            });

            // Set active button based on current days parameter
            const currentDays = ${days};
            document.querySelectorAll('.time-filter-btn').forEach(btn => {
              btn.classList.remove('active');
              if (parseInt(btn.getAttribute('data-days')) === currentDays) {
                btn.classList.add('active');
              }
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching IP timeseries data from RDS:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error - IP Timeseries</title>
          <style>
            body { padding: 20px; font-family: Arial, sans-serif; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>Error Fetching IP Timeseries Data</h1>
          <p class="error">${error.message}</p>
          <p>Please check your RDS database connection and ip_history_table schema.</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

