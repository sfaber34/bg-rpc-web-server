const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get("/dashboard", async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3001/dashboard');
    const data = response.data;

    // Escape the data for safe injection into script tag
    const safeData = JSON.stringify(data).replace(/\//g, '\\/').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

    res.send(`
      <html>
        <head>
          <title>RPC Dashboard</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .dashboard-section { margin-bottom: 30px; }
            .dashboard-section h2 { 
              color: #333;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #eee;
            }
            .dashboard { display: flex; flex-wrap: wrap; gap: 20px; }
            .gauge { flex: 1; min-width: 300px; height: 300px; }
          </style>
        </head>
        <body>
          <h1>RPC Dashboard</h1>
          
          <div class="dashboard-section">
            <h2>Performance Metrics</h2>
            <div class="dashboard">
              <div id="gauge1" class="gauge"></div>
              <div id="gauge2" class="gauge"></div>
              <div id="gauge3" class="gauge"></div>
              <div id="gauge4" class="gauge"></div>
              <div id="gauge5" class="gauge"></div>
              <div id="gauge6" class="gauge"></div>
            </div>
          </div>

          <div class="dashboard-section">
            <h2>Response Time Metrics</h2>
            <div class="dashboard">
              <div id="timeGauge1" class="gauge"></div>
              <div id="timeGauge2" class="gauge"></div>
              <div id="timeGauge3" class="gauge"></div>
            </div>
          </div>

          <div class="dashboard-section">
            <h2>Error Metrics</h2>
            <div class="dashboard">
              <div id="errorGauge1" class="gauge"></div>
              <div id="errorGauge2" class="gauge"></div>
              <div id="errorGauge3" class="gauge"></div>
            </div>
          </div>
          
          <script>
            const data = ${safeData};
            
            // Format metric names to be more readable
            function formatMetricName(name) {
              return name
                // Only remove the 'n' prefix if it exists, preserve 'ave'
                .replace(/^n(?!.*ave)/, '')
                // Split on capital letters and numbers
                .match(/[A-Z]{1}[a-z]+|[0-9]+|ave/g)
                .map(word => word === 'ave' ? 'Ave' : word)
                .join(' ');
            }
            
            // Define the order of performance metrics
            const orderedMetrics = [
              'nTotalRequestsLastHour',
              'nCacheRequestsLastHour',
              'nPoolRequestsLastHour',
              'nFallbackRequestsLastHour'
            ];

            // Create performance gauge charts in specified order
            orderedMetrics.forEach((key, index) => {
              if (key in data) {
                const value = data[key];
                const gaugeData = [{
                  type: "indicator",
                  mode: "gauge+number",
                  value: value,
                  title: { 
                    text: formatMetricName(key),
                    font: { size: 22 }
                  },
                  gauge: {
                    axis: { range: [0, 1000] },
                    bar: { 
                      color: key.toLowerCase().includes('total') ? "#1f77b4" :    // Blue for Total
                            key.toLowerCase().includes('cache') ? "#9370db" :     // Purple for Cache
                            key.toLowerCase().includes('pool') ? "#ff7f0e" :      // Orange for Pool
                            "#2ca02c"                                            // Green for Fallback
                    },
                    bgcolor: "white",
                    borderwidth: 2,
                    bordercolor: "#ccc",
                  }
                }];
                
                const layout = {
                  margin: { t: 50, b: 25, l: 25, r: 25 },
                  paper_bgcolor: "white",
                  font: { size: 12 }
                };
                
                Plotly.newPlot("gauge" + (index + 1), gaugeData, layout);
              }
            });

            // Create time-based gauge charts
            const timeMetrics = [
              'aveCacheRequestTimeLastHour',
              'avePoolRequestTimeLastHour',
              'aveFallbackRequestTimeLastHour'
            ];

            timeMetrics.forEach((key, index) => {
              const value = data[key] || 0;
              const gaugeData = [{
                type: "indicator",
                mode: "gauge+number",
                value: value,
                title: { 
                  text: formatMetricName(key),
                  font: { size: 22 }
                },
                gauge: {
                  axis: { range: [0, 300] },  // Range for milliseconds
                  bar: { 
                    color: key.toLowerCase().includes('cache') ? "#9370db" :     // Purple for Cache
                           key.toLowerCase().includes('pool') ? "#ff7f0e" :      // Orange for Pool
                           "#2ca02c"                                            // Green for Fallback
                  },
                  bgcolor: "white",
                  borderwidth: 2,
                  bordercolor: "#ccc",
                }
              }];
              
              const layout = {
                margin: { t: 50, b: 25, l: 25, r: 25 },
                paper_bgcolor: "white",
                font: { size: 12 }
              };
              
              Plotly.newPlot("timeGauge" + (index + 1), gaugeData, layout);
            });

            // Create error gauge charts
            const errorMetrics = [
              'nErrorCacheRequestsLastHour',
              'nErrorPoolRequestsLastHour',
              'nErrorFallbackRequestsLastHour'
            ];

            errorMetrics.forEach((key, index) => {
              const value = data[key] || 0;
              const gaugeData = [{
                type: "indicator",
                mode: "gauge+number",
                value: value,
                title: { 
                  text: formatMetricName(key),
                  font: { size: 22 }
                },
                gauge: {
                  axis: { range: [0, 50] },  // Adjusted range for error metrics
                  bar: { 
                    color: key.toLowerCase().includes('cache') ? "#9370db" :     // Purple for Cache
                           key.toLowerCase().includes('pool') ? "#ff7f0e" :      // Orange for Pool
                           "#2ca02c"                                            // Green for Fallback
                  },
                  bgcolor: "white",
                  borderwidth: 2,
                  bordercolor: "#ccc",
                }
              }];
              
              const layout = {
                margin: { t: 50, b: 25, l: 25, r: 25 },
                paper_bgcolor: "white",
                font: { size: 12 }
              };
              
              Plotly.newPlot("errorGauge" + (index + 1), gaugeData, layout);
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).send('Error loading dashboard');
  }
});

module.exports = router;