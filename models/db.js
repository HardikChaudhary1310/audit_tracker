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

// Create a MySQL pool to handle connections
// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root', // Your MySQL username
//     password: 'Hardik@12345', // Your MySQL password
//     database: 'user_activity', // Database name
// });


// Create a connection to the database
const pool = mysql.createPool({
    host: 'localhost',         // Replace with your database host (e.g., 'localhost' or IP address)
    user: 'root',              // Replace with your MySQL username
    password: 'Hardik@12345', // Replace with your MySQL password
    database: 'user_activity',  // Replace with the name of your database
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds
    acquireTimeout: 10000, // 10 seconds
    keepAlive: true
});

// Connect to the MySQL server
// connection.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL:', err);
//         return;
//     }
//     console.log('Connected to MySQL!');
// });

// Wrap the pool with promise-based API
const promisePool = pool.promise();

// Create user_policy_activity table if it doesn't exist
const createUserPolicyActivityTable = `
CREATE TABLE IF NOT EXISTS user_policy_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    action_type ENUM('VIEW', 'DOWNLOAD') NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`;

pool.query(createUserPolicyActivityTable, (err) => {
    if (err) {
        console.error('Error creating user_policy_activity table:', err);
    } else {
        console.log('user_policy_activity table created or already exists');
    }
});

// module.exports = connection;
module.exports = promisePool;