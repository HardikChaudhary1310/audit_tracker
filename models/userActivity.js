// models/userActivity.js
const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    const userId = userData?.id || null;
    const username = userData?.email || userData?.username || 'anonymous';
    const safePolicyId = policyId || 'N/A';
    const ipAddress = additionalData.ip || null;
    const userAgent = additionalData.userAgent || null;

    // Start a transaction
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Log to user_activity table
        const userActivityQuery = `
            INSERT INTO user_activity (action_type, user_id, username, policy_id, status, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        const userActivityResult = await client.query(userActivityQuery, [
            actionType,
            userId,
            username,
            safePolicyId,
            status,
            ipAddress,
            userAgent
        ]);

        // Also log to activities table
        const activitiesQuery = `
            INSERT INTO activities (action_type, email, policy_id, user_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const activitiesResult = await client.query(activitiesQuery, [
            actionType,
            username,
            safePolicyId,
            userId,
            ipAddress,
            userAgent
        ]);

        await client.query('COMMIT');
        
        console.log('✅ Activity logged to both tables:', {
            user_activity_id: userActivityResult.rows[0]?.id,
            activities_id: activitiesResult.rows[0]?.id
        });
        
        return {
            user_activity: userActivityResult.rows[0],
            activities: activitiesResult.rows[0]
        };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error inserting activity:', err);
        console.error('Error Details:', { 
            code: err.code, 
            detail: err.detail,
            actionType,
            userId,
            username,
            safePolicyId,
            status
        });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { logUserActivity };