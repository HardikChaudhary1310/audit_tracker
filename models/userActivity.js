// models/userActivity.js
const pool = require('./db'); // Import the PostgreSQL pool connection

const logUserActivity = async (actionType, userData, policyId, status) => {
    // Ensure userData is somewhat valid, default to nulls or placeholders if needed
    // Adapt how you get user ID - using email as ID might not be ideal.
    // If you have a numeric user ID in your 'users' table, pass that instead.
    const userId = userData?.id || null; // Prefer actual user ID if available
    const username = userData?.email || userData?.username || 'anonymous'; // Get email/username
    const safePolicyId = policyId || 'N/A'; // Ensure policyId is not undefined

    // PostgreSQL uses $1, $2, etc. for placeholders
    const query = `
        INSERT INTO user_activity (action_type, user_id, username, policy_id, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;  -- Optional: return the ID of the inserted row
    `;

    try {
        console.log('Attempting to log activity:', { actionType, userId, username, safePolicyId, status });

        // Execute the SQL query using the pool
        // Pass parameters as an array matching the $1, $2 order
        const result = await pool.query(query, [
            actionType,
            userId,     // Using null if no ID provided
            username,
            safePolicyId,
            status
        ]);

        console.log('✅ User activity logged successfully. Inserted ID:', result.rows[0]?.id || 'N/A');
        return result; // Return the full result object from pg

    } catch (err) {
        console.error('❌ Error inserting activity into user_policy_activity:', err);
        // Provide more context on the error if possible
        console.error('Error Details:', { code: err.code, detail: err.detail });
        console.error('Failed Query Values:', { actionType, userId, username, safePolicyId, status });
        // It's important to throw the error so the calling function knows something went wrong
        throw err;
    }
};

module.exports = { logUserActivity };