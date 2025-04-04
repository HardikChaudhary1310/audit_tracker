const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const path = require("path");
const pgSession = require('connect-pg-simple')(session);
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
const cookieParser = require('cookie-parser');



const app = express();


app.use(cookieParser()); // Ensure this is before session middleware
// app.use(session({
//     store: new pgSession({
//         pool: pool,
//         tableName: 'user_sessions',
//         createTableIfMissing: true,
//         pruneSessionInterval: 60,
//         // Add these critical settings:
//         ttl: 86400, // 24 hours in seconds
//         schemaName: 'public',
//         // Error handling
//         errorLog: console.error
//     }),
//     secret: process.env.SESSION_SECRET || 'fallback-secret-key-please-change',
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//         secure: process.env.NODE_ENV === 'production', // false in development
//         httpOnly: true,
//         maxAge: 24 * 60 * 60 * 1000, // 1 day
//         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//         domain: process.env.COOKIE_DOMAIN || 'localhost'
//     },
//     name: 'auditTracker.sid',
//     // Add this to help with session reloading
//     rolling: true
// }));
  

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 60,
        ttl: 86400, // 24 hours
        // Add these critical error handlers
        dispose: (sessionId) => console.log('Session disposed:', sessionId),
        reapInterval: 3600, // Cleanup interval in seconds
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-please-change',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined // Better for localhost
    },
    name: 'auditTracker.sid',
    rolling: true, // Reset maxAge on every request
    unset: 'destroy' // Destroy session when unset
}));

// This middleware runs after session is set up and will log session details
// Add this after session middleware
// app.use((req, res, next) => {
//     console.log('\n--- Session Debug ---');
//     console.log('Session ID:', req.sessionID);
//     console.log('Session:', req.session);
//     console.log('Cookies:', req.cookies);
//     console.log('Headers:', req.headers['cookie']);
//     console.log('--- End Session Debug ---\n');
//     next();
// });

// Add this after session middleware
app.use(async (req, res, next) => {
    console.log('\n--- SESSION VERIFICATION ---');
    
    // Verify session exists in DB
    try {
        const result = await pool.query(
            'SELECT sess FROM user_sessions WHERE sid = $1', 
            [req.cookies['auditTracker.sid']]
        );
        
        if (result.rows.length > 0) {
            console.log('Session found in DB:', result.rows[0].sess);
        } else {
            console.log('⚠️ Session NOT FOUND in database');
        }
    } catch (err) {
        console.error('Session verification error:', err);
    }
    
    next();
});
app.use(morgan('dev'));

const PORT = process.env.PORT || 3001; // Use environment variable for Port

// --- Middleware (Keep as is) ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors()); // Consider configuring CORS more restrictively for production
app.use(cookieParser());

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
    console.log("Session Object:", req.session);
    console.log("Session Object:", req.session);
    console.log("Session Cookie:", req.cookies);
  
    const sessionUser = req.session?.user;
    console.log("Session User:", sessionUser);
  
    if (!sessionUser) {
      console.log("❌ No active session user found. Redirecting to login.");
      return res.redirect("/");
    }
  
    req.user = sessionUser;
    console.log("User Data in mockUserAuth:", req.user);
  
    next();
  };
  






