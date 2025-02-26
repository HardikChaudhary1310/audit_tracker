const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema({
    policyName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Assuming you have user authentication
    timestamp: { type: Date, default: Date.now }
});

const DownloadLog = mongoose.model('DownloadLog', downloadLogSchema);

module.exports = DownloadLog;


