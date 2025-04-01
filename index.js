const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const path = require("path");

// --- Use the PostgreSQL pool ---
const pool = require('./models/db'); // Correctly imports the pg pool

// --- Import logging function (already using the correct pool via its own require) ---
const { logUserActivity } = require('./models/userActivity');

const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// --- Remove File-Based User Storage Variables ---
// const usersFilePath = path.join(__dirname, 'logs', 'user_activity.json'); // REMOVE
// const logFilePath1 = path.join(__dirname, 'logs', 'user_data.json'); // REMOVE (unless used for other file logging)
// const USER_DATA_FILE = "user_data.json"; // REMOVE
// let userData = []; // REMOVE
// let data = []; // REMOVE


// --- Setup Transporter (Keep as is) ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER, // Use environment variables
        pass: process.env.GMAIL_APP_PASSWORD, // Use environment variables
    },
});

// --- File Logging (Optional - Keep if needed for non-user data) ---
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
// const logFilePath = path.join(__dirname, 'logs', 'user_activity.log'); // Keep if needed for general logs

// --- Policy Routes (Keep as is) ---
const policyRoutes = require('./routes/routes');


const app = express();
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key', // Use ENV Variable
    resave: false,
    saveUninitialized: true,
    // For production with HTTPS, set secure: true
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 14400000 }
}));

app.use(morgan('dev'));

const PORT = process.env.PORT || 3001; // Use environment variable for Port

// --- Middleware (Keep as is) ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors()); // Consider configuring CORS more restrictively for production


// --- Validation Functions (Keep as is) ---
const isValidEmail = (username) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/;
    return emailRegex.test(username);
};
const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};


// --- Remove File Reading/Writing Functions for User Data ---
// const readUserData = () => { ... }; // REMOVE
// const writeUserData = (users) => { ... }; // REMOVE
// function saveUserToLog(userData) { ... }; // REMOVE
// function readUsersFromLog() { ... }; // REMOVE
// function logUserAction(...) { ... }; // REMOVE (replaced by DB logging)
// const logUserActivity1 = (...) => { ... }; // REMOVE (or keep only if needed for separate file log)


// --- Mock User Auth Middleware (Keep as is, ensures req.user structure) ---
const mockUserAuth = (req, res, next) => {
    // ... (keep existing implementation) ...
    const sessionUser = req.session?.user;
    req.user = { // Standardize req.user structure
        id: sessionUser?.id || null, // Get ID from session if available
        username: sessionUser?.username || null, // Get username (email) from session
        email: sessionUser?.username || null, // Keep email field consistent
        userType: sessionUser?.userType || 'user',
    };
    console.log("User Data in mockUserAuth:", req.user);
    next();
};


