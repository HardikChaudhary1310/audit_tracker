// index.js

// --- Configuration & Setup ---
require('dotenv').config(); // Load environment variables from .env file (for local dev)
const express = require('express');
const fs = require('fs'); // Keep for file serving/checking, NOT for data storage
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const path = require("path");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// Database connection pool (Make sure models/db.js uses process.env.DATABASE_URL)
const promisePool = require('./models/db');
// User activity logging function (Make sure models/userActivity.js uses the SAME promisePool from models/db.js)
const { logUserActivity } = require('./models/userActivity');

const app = express();

// --- Environment Variables Check (Essential for Production) ---
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'SESSION_SECRET',
    'SECRET_KEY', // For JWT
    'BASE_URL', // For verification emails etc.
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD'
    // Add REDIS_URL if using Redis sessions
];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.warn(`Warning: Environment variable ${varName} is not set.`);
        // In production, you might want to exit if critical variables are missing
        if (process.env.NODE_ENV === 'production' && ['DATABASE_URL', 'SESSION_SECRET', 'SECRET_KEY'].includes(varName)) {
           console.error(`FATAL ERROR: Missing critical environment variable ${varName}. Exiting.`);
           process.exit(1);
        }
    }
});

// --- Constants ---
const PORT = process.env.PORT || 3001; // Use Render's port or 3001 locally
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Middleware Setup ---
app.use(morgan('dev')); // Logging HTTP requests
app.use(cors()); // Enable CORS (adjust options if needed for security)
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 })); // Parse URL-encoded data

// --- Session Configuration (Using Redis Recommended for Production) ---
// Choose ONE session store method:

// OPTION 1: Redis Session Store (Recommended for Render)
// Make sure you have Redis running locally or added on Render
// Install: npm install redis connect-redis
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");

let redisClient = createClient({ url: process.env.REDIS_URL }); // Use Render's REDIS_URL or local redis://localhost:6379
redisClient.connect().catch(err => console.error('Redis Connect Error:', err));
redisClient.on('error', err => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis successfully.'));

let redisStore = new RedisStore({
  client: redisClient,
  prefix: "auditapp:", // Optional prefix for keys in Redis
});

app.use(session({
    store: redisStore,
    secret: process.env.SESSION_SECRET, // Use secure secret from environment variables
    resave: false, // Required for RedisStore/most stores
    saveUninitialized: false, // Don't save sessions for unauthenticated users
    cookie: {
      secure: IS_PRODUCTION, // Set to true if using HTTPS (Render provides HTTPS)
      httpOnly: true, // Prevent client-side JS access to cookie
      maxAge: 1000 * 60 * 60 * 24 * 7 // e.g., 7 days validity
     }
}));

/* // OPTION 2: MemoryStore (Development ONLY - data lost on restart)
if (!IS_PRODUCTION) {
    app.use(session({
        secret: process.env.SESSION_SECRET || 'dev_fallback_secret',
        resave: false,
        saveUninitialized: true, // Maybe true for dev?
        cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 2 } // Shorter age for dev
    }));
    console.warn("Using MemoryStore for sessions - suitable ONLY for development.");
} else {
    // You MUST configure a persistent store like Redis for production
    console.error("FATAL: No persistent session store configured for production!");
    // process.exit(1); // Exit if no persistent store in prod
}
*/

// --- View Engine Setup ---
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- Static Files ---
// Serve files from 'public' directory (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
// Allow access to policy files via a specific path if needed, e.g., /policies/audit/file.pdf
app.use('/policies', express.static(path.join(__dirname, 'public', 'policies')));


// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,     // Use environment variable
        pass: process.env.GMAIL_APP_PASSWORD, // Use environment variable (App Password)
    },
});


// --- Helper Functions ---
const isValidEmail = (username) => {
    // Keep your existing validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/;
    return emailRegex.test(username);
};

