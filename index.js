// index.js
require('dotenv').config(); // MUST BE THE VERY FIRST LINE

const express = require('express');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const path = require("path");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// Import the PostgreSQL pool from db.js
const pool = require('./models/db'); // Assuming db.js now exports the pg pool

// Import the database logging function (ensure this file is updated for pg)
const { logUserActivity } = require('./models/userActivity');

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-dev-secret-please-change'; // Use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-please-change'; // Use environment variable
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD; // Use environment variable

if (!SESSION_SECRET || SESSION_SECRET === 'fallback-dev-secret-please-change') {
    console.warn('WARNING: SESSION_SECRET is not set or is using the default fallback.');
}
if (!JWT_SECRET || JWT_SECRET === 'fallback-jwt-secret-please-change') {
    console.warn('WARNING: JWT_SECRET is not set or is using the default fallback.');
}
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('WARNING: GMAIL_USER or GMAIL_APP_PASSWORD environment variables are not set. Email functionality will fail.');
}

// --- Middleware Setup ---
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // HTTP request logger
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded request bodies

// Session Configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Set to false - don't save unmodified sessions
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
    }
}));

// View Engine Setup
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
// Specific route for /public needed if HTML references files starting with /public
app.use('/public', express.static(path.join(__dirname, 'public')));


// --- Helper Functions ---

// Email validation
const isValidEmail = (email) => {
    // Allow any case before @ but require @shivalikbank.com
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/i;
    return emailRegex.test(email);
};

// Password validation
const isValidPassword = (password) => {
    // Min 6 chars: 1 upper, 1 lower, 1 digit, 1 symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};

// --- Nodemailer Transport ---
let transporter;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD, // Use environment variable
        },
    });
    console.log("✅ Nodemailer transport configured.");
} else {
    console.error("❌ Nodemailer transport NOT configured due to missing GMAIL_USER or GMAIL_APP_PASSWORD.");
    // Assign a dummy transporter to prevent crashes, but log errors on use
    transporter = {
        sendMail: async () => {
             console.error("❌ Attempted to send email, but Nodemailer is not configured.");
             throw new Error("Email service not configured.");
        }
    };
}


// --- Mock/Auth Middleware (Simplified - Adapt as needed) ---
// This ensures req.user exists, getting info from session if logged in
const ensureUserData = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user; // Use user data from session
        console.log("=== User data from session applied ===", req.user);
    } else {
        // Create a guest user object if not logged in
        // Important for logging actions by non-logged-in users if needed
        req.user = {
            id: null, // No database ID for guest
            username: 'guest',
            email: 'guest',
            userType: 'guest'
        };
        console.log("=== No session found, using guest user ===");
    }
    next();
};


// --- Routes ---

// Root/Login Page
app.get("/", (req, res) => {
    // If user is already logged in, maybe redirect to home? Optional.
    // if (req.session.user) {
    //     return res.redirect('/home');
    // }
    res.render("index"); // Render index.ejs
});

// Home Page (Requires Auth - Example)
app.get("/home", ensureUserData, (req, res) => {
    if (!req.user || req.user.userType === 'guest') { // Check if logged in
        return res.redirect('/'); // Redirect guests to login
    }
    res.render("home", { user: req.user }); // Pass user data to home.ejs
});

// Policy Page (Requires Auth - Example)
app.get("/policy", ensureUserData, (req, res) => {
     if (!req.user || req.user.userType === 'guest') { // Check if logged in
         return res.redirect('/'); // Redirect guests to login
     }
    // Pass user data for potential display in policy.ejs
    res.render("policy", { user: req.user });
});

