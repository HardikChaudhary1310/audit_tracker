// models/userActivity.js

// Import the SHARED PostgreSQL pool configured and exported from db.js
// Ensure ./db correctly exports the 'pg' Pool object
const pool = require('./db');

/**
 * Logs a user activity event to the database.
 * @param {string} actionType - The type of action (e.g., 'LOGIN', 'SIGNUP', 'VIEW', 'DOWNLOAD', 'CLICK'). Case-insensitive, will be uppercased.
 * @param {object} userData - An object containing user information. Expected properties: id (integer), email (string), username (string). Can be null or empty for guests/anonymous actions.
 * @param {string | null} policyId - The identifier of the policy involved (e.g., filename), or null/N/A if not applicable.
 * @param {string | null} status - A status message for the activity (e.g., 'SUCCESS', 'FAILED - Reason', null).
 * @returns {Promise<object>} A promise that resolves with the database query result object on success.
 * @throws {Error} Throws an error if the database insertion fails.
 */
const logUserActivity = async (actionType, userData, policyId, status) => {
    // --- Input Validation and Data Preparation ---
    const safeUserData = userData || {}; // Ensure userData is an object, even if empty
    const finalActionType = String(actionType || 'UNKNOWN').toUpperCase(); // Default, ensure string, uppercase action
    const finalPolicyId = policyId || 'N/A'; // Default policyId if null or undefined
    const finalStatus = status || null; // Allow status to be explicitly null

    // Extract user details carefully:
    // user_id should be the integer ID from the 'users' table or NULL
    const userId = typeof safeUserData.id === 'number' ? safeUserData.id : null; // Ensure ID is number or null
    // Use email as a key identifier, default to 'anonymous' if unavailable
    const email = typeof safeUserData.email === 'string' && safeUserData.email ? safeUserData.email : 'anonymous';
    // Username might be the same as email or different, fallback to email then anonymous
    const username = typeof safeUserData.username === 'string' && safeUserData.username ? safeUserData.username : email;

    console.log(`Attempting to log activity: Action=${finalActionType}, UserID=${userId}, Email=${email}, Policy=${finalPolicyId}, Status=${finalStatus}`);

    // Optional: Add specific logic, e.g., prevent logging certain actions for anonymous users
    // if (userId === null && ['DOWNLOAD', 'VIEW', 'CLICK'].includes(finalActionType)) {
    //     console.warn(`Skipping log for anonymous action '${finalActionType}' on policy '${finalPolicyId}'.`);
    //     return null; // Indicate that nothing was logged
    // }

    // --- Database Insertion ---
    // Target table name should match the one created in db.js
    const tableName = "user_policy_activity";

    // Use PostgreSQL $1, $2, ... placeholders
    // Ensure column names match EXACTLY those defined in the CREATE TABLE statement in db.js
    const query = `
        INSERT INTO ${tableName}
            (action_type, user_id, username, email, policy_id, status)
        VALUES
            ($1, $2, $3, $4, $5, $6)
        RETURNING activity_id`; // RETURNING is optional, but useful for getting the new log ID

    const values = [
        finalActionType, // $1
        userId,          // $2 : Integer ID or NULL
        username,        // $3 : Username string
        email,           // $4 : Email string
        finalPolicyId,   // $5 : Policy ID string
        finalStatus      // $6 : Status string or NULL
    ];

    try {
        // Execute the query using the imported PostgreSQL pool
        const result = await pool.query(query, values);

        if (result.rowCount > 0) {
            console.log(`✅ User activity logged. Log ID: ${result.rows[0]?.activity_id}, Action: ${finalActionType}, User: ${email}`);
        } else {
             console.warn(`⚠️ User activity log insertion query executed but reported 0 rows affected.`);
        }
        return result; // Return the full result object from the pg driver

    } catch (err) {
        console.error(`❌ Error inserting activity into ${tableName}:`, err.message);
        // Log details that might help debugging (without sensitive data in production logs)
        console.error('Error Details:', { code: err.code, detail: err.detail }); // Common pg error fields
        console.error('Failed Query Values:', { actionType, userId, username, email, policyId, status }); // Log the values attempted
        // It's often helpful to re-throw the error so the calling function (in index.js) knows it failed
        throw err;
    }
};

// Export the function so it can be required in index.js
module.exports = { logUserActivity };