const isValidPassword = (password) => {
    // Keep your existing validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};

// Simple Authentication Middleware (Example - adjust as needed)
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    console.log("Access denied: User not logged in. Session:", req.session);
    // Redirect to login or send error depending on context
     if (req.accepts('html')) {
       return res.redirect('/'); // Redirect HTML requests to login
     } else {
        return res.status(401).json({ message: 'Authentication required.' }); // Send JSON error for API requests
     }
  }
  // Make user info easily accessible in subsequent middleware/routes
  req.user = req.session.user;
  console.log("Authenticated user:", req.user);
  next();
};

// Authentication Middleware for API routes specifically
const mockUserAuth = (req, res, next) => {
    // This middleware seems designed for adding mock user data if none exists.
    // In a real app with requireLogin, this might become redundant or needs adjustment.
    // Let's ensure it doesn't overwrite a real logged-in user from session.
    if (req.session && req.session.user) {
        req.user = req.session.user; // Use the real user from session
        console.log("mockUserAuth: Using user from session:", req.user);
    } else {
         // If no user in session, create a mock/guest representation
         let guestUsername = 'guest_user'; // Or derive from somewhere if possible
         req.user = {
             id: 'guest_' + Date.now(),
             username: guestUsername,
             email: guestUsername + '@example.com', // Placeholder
             userType: 'guest'
         };
         console.log("mockUserAuth: No session user, using guest:", req.user);
    }
    next();
};


// --- Routes ---

// Root route - Render login/signup page
app.get("/", (req, res) => {
    // If user is already logged in, maybe redirect to home? Optional.
    // if (req.session.user) {
    //    return res.redirect('/home');
    // }
    res.render("index"); // Render your index.ejs (login/signup form)
});

