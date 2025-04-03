const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    const userId = userData?.id || null;
    const username = userData?.email || userData?.username || 'system@shivalikbank.com';
    const safePolicyId = policyId || 'system_default_policy';
    const ipAddress = additionalData.ip || '0.0.0.0';
    const userAgent = additionalData.userAgent || 'unknown';

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Insert into user_activity table (existing)
        const userActivityQuery = `
            INSERT INTO user_activity (
                action_type, user_id, username, policy_id, status, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        await client.query(userActivityQuery, [
            actionType, userId, username, safePolicyId, 
            status, ipAddress, userAgent
        ]);

        // 2. NEW: Insert into activities table
        const activitiesQuery = `
            INSERT INTO activities (
                action_type, email, policy_id, user_id, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const activitiesResult = await client.query(activitiesQuery, [
            actionType, username, safePolicyId, userId,
            ipAddress, userAgent
        ]);

        await client.query('COMMIT');
        
        console.log('✅ Successfully inserted into both tables. Activity ID:', 
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