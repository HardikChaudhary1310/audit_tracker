const express = require('express');
const path = require('path');
const fs = require('fs');
const moment = require('moment'); // Make sure to include moment for date formatting
const router = express.Router();
// const { logUserActivity } = require('./models/userActivity'); // Import the logUserActivity function


const app = express();
app.use(express.json());  // To parse incoming JSON requests



router.get('/download-policy/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const userEmail = req.user ? req.user.email : 'unknown_user';
  console.log(userEmail);
        // Ensure filename is decoded properly
        const decodedFilename = decodeURIComponent(filename);
        const filePath = path.join(__dirname, '..', 'public', 'policies', 'audit', decodedFilename);

        console.log('Downloading file:', filePath); // Debugging

        // Check if the file exists before sending
        await fs.promises.access(filePath, fs.constants.F_OK);

        // Set headers to force download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${decodedFilename}"`);

        // Send file safely
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                return res.status(500).json({ message: 'Error sending file' });
            }

            // Log download success
            const logEntry = `${moment().format("YYYY-MM-DD HH:mm:ss")} | DOWNLOAD | ${userEmail} | ${decodedFilename} | IP: ${req.ip} | Status: SUCCESS\n`;
            const logPath = path.join(__dirname, '..', 'logs', 'user_activity.log');
            fs.appendFileSync(logPath, logEntry);
        });
    } catch (error) {
        console.error('File not found:', error);
        return res.status(404).json({ message: 'Policy file not found' });
    }
});



// Route to track policy clicks
router.post('/track-policy-click', async (req, res) => {
    const { filename } = req.body;
    const userEmail = req.user ? req.user.email : 'unknown_user'; // Get user email from authenticated user (or 'unknown_user')

    if (!filename) {
        return res.status(400).json({ message: 'Filename is required' });
    }

    try {
        const logEntry = `${moment().format("YYYY-MM-DD HH:mm:ss")} | CLICK | ${userEmail} | ${filename}\n`;
        fs.appendFileSync('./user_activity.log', logEntry); // Log the click event
        console.log('Click event logged for:', filename);
        return res.status(200).json({ message: 'Policy click tracked successfully' });
    } catch (err) {
        console.error('Error writing to log file:', err);
        return res.status(500).json({ message: 'Error tracking click' });
    }
});



module.exports = router;
