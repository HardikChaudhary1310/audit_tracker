require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const path = require("path");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const promisePool = require('./models/db');

const logDir = path.join(__dirname, 'logs');
const logFilePath1 = path.join(__dirname, 'logs', 'user_data.json');

const { logUserActivity } = require('./models/userActivity');
const { isValidEmail, isValidPassword } = require("./utils/validation");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "hardikchaudhary713@gmail.com",
        pass: "atxj ijbl xuxt gwfe",
    },
});

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logUserActivity1 = (eventType, user, policyOrFilename, status) => {
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }); // Standard timestamp format
    
    // Debugging: Check what is undefined
    console.log("Logging activity for:", { eventType, user, policyOrFilename, status });

    // Ensure variables are defined
    const safeEventType = eventType || "Unknown";
    const safeUser = user || {}; // Default to empty object if undefined
    const safeEmail = safeUser.email || "Unknown Email";
    const safeUserType = safeUser.userType || "Unknown Type";
    const safePolicyFile = policyOrFilename || "N/A";
    const safeStatus = status || "Unknown";

    // Table log entry
    const tableEntry = `| ${timestamp} | ${safeEventType} | ${safeEmail} | ${safeUserType} | ${safePolicyFile} | ${safeStatus} |`;


    try {
        fs.appendFileSync(logFilePath1, tableEntry, 'utf8');
        console.log("✅ Login activity logged successfully:", tableEntry);
    } catch (error) {
        console.error("❌ Error logging user activity:", error);
    }
};

const policyRoutes = require('./routes/routes');

const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

