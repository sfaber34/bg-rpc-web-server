const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

require('dotenv').config();

const { poolPort } = require('../config');

router.get("/yournodes", async (req, res) => {
  try {
    // Extract owner parameter from query string
    const owner = req.query.owner;
    
    if (!owner) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'Owner address is required. Use /yournodes?owner=0xYourAddress' 
      });
    }

    // Forward request to pool.js with owner parameter
    const response = await axios.get(`https://${process.env.HOST}:${poolPort}/yournodes?owner=${owner}`, {
      httpsAgent: new https.Agent({  
        rejectUnauthorized: true
      })
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching your nodes data:', error);
    
    // Check if error response from pool.js
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    
    res.status(500).json({ error: 'Failed to fetch your nodes data' });
  }
});

module.exports = router;