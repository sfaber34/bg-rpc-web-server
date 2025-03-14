const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const fs = require('fs');

require('dotenv').config();

const { logsPort } = require('../config');

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  cert: fs.readFileSync('/home/ubuntu/shared/server.cert'),
  key: fs.readFileSync('/home/ubuntu/shared/server.key')
});

router.get("/dashboard", async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.HOST}:${logsPort}/dashboard`, {
      httpsAgent
    });
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
            #time-series-section {
              height: 100vh;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              box-sizing: border-box;
            }
            #time-series-section h2 {
              margin-top: 0;
            }
            #time-series-section .hist-plot {
              flex: 1;
              height: calc((100vh - 150px) / 3);
              margin-bottom: 10px;
            }
            #time-series-section .time-filter-buttons {
              margin-bottom: 15px;
            }
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
            <h2>Warning Metrics</h2>
            <div class="dashboard">
              <div id="warningGauge1" class="gauge"></div>
              <div id="warningGauge2" class="gauge"></div>
              <div id="warningGauge3" class="gauge"></div>
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
            <h2>Response Time Metrics</h2>
            <div class="dashboard">
              <div id="timeGauge1" class="gauge"></div>
              <div id="timeGauge2" class="gauge"></div>
              <div id="timeGauge3" class="gauge"></div>
            </div>
          </div>

          <div class="dashboard-section" id="time-series-section">
            <h2>Hourly Request History</h2>
            <div class="time-filter-buttons" style="margin-bottom: 15px; text-align: left;">
              <button class="time-filter-btn" data-range="1">1 Day</button>
              <button class="time-filter-btn" data-range="7">1 Week</button>
              <button class="time-filter-btn" data-range="14">2 Weeks</button>
              <button class="time-filter-btn" data-range="30">1 Month</button>
              <button class="time-filter-btn" data-range="all">All</button>
            </div>
            <div id="requestHistoryPlot" class="hist-plot"></div>
            <div id="warningHistoryPlot" class="hist-plot"></div>
            <div id="errorHistoryPlot" class="hist-plot"></div>
          </div>

          <div class="dashboard-section">
            <h2>Request Duration Distribution</h2>
            <div id="methodDurationHist" class="hist-plot"></div>
            <div id="originDurationHist" class="hist-plot"></div>
            <div id="nodeDurationHist" class="hist-plot"></div>
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

            // Calculate shared range based on total requests
            const totalValue = data['nTotalRequestsLastHour'] || 0;
            const sharedMaxValue = Math.max(totalValue * 2, 100); // Dynamic range that's at least 100

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
                  axis: { range: [0, sharedMaxValue] },
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
                    axis: { range: [0, sharedMaxValue] },
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

            // Create warning gauge charts
            const warningMetrics = [
              'nWarningCacheRequestsLastHour',
              'nWarningPoolRequestsLastHour',
              'nWarningFallbackRequestsLastHour'
            ];

            warningMetrics.forEach((key, index) => {
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
                  axis: { range: [0, sharedMaxValue] },
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
              
              Plotly.newPlot("warningGauge" + (index + 1), gaugeData, layout);
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
                  axis: { range: [0, sharedMaxValue] },
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

            // Add Node Duration Distribution histogram
            if (data.nodeDurationHist) {
              const nodeTraces = Object.entries(data.nodeDurationHist).map(([node, distribution], index) => {
                const color = colors[index % colors.length];
                const solidColor = solidColors[index % solidColors.length];
                return {
                  type: 'box',
                  x: Array(5).fill(node),
                  y: Object.values(distribution),
                  name: node,
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

              const nodeLayout = {
                title: {
                  text: 'Node Duration Distribution (ms)',
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
                annotations: Object.keys(data.nodeDurationHist).map((node, index) => ({
                  x: node,
                  y: -0.1,
                  text: node,
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

              Plotly.newPlot('nodeDurationHist', nodeTraces, nodeLayout);
            }

            // Create request history line plot
            if (data.requestHistory) {
              // Function to update time range for all plots
              function updateTimeRange(days) {
                const now = new Date();
                let startDate = days === 'all' ? null : new Date(now - (days * 24 * 60 * 60 * 1000));
                
                // Update button styles
                document.querySelectorAll('.time-filter-btn').forEach(btn => {
                  btn.classList.remove('active');
                  if ((btn.dataset.range === days.toString()) || (days === 'all' && btn.dataset.range === 'all')) {
                    btn.classList.add('active');
                  }
                });

                const newRange = days === 'all' ? 
                  [data.requestHistory[0].hourMs, now] : 
                  [startDate, now];

                ['requestHistoryPlot', 'warningHistoryPlot', 'errorHistoryPlot'].forEach(plotId => {
                  const plot = document.getElementById(plotId);
                  
                  // Get the visible traces data within the new time range
                  const startTime = new Date(newRange[0]).getTime();
                  const endTime = new Date(newRange[1]).getTime();
                  
                  // Calculate y-axis range based on visible data
                  let yMin = Infinity;
                  let yMax = -Infinity;
                  
                  plot.data.forEach(trace => {
                    trace.x.forEach((x, i) => {
                      const xTime = new Date(x).getTime();
                      if (xTime >= startTime && xTime <= endTime) {
                        const y = trace.y[i];
                        if (y !== null && y !== undefined) {
                          yMin = Math.min(yMin, y);
                          yMax = Math.max(yMax, y);
                        }
                      }
                    });
                  });
                  
                  // Add 10% padding to y-axis range for better visualization
                  const yRange = yMax - yMin;
                  const yPadding = yRange * 0.1;
                  yMin = Math.max(0, yMin - yPadding); // Ensure we don't go below 0
                  yMax = yMax + yPadding;

                  Plotly.relayout(plotId, {
                    'xaxis.range': newRange,
                    'yaxis.range': [yMin, yMax],
                    'yaxis.autorange': false
                  });
                });
              }

              // Add click handlers to time filter buttons
              document.querySelectorAll('.time-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                  const range = btn.dataset.range;
                  updateTimeRange(range === 'all' ? 'all' : parseInt(range));
                });
              });

              const traces = [
                {
                  name: 'Cache Requests',
                  x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                  y: data.requestHistory.map(entry => entry.nCacheRequestsSuccess),
                  type: 'scatter',
                  mode: 'lines',
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
                  mode: 'lines',
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
                  mode: 'lines',
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

              // Set initial time range to all data
              const now = new Date();
              const initialStartDate = new Date(data.requestHistory[0].hourMs);
              successLayout.xaxis.range = [initialStartDate, now];

              Plotly.newPlot('requestHistoryPlot', traces, successLayout).then(gd => {
                // Create warning request history line plot with matching x-axis range
                const warningTraces = [
                  {
                    name: 'Cache Warnings',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nCacheRequestsWarning),
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                      color: '#9370db',  // Purple for Cache
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  },
                  {
                    name: 'Pool Warnings',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nPoolRequestsWarning),
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                      color: '#ff7f0e',  // Orange for Pool
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  },
                  {
                    name: 'Fallback Warnings',
                    x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                    y: data.requestHistory.map(entry => entry.nFallbackRequestsWarning),
                    type: 'scatter',
                    mode: 'lines',
                    line: {
                      color: '#2ca02c',  // Green for Fallback
                      width: 2
                    },
                    marker: {
                      size: 8
                    }
                  }
                ];

                const warningLayout = {
                  ...sharedLayoutConfig,
                  title: {
                    text: 'Warning Requests per Hour',
                    font: { size: 22 }
                  },
                  xaxis: {
                    ...sharedLayoutConfig.xaxis,
                    range: [initialStartDate, now]  // Use the same initial range
                  },
                  yaxis: {
                    title: 'Number of Warnings',
                    type: 'linear'
                  }
                };

                Plotly.newPlot('warningHistoryPlot', warningTraces, warningLayout).then(() => {
                  // Create error request history line plot with matching x-axis range
                  const errorTraces = [
                    {
                      name: 'Cache Errors',
                      x: data.requestHistory.map(entry => new Date(entry.hourMs)),
                      y: data.requestHistory.map(entry => entry.nCacheRequestsError),
                      type: 'scatter',
                      mode: 'lines',
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
                      mode: 'lines',
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
                      mode: 'lines',
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
                      range: [initialStartDate, now]  // Use the same initial range
                    },
                    yaxis: {
                      title: 'Number of Errors',
                      type: 'linear'
                    }
                  };

                  Plotly.newPlot('errorHistoryPlot', errorTraces, errorLayout).then(() => {
                    // Set initial active button to "All Data"
                    document.querySelector('.time-filter-btn[data-range="1"]').classList.remove('active');
                    document.querySelector('.time-filter-btn[data-range="all"]').classList.add('active');

                    // Calculate and set initial y-axis ranges based on all data
                    updateTimeRange('all');

                    // Function to sync plots
                    function syncPlots(sourceId, eventData) {
                      if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
                        const newRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
                        const plots = ['requestHistoryPlot', 'warningHistoryPlot', 'errorHistoryPlot'];
                        
                        plots.forEach(plotId => {
                          if (plotId !== sourceId) {
                            Plotly.relayout(plotId, {
                              'xaxis.range': newRange
                            });
                          }
                        });
                      }
                    }

                    // Add event listeners
                    document.getElementById('requestHistoryPlot').on('plotly_relayout', 
                      eventData => syncPlots('requestHistoryPlot', eventData));
                    document.getElementById('warningHistoryPlot').on('plotly_relayout', 
                      eventData => syncPlots('warningHistoryPlot', eventData));
                    document.getElementById('errorHistoryPlot').on('plotly_relayout', 
                      eventData => syncPlots('errorHistoryPlot', eventData));
                  });
                });
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