// Session configuration
app.use(session({
    secret: "SECRET_KEY",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// CORS configuration
app.use(cors({
    origin: ['https://audit-tracker-w4p6.onrender.com', 'https://audit-tracker-1.onrender.com', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Ensure JSON responses
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

const PORT = process.env.PORT || 3001;

// Ensure the data file exists
if (!fs.existsSync(logFilePath1)) {
    fs.writeFileSync(logFilePath1, JSON.stringify([], null, 2));
}

app.use('/api', policyRoutes);

// Store user data in an array
let userData = [];

// Email validation
const isValidEmail = (username) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/;
    return emailRegex.test(username);
};

// Password validation
const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};

function readUserActivityLog() {
    if (!fs.existsSync(logFilePath)) {
        console.warn("⚠️ Log file does not exist. Returning empty array.");
        return []; // Return an empty array if file doesn't exist
    }

    try {
        const logData = fs.readFileSync(logFilePath, "utf8").trim();
        
        if (!logData) {
            console.warn("⚠️ Log file is empty. Returning empty array.");
            return []; // Return empty array if file is empty
        }

        // ✅ Convert log data into JSON array, skipping invalid lines
        let users = logData
            .split("\n")
            .filter(line => line.trim() !== "") // Ignore empty lines
            .map(line => {
                try {
                    return JSON.parse(line); // Try parsing each line
                } catch (error) {
                    console.error("❌ Invalid JSON line skipped:", line);
                    return null; // Skip invalid JSON
                }
            })
            .filter(user => user !== null); // Remove null entries

        return users;

    } catch (error) {
        console.error("❌ Error reading log file:", error);
        return []; // Return empty array on failure
    }
}

// Read user data from file
const readUserData = () => {
    try {
        if (!fs.existsSync(usersFilePath)) {
            return [];
        }

        const data = fs.readFileSync(usersFilePath, "utf8");

        // If file is empty, return an empty array
        if (!data.trim()) {
            return [];
        }

        // Split log file into lines and parse each line into an object
        const logs = data.split("\n").filter(line => line.trim()).map(line => {
            const parts = line.split(" | ");
            return {
                timestamp: parts[0] || "N/A",
                type: parts[1] || "N/A",
                username: parts[2] || "N/A",
                status: parts[3] || "N/A",
            };
        });

        return logs;

    } catch (error) {
        console.error("❌ Error reading log file:", error);
        return [];
    }
};

const writeUserData = (users) => {
    try {
        fs.writeFileSync(logFilePath1, JSON.stringify(users, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Error writing to JSON file:", error);
    }
};

const logEntry = 'Testing file write operation\n';

// Write test entry to the log
try {
    fs.writeFileSync(logFilePath1, logEntry);
    console.log('Test log file written successfully');
} catch (err) {
    console.error('Error writing to log file:', err);
}

let data = [];

// Log user actions (Signup/Login/Failure)
function logUserAction(username, password, type, status) {
    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
 
    const userLog = {
        username,
        password: type === 'signup' ? bcrypt.hashSync(password, 10) : password,  
        timestamp,
        type,
        status
    };
 
    userData.push(userLog);
    data.push(userData);
}

const mockUserAuth = (req, res, next) => {
    console.log("Session Data Before Middleware:", req.session?.user); // Debugging

    const user = req.session?.user || req.user || {};  

    req.user = {
        id: user.id || 'ID' + Date.now(),
        email: user.username || user.email || 'unknown_user', // Ensure username maps correctly
        userType: user.username === 'admin@shivalikbank.com' ? 'admin' : user.userType || 'user',
    };

    console.log("User After Middleware:", req.user); // Debugging
    next();
};

// Route to track policy clicks
app.post('/track-policy-click', mockUserAuth, (req, res) => {
    const { filename } = req.body;
    const { policyId, actionType } = req.body;
    const user = req.user;
  
    if (!policyId || !actionType || !filename) {
        return res.status(400).send('Policy ID and Action Type are required');
    }

    console.log("Request body track-policy-click:", req.body);
    console.log("User track-policy-click:", user);

    console.log(`Tracking ${actionType} for policy ${filename} with ID: ${policyId}`);

    if (!filename) {
        return res.status(400).send('Filename is required');
    }
 
    // Log the action with proper user information for both VIEW and CLICK
    if (actionType === 'VIEW' || actionType === 'CLICK') {
        logUserActivity(actionType, { 
            email: user.email || user.username, 
            userType: user.userType 
        }, policyId, `Success - ${actionType}ed`);
    }
    
    console.log("track-policy-click", user);
    res.status(200).json({ message: `${actionType} tracked successfully for ${filename}` });
});

app.post('/track-download', mockUserAuth, (req, res) => {
    console.log("Track-download route triggered!");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
 
    const { policyId } = req.body;
    const user = req.user;
  
    if (!policyId) {
        console.log("Missing policyId");
        return res.status(400).json({ message: "policyId is required" });
    }
 
    // Ensure we have the user's email/username
    const username = user.username || user.email;
    if (!username) {
        console.log("Missing username/email");
        return res.status(400).json({ message: "User information is missing" });
    }

    console.log(`Tracking download for policy with ID: ${policyId}, User: ${username}`);
    
    // Log the download activity with proper user information
    logUserActivity('DOWNLOAD', { email: username, userType: user.userType }, policyId, "Success - Downloaded");

    console.log("Download tracked successfully!");
    res.status(200).json({ message: "Download tracked successfully" });
});

app.post("/signup", async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        console.log("Signup request received:", { username, password, confirmPassword });

        // Validate email format
        if (!isValidEmail(username)) {
            await logUserActivity("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED - Invalid Email");
            return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
        }

        // Validate password
        if (!isValidPassword(password) || password !== confirmPassword) {
            await logUserActivity("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED - Invalid Password");
            return res.status(400).json({ message: "Invalid password or mismatch." });
        }

        try {
            // Check if user already exists in the database
            const [results] = await promisePool.query('SELECT * FROM users WHERE email = ?', [username]);
            
            if (results.length > 0) {
                await logUserActivity("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED - User Exists");
                return res.status(400).json({ message: "User already exists. Please log in." });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user object
            const newUser = {
                username,
                email: username,
                password: hashedPassword,
                verified: false,
                userType: username === 'admin@shivalikbank.com' ? 'admin' : 'user'
            };

            // Insert the new user
            await promisePool.query('INSERT INTO users SET ?', newUser);

            // Generate token for email verification
            const token = jwt.sign({ username }, "SECRET_KEY", { expiresIn: '1h' });

            // Send verification email
            const verificationLink = `${process.env.APP_URL || 'https://audit-tracker-w4p6.onrender.com'}/verify-email?token=${token}`;
            const mailOptions = {
                from: "hardikchaudhary713@gmail.com",
                to: username,
                subject: "Verify Your EmailId For Audit Tracker Portal",
                text: `Hello ${username},\n\nThank you for signing up!\n\nYour login details:\nUsername: ${username}\nPassword: ${password}\n\nClick the link below to verify your email:\n${verificationLink}\nThis link will expire in 1 hour.`
            };

            await transporter.sendMail(mailOptions);

            // Log successful signup
            await logUserActivity("SIGNUP", { email: username, userType: "user" }, "N/A", "Success - Signed Up");

            // Set proper headers
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({ 
                message: "Signup successful! Check your email to verify your account.",
                success: true
            });
        } catch (dbError) {
            console.error("Database error during signup:", dbError);
            
            // Handle specific database errors
            if (dbError.code === 'ECONNREFUSED') {
                return res.status(503).json({ 
                    message: "Database service is temporarily unavailable. Please try again later.",
                    error: "Database connection refused"
                });
            }
            
            await logUserActivity("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED - Database Error");
            return res.status(500).json({ 
                message: "Error during signup. Please try again later.",
                error: dbError.message
            });
        }
    } catch (error) {
        console.error("Unexpected error during signup:", error);
        await logUserActivity("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED - Server Error");
        return res.status(500).json({ 
            message: "An unexpected error occurred. Please try again later.",
            error: error.message
        });
    }
});

app.get("/verify-email", (req, res) => {
    const { token } = req.query;
    console.log("🔹 Received token for verification:", token);

    if (!token) {
        return res.status(400).json({ message: "Invalid or missing verification token." });
    }

    try {
        console.log("🔑 Decoding token:", token);
        const decoded = jwt.verify(token, "SECRET_KEY");
        console.log("✅ Token Decoded:", decoded);

        if (!decoded.username) {
            console.error("❌ Verification Error: Username missing");
            return res.status(400).json({ message: "Invalid token structure." });
        }

        const username = decoded.username;
        console.log("✅ Extracted Username:", username);

        // Update user verification status in database
        promisePool.query('UPDATE users SET verified = true WHERE email = ?', [username])
            .then(([results]) => {
                if (results.affectedRows === 0) {
                    console.error("❌ User not found for verification");
                    return res.status(404).json({ message: "User not found." });
                }

                console.log(`✅ Email verified successfully for: ${username}`);
                return res.status(200).send(`
                    <h2>Email Verified Successfully!</h2>
                    <p>Your email has been verified. You can now <a href="https://audit-tracker-w4p6.onrender.com/">log in</a>.</p>
                `);
            })
            .catch(err => {
                console.error("❌ Database Error:", err);
                return res.status(500).json({ message: "Error updating verification status." });
            });
    } catch (error) {
        console.error("❌ Verification Error:", error.message);
        return res.status(400).send(`
            <h2>Invalid or Expired Token</h2>
            <p>The verification link may have expired or is invalid.</p>
            <p>Please try signing up again or contact support.</p>
        `);
    }
});

// Function to read and extract user credentials from log file
function readUsersFromLog() {
    try {
        if (!fs.existsSync(logFilePath1)) {
            console.error("Log file does not exist.");
            return [];
        }

        const data = fs.readFileSync(logFilePath1, "utf8").trim();
        if (!data) return [];

        return data.split("\n").map(line => {
            const jsonStart = line.indexOf("{");
            if (jsonStart === -1) return null; // Skip non-JSON lines

            const jsonPart = line.substring(jsonStart);
            try {
                return JSON.parse(jsonPart); // Parse valid JSON entries
            } catch (error) {
                console.error("Skipping invalid log entry:", jsonPart);
                return null;
            }
        }).filter(entry => entry !== null);
    } catch (error) {
        console.error("Error reading user log:", error);
        return [];
    }
}

app.post("/login", (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - Missing Credentials");
            return res.status(400).json({ message: "Email and password are required." });
        }

        console.log("✅ Extracted Username (Email):", username);

        // Check user in database
        promisePool.query('SELECT * FROM users WHERE email = ?', [username])
            .then(([results]) => {
                if (results.length === 0) {
                    logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - User Not Found");
                    return res.status(401).json({ message: "User not found." });
                }

                const user = results[0];
                console.log("🔍 Found User:", user);

                // Check if user is verified
                if (!user.verified) {
                    console.log("❌ User is not verified.");
                    return res.status(403).json({ message: "Please verify your email before logging in. Check your inbox for the verification link." });
                }

                // Compare password using bcrypt
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) {
                        console.error("Error comparing passwords:", err);
                        return res.status(500).json({ message: "Error during login." });
                    }

                    if (!isMatch) {
                        console.log("❌ Passwords do NOT match!");
                        logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - Incorrect Password");
                        return res.status(401).json({ message: "Invalid credentials." });
                    }

                    // Define userType dynamically
                    const userType = username === 'admin@shivalikbank.com' ? 'admin' : 'user';

                    // Save user in session
                    req.session.user = { 
                        id: user.id,
                        username: user.email,
                        userType: userType
                    };

                    console.log("✅ Logging in user:", req.session.user);

                    // Log user activity
                    logUserActivity("LOGIN", { email: user.email, userType: userType }, "Success - Logged In");

                    // Send response
                    res.status(200).json({ message: "Login successful", user: req.session.user });
                });
            })
            .catch(err => {
                console.error("Database error:", err);
                return res.status(500).json({ message: "Server error." });
            });
    } catch (error) {
        console.error("Login error:", error);
        logUserActivity("LOGIN", { email: req.body.username || "Unknown", userType: "Unknown" }, "Failed - Server Error");
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/track-policy-download', (req, res) => {
    const { userId, email, policyId } = req.body;

    // Log the values before the query
    console.log("Inserting into activities:", { userId, email, policyId });

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ message: 'Transaction start error' });
        }

    // Insert activity into the 'activities' table
    db.query('INSERT INTO activities (action_type, email, policy_id, user_id) VALUES (?, ?, ?, ?)', ['DOWNLOAD', email, policyId, userId], (err, results) => {
        if (err) {
            console.error("Error during query:", err); // Log the error for better visibility
            return res.status(500).json({ message: 'Error tracking activity' });
        }

        db.commit((err) => {
            if (err) {
                return db.rollback(() => {
                    console.error(err);
                    res.status(500).json({ message: 'Error committing transaction' });
                });
            }

        // Log the results of the query
        console.log("Insert successful. Results:", results);

        res.status(200).json({ message: 'Activity logged successfully' });
    });
});

// Tracking policy view activity
app.post('/track-policy-view', (req, res) => {
    const { userId, email, policyId } = req.body;

    // Insert activity into the 'activities' table
    db.query('INSERT INTO activities (action_type, email, policy_id, user_id) VALUES (?, ?, ?, ?)', ['VIEW', email, policyId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error tracking activity' });
        }
        res.status(200).json({ message: 'Activity logged successfully' });
    });
});

