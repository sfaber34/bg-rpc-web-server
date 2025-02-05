const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get("/dashboard", async (req, res) => {
  try {
    const response = await axios.get('http://localhost:3001/dashboard');
    const data = response.data;

    res.send(`
      <html>
        <head>
          <title>RPC Dashboard</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .dashboard { display: flex; flex-wrap: wrap; gap: 20px; }
            .gauge { flex: 1; min-width: 300px; height: 250px; }
          </style>
        </head>
        <body>
          <h1>RPC Dashboard</h1>
          <div class="dashboard">
            <div id="gauge1" class="gauge"></div>
            <div id="gauge2" class="gauge"></div>
            <div id="gauge3" class="gauge"></div>
          </div>
          
          <script>
            const data = ${JSON.stringify(data)};
            
            // Create gauge charts for each metric
            Object.entries(data).forEach(([key, value], index) => {
              const gaugeData = [{
                type: "indicator",
                mode: "gauge+number",
                value: value,
                title: { text: key },
                gauge: {
                  axis: { range: [0, 100] },
                  bar: { color: "#1f77b4" },
                  bgcolor: "white",
                  borderwidth: 2,
                  bordercolor: "#ccc",
                }
              }];
              
              const layout = {
                margin: { t: 25, b: 25, l: 25, r: 25 },
                paper_bgcolor: "white",
                font: { size: 12 }
              };
              
              Plotly.newPlot(\`gauge\${index + 1}\`, gaugeData, layout);
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