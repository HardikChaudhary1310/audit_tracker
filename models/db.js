// const mongoose = require('mongoose');

// const downloadLogSchema = new mongoose.Schema({
//     policyName: { type: String, required: true },
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Assuming you have user authentication
//     timestamp: { type: Date, default: Date.now }
// });

// const DownloadLog = mongoose.model('DownloadLog', downloadLogSchema);

// module.exports = DownloadLog;




// db.js
const mysql = require('mysql2');

// Get database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Hardik@12345',
    database: process.env.DB_NAME || 'user_activity',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    // Add retry configuration
    retry: {
        max: 3,
        backoffBase: 1000,
        backoffExponent: 1.5
    }
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Wrap the pool with promise-based API
const promisePool = pool.promise();

// Test the connection with retry logic
const testConnection = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await promisePool.getConnection();
            console.log('Successfully connected to the database');
            connection.release();
            return true;
        } catch (err) {
            console.error(`Connection attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                const delay = Math.pow(1.5, i) * 1000; // Exponential backoff
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('Failed to connect to database after multiple attempts');
    return false;
};

// Test connection on startup
testConnection().then(success => {
    if (!success) {
        console.error('Warning: Database connection failed. Some features may not work.');
    }
});

// module.exports = connection;
module.exports = promisePool;