// Track download
app.post('/track-download', (req, res) => {
    const { userId, username, policyId } = req.body;

      // Insert activity into the 'activities' table or your user_activity table
      db.query('INSERT INTO activities (action_type, email, policy_id, user_id) VALUES (?, ?, ?, ?)', ['DOWNLOAD', username, policyId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error tracking activity' });
        }
    // Call logUserActivity function to log the event
    logUserActivity(userId, username, 'DOWNLOAD', policyId);

    res.status(200).json({ message: 'Download tracked successfully' });
});

// Track policy view or click
app.post('/track-policy-click', (req, res) => {
    const { userId, username, policyId, actionType } = req.body;

    // Log the event (view or click)
    logUserActivity(userId, username, actionType, policyId);

    res.status(200).json({ message: `${actionType} tracked successfully` });
});

app.post('/track-policy-click', (req, res) => {
    const { userId, username, policyId, actionType } = req.body;

    // Ensure actionType is valid (VIEW or CLICK)
    if (!['VIEW', 'CLICK'].includes(actionType)) {
        return res.status(400).json({ message: 'Invalid action type' });
    }

    // Log the event in user_activity
    logUserActivity(userId, username, actionType, policyId)
        .then(() => {
            // Insert the activity into the 'activities' table
            db.query('INSERT INTO activities (action_type, email, policy_id, user_id) VALUES (?, ?, ?, ?)', [actionType, username, policyId, userId], (err, results) => {
                if (err) {
                    return res.status(500).json({ message: 'Error tracking activity in activities table' });
                }

                res.status(200).json({ message: `${actionType} tracked successfully` });
            });
        })
        .catch(err => {
            res.status(500).json({ message: 'Error logging user activity' });
        });
});

app.get('/download-policy/:filename', mockUserAuth, (req, res) => {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const user = req.user;
    const username = user?.username || "Unknown User";  // Extract username safely

    console.log("User downloading file:", user);

    const filePath = path.join(__dirname, '..', 'public', 'policies', 'audit', decodedFilename);
    // Check if the file exists before sending it
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Error accessing file:', err);
            return res.status(404).send('File not found');
        }
 
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                return res.status(500).send('Error sending file');
            }
 
            logUserActivity('DOWNLOAD', user, policyId);
            console.log("Download tracked successfully!");
            res.status(200).json({ message: "Download tracked successfully" });
            // *Log user details*
             const logEntry = `${new Date().toISOString()} | DOWNLOAD | ${req.user} | ${filename} | IP: ${req.ip} | Status: SUCCESS\n`;
             fs.appendFileSync(path.join(__dirname, 'logs', 'user_activity.log'), logEntry);
        });
    });
});

