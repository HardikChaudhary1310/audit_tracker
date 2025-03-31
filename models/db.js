// models/db.js
require('dotenv').config(); // For local dev, ignored by Render mostly
const mysql = require('mysql2');

const dbUrlString = process.env.DATABASE_URL; // Get URL from environment

// Add extra logging for Render debugging:
console.log(`[DB Setup] DATABASE_URL from environment: ${dbUrlString ? 'SET' : 'NOT SET'}`);
if (process.env.NODE_ENV) {
    console.log(`[DB Setup] NODE_ENV: ${process.env.NODE_ENV}`);
}

let dbConfig = {};

if (!dbUrlString) {
    console.error("[DB Setup] FATAL ERROR: DATABASE_URL environment variable is not set.");
    // Fallback ONLY if explicitly NOT in production - but even then it's risky
    if (process.env.NODE_ENV !== 'production') {
        console.warn("[DB Setup] Falling back to LOCALHOST (DEVELOPMENT ONLY!)");
        // THIS SHOULD NOT BE REACHED ON RENDER if DATABASE_URL is set
        dbConfig = {
            host: '127.0.0.1', // Local fallback
            user: 'root',      // Local fallback
            password: 'Hardik@12345', // Local fallback - use your actual local password here
            database: 'user_activity', // Local fallback
            port: 3306,
            waitForConnections: true, connectionLimit: 10, queueLimit: 0
        };
    } else {
         // In production, exit if DATABASE_URL is missing
         process.exit(1);
    }

} else {
     // Parse the DATABASE_URL from Render's environment
    try {
        const dbUrl = new URL(dbUrlString);
        dbConfig = {
            host: dbUrl.hostname, // Host from the URL
            user: dbUrl.username, // User from the URL
            password: dbUrl.password, // Password from the URL
            database: dbUrl.pathname.slice(1), // Database name from the URL path
            port: dbUrl.port || 3306, // Port from the URL or default 3306
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
             // IMPORTANT: Render MySQL often requires SSL. Check your Render DB connection details.
             // ssl: { rejectUnauthorized: false } // Add this if needed based on Render docs/settings
        };
         console.log(`[DB Setup] Parsed DB Config (Password Masked): host=${dbConfig.host}, user=${dbConfig.user}, database=${dbConfig.database}, port=${dbConfig.port}`);
    } catch (e) {
         console.error("[DB Setup] FATAL ERROR: Could not parse DATABASE_URL:", e);
         process.exit(1);
    }
}

// Create the pool using the determined dbConfig
const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// ... rest of db.js (testing connection, table creation, export) ...

 // Test connection (optional, but good practice - logs might show specific errors)
promisePool.getConnection()
  .then(connection => {
    console.log('[DB Setup] Successfully connected to the database via pool.');
    connection.release();
  })
  .catch(err => {
    console.error('[DB Setup] !!! Error connecting to the database via pool:');
    // Log the config being used (mask password)
    console.error('[DB Setup] Using DB config:', { ...dbConfig, password: '***' });
    console.error(err); // Log the full connection error
  });

module.exports = promisePool; // Export the promise pool