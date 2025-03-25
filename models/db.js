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

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Hardik@12345',
    database: process.env.DB_NAME || 'user_activity',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Add SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : undefined
};

// Log database configuration (excluding sensitive info)
console.log('Database configuration:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    environment: process.env.NODE_ENV || 'development',
    ssl: dbConfig.ssl ? 'enabled' : 'disabled'
});

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Wrap pool with promise API
const promisePool = pool.promise();

// Test connection function with better error handling
const testConnection = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await promisePool.getConnection();
            console.log('✅ Database connection successful!');
            connection.release();
            return true;
        } catch (err) {
            console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, {
                code: err.code,
                errno: err.errno,
                sqlState: err.sqlState,
                sqlMessage: err.sqlMessage,
                host: dbConfig.host,
                database: dbConfig.database
            });
            
            if (i < retries - 1) {
                console.log(`⏳ Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.5; // Exponential backoff
            }
        }
    }
    return false;
};

// Test connection on startup
testConnection().then(success => {
    if (!success) {
        console.error('❌ Failed to connect to database after multiple attempts. Please check:');
        console.error('1. Database server is running');
        console.error('2. Database credentials are correct');
        console.error('3. Database exists');
        console.error('4. Network/firewall allows connection');
        console.error('5. Environment variables are set correctly');
        // Don't exit the process, let the application handle reconnection
    }
});

// module.exports = connection;
module.exports = promisePool;