app.delete('/delete-policy/:filename', mockUserAuth, (req, res) => {
    console.log('DELETE request received:', req.params.filename); // Debugging
 
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(__dirname, 'public', 'policies', 'audit', decodedFilename);
 
    console.log('File Path:', filePath); // Debugging
 
    // Check if file exists before deleting
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return res.status(404).json({ message: 'File not found' });
    }
 
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ message: 'Error deleting file' });
        }
 
        console.log('File deleted successfully');
        res.json({ message: 'File deleted successfully' });
    });
});

// Home route
app.get("/", (req, res) => {
    res.render("index", { 
        title: "Login/Signup",
        error: null,
        success: null,
        isSignup: false
    });
});

app.get("/signup", (req, res) => {
    res.render("index", { 
        title: "Signup",
        error: null,
        success: null,
        isSignup: true
    });
});

app.get("/home", (req, res) => {
    res.render("home", { 
        title: "Home",
        user: req.session.user
    });
});

app.get("/policy", (req, res) => {
    res.render("policy", { 
        title: "Policy",
        userEmail: req.session.username || ""
    });
});

app.get("/manuals", (req, res) => {
    res.render("manuals", { 
        title: "Manuals",
        user: req.session.user
    });
});

app.get("/circular", (req, res) => {
    res.render("circular", { 
        title: "Circular",
        user: req.session.user
    });
});

// View Data Route - Reads data from log file
app.get("/viewData", (req, res) => {
    let logs = readUserData(); // Get logs from file

    try {
        // Read log file
        const logData = fs.readFileSync(logFilePath1, "utf8");
        
        // Convert log data to JSON format
        const users = logData
            .trim()
            .split("\n")
            .map(line => {
                const parts = line.split("|").map(p => p.trim());
                return {
                    timestamp: parts[0] || "N/A",
                    eventType: parts[1] || "N/A",
                    username: parts[2] || "N/A",
                    userType: parts[3] || "N/A",
                    policyOrFilename: parts[4] || "N/A",
                    status: parts[5] || "N/A"
                };
            });

        // Send as JSON response
        res.json(users);
        res.json(logs);
    } catch (error) {
        console.error("Error reading user activity log:", error);
        res.status(500).json({ message: "Failed to load user activity data." });
    }
});

// Start the server
app.listen(PORT, (err) => {
    if (err) {
        console.error("Error starting server:", err);
    } else {
        console.log(`Server running at http://localhost:${PORT}`);
    }
});

module.exports = app;
