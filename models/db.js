// /models/db.js

const { Pool } = require('pg'); // Use pg Pool
require('dotenv').config();

// --- Database Configuration using Environment Variables ---
// pg library natively supports DATABASE_URL
const connectionString = process.env.DATABASE_URL;

// Alternative config using individual variables (less common with pg)
// const config = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: parseInt(process.env.DB_PORT || '5432', 10), // Default PG port is 5432
//   // --- SSL Configuration for PostgreSQL on Render ---
//   // Render usually requires SSL for external connections,
//   // and often manages internal connections securely.
//   // The connection string often includes sslmode=require
//   ssl: {
//     rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' // Recommended
//   }
// };

if (!connectionString) {
    console.error('❌ FATAL: DATABASE_URL environment variable is not set!');
    process.exit(1);
}

// --- Create the Pool ---
let pool;
try {
    pool = new Pool({
        connectionString: connectionString,
        // Add SSL requirement if not included in the connection string Render provides
        // ssl: { rejectUnauthorized: false } // Use this cautiously if needed
    });
    console.log('✅ PostgreSQL Pool configured.');

    // --- Test Connection on Startup ---
    pool.connect((err, client, release) => {
        if (err) {
            console.error('❌ DATABASE CONNECTION FAILED:', err.message);
            console.error('Connection attempt details:', { connectionString: connectionString ? 'Set' : 'Not Set' });
            // process.exit(1); // Optional: exit if critical
            return;
        }
        console.log('✅ Database connected successfully via pool!');
        release(); // Release the client back to the pool
    });

} catch (error) {
    console.error('❌ FATAL: Error configuring PostgreSQL Pool:', error.message);
    process.exit(1);
}

// --- Schema Setup (PostgreSQL Syntax) ---
// Note: SQL syntax might need slight adjustments for PostgreSQL

// IMPORTANT: PostgreSQL uses different syntax for AUTO_INCREMENT (SERIAL)
// and doesn't typically use backticks for identifiers.
// Also adjust ENUM syntax if needed or use VARCHAR/CHECK constraints.
// models/db.js (Schema Setup section)

// ... (pool setup code above) ...

// --- Schema Setup (Ensure Order) ---

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    "userType" VARCHAR(10) DEFAULT 'user' CHECK ("userType" IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`;

const createUserPolicyActivityTable = `
CREATE TABLE IF NOT EXISTS user_policy_activity (
    activity_id SERIAL PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('VIEW', 'DOWNLOAD', 'CLICK', 'SIGNUP', 'LOGIN')),
    status VARCHAR(50) NULL,
    "timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
)`;

// Chain the promises: Execute users table creation, THEN activity table creation
pool.query(createUsersTable)
    .then(() => {
        console.log('"users" table checked/created successfully.');
        // Only attempt to create the activity table AFTER users table is done
        return pool.query(createUserPolicyActivityTable); // Return the next promise
    })
    .then(() => {
        console.log('"user_policy_activity" table checked/created successfully.');
    })
    .catch((err) => {
        // This will catch errors from EITHER query
        console.error('Error during table creation:', err);
    });

// --- Export the Pool ---
module.exports = pool;