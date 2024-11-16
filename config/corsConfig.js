const cors = require('cors');

const corsConfig = cors({
  origin: 'http://localhost:5173',
});

module.exports = corsConfig;