// --- Signup Route (Using PostgreSQL) ---
app.post("/signup", async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    
    // Validate email format
    if (!isValidEmail(username)) {
        await logUserActivity("SIGNUP_ATTEMPT", { email: username }, null, 
            "FAILED - Invalid email format", {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
        return res.status(400).json({ 
            message: "Invalid email format. Must be @shivalikbank.com" 
        });
    }

    // Validate password
    if (!isValidPassword(password) || password !== confirmPassword) {
        await logUserActivity("SIGNUP_ATTEMPT", { email: username }, null, 
            "FAILED - Invalid password", {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
        return res.status(400).json({ 
            message: "Password must be valid and match confirmation." 
        });
    }

    try {
        // Check existing user
        const { rows } = await pool.query(
            'SELECT id FROM users WHERE email = $1', 
            [username]
        );

        if (rows.length > 0) {
            await logUserActivity("SIGNUP_ATTEMPT", { email: username }, null, 
                "FAILED - User exists", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            return res.status(400).json({ 
                message: "User already exists. Please log in." 
            });
        }

        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const userType = username.toLowerCase() === 'admin@shivalikbank.com' ? 'admin' : 'user';

        const { rows: [newUser] } = await pool.query(`
            INSERT INTO users (username, email, password, verified, userType)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, userType
        `, [username, username, hashedPassword, false, userType]);

        // Generate verification token
        const token = jwt.sign(
            { userId: newUser.id, email: username }, 
            process.env.JWT_SECRET || "DEFAULT_SECRET_KEY", 
            { expiresIn: '1h' }
        );

        // Send verification email
        const verificationLink = `${process.env.BASE_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
        
        transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: username,
            subject: "Verify Your Email For Audit Tracker Portal",
            text: `Hello ${username},\n\nThank you for signing up!\n\nClick the link below to verify your email:\n${verificationLink}\n\nThis link will expire in 1 hour. If you did not sign up, please ignore this email.`
        }, async (error, info) => {
            if (error) {
                await logUserActivity("SIGNUP_ATTEMPT", { id: newUser.id, email: username }, null, 
                    "FAILED - Email send error", {
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        error: error.message
                    });
                return res.status(500).json({ 
                    message: "Signup complete, but failed to send verification email. Contact support." 
                });
            }

            await logUserActivity("SIGNUP_SUCCESS", { id: newUser.id, email: username }, null, 
                "SUCCESS - Verification email sent", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });

            res.status(200).json({
                message: "Signup successful! Check your email to verify your account.",
                redirectUrl: "/home",
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    userType: newUser.userType
                }
            });
        });

    } catch (err) {
        console.error("Signup error:", err);
        await logUserActivity("SIGNUP_ATTEMPT", { email: username }, null, 
            "FAILED - Server error", {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                error: err.message
            });
        res.status(500).json({ 
            message: "Server error during signup." 
        });
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
// app.get("/home", (req, res) => {
//     console.log("--- DEBUG START ---");
//     console.log("Request Session ID:", req.sessionID);
//     console.log("Cookie Session ID:", req.cookies['auditTracker.sid']);
//     console.log("Session:", req.session);
//     console.log("Session User:", req.session?.user);
//     console.log("Cookies:", req.cookies);
//     console.log("--- DEBUG END ---");

//     try {
//         const result = await pool.query(
//             'SELECT sess FROM user_sessions WHERE sid = $1', 
//             [req.cookies['auditTracker.sid']]
//         );
        
//         if (result.rows.length > 0) {
//             console.log('Session found in DB:', result.rows[0].sess);
//         } else {
//             console.log('⚠️ Session NOT FOUND in database');
//         }
//     } catch (err) {
//         console.error('Session verification error:', err);
//     }

//     if (!req.session.user) {
//         console.log("No user in session, redirecting to login");
//         return res.redirect("/");
//     }

//     res.render("home", { user: req.session.user });
// });
const sessionRestorationMiddleware = async (req, res, next) => {
    console.log("\n--- SESSION VERIFICATION ---");
    console.log("Request Session ID:", req.sessionID);
    console.log("Cookie Session ID:", req.cookies['auditTracker.sid']);
    
    let dbSessionData = null;
    
    try {
        // Query the session from database
        const result = await pool.query(
            'SELECT sess FROM user_sessions WHERE sid = $1', 
            [req.cookies['auditTracker.sid'] || req.sessionID]
        );
        
        if (result.rows.length > 0) {
            dbSessionData = result.rows[0].sess;
            console.log('Session found in DB:', dbSessionData);
            
            // Restore session if needed
            if (!req.session.user && dbSessionData.user) {
                console.log('Restoring user session from DB');
                req.session.user = dbSessionData.user;
                await new Promise((resolve, reject) => {
                    req.session.save(err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        } else {
            console.log('⚠️ Session NOT FOUND in database');
        }
    } catch (err) {
        console.error('Session verification error:', err);
    }

    // Attach user data to request for all routes
    req.authenticatedUser = req.session.user || (dbSessionData?.user || null);
    
    if (!req.authenticatedUser) {
        console.log("No user in session, redirecting to login");
        return res.redirect("/");
    }
    
    console.log("User authenticated:", req.authenticatedUser.email);
    next();
}; 


// app.get("/home", async (req, res) => { // Make the callback async

//     console.log("--- DEBUG START ---");
//     console.log("Request Session ID:", req.sessionID);
//     console.log("Cookie Session ID:", req.cookies['auditTracker.sid']);
//     console.log("Session:", req.session);
//     console.log("Session User:", req.session?.user);
//     console.log("Cookies:", req.cookies);
//     console.log("--- DEBUG END ---");
    
//     let dbSessionData = null; // Variable to store session data from DB
    
//     try {
//         // Query the session from database using the cookie session ID
//         const result = await pool.query(
//             'SELECT sess FROM user_sessions WHERE sid = $1', 
//             [req.cookies['auditTracker.sid'] || req.sessionID]
//         );
        
//         if (result.rows.length > 0) {
//             dbSessionData = result.rows[0].sess;
//             console.log('Session found in DB:', dbSessionData);
            
//             // If session exists in DB but not in memory, restore it
//             if (!req.session.user && dbSessionData.user) {
//                 console.log('Restoring user session from DB');
//                 req.session.user = dbSessionData.user;
//                 await new Promise((resolve, reject) => {
//                     req.session.save(err => {
//                         if (err) {
//                             console.error('Error saving restored session:', err);
//                             reject(err);
//                         } else {
//                             resolve();
//                         }
//                     });
//                 });
//             }
//         } else {
//             console.log('⚠️ Session NOT FOUND in database');
//         }
//     } catch (err) {
//         console.error('Session verification error:', err);
//     }

//     // Final check - use either in-memory session or DB-restored session
//     const userData = req.session.user || (dbSessionData?.user || null);
    
//     if (!userData) {
//         console.log("No user in session, redirecting to login");
//         return res.redirect("/");
//     }

//     console.log("User authenticated:", userData.email);
//     res.render("home", { user: userData });
// });
  
// Home route
app.get("/home", sessionRestorationMiddleware, (req, res) => {
    res.render("home", { user: req.authenticatedUser });
});

// Policy route
app.get("/policy", sessionRestorationMiddleware, (req, res) => {
    res.render("policy", { user: req.authenticatedUser });
});

// Manuals route
app.get("/manuals", sessionRestorationMiddleware, (req, res) => {
    res.render("manuals", { user: req.authenticatedUser });
});

// Circular route
app.get("/circular", sessionRestorationMiddleware, (req, res) => {
    res.render("circular", { user: req.authenticatedUser });
});
// --- Activity Tracking Routes (Using PostgreSQL and logUserActivity) ---

app.use((req, res, next) => {
    if (req.path.startsWith('/track-')) {
      console.log('\n--- TRACKING REQUEST ---');
      console.log('Path:', req.path);
      console.log('Method:', req.method);
      console.log('User:', req.user || 'Unauthenticated');
      console.log('Body:', req.body);
      console.log('IP:', req.ip);
      console.log('User Agent:', req.get('User-Agent'));
      console.log('--- END TRACKING REQUEST ---\n');
    }
    next();
  });

// Add this test route to check DB connection
app.get('/test-db', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      res.json({ dbConnected: true, time: result.rows[0].current_time });
    } catch (err) {
      console.error('Database connection error:', err);
      res.status(500).json({ dbConnected: false, error: err.message });
    }
  });


// In your index.js (backend)
app.post('/track-download', mockUserAuth, async (req, res) => {
    try {
        const { policyId, filename } = req.body;
        const user = req.user;

        // Insert into database
        const result = await pool.query(
            `INSERT INTO policy_tracking 
            (user_id, username, policy_id, action_type, file_path, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [user.id, user.email, policyId, 'DOWNLOAD', filename, req.ip, req.get('User-Agent')]
        );

        // Return JSON response
        res.json({ 
            success: true,
            trackingId: result.rows[0].id 
        });
    } catch (error) {
        console.error('Download tracking error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.post('/track-view', mockUserAuth, async (req, res) => {
    try {
        const { policyId, filename } = req.body;
        const user = req.user;

        // Insert into database
        const result = await pool.query(
            `INSERT INTO policy_tracking 
            (user_id, username, policy_id, action_type, file_path, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [user.id, user.email, policyId, 'VIEW', filename, req.ip, req.get('User-Agent')]
        );

        // Return JSON response
        res.json({ 
            success: true,
            trackingId: result.rows[0].id 
        });
    } catch (error) {
        console.error('View tracking error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});


app.get('/admin/policy-stats', mockUserAuth, async (req, res) => {
    if (req.user.userType !== 'admin') {
        return res.status(403).send('Access denied');
    }

    try {
        const { rows } = await pool.query(`
            SELECT * FROM policy_tracking 
            ORDER BY timestamp DESC 
            LIMIT 100
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching policy stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});



app.get('/test-auth', mockUserAuth, (req, res) => {
    res.json({ user: req.user });
  });



app.post('/track-policy-click', mockUserAuth, async (req, res) => {
    const { policyId, filename, actionType } = req.body;
    const user = req.user;

    if (!user || !user.id) {
        return res.status(401).json({ message: "User authentication required." });
    }

    try {
        await logUserActivity(actionType, user, policyId, "Success", {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            filePath: filename
        });
        res.status(200).json({ message: `${actionType} tracked successfully` });
    } catch (err) {
        console.error(`Error tracking ${actionType}:`, err);
        res.status(500).json({ message: `Server error while tracking ${actionType}` });
    }
});
app.get('/policy-stats/:policyId', mockUserAuth, async (req, res) => {
    const { policyId } = req.params;
    
    try {
        const statsQuery = `
            SELECT 
                action_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users,
                MIN(timestamp) as first_occurrence,
                MAX(timestamp) as last_occurrence
            FROM policy_tracking
            WHERE policy_id = $1
            GROUP BY action_type
        `;
        
        const { rows } = await pool.query(statsQuery, [policyId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching policy stats:', err);
        res.status(500).json({ message: "Error fetching policy statistics" });
    }
});

// Route for DOWNLOAD using logUserActivity
// app.post('/track-download', mockUserAuth, async (req, res) => { // Make async
//     const { policyId, filename } = req.body;
//     const user = req.user; // Get user from middleware

//      if (!user || !user.id) {
//          console.error("Tracking Error: User not authenticated or missing ID.");
//          return res.status(401).json({ message: "User authentication required." });
//     }
//     if (!policyId) {
//         return res.status(400).json({ message: "Policy ID is required" });
//     }
//      const safeFilename = filename || policyId;

//     console.log(`Tracking DOWNLOAD for policy: ${safeFilename} (ID: ${policyId}), User: ${user.username} (ID: ${user.id})`);

//     try {
//         // Log using the centralized function
//         await logUserActivity('DOWNLOAD', user, policyId, "Success - Downloaded");

//         // Optional: If you still need the separate 'activities' table
//         /*
//         const insertActivitiesQuery = `
//             INSERT INTO activities (action_type, email, policy_id, user_id)
//             VALUES ($1, $2, $3, $4)`;
//         await pool.query(insertActivitiesQuery, ['DOWNLOAD', user.username, policyId, user.id]);
//         console.log(`Also logged to 'activities' table.`);
//         */

//         res.status(200).json({ message: "Download tracked successfully" });

//     } catch (err) {
//         console.error(`❌ Error tracking DOWNLOAD for policy ${policyId}:`, err);
//         res.status(500).json({ message: "Server error while tracking download" });
//     }
// });

// --- Login Route (Using PostgreSQL) ---
// --- Login Route (Using PostgreSQL) ---
// --- Login Route (Using PostgreSQL) ---
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    let userId = null;

    // Basic validation
    if (!username || !password) {
        await logUserActivity("LOGIN_ATTEMPT", { email: username || 'unknown' }, null, 
            "FAILED - Missing credentials", {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
        return res.status(400).json({ 
            success: false, 
            message: "Username and password are required." 
        });
    }

    try {
        // Check user exists
        const { rows } = await pool.query(
            "SELECT id, email, password, userType, verified FROM users WHERE email = $1", 
            [username]
        );

        if (rows.length === 0) {
            await logUserActivity("LOGIN_ATTEMPT", { email: username }, null, 
                "FAILED - User not found", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials." 
            });
        }

        const user = rows[0];
        userId = user.id;

        // Check verification status
        if (!user.verified) {
            await logUserActivity("LOGIN_ATTEMPT", { id: userId, email: username }, null, 
                "FAILED - Account not verified", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            return res.status(401).json({ 
                success: false, 
                message: "Account not verified. Please check your email." 
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await logUserActivity("LOGIN_ATTEMPT", { id: userId, email: username }, null, 
                "FAILED - Invalid password", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials." 
            });
        }

        // Update last login time
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1', 
            [userId]
        );

        // Create session
        req.session.user = {
            id: user.id,
            email: user.email,
            userType: user.userType
        };

        req.session.save(async (err) => {
            if (err) {
                await logUserActivity("LOGIN_ATTEMPT", { id: userId, email: username }, null, 
                    "FAILED - Session save error", {
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        error: err.message
                    });
                return res.status(500).json({ 
                    success: false, 
                    message: "Server error during login." 
                });
            }

            // Successful login
            await logUserActivity("LOGIN_SUCCESS", { id: userId, email: username }, null, 
                "SUCCESS", {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });

            res.cookie('auditTracker.sid', req.sessionID, {
                maxAge: 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });

            res.status(200).json({ 
                success: true,
                message: "Login successful!", 
                redirectUrl: "/home",
                user: {
                    id: user.id,
                    email: user.email,
                    userType: user.userType
                }
            });
        });

    } catch (error) {
        console.error("Login process error:", error);
        await logUserActivity("LOGIN_ATTEMPT", 
            userId ? { id: userId, email: username } : { email: username }, 
            null, 
            "FAILED - Server error", {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                error: error.message
            });
        res.status(500).json({ 
            success: false, 
            message: "Server error during login." 
        });
    }
});
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
app.post('/log-activity', async (req, res) => {
    const { actionType, username, policyId, status } = req.body;
    
    try {
      const result = await logUserActivity(actionType, { username }, policyId, status);
      res.status(200).json({ success: true, message: 'Activity logged successfully', data: result });
    } catch (error) {
      console.error('Error logging activity:', error);
      res.status(500).json({ success: false, message: 'Error logging activity' });
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

// app.get("/home", mockUserAuth, (req, res) => { // Add auth middleware
//      if (!req.session.user) return res.redirect('/'); // Redirect if not logged in
//     res.render("home", { user: req.user }); // Pass user info
// });

// app.get("/policy", mockUserAuth, (req, res) => { // Add auth middleware
//      if (!req.session.user) return res.redirect('/');
//     res.render("policy", { user: req.user });
// });

// app.get("/manuals", mockUserAuth, (req, res) => { // Add auth middleware
//      if (!req.session.user) return res.redirect('/');
//     res.render("manuals", { user: req.user });
// });

// app.get("/circular", mockUserAuth, (req, res) => { // Add auth middleware
//      if (!req.session.user) return res.redirect('/');
//     res.render("circular", { user: req.user });
// });


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