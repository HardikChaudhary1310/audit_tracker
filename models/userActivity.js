// models/userActivity.js
const promisePool = require('./db');  // Import the shared database connection

const logUserActivity = async(actionType, userData, policyId, status) => {
    try {
        // Validate required parameters
        if (!actionType || !userData || !policyId || !status) {
            console.error('Missing required parameters for logUserActivity:', { actionType, userData, policyId, status });
            return;
        }

        const query = `
            INSERT INTO user_activity (action_type, user_id, username, policy_id, status) 
            VALUES (?, ?, ?, ?, ?)
        `;

        // Handle cases where userData might be null or undefined
        const userId = userData?.email || userData?.username || 'anonymous';
        const username = userData?.email || userData?.username || 'anonymous';

        console.log('Logging user activity:', {
            actionType,
            userId,
            username,
            policyId,
            status
        });

        // Execute the SQL query to insert the log data into the database
        const [results] = await promisePool.query(query, [
            actionType,
            userId,
            username,
            policyId,
            status
        ]);

        console.log('User activity logged successfully:', results);
        return results;
    } catch (err) {
        console.error('Error inserting activity into DB:', {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage,
            stack: err.stack
        });
        // Don't throw the error, just log it and continue
        return null;
    }
};

module.exports = { logUserActivity };
