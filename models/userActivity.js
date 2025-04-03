const pool = require('./db');

const logPolicyAction = async (actionType, user, policyData, req) => {
    if (!user || !user.id) {
        throw new Error('User authentication required');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Prepare data with defaults
        const policyId = policyData.id || 'unknown';
        const filename = policyData.filename || policyId;
        const ip = req.ip || '0.0.0.0';
        const userAgent = req.get('User-Agent') || 'unknown';

        // Insert into user_activity
        const userActivityQuery = `
            INSERT INTO user_activity (
                action_type, user_id, username, policy_id, status, 
                ip_address, user_agent, additional_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        await client.query(userActivityQuery, [
            actionType,
            user.id,
            user.email,
            policyId,
            'SUCCESS',
            ip,
            userAgent,
            JSON.stringify({ filename })
        ]);

        // Insert into activities
        const activitiesQuery = `
            INSERT INTO activities (
                action_type, email, policy_id, user_id, 
                ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const result = await client.query(activitiesQuery, [
            actionType,
            user.email,
            policyId,
            user.id,
            ip,
            userAgent
        ]);

        await client.query('COMMIT');
        return result.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database Error:', {
            error: err.message,
            query: err.query,
            parameters: err.parameters,
            stack: err.stack
        });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { logPolicyAction };