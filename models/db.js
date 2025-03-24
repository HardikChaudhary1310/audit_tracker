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
    } : false
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Wrap the pool with promise-based API
const promisePool = pool.promise();

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Successfully connected to the database');
    connection.release();
});

// module.exports = connection;
module.exports = promisePool;