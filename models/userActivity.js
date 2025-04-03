// models/userActivity.js
const pool = require('./db');

const logDownloadActivity = async (user, policyId, filename, req) => {
    if (!user || !user.id) {
        throw new Error('User information required for download tracking');
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Insert into user_activity table
        const query = `
            INSERT INTO user_activity (
                action_type, 
                user_id, 
                username, 
                policy_id, 
                status, 
                ip_address, 
                user_agent,
                additional_data,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, NOW()
            ) RETURNING *;
        `;

        const result = await client.query(query, [
            'DOWNLOAD',
            user.id,
            user.email,
            policyId,
            'SUCCESS',
            req.ip,
            req.get('User-Agent'),
            JSON.stringify({ filename }) // Store additional metadata
        ]);

        await client.query('COMMIT');
        return result.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error logging download activity:', {
            error: err.message,
            userId: user?.id,
            policyId,
            filename
        });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { logDownloadActivity };