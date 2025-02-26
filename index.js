const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const ejs = require('ejs');
const moment = require('moment');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
 
 
const DownloadLogs = require('./models/DownloadLogs');
 
//const logFilePath = './user_activity.log'; // Log file for user activity
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
    fs.writeFileSync(logFilePath, logEntry);
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
 
 
// // Middleware to mock user authentication (Replace with real authentication)
// const mockUserAuth = (req, res, next) => {
//     req.user = { email: 'hardik1310@shivalikbank.com' }; // Mocked user data
//     next();
// };
 
 
const mockUserAuth = (req, res, next) => {
    req.user = {
        id: 'USR' + Date.now(),  // Generate a simple unique ID (replace with DB-generated ID in real auth)
        email: 'hardik1310@shivalikbank.com',
        password: 'mockPassword123', // Mocked password (use hashed passwords in real apps)
        userType: 'admin', // Set user type (e.g., 'admin' or 'member')
    };
    next();
};
 
// const mockUserAuth = (req, res, next) => {
//     const { email, password, userType } = req.body;
 
//     if (!email || !password || !userType) {
//         return res.status(401).json({ message: "Unauthorized: Missing user credentials" });
//     }
 
//     req.user = {
//         id: 'USR' + Date.now(),
//         email: email,
//         password: password,
//         userType: userType,
//     };
 
//     next();
// };
 
 
 
 
// 111
// // Route to track policy downloads
// app.post('/track-download', mockUserAuth, (req, res) => {
//    // console.log("132");
//     const { policyId } = req.body;
//     const userEmail = req.user.email || 'unknown_user';
 
//     if (!policyId) {
//         return res.status(400).json({ message: "policyId is required" });
//     }
 
//     logUserActivity('DOWNLOAD', userEmail, policyId); // Log download event
//     console.log("download tracked succesfully!");
//     res.status(200).json({ message: "Download tracked successfully" });
    
// });
 
 
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
    const { filename } = req.body;
    const user = req.user;
 
    if (!filename) {
        return res.status(400).send('Filename is required');
    }
 
    logUserActivity('DOWNLOAD', user, policyId); // Log click event
    console.log("track-policy-click",data);
    res.status(200).json({ message: "User click tracked" });
});
 
 
const logUserActivity = (eventType, user, policyIdOrFilename) => {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
 
    const logEntry = `${moment().format("YYYY-MM-DD HH:mm:ss")} | ${eventType} | ID: ${user.id} | Email: ${user.email} | Password: ${user.password} | User Type: ${user.userType} | Policy: ${policyIdOrFilename}\n`; 
    try {
        fs.appendFileSync(logFilePath, logEntry);
        console.log(logEntry);
    } catch (err) {
        console.error('Error writing to log file:', err);
    }
};
 
 
// // Function to log user activity (click or download)
// const logUserActivity = (eventType, userEmail, policyIdOrFilename) => {
//     // Ensure the log directory exists
//     const logDir = path.dirname(logFilePath);
//     if (!fs.existsSync(logDir)) {
//         fs.mkdirSync(logDir, { recursive: true });
//     }
 
//     const logEntry = ${moment().format("YYYY-MM-DD HH:mm:ss")} | ${eventType} | ${userEmail} | ${policyIdOrFilename}\n;
 
//     try {
//         fs.appendFileSync(logFilePath, logEntry);
//        // console.log('Log entry successfully added');
//         console.log(logEntry);
//         console.log(logFilePath);
//     } catch (err) {
//         console.error('Error writing to log file:', err);
//     }
// };
 
 
 
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
});
 
 
 
 
 
 
// console.log('Calling logUserActivity function...');
 
// const logUserActivity = (eventType, userEmail, policyIdOrFilename) => {
//     console.log(Logging Activity: ${eventType}, ${userEmail}, ${policyIdOrFilename});
 
//     const logEntry = ${new Date().toISOString()} | ${eventType} | ${userEmail} | ${policyIdOrFilename}\n;
 
//     try {
//         fs.appendFileSync(logFilePath, logEntry);
//         console.log('Log entry successfully added');
//     } catch (err) {
//         console.error('Error writing to log file:', err);
//     }
// };
 
// //Test the function manually
// logUserActivity('CLICK', 'test@example.com', 'policy123.pdf');
 
 
 
app.get('/download-policy/:filename', mockUserAuth, (req, res) => {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(__dirname, '..', 'public', 'policies', 'audit', decodedFilename);
     console.log("282");
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
            const logEntry = `${new Date().toISOString()} | DOWNLOAD | ${req.user.email} | ${filename} | IP: ${req.ip} | Status: SUCCESS\n`;
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
 
 
// View Data Route - Includes passwords
app.get("/viewData", (req, res) => {
    let users = readUserData();
    const filteredUsers = users.map(user => ({ username: user.username, timestamp: user.timestamp, type: user.type, status: user.status }));
    res.json(filteredUsers);
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
});
 

// Login Route
// app.post("/login", (req, res) => {
//     const { username, password } = req.body;
//     console.log("Login request received:", { username, password });

//     // Ensure both username and password are provided
//     if (!username || !password) {
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Email and password are required." });
//     }

//     // Simple email validation
//     if (!isValidEmail(username)) {
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
//     }

//     // Fetch users from data (remove bcrypt password hashing)
//     let users = readUserData();
//     const userIndex = users.findIndex(user => user.username === username);

//     if (userIndex === -1) {
//         console.log("User not found:", username);
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Invalid credentials." });
//     }

//     const user = users[userIndex];

//     // Compare plain text password
//     if (password !== user.password) {
//         console.log("Invalid credentials for:", username);
//         logUserAction(username, password, "login", "failed");
//         return res.status(400).json({ message: "Invalid credentials." });
//     }

//     // Successful login
//     logUserAction(username, password, "login", "active");

//     console.log("Login successful for:", username);
//     res.status(200).json({ message: "Login successful" });
// });

 
 
// View Data Route - Includes passwords
app.get("/viewData", (req, res) => {
    let users = readUserData();
    res.json(users);
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