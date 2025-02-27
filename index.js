const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
 
 
const DownloadLogs = require('./models/DownloadLogs');
 
const logDir = path.join(__dirname, 'logs');
const logFilePath1 = path.join(__dirname, 'logs', 'user_activity.log');


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


const policyRoutes = require('./routes/policies');
 
const app = express();
app.use(session({
    secret: 'shivalikbank',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 14400000 }
  }));

  app.use(morgan('dev'));

const PORT = 3001;
 
const USER_DATA_FILE = "user_data.json"; // Ensure this variable is declared



// Ensure the data file exists
if (!fs.existsSync(USER_DATA_FILE)) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify([], null, 2));
}

 
//const policyRoutes = require('./routes/policies');
app.use('/api', policyRoutes);
 
 
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
 
 

 
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors());
 
 
 
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
 

const logFilePath = path.join(__dirname, 'logs', 'user_activity.log');
 
 
//Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors());
 
 

 
// Read user data from file
const readUserData = () => {
    try {
        const data = fs.readFileSync(USER_DATA_FILE, "utf8");
        return JSON.parse(data || "[]");
    } catch (err) {
        console.error("Error reading user data:", err);
        return [];
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
 

// const mockUserAuth = (req, res, next) => {
//     // Assuming user data is stored in session (or from JWT)
//     console.log("Session Data Before Middleware:", req.session?.user); // Debugging

//     const user = req.session?.user || req.user || {};  

//     req.user = {
//         id: user.id || 'ID' + Date.now(),
//         email: user.email || 'unknown_user',
//         password: user.password || 'mockPassword123', // Avoid storing raw passwords in req.user
//         userType: user.email === 'admin@shivalikbank.com' ? 'admin' : user.userType || 'user',
//     };

//     next();
// };

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


const logUserActivity = (action, user, policyId) => {

    const logEntry = `[${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })}] ACTION: ${action}, UserName: ${user}, POLICY_ID: ${policyId}\n`;

    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error("Error writing to log file:", err);
        }
        else {
            console.log("User activity logged successfully:", logEntry);
        }

          // Append to log file
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
    console.log("User activity logged:", logEntry);
    });
};
 
app.post('/track-download', mockUserAuth, (req, res) => {
    console.log("Track-download route triggered!");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
 
    const { policyId } = req.body;
    const user = req.user;
    console.log("Missss");
    console.log(user);
 
    if (!policyId) {
        console.log("Missing policyId");
        return res.status(400).json({ message: "policyId is required" });
    }
 
    logUserActivity('DOWNLOAD', user.email, policyId,);
    console.log("Download tracked successfully!");
    res.status(200).json({ message: "Download tracked successfully" });
});
 
 
// Route to track policy clicks
app.post('/track-policy-click', mockUserAuth, (req, res) => {
    const { filename } = req.body;
    const user = req.user;
 
    if (!filename) {
        return res.status(400).send('Filename is required');
    }
 
    logUserActivity('CLICK', user.email, filename);
  //  logUserActivity('DOWNLOAD', user, policyId); // Log click event
    console.log("track-policy-click",data);
    res.status(200).json({ message: "User click tracked" });
});
 
 
// const logUserActivity = (eventType, user, policyIdOrFilename) => {
//     const logDir = path.dirname(logFilePath1);
//     if (!fs.existsSync(logDir)) {
//         fs.mkdirSync(logDir, { recursive: true });
//     }
 
//     const logEntry = `${moment().format("YYYY-MM-DD HH:mm:ss")} | ${eventType} | ID: ${user.id} | Email: ${user.email} | Password: ${user.password} | User Type: ${user.userType} | Policy: ${policyIdOrFilename}\n`; 
//     try {
//         fs.appendFileSync(logFilePath1, logEntry);
//         console.log(logEntry);
//     } catch (err) {
//         console.error('Error writing to log file:', err);
//     }
// };
 
 
 
 
// Signup Route
// app.post("/signup", (req, res) => {
//     const { username, password, confirmPassword } = req.body;
//     console.log("Signup request received:", { username, password, confirmPassword });
 


    
//     if (!isValidEmail(username)) {
//         logUserAction(username, password, "signup", "failed");
//         return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
//     }
 
