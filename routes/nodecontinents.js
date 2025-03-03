const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

require('dotenv').config();

const { poolPort } = require('../config');

router.get("/nodecontinents", async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.HOST}:${poolPort}/nodeContinents`, {
      httpsAgent: new https.Agent({  
        rejectUnauthorized: true
      })
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching node continents:', error);
    res.status(500).json({ error: 'Failed to fetch node continents data' });
  }
});

module.exports = router;