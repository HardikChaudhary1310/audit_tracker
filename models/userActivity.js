const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    try {
        console.log('Attempting to log activity:', { 
            actionType, 
            userData, 
            policyId, 
            status,
            additionalData 
        });

        // Verify database connection
        await pool.query('SELECT 1');
        
        const query = `
            INSERT INTO user_activity (
                action_type, 
                user_id, 
                username, 
                policy_id, 
                status,
                ip_address,
                user_agent,
                additional_data
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;

        const result = await pool.query(query, [
            actionType,
            userData?.id || null,
            userData?.email || userData?.username || 'anonymous',
            policyId || 'N/A',
            status,
            additionalData.ip || null,
            additionalData.userAgent || null,
            additionalData.data ? JSON.stringify(additionalData.data) : null
        ]);

        console.log('Successfully logged activity:', result.rows[0]);
        return result.rows[0].id;
    } catch (err) {
        console.error('❌ Failed to log activity:', {
            error: err,
            query: query,
            params: [
                actionType,
                userData?.id,
                userData?.email,
                policyId,
                status,
                additionalData.ip,
                additionalData.userAgent,
                additionalData.data
            ]
        });
        throw err;
    }
};

module.exports = { logUserActivity };