//     if (!isValidPassword(password)) {
//         logUserAction(username, password, "signup", "failed");
//         return res.status(400).json({
//             message: "Password must be at least 6 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
//         });
//     }
 
//     if (password !== confirmPassword) {
//         logUserAction(username, password, "signup", "failed");
//         return res.status(400).json({ message: "Passwords do not match." });
//     }
 

//     let userData = readUserData(); 


//     if (userData.some(user => user.username === username)) {
//         console.log("User already exists:", username);
//         logUserAction(username, password, "signup", "failed");
//         return res.status(400).json({ message: "User already exists." });
//     }
 
//     const hashedPassword = bcrypt.hashSync(password, 10);
    
//     const newUser = {
//         username,
//         password: hashedPassword,
//          type: "signup",
//         status: "active"
        
//     };
    
//     userData.push(newUser);
    

//     logUserAction(username, hashedPassword, "signup", "active");
 
//     console.log("User added successfully:", username);
    
//     // Create session for the new user
//     req.session.user = newUser;
    
//     // res.status(201).json({ message: "Signup successful." });

//     if (!isValidEmail(username) || !isValidPassword(password) || password !== confirmPassword) {
//         logUserActivity1("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED");
//         return res.status(400).json({ message: "Invalid signup details." });
//     }

//     logUserActivity1("SIGNUP", { email: username, userType: "Admin" }, "N/A", "SUCCESS");
//     res.status(201).json({ message: "Signup successful." });
// });
 

// Function to append data to the log file
function saveUserToLog(userData) {
    try {
        const logEntry = JSON.stringify(userData) + "\n"; // Store each entry as JSON string
        fs.appendFileSync(logFilePath1, logEntry); // Append to the log file
        console.log("User data saved in log.");
    } catch (error) {
        console.error("Error saving user data:", error);
    }
}

