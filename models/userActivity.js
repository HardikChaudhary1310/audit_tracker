const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Validate required parameters
        if (!actionType) throw new Error('Action type is required');
        
        // Prepare data with better null handling
        const userId = userData?.id ?? null; // Using nullish coalescing
        const username = userData?.email || userData?.username || 'system@shivalikbank.com';
        const safePolicyId = policyId ?? null; // Explicit null instead of 'system_default'
        const ipAddress = additionalData.ip  || '0.0.0.0';// Added req.ip fallback
        const userAgent = additionalData.userAgent || 'unknown';

        // Main activity log
        const userActivityQuery = `
            INSERT INTO user_activity (
                action_type, user_id, username, policy_id, status,
                ip_address, user_agent, additional_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        
        const userActivityParams = [
            actionType,
            userId,
            username,
            safePolicyId,
            status,
            ipAddress,
            userAgent,
            JSON.stringify(additionalData) || '{}' // Ensure valid JSON
        ];

        await client.query(userActivityQuery, userActivityParams);

        // Optional: Only insert to activities table if needed
        if (['VIEW', 'DOWNLOAD', 'LOGIN', 'LOGOUT'].includes(actionType)) {
            const activitiesQuery = `
                INSERT INTO activities (
                    action_type, email, policy_id, user_id,
                    ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id;
            `;
            
            await client.query(activitiesQuery, [
                actionType,
                username,
                safePolicyId,
                userId,
                ipAddress,
                userAgent
            ]);
        }

        await client.query('COMMIT');
        return { success: true };

    } catch (err) {
        await client.query('ROLLBACK');
        
        // Enhanced error logging
        console.error('Activity Logging Error:', {
            timestamp: new Date().toISOString(),
            error: {
                message: err.message,
                stack: err.stack
            },
            actionType,
            userData,
            policyId
        });
        
        throw err; // Re-throw for calling function to handle
    } finally {
        client.release();
    }
};

module.exports = { logUserActivity };