// --- Signup Route ---
app.post("/signup", async (req, res) => {
    const { username, password, confirmPassword } = req.body; // Frontend sends 'username' which is the email
    const email = username; // Treat username from form as email

    console.log("Signup request received:", { email, password: '***', confirmPassword: '***' });

    // Validation
    if (!isValidEmail(email)) {
        await logUserActivity("SIGNUP", { email }, null, "FAILED - Invalid Email Format").catch(console.error);
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }
    if (!isValidPassword(password)) {
        await logUserActivity("SIGNUP", { email }, null, "FAILED - Invalid Password Format").catch(console.error);
        return res.status(400).json({ message: "Password must meet complexity requirements." });
    }
    if (password !== confirmPassword) {
        await logUserActivity("SIGNUP", { email }, null, "FAILED - Password Mismatch").catch(console.error);
        return res.status(400).json({ message: "Passwords do not match." });
    }

    try {
        // Check if user already exists
        const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
        const { rows } = await pool.query(checkUserQuery, [email]);

        if (rows.length > 0) {
            console.log(`Signup attempt for existing user: ${email}`);
            await logUserActivity("SIGNUP", { email }, null, "FAILED - User Exists").catch(console.error);
            return res.status(400).json({ message: "User already exists. Please log in." });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine userType
        const userType = email.toLowerCase() === 'admin@shivalikbank.com' ? 'admin' : 'user';

        // Insert new user (unverified)
        const insertQuery = `
            INSERT INTO users (username, email, password, verified, "userType")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`; // Return the new user's ID
        const insertValues = [email, email, hashedPassword, false, userType];
        const insertResult = await pool.query(insertQuery, insertValues);
        const userId = insertResult.rows[0]?.id;

        console.log(`User ${email} created with ID: ${userId}, Type: ${userType}`);

        // Generate verification token
        const token = jwt.sign({ email: email }, JWT_SECRET, { expiresIn: '1h' });

        // Send verification email
        const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`; // Get base URL
        const verificationLink = `${BASE_URL}/verify-email?token=${token}`;
        const mailOptions = {
            from: GMAIL_USER,
            to: email,
            subject: "Verify Your Email for Audit Tracker Portal",
            text: `Hello,\n\nThank you for signing up for the Audit Tracker!\n\nPlease click the link below to verify your email address:\n${verificationLink}\n\nThis link will expire in 1 hour.\n\nYour login username is: ${email}`,
            // Consider adding HTML version
            // html: `<p>Hello,</p><p>Thank you...</p><p><a href="${verificationLink}">Verify Email</a></p>...`
        };

        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email}`);

        await logUserActivity("SIGNUP", { email: email, userType: userType, id: userId }, null, "SUCCESS - Verification Email Sent").catch(console.error);
        res.status(201).json({ message: "Signup successful! Please check your email to verify your account." });

    } catch (error) {
        console.error("Error during signup:", error);
        await logUserActivity("SIGNUP", { email: email }, null, "FAILED - Server Error").catch(console.error);
        res.status(500).json({ message: "An internal error occurred during signup." });
    }
});

