// Import mysql2
const mysql = require('mysql2');

// Create a connection pool for better connection management
const pool = mysql.createPool({
    host: 'localhost',         // Replace with your database host (e.g., 'localhost' or IP address)
    user: 'root',              // Replace with your MySQL username
    password: 'Hardik@12345', // Replace with your MySQL password
    database: 'user_activity',
    waitForConnections: true,
    connectionLimit: 10,  // Adjust the limit based on your needs
    queueLimit: 0
});

// Promisify the pool for async/await usage
const promisePool = pool.promise();

// models/userActivity.js
const db = require('./db');  // Import the database connection

const logUserActivity = async(userId, username, actionType, policyId) => {
    try {
        const query = `
            INSERT INTO user_activity (user_id, username, action_type, policy_id) 
            VALUES (?, ?, ?, ?)
        `;

        // Execute the SQL query to insert the log data into the database
        const [results] = await promisePool.query(query, [userId, username, actionType, policyId]);

        console.log('User activity logged:', results);
    } catch (err) {
        console.error('Error inserting activity into DB:', err);
    }
};

module.exports = { logUserActivity };
