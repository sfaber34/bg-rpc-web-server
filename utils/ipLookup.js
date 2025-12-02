const path = require('path');
const axios = require('axios');

// Load .env from the project root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Fetches IP information from ip-api.com PRO service
 * @param {string} ip - The IP address to lookup
 * @returns {Promise<Object>} IP information object
 */
async function lookupIp(ip) {
  try {
    if (!process.env.PRO_IP_KEY) {
      throw new Error('PRO_IP_KEY is not configured in .env file');
    }

    const url = `https://pro.ip-api.com/json/${ip}?key=${process.env.PRO_IP_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });

    if (response.data.status === 'fail') {
      throw new Error(response.data.message || 'IP lookup failed');
    }

    return response.data;
  } catch (error) {
    console.error('Error looking up IP:', ip, error.message);
    throw error;
  }
}

module.exports = { lookupIp };

