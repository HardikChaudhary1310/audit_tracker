// models/userActivity.js
const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    // Ensure required fields have proper values
    const userId = userData?.id || null;
    const username = userData?.email || userData?.username || 'anonymous@example.com'; // Must be valid email format
    const safePolicyId = policyId || 'default_policy_id'; // Can't be null or 'N/A'
    const ipAddress = additionalData.ip || '0.0.0.0';
    const userAgent = additionalData.userAgent || 'unknown';

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. First insert into activities table (since it has stricter constraints)
        const activitiesQuery = `
            INSERT INTO activities 
                (action_type, email, policy_id, user_id, ip_address, user_agent)
            VALUES 
                ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        
        const activitiesResult = await client.query(activitiesQuery, [
            actionType, 
            username,
            safePolicyId,
            userId, // This can be null but must match a users.id if not null
            ipAddress,
            userAgent
        ]);

        // 2. Then insert into user_activity (less restrictive)
        const userActivityQuery = `
            INSERT INTO user_activity 
                (action_type, user_id, username, policy_id, status, ip_address, user_agent)
            VALUES 
                ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        
        await client.query(userActivityQuery, [
            actionType,
            userId,
            username,
            safePolicyId,
            status,
            ipAddress,
            userAgent
        ]);

        await client.query('COMMIT');
        
        console.log('✅ Successfully inserted into activities table with ID:', 
                   activitiesResult.rows[0]?.id);
        
        return activitiesResult.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction failed:', {
            error: err.message,
            query: err.query,
            parameters: err.parameters
        });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { logUserActivity };