// --- Email Verification Route ---
app.get("/verify-email", async (req, res) => {
    const { token } = req.query;
    console.log("Verification token received:", token ? 'Present' : 'Missing');

    if (!token) {
        return res.status(400).send("Verification token is missing.");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const email = decoded.email;

        if (!email) {
             console.error("Verification Error: Email missing in token payload");
             return res.status(400).send("Invalid token structure.");
        }
        console.log(`Attempting to verify email: ${email}`);

        // Update user status in database
        const updateQuery = 'UPDATE users SET verified = true WHERE email = $1 AND verified = false RETURNING id';
        const { rows, rowCount } = await pool.query(updateQuery, [email]);

        if (rowCount === 0) {
            // Check if already verified or user doesn't exist
             const checkQuery = 'SELECT verified FROM users WHERE email = $1';
             const checkResult = await pool.query(checkQuery, [email]);
             if (checkResult.rowCount > 0 && checkResult.rows[0].verified) {
                 console.log(`Email ${email} was already verified.`);
                 return res.status(200).send(`<h2>Email Already Verified</h2><p>Your email ${email} has already been verified. You can <a href="/">log in</a>.</p>`);
             } else {
                 console.error(`User not found or couldn't update for verification: ${email}`);
                 return res.status(404).send(`<h2>Verification Failed</h2><p>User not found or unable to verify. Please try signing up again.</p>`);
             }
        }

        const userId = rows[0]?.id;
        console.log(`Email verified successfully for: ${email} (User ID: ${userId})`);
        await logUserActivity("VERIFY_EMAIL", { email: email, id: userId }, null, "SUCCESS").catch(console.error);

        // Send verification success page
        const loginUrl = process.env.BASE_URL || '/'; // Link back to login page
        return res.status(200).send(`
            <h2>Email Verified Successfully!</h2>
            <p>Your email (${email}) has been verified. You can now <a href="${loginUrl}">log in</a>.</p>
        `);

    } catch (error) {
        console.error("❌ Email Verification Error:", error.name, error.message);
        await logUserActivity("VERIFY_EMAIL", { email: 'unknown (token error)' }, null, "FAILED - Token Error").catch(console.error);
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(400).send("<h2>Verification Link Expired</h2><p>This verification link has expired. Please sign up again or request a new verification email.</p>");
        } else if (error instanceof jwt.JsonWebTokenError) {
            return res.status(400).send("<h2>Invalid Verification Link</h2><p>This verification link is invalid.</p>");
        } else {
            return res.status(500).send("<h2>Verification Error</h2><p>An unexpected error occurred during email verification.</p>");
        }
    }
});


// --- Login Route ---
app.post("/login", async (req, res) => {
    const { username, password } = req.body; // Frontend sends 'username' which is the email
    const email = username;
    console.log(`Login attempt: ${email}, Password: ***`);

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }
    if (!isValidEmail(email)) {
         await logUserActivity("LOGIN", { email }, null, "FAILED - Invalid Email Format").catch(console.error);
         return res.status(400).json({ message: "Invalid email format." });
    }

    try {
        // Find user by email
        const query = 'SELECT id, username, email, password as "hashedPassword", verified, "userType" FROM users WHERE email = $1';
        const { rows } = await pool.query(query, [email]);

        if (rows.length === 0) {
            console.log(`Login failed: User not found - ${email}`);
            await logUserActivity("LOGIN", { email }, null, "FAILED - User Not Found").catch(console.error);
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message
        }

        const user = rows[0];

        // Check if verified
        if (!user.verified) {
            console.log(`Login failed: User not verified - ${email}`);
            await logUserActivity("LOGIN", { email, id: user.id }, null, "FAILED - Not Verified").catch(console.error);
            return res.status(403).json({ message: "Please verify your email before logging in. Check your inbox." });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.hashedPassword);
        if (!isMatch) {
            console.log(`Login failed: Incorrect password - ${email}`);
            await logUserActivity("LOGIN", { email, id: user.id }, null, "FAILED - Incorrect Password").catch(console.error);
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message
        }

        // --- Login Successful ---
        console.log(`Login successful: ${email} (ID: ${user.id}, Type: ${user.userType})`);

        // Regenerate session to prevent fixation attacks
        req.session.regenerate(async (err) => {
            if (err) {
                console.error("Error regenerating session:", err);
                await logUserActivity("LOGIN", { email, id: user.id }, null, "FAILED - Session Error").catch(console.error);
                return res.status(500).json({ message: "Login failed due to a session error." });
            }

             // Store essential, non-sensitive user data in session
            req.session.user = {
                id: user.id,
                username: user.username, // or user.email if username isn't separate
                email: user.email,
                userType: user.userType
            };
            console.log("Session data set:", req.session.user);

            await logUserActivity("LOGIN", req.session.user, null, "SUCCESS").catch(console.error);

             // Send success response (frontend will handle redirect)
            res.status(200).json({ message: "Login successful", user: req.session.user });
        });

    } catch (error) {
        console.error("Error during login:", error);
        await logUserActivity("LOGIN", { email }, null, "FAILED - Server Error").catch(console.error);
        res.status(500).json({ message: "An internal error occurred during login." });
    }
});

