// models/userActivity.js
const logUserActivity = async (actionType, user, policyId, status, additionalData = {}) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Prepare data
        const userId = user?.id || null;
        const username = user?.email || user?.username || 'system@shivalikbank.com';
        const safePolicyId = policyId || 'system_default';
        const ipAddress = additionalData.ip || '0.0.0.0';
        const userAgent = additionalData.userAgent || 'unknown';

        // Insert into user_activity table
        const userActivityQuery = `
            INSERT INTO user_activity (
                action_type, user_id, username, policy_id, status,
                ip_address, user_agent, additional_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        await client.query(userActivityQuery, [
            actionType,
            userId,
            username,
            safePolicyId,
            status,
            ipAddress,
            userAgent,
            JSON.stringify(additionalData)
        ]);

        // Insert into activities table
        const activitiesQuery = `
            INSERT INTO activities (
                action_type, email, policy_id, user_id,
                ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const result = await client.query(activitiesQuery, [
            actionType,
            username,
            safePolicyId,
            userId,
            ipAddress,
            userAgent
        ]);

        await client.query('COMMIT');
        return result.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Activity Logging Error:', {
            error: err.message,
            query: err.query,
            parameters: err.parameters
        });
        throw err;
    } finally {
        client.release();
    }
};