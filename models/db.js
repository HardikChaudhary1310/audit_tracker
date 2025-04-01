// db.js
const { Pool } = require('pg'); // Use the pg library

// Determine if SSL should be enabled based on the environment
// Render automatically sets NODE_ENV to 'production'
const isProduction = process.env.NODE_ENV === 'production';

console.log(`Node Environment: ${process.env.NODE_ENV}, Production mode: ${isProduction}`);

// Base configuration
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
};

// Add SSL configuration ONLY for production (Render)
if (isProduction) {
    poolConfig.ssl = {
        rejectUnauthorized: false // Required for Render database connections
    };
    console.log('Applying SSL configuration for production environment.');
} else {
    console.log('Skipping SSL configuration for non-production environment.');
}


// Create a PostgreSQL pool using the determined configuration
const pool = new Pool(poolConfig);


// Optional: Add basic error handling for the pool
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    process.exit(-1); // Exit the process if pool errors occur
});

console.log('🐘 PostgreSQL Pool created. Connecting...');

// Test the connection (optional but good practice)
pool.connect((err, client, release) => {
  if (err) {
    // Log the specific connection error
    return console.error('❌ Error acquiring PostgreSQL client during initial test', err); // Added context
  }
  console.log('✅ Successfully connected to PostgreSQL database!');
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release the client back to the pool
    if (err) {
      return console.error('❌ Error executing test query', err.stack);
    }
    // Check if result and rows exist before accessing
    if (result && result.rows && result.rows.length > 0) {
        console.log('🕒 PostgreSQL current time:', result.rows[0].now);
    } else {
        console.log('🕒 Test query executed, but no time returned.');
    }
  });
});


// Export the pool directly.
module.exports = pool;