// --- Logout Route ---
app.get('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      // Optionally pass the error to an error handler
      return next(err);
    }
    // Redirect to login page after logout
    res.redirect('/');
  });
});


// --- Policy Interaction Tracking Routes ---

// Consolidated tracking for VIEW and CLICK actions sent from the frontend
app.post('/track-policy-interaction', ensureUserData, async (req, res) => {
    const { policyId, actionType, filename } = req.body; // filename might be useful for context
    const user = req.user; // Get user data from middleware

    // Basic validation
    if (!policyId || !actionType || !['VIEW', 'CLICK'].includes(actionType.toUpperCase())) {
        console.warn("Invalid policy interaction tracking request:", req.body);
        return res.status(400).json({ message: 'Policy ID and valid Action Type (VIEW or CLICK) are required.' });
    }
     if (!user || !user.id) {
         console.warn(`Attempt to track policy interaction without logged-in user. Action: ${actionType}, Policy: ${policyId}`);
         // Decide if you want to allow tracking for guests or return an error
         // If allowing guests, ensure logUserActivity handles null user.id
         // For now, let's assume login is required for these actions:
         // return res.status(401).json({ message: 'Authentication required for this action.' });
         // Or proceed with guest info if ensureUserData sets it up
     }


    console.log(`Tracking Policy Interaction: User: ${user.email || user.username}, Action: ${actionType}, Policy: ${policyId}, Filename: ${filename || 'N/A'}`);

    try {
        // Log using the unified function (ensure userActivity.js is updated for PG)
        await logUserActivity(
            actionType.toUpperCase(), // Ensure uppercase VIEW or CLICK
            user, // Pass the whole user object
            policyId,
            `Success - ${actionType}` // Status message
        );
        res.status(200).json({ message: `${actionType} tracked successfully for ${policyId}` });
    } catch (err) {
        console.error(`Error logging policy interaction (${actionType}):`, err);
        res.status(500).json({ message: `Error logging activity for ${actionType}` });
    }
});

// --- Policy File Serving Routes ---

// Route to VIEW policy files inline
app.get('/view-policy/:filename', ensureUserData, async (req, res) => {
    if (!req.user || !user.id) { // Require login to view
       return res.status(401).send('Please log in to view policies.');
    }

    const { filename } = req.params;
    const user = req.user;
    const policyId = decodeURIComponent(filename); // Use filename as policyId for logging

    // Construct potential file path (adjust if your structure differs)
    const filePath = path.join(__dirname, 'public', 'policies', 'audit', policyId);
     console.log(`Attempting to view file: ${filePath} for user ${user.email}`);


    try {
        // Check if file exists (use fs.promises for async)
        // Note: fs.existsSync is synchronous, avoid in async routes if possible
        // A better way is to let sendFile handle the error
        /*
        try {
            await fs.promises.access(filePath, fs.constants.R_OK); // Check read access
        } catch (fsErr) {
            console.error(`File not found or not readable: ${filePath}`);
            await logUserActivity('VIEW', user, policyId, "FAILED - File Not Found").catch(console.error);
            return res.status(404).send('Policy file not found.');
        }
        */

        // Log the view attempt BEFORE sending file
        await logUserActivity('VIEW', user, policyId, "Attempted View");

        // Send the file inline
        res.setHeader('Content-Disposition', `inline; filename="${policyId}"`); // Keep original filename
        res.sendFile(filePath, async (err) => {
            if (err) {
                 console.error(`Error sending file ${policyId} for view:`, err);
                 // Log failure only if sendFile fails AFTER logging the attempt
                 // Avoid double logging on file not found if checking first
                 await logUserActivity('VIEW', user, policyId, `FAILED - ${err.code || 'Send Error'}`).catch(console.error);
                 if (!res.headersSent) { // Check if headers were already sent
                    if(err.code === "ENOENT"){
                         return res.status(404).send('Policy file not found.');
                    } else {
                        return res.status(500).send('Error sending policy file.');
                    }
                 }
            } else {
                console.log(`File ${policyId} viewed successfully by ${user.email}`);
                // Optionally log SUCCESS here, but logging the attempt might be enough
                 await logUserActivity('VIEW', user, policyId, "Success - Viewed").catch(console.error);
            }
        });

    } catch (err) { // Catch errors from logUserActivity or other async issues
        console.error('Error in view-policy route:', err);
        res.status(500).send('Server error while processing view request.');
    }
});


