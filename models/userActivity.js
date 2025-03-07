// models/userActivity.js
const db = require('./db');  // Import the database connection

const logUserActivity = (userId, username, actionType, policyId) => {
    const query = `
        INSERT INTO user_activity (user_id, username, action_type, policy_id) 
        VALUES (?, ?, ?, ?)
    `;

    // Execute the SQL query to insert the log data into the database
    db.query(query, [userId, username, actionType, policyId], (err, results) => {
        if (err) {
            console.error('Error inserting activity into DB:', err);
            return;
        }
        console.log('User activity logged:', results);
    });
};

module.exports = { logUserActivity };