// Signup Route (Using Database)
app.post("/signup", async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    console.log("Signup request received:", { username }); // Don't log passwords

    try {
        // Validation
        if (!isValidEmail(username)) {
            await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Invalid Email Format");
            return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
        }
        if (!isValidPassword(password)) {
            await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Invalid Password Format");
            return res.status(400).json({ message: "Password does not meet requirements." });
        }
        if (password !== confirmPassword) {
             await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Passwords Mismatch");
            return res.status(400).json({ message: "Passwords do not match." });
        }

        // Check if user already exists
        const [existingUsers] = await promisePool.query('SELECT id FROM users WHERE email = ?', [username]);
        if (existingUsers.length > 0) {
             await logUserActivity("SIGNUP", { email: username }, null, "FAILED - User Exists");
            return res.status(400).json({ message: "User already exists. Please log in." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10); // Use async bcrypt

        // Create new user object
        const newUser = {
            username: username, // Assuming username is the email for this app
            email: username,
            password: hashedPassword,
            verified: false, // Start as not verified
            userType: username === 'admin@shivalikbank.com' ? 'admin' : 'user'
        };

        // Insert user into database
        const [insertResult] = await promisePool.query('INSERT INTO users SET ?', newUser);
        const newUserId = insertResult.insertId; // Get the ID of the newly created user

        // Log successful signup attempt (before email sending)
        await logUserActivity("SIGNUP", { id: newUserId, email: username, userType: newUser.userType }, null, "Success - Pending Verification");

        // Generate JWT for verification
        const token = jwt.sign({ userId: newUserId, email: username }, process.env.SECRET_KEY, { expiresIn: '1h' });

        // Send verification email
        const verificationLink = `${process.env.BASE_URL}/verify-email?token=${token}`;
        const mailOptions = {
            from: `"Audit Tracker" <${process.env.GMAIL_USER}>`,
            to: username,
            subject: "Verify Your Email for Audit Tracker",
            text: `Hello ${username},\n\nThank you for signing up!\nPlease click the link below to verify your email address:\n${verificationLink}\n\nThis link will expire in 1 hour.\n\nIf you did not sign up, please ignore this email.`,
            html: `<p>Hello ${username},</p><p>Thank you for signing up!</p><p>Please click the link below to verify your email address:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>This link will expire in 1 hour.</p><p>If you did not sign up, please ignore this email.</p>`
        };

        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${username}`);

        // Send success response to frontend
        // Do NOT automatically log the user in here - wait for verification
        res.status(200).json({ message: "Signup successful! Please check your email to verify your account." });

    } catch (error) {
        console.error("Error during signup:", error);
        // Log generic signup failure
        await logUserActivity("SIGNUP", { email: username }, null, "FAILED - Server Error").catch(e => console.error("Failed to log signup error:", e));
        res.status(500).json({ message: "An error occurred during signup. Please try again." });
    }
});

// Email Verification Route
app.get("/verify-email", async (req, res) => {
    const { token } = req.query;
    console.log("Received verification token:", token);

    if (!token) {
        return res.status(400).send("Verification token is missing.");
    }

    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const { userId, email } = decoded;

        if (!userId || !email) {
             console.error("Verification Error: Invalid token payload", decoded);
             return res.status(400).send("Invalid verification token payload.");
        }
        console.log(`Attempting to verify email for User ID: ${userId}, Email: ${email}`);

        // Update user status in database
        const [updateResult] = await promisePool.query(
            'UPDATE users SET verified = true WHERE id = ? AND email = ? AND verified = false',
            [userId, email]
        );

        if (updateResult.affectedRows === 0) {
            // Check if already verified or user not found
            const [users] = await promisePool.query('SELECT verified FROM users WHERE id = ? AND email = ?', [userId, email]);
            if (users.length > 0 && users[0].verified) {
                console.log(`Email already verified for: ${email}`);
                return res.status(200).send(`<h2>Email Already Verified!</h2><p>Your email ${email} was already verified. You can now <a href="${process.env.BASE_URL || '/'}">log in</a>.</p>`);
            } else {
                 console.error(`Verification failed: User not found or mismatch for ID: ${userId}, Email: ${email}`);
                 return res.status(404).send("Verification failed. User not found or link invalid.");
            }
        }

        console.log(`Email verified successfully for: ${email} (User ID: ${userId})`);
        // Log successful verification
        await logUserActivity("EMAIL_VERIFICATION", { id: userId, email: email }, null, "Success");

        // Display success message
        res.status(200).send(`<h2>Email Verified Successfully!</h2><p>Your email ${email} has been verified. You can now <a href="${process.env.BASE_URL || '/'}">log in</a>.</p>`);

    } catch (error) {
        console.error("Error during email verification:", error);
        if (error instanceof jwt.TokenExpiredError) {
            res.status(400).send("Verification link has expired. Please sign up again or request a new link.");
        } else if (error instanceof jwt.JsonWebTokenError) {
            res.status(400).send("Invalid verification link.");
        } else {
            res.status(500).send("An error occurred during verification.");
        }
    }
});

// Login Route (Using Database)
app.post("/login", async (req, res) => {
    const { username, password } = req.body; // Assuming 'username' from form is the email
    console.log("Login attempt received for:", username); // Don't log password

    try {
        // Validation
        if (!username || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }
        if (!isValidEmail(username)) {
           await logUserActivity("LOGIN", { email: username }, null, "FAILED - Invalid Email Format");
           return res.status(400).json({ message: "Invalid email format." });
        }

        // Find user by email
        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [username]);

        if (users.length === 0) {
            console.log("Login Failed: User not found -", username);
            await logUserActivity("LOGIN", { email: username }, null, "FAILED - User Not Found");
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message
        }

        const user = users[0];

        // Check if verified
        if (!user.verified) {
            console.log("Login Failed: Email not verified -", username);
             await logUserActivity("LOGIN", { id: user.id, email: username }, null, "FAILED - Not Verified");
            return res.status(403).json({ message: "Please verify your email before logging in. Check your inbox." });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Login Failed: Incorrect password -", username);
             await logUserActivity("LOGIN", { id: user.id, email: username }, null, "FAILED - Incorrect Password");
            return res.status(401).json({ message: "Invalid credentials." }); // Generic message
        }

        // --- Login Successful ---
        console.log(`Login successful for User ID: ${user.id}, Email: ${user.email}`);

        // Regenerate session to prevent session fixation
        req.session.regenerate(async (err) => {
             if (err) {
                console.error("Error regenerating session:", err);
                await logUserActivity("LOGIN", { id: user.id, email: username }, null, "FAILED - Session Error");
                return res.status(500).json({ message: "Login failed due to a session error." });
             }

            // Store essential, non-sensitive user info in session
            req.session.user = {
                id: user.id,
                username: user.username, // Or email, depending on what you display
                email: user.email,
                userType: user.userType
            };

            // Save the session explicitly before sending the response
             req.session.save(async (saveErr) => {
                if (saveErr) {
                     console.error("Error saving session:", saveErr);
                     await logUserActivity("LOGIN", { id: user.id, email: username }, null, "FAILED - Session Save Error");
                     return res.status(500).json({ message: "Login failed due to a session saving error." });
                }

                // Log successful login AFTER session is established
                 await logUserActivity("LOGIN", req.session.user, null, "Success");

                // Send success response (e.g., user info or just success message)
                // The frontend JS (index.ejs) should handle the redirect to /home
                 res.status(200).json({
                     message: "Login successful",
                     user: req.session.user // Send back user info if needed by frontend
                 });
            });
        });

    } catch (error) {
        console.error("Error during login:", error);
         await logUserActivity("LOGIN", { email: username }, null, "FAILED - Server Error").catch(e => console.error("Failed to log login error:", e));
        res.status(500).json({ message: "An error occurred during login. Please try again." });
    }
});

// Logout Route
app.get('/logout', requireLogin, async (req, res) => { // Ensure user is logged in to log out
    const user = req.session.user; // Get user info before destroying session
    req.session.destroy(async (err) => {
        if (err) {
            console.error("Error destroying session:", err);
            // Optionally log logout failure
             return res.status(500).json({ message: "Logout failed." }); // Or redirect with error
        }
        // Log successful logout
        if (user) { // Check if user existed before destroy
           await logUserActivity("LOGOUT", user, null, "Success").catch(e => console.error("Failed to log logout:", e));
        }
        res.clearCookie('connect.sid'); // Adjust cookie name if you changed it
        console.log("User logged out successfully.");
        res.redirect('/'); // Redirect to login page
    });
});


// --- Protected Routes (Example: Require Login) ---

// Home route (Protected)
app.get("/home", requireLogin, (req, res) => {
    // req.user is available here thanks to requireLogin middleware
    res.render("home", { user: req.user });
});

// Policy route (Protected)
app.get("/policy", requireLogin, (req, res) => {
    res.render("policy", { user: req.user });
});

// Manuals route (Protected)
app.get("/manuals", requireLogin, (req, res) => {
    res.render("manuals", { user: req.user });
});

// Circular route (Protected)
app.get("/circular", requireLogin, (req, res) => {
    res.render("circular", { user: req.user });
});

// --- Policy Interaction Routes (Protected) ---

// Generic API route from routes/routes.js (Make sure this also has protection if needed)
const policyRoutes = require('./routes/routes'); // Assuming this defines API routes like /api/policies
app.use('/api', requireLogin, policyRoutes); // Apply requireLogin to all /api routes


// Track policy click/view (Ensure frontend sends correct actionType)
// This might duplicate logging if also called from /view-policy or /download-policy. Consolidate if needed.
app.post('/track-policy-click', requireLogin, async (req, res) => {
    const { policyId, actionType, filename } = req.body; // filename might be same as policyId
    const user = req.user;

    if (!policyId || !actionType || !['VIEW', 'CLICK'].includes(actionType)) {
        return res.status(400).json({ message: 'Policy ID and valid Action Type (VIEW/CLICK) are required.' });
    }
    console.log(`Tracking ${actionType} for policy: ${policyId}, User: ${user.email}`);

    try {
        await logUserActivity(actionType, user, policyId, `Success - ${actionType}ed`);
        res.status(200).json({ message: `${actionType} tracked successfully for ${filename || policyId}` });
    } catch (err) {
        console.error(`Error logging ${actionType} activity:`, err);
        res.status(500).json({ message: `Error logging ${actionType} activity` });
    }
});

// Track policy download (Ensure frontend sends policyId)
// This duplicates logging from /download-policy/:filename. Choose one place to log.
// Let's assume the main logging happens in the download route itself.
/*
app.post('/track-download', requireLogin, async (req, res) => {
    const { policyId } = req.body;
    const user = req.user;

    if (!policyId) {
        return res.status(400).json({ message: "policyId is required" });
    }
    console.log(`Tracking download for policy: ${policyId}, User: ${user.email}`);

    try {
        await logUserActivity('DOWNLOAD', user, policyId, "Success - Downloaded (POST)"); // Indicate source?
        res.status(200).json({ message: "Download tracked successfully (POST)" });
    } catch (err) {
        console.error("Error logging download activity (POST):", err);
        res.status(500).json({ message: "Error logging download activity (POST)" });
    }
});
*/


// View Policy File (Protected) - Streams file for inline viewing
app.get('/view-policy/:filename', requireLogin, async (req, res) => {
    const { filename } = req.params;
    const user = req.user;
    const policyId = decodeURIComponent(filename); // Use filename as policyId

    console.log(`View request for policy: ${policyId}, User: ${user.email}`);

    const filePath = path.join(__dirname, 'public', 'policies', 'audit', policyId); // Adjust path as needed

    // Check if file exists (Security: Basic check, ensure path traversal is not possible)
     if (!fs.existsSync(filePath) || !filePath.startsWith(path.join(__dirname, 'public', 'policies'))) {
        console.error(`File not found or invalid path for viewing: ${policyId}`);
        await logUserActivity('VIEW', user, policyId, "FAILED - File Not Found").catch(()=>{});
        return res.status(404).send('Policy file not found.');
    }

    try {
        // Log the view activity BEFORE sending the file
        await logUserActivity('VIEW', user, policyId, "Success - Viewed");

        // Send the file for inline display
        res.setHeader('Content-Disposition', `inline; filename="${policyId}"`); // Crucial for viewing
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file for viewing:', err);
                // Avoid logging view failure again if already logged success
                if (!res.headersSent) {
                    res.status(500).send('Error displaying file.');
                }
            } else {
                console.log(`File ${policyId} displayed successfully to ${user.email}`);
            }
        });

    } catch (err) {
        console.error('Error processing view-policy request:', err);
         await logUserActivity('VIEW', user, policyId, "FAILED - Server Error").catch(()=>{});
        if (!res.headersSent) {
            res.status(500).send('Server error while processing view request.');
        }
    }
});


// Download Policy File (Protected) - Prompts user to save
app.get('/download-policy/:filename', requireLogin, async (req, res) => {
    const { filename } = req.params;
    const user = req.user;
    const policyId = decodeURIComponent(filename); // Use filename as policyId

    console.log(`Download request for policy: ${policyId}, User: ${user.email}`);

    const filePath = path.join(__dirname, 'public', 'policies', 'audit', policyId); // Adjust path as needed

    // Check if file exists (Security: Basic check, ensure path traversal is not possible)
    if (!fs.existsSync(filePath) || !filePath.startsWith(path.join(__dirname, 'public', 'policies'))) {
        console.error(`File not found or invalid path for download: ${policyId}`);
        await logUserActivity('DOWNLOAD', user, policyId, "FAILED - File Not Found").catch(()=>{});
        return res.status(404).send('Policy file not found.');
    }

    try {
        // Log the download activity BEFORE sending the file
        await logUserActivity('DOWNLOAD', user, policyId, "Success - Downloaded");

        // Send the file as an attachment to prompt download
        res.download(filePath, policyId, (err) => { // The optional filename argument sets the downloaded file name
            if (err) {
                console.error('Error sending file for download:', err);
                // Avoid logging download failure again if already logged success
                // The 'download' method handles setting headers, so checking headersSent might be tricky
                // if (!res.headersSent) { // This might not work reliably with res.download errors
                //    res.status(500).send('Error downloading file.');
                // }
            } else {
                console.log(`File ${policyId} sent for download successfully to ${user.email}`);
            }
        });

    } catch (err) {
        console.error('Error processing download-policy request:', err);
        await logUserActivity('DOWNLOAD', user, policyId, "FAILED - Server Error").catch(()=>{});
        // if (!res.headersSent) {
             res.status(500).send('Server error while processing download request.');
        // }
    }
});


// Delete Policy File (Example - NEEDS Strong Admin Authorization)
// WARNING: File system deletion on Render is temporary. Consider cloud storage.
app.delete('/delete-policy/:filename', requireLogin, /* requireAdmin, */ (req, res) => {
    // !! IMPORTANT: Add an 'requireAdmin' middleware here to check req.user.userType === 'admin'
    // Example:
    // const requireAdmin = (req, res, next) => {
    //   if (req.user && req.user.userType === 'admin') {
    //      next();
    //   } else {
    //      return res.status(403).json({ message: 'Forbidden: Admin privileges required.' });
    //   }
    // };
    // Then use it: app.delete('/delete-policy/:filename', requireLogin, requireAdmin, ... )

    const { filename } = req.params;
    const user = req.user; // For logging who deleted
    const policyId = decodeURIComponent(filename);

    console.log(`DELETE request for policy: ${policyId} by User: ${user.email}`);

    const filePath = path.join(__dirname, 'public', 'policies', 'audit', policyId);

     // Security Check
    if (!filePath.startsWith(path.join(__dirname, 'public', 'policies'))) {
         console.error(`Forbidden deletion attempt: ${policyId}`);
         return res.status(403).json({ message: 'Forbidden path.' });
    }

    if (!fs.existsSync(filePath)) {
        console.error(`File not found for deletion: ${policyId}`);
        return res.status(404).json({ message: 'File not found' });
    }

    fs.unlink(filePath, async (err) => { // Use async for logging
        if (err) {
            console.error('Error deleting file:', err);
             await logUserActivity('DELETE_POLICY', user, policyId, "FAILED - File System Error").catch(()=>{});
            return res.status(500).json({ message: 'Error deleting file' });
        }

        console.log(`File deleted successfully: ${policyId} by ${user.email}`);
        await logUserActivity('DELETE_POLICY', user, policyId, "Success").catch(()=>{});
        res.status(200).json({ message: 'File deleted successfully' }); // Use 200 or 204 (No Content)
    });
});

// --- Catch-all for 404 Not Found (Should be last route) ---
app.use((req, res, next) => {
  res.status(404).render('404'); // Optional: Create a 404.ejs view
  // Or just: res.status(404).send("Sorry, can't find that!");
});

// --- Global Error Handler (Should be last app.use) ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  // Log error details here if needed
  res.status(err.status || 500).render('error', { // Optional: Create an error.ejs view
      message: err.message || "Something went wrong!",
      // Provide error stack only in development
      error: IS_PRODUCTION ? {} : err
  });
   // Or just: res.status(err.status || 500).send(err.message || "Something went wrong!");
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Base URL configured as: ${process.env.BASE_URL}`);
    // Log database host for confirmation (mask credentials if needed)
    const dbUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
    if (dbUrl) {
         console.log(`Attempting to connect to database host: ${dbUrl.hostname}`);
    } else {
        console.error("Database URL not configured!");
    }
});

module.exports = app; // Export app if needed for testing