const express = require('express');
const { ethers } = require('ethers');
const app = express();
const PORT = 8080;

// zkCandy Smart Chain configuration - using premium RPC
const ZKCANDY_RPC = 'https://zkcandy-mainnet.rpc.thirdweb.com';
const CONTRACT_ADDRESS = '0x023B06cD5C78C56b91bDB51C4a68ad8E5aB58D56';
const ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(ZKCANDY_RPC);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Balance cache with 5 second TTL
const balanceCache = new Map();

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Task verification endpoint
app.get('/v1/okx_task_requirement', async (req, res) => {
  const startTime = process.hrtime();
  
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ code: 1, message: 'Address parameter is required' });
    }

    // Check cache first
    const cacheKey = address.toLowerCase();
    if (balanceCache.has(cacheKey)) {
      const cached = balanceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5000) {
        const duration = process.hrtime(startTime);
        const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
        console.log(`Served cached balance for ${address} in ${ms}ms`);
        return res.json({ code: 0, data: cached.balance > 0 });
      }
    }

    const balance = await contract.balanceOf(address);
    balanceCache.set(cacheKey, { balance, timestamp: Date.now() });
    
    const result = {
      code: 0,
      data: balance > 0
    };
    
    const duration = process.hrtime(startTime);
    const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
    
    console.log(`Processed request for ${address} in ${ms}ms. Balance: ${balance}`);
    res.json(result);
    
  } catch (error) {
    const duration = process.hrtime(startTime);
    const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
    
    console.error(`Error checking balance (${ms}ms):`, error);
    res.status(500).json({ code: 2, message: 'Error checking balance' });
  }
});

app.get('/', (req, res) => {
  res.send('Server test on port 8080');
});

// Export for Vercel
module.exports = app;

// Only listen locally if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on all interfaces at port ${PORT}`);
  }).on('error', (err) => {
    console.error('Server error:', err);
  });
}