// Signup Route
app.post("/signup", (req, res) => {
    const { username, password, confirmPassword } = req.body;
    console.log("Signup request received:", { username, password, confirmPassword });

    if (!isValidEmail(username)) {
        logUserActivity1("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED");
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }

    if (!isValidPassword(password) || password !== confirmPassword) {
        logUserActivity1("SIGNUP", { email: username, userType: "N/A" }, "N/A", "FAILED");
        return res.status(400).json({ message: "Invalid password or mismatch." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const newUser = {
        username,
        password: hashedPassword,
        type: "signup",
        status: "active"
    };


    const userType = username === 'admin@shivalikbank.com' ? 'admin' : 'user';

    req.session.user = {
        id: 'ID' + Date.now(),
        username,
        userType
    };

    console.log("User signed up:", req.session.user); // Debugging

   
    // Save new user in the log file
    saveUserToLog(newUser);

    logUserActivity1("SIGNUP", { email: username, userType}, "N/A", "Success - Signed Up");
    res.status(201).json({ message: "Signup successful", user: req.session.user });
    
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

// Login route using credentials from log file
// app.post("/login", async (req, res) => {
//     console.log("Received request body:", req.body); 
//     try {
//         const { username, password } = req.body;
//         if (!username || !password) {
//             return res.status(400).json({ message: "Email and password are required." });
//         }

//         // Fetch users from log file
//         const users = readUsersFromLog();
//         console.log("Loaded users from log:", users);

//         // Find user by email
//         const user = users.find(u => u.username === username);
//         if (!user) {
//             return res.status(401).json({ message: "User not found." });
//         }

//         console.log("User found:", user);

//         // Ensure stored password exists
//         if (!user.password) {
//             console.error("Stored password is undefined for user:", username);
//             return res.status(500).json({ message: "Internal server error. Try again later." });
//         }

//         // Compare password using bcrypt
//         const isMatch = bcrypt.compareSync(password, user.password);
//         if (!isMatch) {
//             return res.status(401).json({ message: "Invalid credentials." });
//         }

//         // Define userType dynamically
//         const userType = username === 'admin@shivalikbank.com' ? 'admin' : 'user';

//         // Save user in session
//         req.session.user = { 
//             id: 'ID' + Date.now(), 
//             username, 
//             userType 
//         };

//         console.log("User logged in:", req.session.user); // Debugging

//         // Log user activity
//         logUserActivity1("LOGIN", { email: user.username, userType }, "Success - Logged In");

//         // Send response only once
//         res.status(200).json({ message: "Login successful", user: req.session.user });

//     } catch (error) {
//         console.error("Login error:", error);
//         logUserActivity1("LOGIN", { email: req.body.username, userType: "Unknown" }, "Failed - Server Error");
//         res.status(500).json({ message: "Server error." });
//     }
// });



app.post("/login", async (req, res) => {
    console.log("Received request body:", req.body); 
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - Missing Credentials");
            return res.status(400).json({ message: "Email and password are required." });
        }

        // Fetch users from log file
        const users = readUsersFromLog();
        console.log("Loaded users from log:", users);

        // Find user by email
        const user = users.find(u => u.username === username);
        if (!user) {
            logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - User Not Found");
            return res.status(401).json({ message: "User not found." });
        }

        console.log("User found:", user);

        // Ensure stored password exists
        if (!user.password) {
            logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - No Password Set");
            return res.status(500).json({ message: "Internal server error. Try again later." });
        }

        // Compare password using bcrypt
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            logUserActivity1("LOGIN", { email: username, userType: "Unknown" }, "Failed - Incorrect Password");
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Define userType dynamically
        const userType = username === 'admin@shivalikbank.com' ? 'admin' : 'user';

        // Save user in session
        req.session.user = { 
            id: 'ID' + Date.now(), 
            username, 
            userType 
        };

        console.log("User logged in:", req.session.user); // Debugging

        // Log user activity
        logUserActivity1("LOGIN", { email: username, userType }, "Success - Logged In");

        // Send response only once
        res.status(200).json({ message: "Login successful", user: req.session.user });

    } catch (error) {
        console.error("Login error:", error);
        logUserActivity1("LOGIN", { email: req.body.username || "Unknown", userType: "Unknown" }, "Failed - Server Error");
        res.status(500).json({ message: "Server error." });
    }
});


// Route to track policy downloads
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

    logUserActivity('DOWNLOAD', user, policyId);
    console.log("Download tracked successfully!");
    res.status(200).json({ message: "Download tracked successfully" });
});



// Route to track policy clicks
app.post('/track-policy-click', mockUserAuth, (req, res) => {
    console.log("Track-policy-click route triggered!");
    console.log("Request body:", req.body);
    console.log("User:", req.user);

    const { policyId } = req.body;
    const user = req.user;

    if (!policyId) {
        return res.status(400).json({ message: "Policy ID is required" });
    }

    logUserActivity('CLICK', user, policyId); // Log click event
    console.log("User click tracked successfully!");
    res.status(200).json({ message: "User click tracked successfully" });
});


// Login Route
// app.post("/login", (req, res) => {
//     const { username, password } = req.body;
//     let userData = readUserData();
//     const user = userData.find(user => user.username === username);
//     // console.log("Login request received:", { username, password });
 
//     if (!username || !password) {
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Email and password are required." });
//     }
 
//     if (!isValidEmail(username)) {
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
//     }
 
    
 
//     if (!user) {
//         console.log("User not found:", username);
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Invalid credentials." });
//     }
 
//     try {
//         console.log("Entered password:", password);
//         console.log("Stored hashed password:", user.password);
//         if (!user || !bcrypt.compareSync(password, user.password)) {
//             console.log("Invalid credentials for:", username);
//             logUserAction(username, password, "login", "failed");
//             logUserActivity1("LOGIN", { email: username, userType: "N/A" }, "N/A", "FAILED");
//             return res.status(400).json({ message: "Invalid credentials." });
//         }
//     } catch (error) {
//         console.error("Error comparing passwords:", error);
//         return res.status(500).json({ message: "Internal server error." });
//     }
 
//     // Update user login timestamp
//     user.timestamp = new Date().toISOString();
//     user.type = "login";
//     user.status = "active";

//     writeUserData(userData); // Save updates to file

//     logUserAction(username, password, "login", "active");
//     logUserActivity1("LOGIN", { email: username, userType: "Admin" }, "N/A", "SUCCESS");
//     // Create session for the logged in user
//     req.session.user = user;
    
//     console.log("Login successful for:", username);
//     res.status(200).json({ message: "Login successful" });
// });
 

 
 
 
app.get('/download-policy/:filename', mockUserAuth, (req, res) => {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const user = req.user;
    const username = user?.username || "Unknown User";  // Extract username safely

    console.log("User downloading file:", username);

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
 
            // *Log user details*
             const logEntry = `${new Date().toISOString()} | DOWNLOAD | ${req.user} | ${filename} | IP: ${req.ip} | Status: SUCCESS\n`;
             fs.appendFileSync(path.join(__dirname, '..', 'logs', 'user_activity.log'), logEntry);
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
 
 
// Log user actions (Signup/Login/Failure)
function logUserAction(username, password, type, status) {
    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
 
    const userLog = {
        username,
        password,  // Storing password (hashed for signup, plain for failed login)
        timestamp,
        type,
        status
    };
 
    userData.push(userLog);
    console.log(userLog);
}
 
// Home route
app.get("/", (req, res) => {
    res.render("index");
});
 
app.get("/home", (req, res) => {
    res.render("home");
});
 
app.get("/policy", (req, res) => {
    res.render("policy");
});
 
app.get("/manuals", (req, res) => {
    res.render("manuals");
});
 
app.get("/circular", (req, res) => {
    res.render("circular");
});
 
// Signup Route
app.post("/signup", (req, res) => {
    const { username, password, confirmPassword } = req.body;
    console.log("Signup request received:", { username, password, confirmPassword });
 
    if (!isValidEmail(username)) {
        logUserAction(username, password, "signup", "failed");
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }
 
    if (!isValidPassword(password)) {
        logUserAction(username, password, "signup", "failed");
        return res.status(400).json({
            message: "Password must be at least 6 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
        });
    }
 
    if (password !== confirmPassword) {
        logUserAction(username, password, "signup", "failed");
        return res.status(400).json({ message: "Passwords do not match." });
    }
 
    if (userData.some(user => user.username === username)) {
        console.log("User already exists:", username);
        logUserAction(username, password, "signup", "failed");
        return res.status(400).json({ message: "User already exists." });
    }
 
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const newUser = {
        username,
        password: hashedPassword
    };
    
    userData.push(newUser);
    
    logUserAction(username, hashedPassword, "signup", "active");
 
    console.log("User added successfully:", username);
    
    // Create session for the new user
    req.session.user = newUser;
    
    res.status(201).json({ message: "Signup successful." });
});
 
// Login Route
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    console.log("Login request received:", { username, password });
 
    if (!username || !password) {
        logUserAction(username, password, "login", "failed");
        return res.status(400).json({ message: "Email and password are required." });
    }
 
    if (!isValidEmail(username)) {
        logUserAction(username, password, "login", "failed");
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }
 
    const user = userData.find(user => user.username === username);
 
    if (!user) {
        console.log("User not found:", username);
        logUserAction(username, password, "login", "failed");
        return res.status(400).json({ message: "Invalid credentials." });
    }
 
    try {
        console.log("Entered password:", password);
        console.log("Stored hashed password:", user.password);
        if (!bcrypt.compareSync(password, user.password)) {
            console.log("Invalid credentials for:", username);
            logUserAction(username, password, "login", "failed");
            return res.status(400).json({ message: "Invalid credentials." });
        }
    } catch (error) {
        console.error("Error comparing passwords:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
 
    logUserAction(username, password, "login", "active");
    
    // Create session for the logged in user
    req.session.user = user;
    
    console.log("Login successful for:", username);
    res.status(200).json({ message: "Login successful" });

    // Store email in session
    req.session.userEmail = username;

    res.redirect('/policy');
});
 

// Sample logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/policy');
});



app.get("/policy", (req, res) => {
    const userEmail = req.session.username || ""; // Assuming you store email in session
    res.render("policy", { userEmail });
});

 
// View Data Route - Includes passwords
// app.get("/viewData", (req, res) => {
//     let users = readUserData();
//     const filteredUsers = users.map(users => ({ username: user.username, timestamp: user.timestamp, type: user.type, status: user.status }));
//     res.json(filteredUsers);
// });
 


// View Data Route - Reads data from log file
app.get("/viewData", (req, res) => {
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