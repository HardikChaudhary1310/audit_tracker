// db.js
const { Pool } = require('pg'); // Use the pg library

// Create a PostgreSQL pool using the DATABASE_URL environment variable
// This is the standard way to connect in environments like Render/Heroku
// Ensure DATABASE_URL is set correctly in your .env file (for local)
// and in Render's environment variables (for deployment).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Optional: Add SSL configuration if required by your provider (Render often needs it)
    // ssl: {
    //   rejectUnauthorized: false // Adjust based on provider requirements
    // }
});

// Optional: Add basic error handling for the pool
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    process.exit(-1); // Exit the process if pool errors occur
});

console.log('🐘 PostgreSQL Pool created. Connecting...');

// Test the connection (optional but good practice)
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring PostgreSQL client', err.stack);
  }
  console.log('✅ Successfully connected to PostgreSQL database!');
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release the client back to the pool
    if (err) {
      return console.error('❌ Error executing test query', err.stack);
    }
    console.log('🕒 PostgreSQL current time:', result.rows[0].now);
  });
});


// Export the pool directly. The 'pg' driver methods (like pool.query)
// return promises natively, so no need for .promise() wrapper.
module.exports = pool;