// --- Signup Route (Using PostgreSQL) ---
app.post("/signup", async (req, res) => { // Make async
    const { username, password, confirmPassword } = req.body; // 'username' here is the email
    console.log("Signup request received:", { email: username }); // Log email

    // Validate email format
    if (!isValidEmail(username)) {
        await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Invalid Email Format");
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }

    // Validate password
    if (!isValidPassword(password) || password !== confirmPassword) {
        await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Invalid Password");
        return res.status(400).json({ message: "Password must be valid and match confirmation." });
    }

    try {
        // Check if user already exists in the database
        const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
        const { rows } = await pool.query(checkUserQuery, [username]);

        if (rows.length > 0) {
            console.log("User already exists:", username);
            await logUserActivity("SIGNUP", { email: username }, null, "FAILED - User Exists");
            return res.status(400).json({ message: "User already exists. Please log in." });
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine userType
        const userType = username.toLowerCase() === 'admin@shivalikbank.com' ? 'admin' : 'user';

        // Insert the new user into the database
        // Note: 'username' column now stores the email as well for consistency if needed
        const insertQuery = `
            INSERT INTO users (username, email, password, verified, userType)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`; // Return the new user's ID
        const newUserResult = await pool.query(insertQuery, [
            username, // Storing email in username column too
            username, // Storing email in email column
            hashedPassword,
            false, // Not verified initially
            userType
        ]);

        const newUserId = newUserResult.rows[0].id;
        console.log(`New user created with ID: ${newUserId}`);

        // Generate token for email verification
        const token = jwt.sign({ userId: newUserId, email: username }, process.env.JWT_SECRET || "DEFAULT_SECRET_KEY", { expiresIn: '1h' });

        // Send verification email
        const verificationLink = `${process.env.BASE_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: username,
            subject: "Verify Your Email For Audit Tracker Portal",
            // Consider using an HTML template for a nicer email
            text: `Hello ${username},\n\nThank you for signing up!\n\nClick the link below to verify your email:\n${verificationLink}\n\nThis link will expire in 1 hour. If you did not sign up, please ignore this email.\n\n(For testing/demo purposes, your entered password was: ${password})` // Inform user about password in demo/testing, REMOVE FOR PRODUCTION
        };

        transporter.sendMail(mailOptions, async (error, info) => { // Make callback async
            if (error) {
                console.error("Error sending verification email:", error);
                // Log failure, but maybe don't block signup completely? Or handle differently.
                await logUserActivity("SIGNUP", { id: newUserId, email: username }, null, "FAILED - Email Send Error");
                // It's tricky whether to return 500 here or still 200 but with a warning
                return res.status(500).json({ message: "Signup complete, but failed to send verification email. Contact support." });
            }

            console.log("Verification email sent:", info.response);
            // Log successful signup AFTER email attempt
            await logUserActivity("SIGNUP", { id: newUserId, email: username }, null, "SUCCESS - Verification Email Sent");
            res.status(200).json({ message: "Signup successful! Check your email to verify your account." });
        });

    } catch (err) {
        console.error("❌ Error during signup process:", err);
        await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Server Error");
        res.status(500).json({ message: "Server error during signup." });
    }
});


// --- Email Verification Route (Using PostgreSQL) ---
app.get("/verify-email", async (req, res) => { // Make async
    const { token } = req.query;
    console.log("🔹 Received token for verification:", token);

    if (!token) {
        return res.status(400).send("<h2>Invalid or missing verification token.</h2>");
    }

    try {
        console.log("🔑 Decoding token...");
        // Use the correct secret key from environment variables
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "DEFAULT_SECRET_KEY");
        console.log("✅ Token Decoded:", decoded);

        if (!decoded.userId || !decoded.email) {
            console.error("❌ Verification Error: UserID or Email missing in token");
            return res.status(400).send("<h2>Invalid token structure.</h2>");
        }

        const { userId, email } = decoded; // Extract userId and email

        // Update user verification status in database using userId
        const updateQuery = 'UPDATE users SET verified = true WHERE id = $1 AND email = $2';
        const result = await pool.query(updateQuery, [userId, email]);

        if (result.rowCount === 0) {
            console.error(`❌ User not found or email mismatch for verification. UserID: ${userId}, Email: ${email}`);
            return res.status(404).send("<h2>User not found or token mismatch.</h2><p>Please try signing up again.</p>");
        }

        console.log(`✅ Email verified successfully for UserID: ${userId}, Email: ${email}`);
        // Log successful verification
        await logUserActivity("VERIFY_EMAIL", { id: userId, email: email }, null, "SUCCESS");
        // Redirect to login or show success message
        res.status(200).send(`
            <h2>Email Verified Successfully!</h2>
            <p>Your email (${email}) has been verified. You can now <a href="/">log in</a>.</p>
        `);

    } catch (error) {
        console.error("❌ Verification Error:", error.message);
        let message = "<h2>Invalid or Expired Token</h2><p>The verification link may have expired or is invalid.</p>";
        if (error instanceof jwt.TokenExpiredError) {
             message = "<h2>Token Expired</h2><p>Your verification link has expired. Please sign up again to receive a new link.</p>";
        } else if (error instanceof jwt.JsonWebTokenError) {
             message = "<h2>Invalid Token</h2><p>Your verification link is invalid. Please check the link or sign up again.</p>";
        }
         await logUserActivity("VERIFY_EMAIL", { email: "Unknown" }, null, `FAILED - ${error.name}`);
        res.status(400).send(message + "<p>Contact support if the problem persists.</p>");
    }
});


// --- Login Route (Using PostgreSQL) ---
app.post("/login", async (req, res) => { // Make async
    const { username, password } = req.body; // username is the email
    const logAttemptData = { email: username }; // Data for logging attempts

    if (!username || !password) {
        await logUserActivity("LOGIN", logAttemptData, null, "FAILED - Missing Credentials");
        return res.status(400).json({ message: "Email and password are required." });
    }

    console.log(`Login attempt for: ${username}`);

    try {
        // Check user in database
        const query = 'SELECT id, email, username, password, verified, userType FROM users WHERE email = $1';
        const { rows } = await pool.query(query, [username]);

        if (rows.length === 0) {
            console.log("Login failed: User not found.");
            await logUserActivity("LOGIN", logAttemptData, null, "FAILED - User Not Found");
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message for security
        }

        const user = rows[0];
        logAttemptData.id = user.id; // Add ID for logging if found

        // Check if user is verified
        if (!user.verified) {
            console.log("Login failed: User not verified.");
            await logUserActivity("LOGIN", logAttemptData, null, "FAILED - Not Verified");
            return res.status(403).json({ message: "Please verify your email before logging in. Check your inbox for the verification link." });
        }

        // Compare password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log("Login failed: Incorrect password.");
            await logUserActivity("LOGIN", logAttemptData, null, "FAILED - Incorrect Password");
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message
        }

        // --- Login Successful ---
        console.log("Login successful for:", user.email);

        // Save essential, non-sensitive user info in session
        req.session.user = {
            id: user.id,
            username: user.email, // Use email as the primary username identifier in session
            userType: user.userType
        };

        // Regenerate session ID upon login for security
        req.session.regenerate(async (err) => {
            if (err) {
                console.error("Error regenerating session:", err);
                await logUserActivity("LOGIN", logAttemptData, null, "FAILED - Session Error");
                return res.status(500).json({ message: "Login failed due to session error." });
            }

            // Re-save user data to the new session
            req.session.user = {
                id: user.id,
                username: user.email,
                userType: user.userType
            };

            // Log successful login activity
            await logUserActivity("LOGIN", req.session.user, null, "SUCCESS");

            // Send success response
            res.status(200).json({
                message: "Login successful",
                user: req.session.user // Send back basic user info
            });
        });

    } catch (error) {
        console.error("❌ Login process error:", error);
        await logUserActivity("LOGIN", logAttemptData, null, "FAILED - Server Error");
        res.status(500).json({ message: "Server error during login." });
    }
});

app.get("/home", mockUserAuth, (req, res) => {
    if (!req.session.user) return res.redirect('/'); // <--- THIS CHECK NOW PASSES
   res.render("home", { user: req.user });
});
// --- Activity Tracking Routes (Using PostgreSQL and logUserActivity) ---

// Combined route for VIEW and CLICK using logUserActivity
app.post('/track-policy-click', mockUserAuth, async (req, res) => { // Make async
    const { policyId, actionType, filename } = req.body; // actionType should be 'VIEW' or 'CLICK'
    const user = req.user; // Get user from middleware

    if (!user || !user.id) {
         console.error("Tracking Error: User not authenticated or missing ID.");
         return res.status(401).json({ message: "User authentication required." });
    }
    if (!policyId || !actionType || !['VIEW', 'CLICK'].includes(actionType)) {
        return res.status(400).json({ message: 'Valid Policy ID and Action Type (VIEW/CLICK) are required' });
    }
    const safeFilename = filename || policyId; // Use filename if provided, else policyId

    console.log(`Tracking ${actionType} for policy: ${safeFilename} (ID: ${policyId}), User: ${user.username} (ID: ${user.id})`);

    try {
        // Log using the centralized function
        await logUserActivity(actionType, user, policyId, `Success - ${actionType}ed`);

        // Optional: If you still need the separate 'activities' table
        /*
        const insertActivitiesQuery = `
            INSERT INTO activities (action_type, email, policy_id, user_id)
            VALUES ($1, $2, $3, $4)`;
        await pool.query(insertActivitiesQuery, [actionType, user.username, policyId, user.id]);
        console.log(`Also logged to 'activities' table.`);
        */

        res.status(200).json({ message: `${actionType} tracked successfully for ${safeFilename}` });

    } catch (err) {
        console.error(`❌ Error tracking ${actionType} for policy ${policyId}:`, err);
        res.status(500).json({ message: `Server error while tracking ${actionType}` });
    }
});


// Route for DOWNLOAD using logUserActivity
app.post('/track-download', mockUserAuth, async (req, res) => { // Make async
    const { policyId, filename } = req.body;
    const user = req.user; // Get user from middleware

     if (!user || !user.id) {
         console.error("Tracking Error: User not authenticated or missing ID.");
         return res.status(401).json({ message: "User authentication required." });
    }
    if (!policyId) {
        return res.status(400).json({ message: "Policy ID is required" });
    }
     const safeFilename = filename || policyId;

    console.log(`Tracking DOWNLOAD for policy: ${safeFilename} (ID: ${policyId}), User: ${user.username} (ID: ${user.id})`);

    try {
        // Log using the centralized function
        await logUserActivity('DOWNLOAD', user, policyId, "Success - Downloaded");

        // Optional: If you still need the separate 'activities' table
        /*
        const insertActivitiesQuery = `
            INSERT INTO activities (action_type, email, policy_id, user_id)
            VALUES ($1, $2, $3, $4)`;
        await pool.query(insertActivitiesQuery, ['DOWNLOAD', user.username, policyId, user.id]);
        console.log(`Also logged to 'activities' table.`);
        */

        res.status(200).json({ message: "Download tracked successfully" });

    } catch (err) {
        console.error(`❌ Error tracking DOWNLOAD for policy ${policyId}:`, err);
        res.status(500).json({ message: "Server error while tracking download" });
    }
});


// --- File Serving Routes (Download/View - Updated Logging) ---

// Download Policy Route
app.get('/download-policy/:filename', mockUserAuth, async (req, res) => { // Make async
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const user = req.user; // Get user from middleware
    const policyId = decodedFilename; // Use filename as policyId for logging

     if (!user || !user.id) {
         console.error("Download Error: User not authenticated or missing ID.");
         // Don't return JSON here, maybe redirect or show an error page
         return res.status(401).send("Authentication required to download files.");
    }

    console.log(`Download request for: ${decodedFilename}, User: ${user.username} (ID: ${user.id})`);

    // Define potential file paths (adjust if your structure is different)
    const possiblePaths = [
        path.join(__dirname, 'public', 'policies', 'audit', decodedFilename),
        path.join(__dirname, 'public', 'policies', decodedFilename),
    ];

    let filePath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            filePath = p;
            break;
        }
    }

    if (!filePath) {
        console.error(`File not found for download: ${decodedFilename}`);
        // Log failed download attempt
        await logUserActivity('DOWNLOAD', user, policyId, "FAILED - File Not Found").catch(e => console.error("Error logging failed download:", e));
        return res.status(404).send('File not found');
    }

    try {
        // Log successful download activity *before* sending file
        await logUserActivity('DOWNLOAD', user, policyId, "Success - Download Started");

        // Optional: Log to 'activities' table if needed
        /*
        const insertActivitiesQuery = `
            INSERT INTO activities (action_type, email, policy_id, user_id)
            VALUES ($1, $2, $3, $4)`;
        await pool.query(insertActivitiesQuery, ['DOWNLOAD', user.username, policyId, user.id]);
        */

        // Send the file for download
        res.download(filePath, decodedFilename, (err) => {
            if (err) {
                // An error occurred after headers were sent, log it but can't send new response
                console.error(`Error during file transmission for ${decodedFilename}:`, err);
                // You might log this specific failure state if needed
                 logUserActivity('DOWNLOAD', user, policyId, "FAILED - Transmission Error").catch(e => console.error("Error logging failed transmission:", e));
            } else {
                console.log(`File ${decodedFilename} sent successfully to ${user.username}`);
                // Optional: Log completion if needed, but 'Started' is usually sufficient
            }
        });

    } catch (err) {
        console.error(`❌ Server error during download prep for ${decodedFilename}:`, err);
         await logUserActivity('DOWNLOAD', user, policyId, "FAILED - Server Error").catch(e => console.error("Error logging server error:", e));
        // Avoid sending JSON if headers might have been sent
        if (!res.headersSent) {
             res.status(500).send('Server error while processing download');
        }
    }
});

// View Policy Route
app.get('/view-policy/:filename', mockUserAuth, async (req, res) => { // Make async
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const user = req.user;
    const policyId = decodedFilename;

    if (!user || !user.id) {
         console.error("View Error: User not authenticated or missing ID.");
         return res.status(401).send("Authentication required to view files.");
    }

    console.log(`View request for: ${decodedFilename}, User: ${user.username} (ID: ${user.id})`);

    const possiblePaths = [
        path.join(__dirname, 'public', 'policies', 'audit', decodedFilename),
        path.join(__dirname, 'public', 'policies', decodedFilename),
    ];

    let filePath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            filePath = p;
            break;
        }
    }

    if (!filePath) {
        console.error(`File not found for viewing: ${decodedFilename}`);
        await logUserActivity('VIEW', user, policyId, "FAILED - File Not Found").catch(e => console.error("Error logging failed view:", e));
        return res.status(404).send('File not found');
    }

    try {
        // Log successful view activity
        await logUserActivity('VIEW', user, policyId, "Success - Viewed");

        // Optional: Log to 'activities' table if needed
        /*
        const insertActivitiesQuery = `
            INSERT INTO activities (action_type, email, policy_id, user_id)
            VALUES ($1, $2, $3, $4)`;
        await pool.query(insertActivitiesQuery, ['VIEW', user.username, policyId, user.id]);
        */

        // Send the file for inline viewing
        res.sendFile(filePath, (err) => {
             if (err) {
                 console.error(`Error sending file for view ${decodedFilename}:`, err);
                  logUserActivity('VIEW', user, policyId, "FAILED - Transmission Error").catch(e => console.error("Error logging failed view transmission:", e));
             } else {
                 console.log(`File ${decodedFilename} sent for viewing to ${user.username}`);
             }
        });

    } catch (err) {
        console.error(`❌ Server error during view prep for ${decodedFilename}:`, err);
         await logUserActivity('VIEW', user, policyId, "FAILED - Server Error").catch(e => console.error("Error logging server error:", e));
         if (!res.headersSent) {
             res.status(500).send('Server error while processing view request');
         }
    }
});


// --- Delete Policy Route (Keep as is - File System Operation) ---
app.delete('/delete-policy/:filename', mockUserAuth, (req, res) => {
    // ... (keep existing implementation, maybe add logging?) ...
    // Consider adding logging here too using logUserActivity
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const user = req.user;
    const filePath = path.join(__dirname, 'public', 'policies', 'audit', decodedFilename);

    // Check admin privileges
    if (user.userType !== 'admin') {
        logUserActivity('DELETE_POLICY', user, decodedFilename, "FAILED - Unauthorized").catch(e => console.error("Error logging delete attempt:", e));
        return res.status(403).json({ message: 'Forbidden: Only admins can delete policies.' });
    }

     if (!fs.existsSync(filePath)) {
        console.error('File not found for delete:', filePath);
         logUserActivity('DELETE_POLICY', user, decodedFilename, "FAILED - File Not Found").catch(e => console.error("Error logging delete attempt:", e));
        return res.status(404).json({ message: 'File not found' });
    }

    fs.unlink(filePath, async (err) => { // Make async for logging
        if (err) {
            console.error('Error deleting file:', err);
             await logUserActivity('DELETE_POLICY', user, decodedFilename, "FAILED - File System Error").catch(e => console.error("Error logging failed delete:", e));
            return res.status(500).json({ message: 'Error deleting file' });
        }

        console.log('File deleted successfully:', decodedFilename);
        await logUserActivity('DELETE_POLICY', user, decodedFilename, "SUCCESS").catch(e => console.error("Error logging successful delete:", e));
        res.json({ message: 'File deleted successfully' });
    });
});


// --- Basic Page Routes (Keep as is) ---
app.get("/", (req, res) => {
    // If user is logged in, maybe redirect to home? Optional.
    // if (req.session.user) {
    //     return res.redirect('/home');
    // }
    res.render("index"); // Renders the login/signup page
});

app.get("/home", mockUserAuth, (req, res) => { // Add auth middleware
     if (!req.session.user) return res.redirect('/'); // Redirect if not logged in
    res.render("home", { user: req.user }); // Pass user info
});

app.get("/policy", mockUserAuth, (req, res) => { // Add auth middleware
     if (!req.session.user) return res.redirect('/');
    res.render("policy", { user: req.user });
});

app.get("/manuals", mockUserAuth, (req, res) => { // Add auth middleware
     if (!req.session.user) return res.redirect('/');
    res.render("manuals", { user: req.user });
});

app.get("/circular", mockUserAuth, (req, res) => { // Add auth middleware
     if (!req.session.user) return res.redirect('/');
    res.render("circular", { user: req.user });
});


// --- Logout Route ---
app.get('/logout', mockUserAuth, (req, res) => {
    const user = req.user; // Get user info before destroying session
    req.session.destroy(async (err) => { // Make async for logging
        if (err) {
            console.error("Error destroying session:", err);
             // Log attempt even if session destruction fails
            await logUserActivity("LOGOUT", user, null, "FAILED - Session Error").catch(e => console.error("Error logging failed logout:", e));
            // Maybe redirect anyway or show error?
            return res.redirect('/');
        }
        console.log("User logged out:", user.username);
        await logUserActivity("LOGOUT", user, null, "SUCCESS").catch(e => console.error("Error logging successful logout:", e));
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/'); // Redirect to login page
    });
});


// --- View Data Route (Needs Database Query) ---
// THIS IS A SECURITY RISK if it shows sensitive data.
// Consider restricting access (admin only) and selecting specific columns.
app.get("/viewData", mockUserAuth, async (req, res) => { // Make async
     // Check if user is admin
     if (req.user?.userType !== 'admin') {
         return res.status(403).json({ message: 'Forbidden: Access restricted to administrators.' });
     }

    try {
        // Fetch data from the user_activity table
        const query = `
            SELECT id, action_type, user_id, username, policy_id, status, timestamp
            FROM user_activity
            ORDER BY timestamp DESC
            LIMIT 1000; -- Add a LIMIT to prevent fetching too much data
        `;
        const { rows } = await pool.query(query);

        res.json(rows); // Send database results as JSON

    } catch (error) {
        console.error("❌ Error fetching user activity data:", error);
        res.status(500).json({ message: "Failed to load user activity data." });
    }
});


// --- Static Files Middleware (Ensure placement is correct) ---
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static('public')); // Serves files from public root


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔗 Connected to PostgreSQL via ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'default settings'}`); // Confirm DB connection method
    console.log(`🔑 JWT Secret is ${process.env.JWT_SECRET ? 'SET' : 'NOT SET (Using default - INSECURE)'}`);
    console.log(`🔑 Session Secret is ${process.env.SESSION_SECRET ? 'SET' : 'NOT SET (Using default - INSECURE)'}`);
});

module.exports = app; // Keep for potential testing setups