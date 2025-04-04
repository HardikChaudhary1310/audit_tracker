const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Prepare data with defaults
        const userId = userData?.id || null;
        const username = userData?.email || userData?.username || 'system@shivalikbank.com';
        const safePolicyId = policyId || 'system_default';
        const ipAddress = additionalData.ip || '0.0.0.0';
        const userAgent = additionalData.userAgent || 'unknown';
        const filePath = additionalData.filePath || null;

        // Insert into user_activity table (general activity log)
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

        // Insert into policy_tracking table (specific for policy actions)
        if (['VIEW', 'DOWNLOAD', 'CLICK'].includes(actionType)) {
            const policyTrackingQuery = `
                INSERT INTO policy_tracking (
                    user_id, username, policy_id, action_type,
                    file_path, ip_address, user_agent, additional_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id;
            `;
            await client.query(policyTrackingQuery, [
                userId,
                username,
                safePolicyId,
                actionType,
                filePath,
                ipAddress,
                userAgent,
                JSON.stringify(additionalData)
            ]);
        }

        await client.query('COMMIT');
        return { success: true };

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

module.exports = { logUserActivity };