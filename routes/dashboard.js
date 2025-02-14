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
            body { font-family: Arial, sans-serif; margin: 0; }
            .dashboard-section { margin-bottom: 30px; padding: 0px 20px; }
            .dashboard-section h2 { 
              color: #333;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #eee;
            }
            .dashboard { display: flex; flex-wrap: wrap; gap: 20px; }
            .gauge { flex: 1; min-width: 300px; height: 300px; }
            .hist-plot { width: 100%; height: 500px; margin-bottom: 20px; }
            h1 { padding: 0px 20px; }
          </style>
        </head>
        <body>
          <h1>Dashboard</h1>
          
          <div class="dashboard-section">
            <h2>Total Requests</h2>
            <div class="dashboard">
              <div id="totalGauge" class="gauge"></div>
            </div>
          </div>

          <div class="dashboard-section">
            <h2>Request Source Metrics</h2>
            <div class="dashboard">
              <div id="gauge2" class="gauge"></div>
              <div id="gauge3" class="gauge"></div>
              <div id="gauge4" class="gauge"></div>
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

          <div class="dashboard-section">
            <h2>Request Duration Distribution</h2>
            <div id="methodDurationHist" class="hist-plot"></div>
            <div id="originDurationHist" class="hist-plot"></div>
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
              'nTotalRequestsLastHour'
            ];

            // Create total requests gauge
            if ('nTotalRequestsLastHour' in data) {
              const value = data['nTotalRequestsLastHour'];
              const gaugeData = [{
                type: "indicator",
                mode: "gauge+number",
                value: value,
                title: { 
                  text: formatMetricName('nTotalRequestsLastHour'),
                  font: { size: 22 }
                },
                gauge: {
                  axis: { range: [0, 1000] },
                  bar: { color: "#1f77b4" },    // Blue for Total
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
              
              Plotly.newPlot("totalGauge", gaugeData, layout);
            }

            // Define source metrics
            const sourceMetrics = [
              'nCacheRequestsLastHour',
              'nPoolRequestsLastHour',
              'nFallbackRequestsLastHour'
            ];

            // Create source metrics gauge charts
            sourceMetrics.forEach((key, index) => {
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
                
                Plotly.newPlot("gauge" + (index + 2), gaugeData, layout);
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

            // Create histogram bar charts for duration distributions
            console.log('Full dashboard data:', data);
            console.log('Method Duration Histogram:', data.methodDurationHist);
            console.log('Origin Duration Histogram:', data.originDurationHist);

            if (data.methodDurationHist) {
              const methodTrace = {
                type: 'box',
                x: [],
                y: [],
                boxpoints: false,
                name: 'Method Duration',
                marker: {
                  color: '#1f77b4'
                }
              };

              // For each method, add the method name multiple times (once for each percentile)
              // and add the corresponding percentile values
              Object.entries(data.methodDurationHist).forEach(([method, distribution]) => {
                // Add the method name 5 times (one for each percentile)
                methodTrace.x.push(...Array(5).fill(method));
                // Add the percentile values
                methodTrace.y.push(...Object.values(distribution));
              });

              console.log('Method Trace:', methodTrace);

              const methodLayout = {
                title: {
                  text: 'Method Duration Distribution (ms)',
                  font: { size: 22 }
                },
                xaxis: {
                  title: 'Method',
                  tickangle: -45
                },
                yaxis: {
                  title: 'Duration (ms)',
                  type: 'log'  // Using log scale since durations can vary widely
                },
                margin: { t: 50, b: 120, l: 50, r: 25 },  // Increased bottom margin for rotated labels
                paper_bgcolor: "white",
                font: { size: 12 },
                showlegend: false
              };

              Plotly.newPlot('methodDurationHist', [methodTrace], methodLayout);
            }

            if (data.originDurationHist) {
              const originTrace = {
                type: 'box',
                x: [],
                y: [],
                boxpoints: false,
                name: 'Origin Duration',
                marker: {
                  color: '#ff7f0e'
                }
              };

              // For each origin, add the origin name multiple times (once for each percentile)
              // and add the corresponding percentile values
              Object.entries(data.originDurationHist).forEach(([origin, distribution]) => {
                // Add the origin name 5 times (one for each percentile)
                originTrace.x.push(...Array(5).fill(origin));
                // Add the percentile values
                originTrace.y.push(...Object.values(distribution));
              });

              console.log('Origin Trace:', originTrace);

              const originLayout = {
                title: {
                  text: 'Origin Duration Distribution (ms)',
                  font: { size: 22 }
                },
                xaxis: {
                  title: 'Origin',
                  tickangle: -45
                },
                yaxis: {
                  title: 'Duration (ms)',
                  type: 'log'  // Using log scale since durations can vary widely
                },
                margin: { t: 50, b: 120, l: 50, r: 25 },  // Increased bottom margin for rotated labels
                paper_bgcolor: "white",
                font: { size: 12 },
                showlegend: false
              };

              Plotly.newPlot('originDurationHist', [originTrace], originLayout);
            }
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