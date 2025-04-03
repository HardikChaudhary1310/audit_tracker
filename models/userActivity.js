// const pool = require('./db');

// const logUserActivity = async (actionType, userData, policyId, status, additionalData = {}) => {
//     // Validate required parameters
//     if (!actionType || !userData) {
//         throw new Error('Missing required parameters');
//     }

//     // Prepare data with strict validation
//     const userId = userData.id || null; // Can be null but must be valid if provided
//     const username = userData.email || userData.username || 'system@shivalikbank.com';
//     const safePolicyId = policyId ? String(policyId).substring(0, 100) : 'system_default_policy';
//     const ipAddress = additionalData.ip || req?.ip || '0.0.0.0';
//     const userAgent = additionalData.userAgent || req?.get('User-Agent') || 'unknown';

//     const client = await pool.connect();
    
//     try {
//         console.log('Attempting to log activity:', {
//             actionType, userId, username, safePolicyId, status
//         });

//         await client.query('BEGIN');

//         // 1. First insert into activities table (more restrictive)
//         const activitiesInsert = `
//             INSERT INTO activities (
//                 action_type, 
//                 email, 
//                 policy_id, 
//                 user_id, 
//                 ip_address, 
//                 user_agent
//             ) VALUES (
//                 $1, $2, $3, $4, $5, $6
//             ) RETURNING id;
//         `;

//         const activitiesRes = await client.query(activitiesInsert, [
//             actionType.substring(0, 20), // Ensure fits VARCHAR(20)
//             username.substring(0, 255),  // Ensure fits VARCHAR(255)
//             safePolicyId,
//             userId, // NULL allowed but must match users.id if not null
//             ipAddress.substring(0, 45),
//             userAgent.substring(0, 500) // Truncate if needed for text field
//         ]);

//         console.log('Activities insert result:', activitiesRes.rows[0]);

//         // 2. Then insert into user_activity
//         const userActivityInsert = `
//             INSERT INTO user_activity (
//                 action_type, 
//                 user_id, 
//                 username, 
//                 policy_id, 
//                 status, 
//                 ip_address, 
//                 user_agent
//             ) VALUES (
//                 $1, $2, $3, $4, $5, $6, $7
//             ) RETURNING id;
//         `;

//         await client.query(userActivityInsert, [
//             actionType,
//             userId,
//             username,
//             safePolicyId,
//             status,
//             ipAddress,
//             userAgent
//         ]);

//         await client.query('COMMIT');
//         return activitiesRes.rows[0];

//     } catch (err) {
//         await client.query('ROLLBACK');
//         console.error('DATABASE ERROR DETAILS:', {
//             message: err.message,
//             code: err.code,
//             query: err.query,
//             parameters: err.parameters
//         });
//         throw err;
//     } finally {
//         client.release();
//     }
// };

// module.exports = { logUserActivity };

// models/userActivity.js
const pool = require('./db');

const logPolicyActivity = async (actionType, user, policyId, additionalData = {}) => {
    if (!user || !user.id) {
        throw new Error('User information required for policy tracking');
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
                timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, NOW()
            ) RETURNING *;
        `;

        const result = await client.query(query, [
            actionType,
            user.id,
            user.email,
            policyId,
            'SUCCESS',
            additionalData.ip || null,
            additionalData.userAgent || null
        ]);

        await client.query('COMMIT');
        return result.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error logging policy activity:', {
            error: err.message,
            actionType,
            userId: user?.id,
            policyId
        });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { logPolicyActivity };