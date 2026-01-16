const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory (root of monorepo)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  adminKey: process.env.ADMIN_KEY,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN,
  port: process.env.PORT || 3000,
  enableHelmet: true,
  isDbConfigured: !!process.env.DATABASE_URL
};

module.exports = config;
