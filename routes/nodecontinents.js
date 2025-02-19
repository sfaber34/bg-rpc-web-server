const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

router.get("/nodecontinents", async (req, res) => {
  try {
    const response = await axios.get('https://localhost:3003/nodeContinents', {
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false
      })
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching node continents:', error);
    res.status(500).json({ error: 'Failed to fetch node continents data' });
  }
});

module.exports = router;