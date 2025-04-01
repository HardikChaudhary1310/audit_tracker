// /models/db.js

const mysql = require('mysql2/promise'); // Using the promise wrapper directly
require('dotenv').config(); // Loads .env file for local development (optional on Render)

// --- Database Configuration using Environment Variables ---

// Check if Render provides a DATABASE_URL (common for database addons)
// Format: mysql://user:password@host:port/database
console.log('[DEBUG] DB_HOST from process.env:', process.env.DB_HOST); // <<< ADD THIS LOG
console.log('[DEBUG] DB_USER from process.env:', process.env.DB_USER); // <<< ADD THIS LOG

// --- Database Configuration using Environment Variables ---
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const connectionConfig = {
    // If DATABASE_URL is provided, use it directly
    ...(hasDatabaseUrl && { uri: process.env.DATABASE_URL }),

    // Otherwise, use individual environment variables
    ...(!hasDatabaseUrl && {
        host: process.env.DB_HOST || 'localhost',       // Fallback to localhost for local dev if needed
        user: process.env.DB_USER || 'root',            // Fallback to root
        password: process.env.DB_PASSWORD || '',        // !! NO DEFAULT PASSWORD !! Set in env
        database: process.env.DB_NAME || 'user_activity',// Fallback db name
        port: parseInt(process.env.DB_PORT || '3306', 10), // Ensure port is a number
    }),

    // --- Pooling Options (keep these from your original code) ---
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10), // Allow setting via env
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds
    acquireTimeout: 10000, // 10 seconds

    // --- SSL Configuration (IMPORTANT for remote databases) ---
    // ssl: { /* ... SSL config if needed ... */ }
};

// --- Create the Pool ---
// pool created here using require('mysql2/promise') is already promise-aware
let pool;
try {
    pool = mysql.createPool(connectionConfig);
    console.log('✅ MySQL Pool (Promise-based) configured.');
} catch (error) {
    console.error('❌ FATAL: Error configuring MySQL Pool:', error.message);
    console.error('Current Config:', { ...connectionConfig, password: '[REDACTED]' });
    process.exit(1);
}

// --- Test Connection on Startup (using async/await with the promise pool) ---
// Using an immediately invoked async function expression (IIAFE) for top-level await
(async () => {
    let connection = null;
    try {
        connection = await pool.getConnection();
        console.log('✅ Database connected successfully via pool!');
    } catch (err) {
        console.error('❌ DATABASE CONNECTION FAILED:', err.code, err.message);
        console.error('Connection attempt details:', {
            host: connectionConfig.host || (connectionConfig.uri ? new URL(connectionConfig.uri).hostname : 'N/A'),
            port: connectionConfig.port || (connectionConfig.uri ? new URL(connectionConfig.uri).port : 'N/A'),
            user: connectionConfig.user || (connectionConfig.uri ? new URL(connectionConfig.uri).username : 'N/A'),
            database: connectionConfig.database || (connectionConfig.uri ? new URL(connectionConfig.uri).pathname.substring(1) : 'N/A'),
            ssl_enabled: !!connectionConfig.ssl
        });
        // Consider if the app should exit if DB connection fails
        // process.exit(1);
    } finally {
        if (connection) {
            connection.release(); // Always release the connection
        }
    }
})();


// --- Schema Setup (using the promise pool directly) ---

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Store hashed passwords!
    verified BOOLEAN DEFAULT FALSE,
    userType ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

pool.query(createUsersTable) // Use pool directly
    .then(() => {
        console.log('`users` table checked/created successfully.');
    })
    .catch((err) => {
        console.error('Error creating/checking `users` table:', err);
    });


const createUserPolicyActivityTable = `
CREATE TABLE IF NOT EXISTS user_policy_activity (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    action_type ENUM('VIEW', 'DOWNLOAD', 'CLICK', 'SIGNUP', 'LOGIN') NOT NULL,
    status VARCHAR(50) NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
)`;

pool.query(createUserPolicyActivityTable) // Use pool directly
    .then(() => {
        console.log('`user_policy_activity` table checked/created successfully.');
    })
    .catch((err) => {
        console.error('Error creating/checking `user_policy_activity` table:', err);
    });

// --- Export the Promise Pool ---
// The 'pool' object IS the promise pool when using require('mysql2/promise')
module.exports = pool;