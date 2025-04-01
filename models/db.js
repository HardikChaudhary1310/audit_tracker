const mysql = require('mysql2');
require('dotenv').config(); // Loads .env file for local development (optional on Render)

// --- Database Configuration using Environment Variables ---

// Check if Render provides a DATABASE_URL (common for database addons)
// Format: mysql://user:password@host:port/database
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
        port: process.env.DB_PORT || 3306,              // Default MySQL port
    }),

    // --- Pooling Options (keep these from your original code) ---
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10), // Allow setting via env
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds
    acquireTimeout: 10000, // 10 seconds
    // keepAlive: true, // Often managed by pool settings implicitly

    // --- SSL Configuration (IMPORTANT for remote databases) ---
    // Uncomment and configure if your database provider requires SSL
    // ssl: {
    //   // Set to true to require SSL, false to disable (not recommended for remote)
    //   require: process.env.DB_SSL_REQUIRE === 'true', // Example using env var
    //
    //   // Set to true to reject connections with invalid certs (recommended)
    //   rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false', // Default true
    //
    //   // Example: Provide CA certificate if needed (path relative to where app runs)
    //   // ca: fs.readFileSync(process.env.DB_SSL_CA_PATH),
    // }
};

// --- Create the Pool ---
let pool;
try {
    pool = mysql.createPool(connectionConfig);
    console.log('✅ MySQL Pool configured.');
} catch (error) {
    console.error('❌ FATAL: Error configuring MySQL Pool:', error.message);
    console.error('Current Config:', { ...connectionConfig, password: '[REDACTED]' }); // Log config without password
    process.exit(1); // Exit if pool configuration fails critically
}


// --- Test Connection on Startup ---
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ DATABASE CONNECTION FAILED:', err.code, err.message);
        // Optional: Log specific details without exposing password
        console.error('Connection attempt details:', {
            host: connectionConfig.host || (connectionConfig.uri ? new URL(connectionConfig.uri).hostname : 'N/A'),
            port: connectionConfig.port || (connectionConfig.uri ? new URL(connectionConfig.uri).port : 'N/A'),
            user: connectionConfig.user || (connectionConfig.uri ? new URL(connectionConfig.uri).username : 'N/A'),
            database: connectionConfig.database || (connectionConfig.uri ? new URL(connectionConfig.uri).pathname.substring(1) : 'N/A'),
            ssl_enabled: !!connectionConfig.ssl
        });
        // You might choose *not* to exit here if the app can run partially without DB initially
        // process.exit(1);
        return;
    }
    if (connection) {
        connection.release();
        console.log('✅ Database connected successfully via pool!');
    }
});

// Wrap the pool with promise-based API
const promisePool = pool.promise();

// --- Schema Setup ---

// Create users table if it doesn't exist (assuming it's needed for the foreign key)
// Modify this schema based on your actual users table structure
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

promisePool.query(createUsersTable)
    .then(() => {
        console.log('`users` table checked/created successfully.');
    })
    .catch((err) => {
        console.error('Error creating/checking `users` table:', err);
    });


// Create user_policy_activity table if it doesn't exist
const createUserPolicyActivityTable = `
CREATE TABLE IF NOT EXISTS user_policy_activity (
    activity_id INT AUTO_INCREMENT PRIMARY KEY, -- Renamed id for clarity
    user_id INT NULL,                           -- Allow NULL if user might not be logged in for some actions? Or make NOT NULL
    username VARCHAR(255) NOT NULL,             -- Consider making NULLable if user_id is present
    email VARCHAR(255) NOT NULL,                -- Consider making NULLable if user_id is present
    policy_id VARCHAR(255) NOT NULL,            -- Might be filename or a specific ID
    action_type ENUM('VIEW', 'DOWNLOAD', 'CLICK', 'SIGNUP', 'LOGIN') NOT NULL, -- Added more actions
    status VARCHAR(50) NULL,                    -- Added status from your logging
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE -- SET NULL if user deleted, CASCADE if ID changes
)`;

promisePool.query(createUserPolicyActivityTable)
    .then(() => {
        console.log('`user_policy_activity` table checked/created successfully.');
    })
    .catch((err) => {
        console.error('Error creating/checking `user_policy_activity` table:', err);
    });

// --- Export the Promise Pool ---
module.exports = promisePool;