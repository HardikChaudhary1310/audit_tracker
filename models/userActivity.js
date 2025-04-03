// models/userActivity.js
const pool = require('./db');

const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
    console.log('Attempting to log activity:', { actionType, userData, policyId, status, additionalData });
    
    const userId = userData?.id || null;
    const username = userData?.email || userData?.username || 'anonymous';
    const safePolicyId = policyId || 'N/A';
    
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

    const params = [
        actionType,
        userId,
        username,
        safePolicyId,
        status,
        additionalData.ip || null,
        additionalData.userAgent || null,
        additionalData.data ? JSON.stringify(additionalData.data) : null
    ];

    console.log('Executing query with params:', { query, params });

    try {
        const result = await pool.query(query, params);
        console.log('Activity logged successfully:', result.rows[0]);
        return result.rows[0].id;
    } catch (err) {
        console.error('❌ Error logging activity:', {
            error: err,
            query: query,
            params: params
        });
        throw err;
    }
};