// Route to DOWNLOAD policy files as attachments
app.get('/download-policy/:filename', ensureUserData, async (req, res) => {
     if (!req.user || !user.id) { // Require login to download
        return res.status(401).send('Please log in to download policies.');
     }

    const { filename } = req.params;
    const user = req.user;
    const policyId = decodeURIComponent(filename); // Use filename as policyId

    // Construct potential file path
    const filePath = path.join(__dirname, 'public', 'policies', 'audit', policyId);
     console.log(`Attempting to download file: ${filePath} for user ${user.email}`);

    try {
        // Log download attempt
        await logUserActivity('DOWNLOAD', user, policyId, "Attempted Download");

        // Send the file as an attachment
        res.download(filePath, policyId, async (err) => { // policyId is the filename presented to user
            if (err) {
                 console.error(`Error downloading file ${policyId}:`, err);
                  await logUserActivity('DOWNLOAD', user, policyId, `FAILED - ${err.code || 'Download Error'}`).catch(console.error);

                 if (!res.headersSent) {
                     if (err.code === "ENOENT") {
                         res.status(404).send('Policy file not found.');
                     } else {
                         res.status(500).send('Error downloading policy file.');
                     }
                 }
            } else {
                console.log(`File ${policyId} downloaded successfully by ${user.email}`);
                 await logUserActivity('DOWNLOAD', user, policyId, "Success - Downloaded").catch(console.error);
            }
        });
    } catch (err) { // Catch errors from logUserActivity
        console.error('Error in download-policy route:', err);
        res.status(500).send('Server error while processing download request.');
    }
});


// --- Simple GET routes for other pages ---
app.get("/manuals", ensureUserData, (req, res) => {
     if (!req.user || req.user.userType === 'guest') return res.redirect('/');
     res.render("manuals", { user: req.user });
});

app.get("/circular", ensureUserData, (req, res) => {
     if (!req.user || req.user.userType === 'guest') return res.redirect('/');
     res.render("circular", { user: req.user });
});

// --- Admin Route Example (Delete Policy) ---
// Add more robust admin check if needed
app.delete('/delete-policy/:filename', ensureUserData, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        console.warn(`Unauthorized delete attempt by user: ${req.user?.email || 'Guest'}`);
        return res.status(403).json({ message: 'Forbidden: Admin privileges required.' });
    }

    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(__dirname, 'public', 'policies', 'audit', decodedFilename);

    console.log(`Admin ${req.user.email} attempting to delete file: ${filePath}`);

    try {
        // Use fs.promises for async unlink
        await fs.promises.unlink(filePath);
        console.log(`File deleted successfully: ${filePath}`);
        // Log admin action (consider a separate admin log or use userActivity log)
         await logUserActivity('DELETE_POLICY', req.user, decodedFilename, "Success").catch(console.error);
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err);
        if (err.code === 'ENOENT') {
             await logUserActivity('DELETE_POLICY', req.user, decodedFilename, "FAILED - Not Found").catch(console.error);
             return res.status(404).json({ message: 'File not found' });
        } else {
             await logUserActivity('DELETE_POLICY', req.user, decodedFilename, "FAILED - Server Error").catch(console.error);
             return res.status(500).json({ message: 'Error deleting file' });
        }
    }
});


// --- Catch-all for 404 Not Found (Place Last) ---
app.use((req, res, next) => {
  res.status(404).send("Sorry, that page doesn't exist!");
});

// --- Global Error Handler (Place Very Last) ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  // Avoid sending stack trace to client in production
  res.status(500).send('Something broke on the server!');
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; // Optional: for testing