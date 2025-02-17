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
            .hist-plot { width: 100%; height: 800px; margin-bottom: 20px; }
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
            <h2>Hourly Request History</h2>
            <div id="requestHistoryPlot" class="hist-plot"></div>
            <div id="errorHistoryPlot" class="hist-plot"></div>
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

            // Define a color palette for the traces
            const colors = [
              'rgba(31, 119, 180, 0.5)',  // blue
              'rgba(255, 127, 14, 0.5)',  // orange
              'rgba(44, 160, 44, 0.5)',   // green
              'rgba(214, 39, 40, 0.5)',   // red
              'rgba(148, 103, 189, 0.5)', // purple
              'rgba(140, 86, 75, 0.5)',   // brown
              'rgba(227, 119, 194, 0.5)', // pink
              'rgba(127, 127, 127, 0.5)', // gray
              'rgba(188, 189, 34, 0.5)',  // yellow-green
              'rgba(23, 190, 207, 0.5)'   // cyan
            ];

            // Define solid colors for lines
            const solidColors = [
              'rgb(31, 119, 180)',  // blue
              'rgb(255, 127, 14)',  // orange
              'rgb(44, 160, 44)',   // green
              'rgb(214, 39, 40)',   // red
              'rgb(148, 103, 189)', // purple
              'rgb(140, 86, 75)',   // brown
              'rgb(227, 119, 194)', // pink
              'rgb(127, 127, 127)', // gray
              'rgb(188, 189, 34)',  // yellow-green
              'rgb(23, 190, 207)'   // cyan
            ];

            if (data.methodDurationHist) {
              const methodTraces = Object.entries(data.methodDurationHist).map(([method, distribution], index) => {
                const color = colors[index % colors.length];
                const solidColor = solidColors[index % solidColors.length];
                return {
                  type: 'box',
                  x: Array(5).fill(method),
                  y: Object.values(distribution),
                  name: method,
                  boxpoints: false,
                  fillcolor: color,
                  line: {
                    width: 2,
                    color: solidColor
                  },
                  median: {
                    color: 'rgb(0,0,0)',
                    width: 8
                  }
                };
              });

              const methodLayout = {
                title: {
                  text: 'Method Duration Distribution (ms)',
                  font: { size: 22 }
                },
                xaxis: {
                  title: '',
                  tickangle: -45,
                  showticklabels: false,
                  tickfont: {
                    size: 12
                  }
                },
                yaxis: {
                  title: 'Duration (ms)',
                  type: 'linear'
                },
                annotations: Object.keys(data.methodDurationHist).map((method, index) => ({
                  x: method,
                  y: -0.1,
                  text: method,
                  textangle: -45,
                  showarrow: false,
                  xanchor: 'right',
                  yanchor: 'middle',
                  font: {
                    size: 12,
                    color: solidColors[index % solidColors.length]
                  },
                  xref: 'x',
                  yref: 'paper'
                })),
                margin: { t: 50, b: 120, l: 50, r: 25 },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
                font: { size: 12 },
                showlegend: false
              };

              Plotly.newPlot('methodDurationHist', methodTraces, methodLayout);
            }

            if (data.originDurationHist) {
              const originTraces = Object.entries(data.originDurationHist).map(([origin, distribution], index) => {
                const color = colors[index % colors.length];
                const solidColor = solidColors[index % solidColors.length];
                return {
                  type: 'box',
                  x: Array(5).fill(origin),
                  y: Object.values(distribution),
                  name: origin,
                  boxpoints: false,
                  fillcolor: color,
                  line: {
                    width: 2,
                    color: solidColor
                  },
                  median: {
                    color: 'rgb(0,0,0)',
                    width: 8
                  }
                };
              });

              const originLayout = {
                title: {
                  text: 'Origin Duration Distribution (ms)',
                  font: { size: 22 }
                },
                xaxis: {
                  title: '',
                  tickangle: -45,
                  showticklabels: false,
                  tickfont: {
                    size: 12
                  }
                },
                yaxis: {
                  title: 'Duration (ms)',
                  type: 'linear'
                },
                annotations: Object.keys(data.originDurationHist).map((origin, index) => ({
                  x: origin,
                  y: -0.1,
                  text: origin,
                  textangle: -45,
                  showarrow: false,
                  xanchor: 'right',
                  yanchor: 'middle',
                  font: {
                    size: 12,
                    color: solidColors[index % solidColors.length]
                  },
                  xref: 'x',
                  yref: 'paper'
                })),
                margin: { t: 50, b: 120, l: 50, r: 25 },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
                font: { size: 12 },
                showlegend: false
              };

              Plotly.newPlot('originDurationHist', originTraces, originLayout);
            }

            // Create request history line plot
            if (data.requestHistory) {
              const traces = [
                {
                  name: 'Cache Requests',
                  x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                  y: data.requestHistory.map(entry => entry.nCacheRequestsSuccess),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: {
                    color: '#9370db',  // Purple for Cache
                    width: 2
                  },
                  marker: {
                    size: 8
                  }
                },
                {
                  name: 'Pool Requests',
                  x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                  y: data.requestHistory.map(entry => entry.nPoolRequestsSuccess),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: {
                    color: '#ff7f0e',  // Orange for Pool
                    width: 2
                  },
                  marker: {
                    size: 8
                  }
                },
                {
                  name: 'Fallback Requests',
                  x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                  y: data.requestHistory.map(entry => entry.nFallbackRequestsSuccess),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: {
                    color: '#2ca02c',  // Green for Fallback
                    width: 2
                  },
                  marker: {
                    size: 8
                  }
                }
              ];

              // Define shared layout properties
              const sharedLayoutConfig = {
                xaxis: {
                  title: 'Time',
                  type: 'date',
                  tickformat: '%Y-%m-%d %H:%M',
                  tickangle: -45
                },
                margin: { t: 50, b: 120, l: 50, r: 25 },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
                font: { size: 12 },
                showlegend: true,
                legend: {
                  orientation: 'h',
                  y: -0.2
                }
              };

              const successLayout = {
                ...sharedLayoutConfig,
                title: {
                  text: 'Successful Requests per Hour',
                  font: { size: 22 }
                },
                yaxis: {
                  title: 'Number of Requests',
                  type: 'linear'
                }
              };

              Plotly.newPlot('requestHistoryPlot', traces, successLayout).then(gd => {
                // Create error request history line plot with matching x-axis range
                const errorTraces = [
                  {
                    name: 'Cache Errors',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nCacheRequestsError),
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: {
                      color: '#9370db',  // Purple for Cache
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  },
                  {
                    name: 'Pool Errors',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nPoolRequestsError),
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: {
                      color: '#ff7f0e',  // Orange for Pool
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  },
                  {
                    name: 'Fallback Errors',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nFallbackRequestsError),
                    type: 'scatter',
                    mode: 'lines+markers',
                    line: {
                      color: '#2ca02c',  // Green for Fallback
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  }
                ];

                const errorLayout = {
                  ...sharedLayoutConfig,
                  title: {
                    text: 'Error Requests per Hour',
                    font: { size: 22 }
                  },
                  xaxis: {
                    ...sharedLayoutConfig.xaxis,
                    range: gd.layout.xaxis.range  // Use the range from the success plot
                  },
                  yaxis: {
                    title: 'Number of Errors',
                    type: 'linear'
                  }
                };

                Plotly.newPlot('errorHistoryPlot', errorTraces, errorLayout);
              });
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