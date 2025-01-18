const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const ejs = require('ejs');

const { fileURLToPath } = require('url');
const { dirname } = require('path');

// For ES Modules to resolve __dirname
const cors = require('cors');


const app = express();
const PORT = 3001; // Changed port to 3001

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors());




// Path to store user data
const dataFilePath = "user_data.json";

// Ensure the data file exists or create it
if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify([]));
}

// Utility function to read user data
const readUserData = () => {
    try {
        const data = fs.readFileSync(dataFilePath, "utf8");
        return JSON.parse(data || "[]");
    } catch (err) {
        console.error("Error reading user data:", err);
        return [];
    }
};

// Utility function to write user data
const writeUserData = (data) => {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing user data:", err);
    }
};

// Helper function to validate email format
const isValidEmail = (username) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/;
    return emailRegex.test(username);
};

// Helper function to validate password strength
const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};

// Define the home route
app.get("/", (req, res) => {
    res.render("index");
    
});


// Define the home route
app.get("/home", (req, res) => {
    res.render("home");
    
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    console.log("Login request received:", { username, password });

    // Validate email and password presence
    if (!username || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    // Validate email format
    if (!isValidEmail(username)) {
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }

    // Validate password format
    if (!isValidPassword(password)) {
        return res.status(400).json({
            message: "Password must be at least 6 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
        });
    }

    const users = readUserData();
    const user = users.find((user) => user.username === username);

    if (!user) {
        console.log("User not found:", username);
        return res.status(400).json({ message: "Invalid credentials." });
    }

    try {
        if (!bcrypt.compareSync(password, user.password)) {
            console.log("Invalid credentials for:", username);
            return res.status(400).json({ message: "Invalid credentials." });
        }
    } catch (error) {
        console.error("Error comparing passwords:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
    console.log("harrr");
    res.status(200).json({ message: "Login successful" });
    console.log("Login successful for:", username);
    user.status = "passed"; // Set status to passed on successful login
    writeUserData(users); // Update user data
    console.log("Redirecting to home page..."); // Log redirection
    //res.redirect("/home"); // Redirect to home page after successful login
    console.log("Response sent to client."); // Log response sent

    
});




// Define the /home route to redirect to /
app.post("/signup", (req, res) => {
    const { username, password, confirmPassword } = req.body;
    console.log("Signup request received:", { username, password, confirmPassword });

    // Validate email format
    if (!isValidEmail(username)) {
        return res.status(400).json({ message: "Invalid email format. Must be @shivalikbank.com" });
    }

    // Validate password format
    if (!isValidPassword(password)) {
        return res.status(400).json({
            message: "Password must be at least 6 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character."
        });
    }

    // Check if password and confirm password match
    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match." });
    }

    const users = readUserData();

    // Check if user already exists
    if (users.some((user) => user.username === username)) {
        console.log("User already exists:", username);
        return res.status(400).json({ message: "User already exists." });
    }

    // Hash password and save user
    const hashedPassword = bcrypt.hashSync(password, 10);
    users.push({ username, password: hashedPassword, status: "passed" }); // Set status to passed on successful signup
    writeUserData(users);

    console.log("User added successfully:", username);

    res.status(201).json({ message: "Signup successful." });
});

// View Data route (fetches all users' data)
app.get("/viewData", (req, res) => {
    const users = readUserData();
    const formattedUsers = users.map(user => ({
        username: user.username,
        password: user.password,
        timestamp: new Date().toISOString(), // Assuming you want the current timestamp
        type: user.type || "unknown", // Assuming type is part of user data
        status: user.status || "unknown" // Assuming status is part of user data
    }));
    res.json(formattedUsers);
});

// Start the server with error handling
app.listen(PORT, (err) => {
    if (err) {
        console.error("Error starting server:", err);
    } else {
        console.log(`Server running at http://localhost:${PORT}`);
    }
});

module.exports = app;  // Use ES Module export
