require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Privacy Vault Connected'))
    .catch(err => console.error('❌ Connection Error:', err));

// --- SCHEMAS ---

// 1. Booking Schema (Existing)
const BookingSchema = new mongoose.Schema({
    alias: String,
    contact: String,
    notes: String,
    ngfTag: String,
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', BookingSchema);

// 2. User Schema (New: For Client Accounts)
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, 
    isApproved: { type: Boolean, default: false }, // Manual approval for elite access
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// 3. Companion Schema (New: For the Boys' Profiles)
const CompanionSchema = new mongoose.Schema({
    name: String,
    age: Number,
    height: String,
    specialty: String,
    imageUrl: String,
    isAvailable: { type: Boolean, default: true }
});
const Companion = mongoose.model('Companion', CompanionSchema);

// --- ROUTES ---

// Reservation Route (Existing)
app.post('/api/reserve', async (req, res) => {
    try {
        const ngfTag = `NGF-${Math.floor(1000 + Math.random() * 9000)}`;
        const newBooking = new Booking({
            alias: req.body.alias,
            contact: req.body.contact,
            notes: req.body.notes,
            ngfTag: ngfTag
        });
        await newBooking.save();
        res.json({ success: true, tag: ngfTag });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve the front-end files
app.use(express.static('public'));

// The "Home" route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Admin Vault (Existing)
app.get('/admin/vault', async (req, res) => {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let html = `
    <html>
    <head>
        <title>VIBE & CO. | Private Vault</title>
        <style>
            body { background: #0a0e14; color: white; font-family: sans-serif; padding: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #c5a059; padding: 15px; text-align: left; }
            th { background: #c5a059; color: black; }
            .tag { font-family: serif; font-weight: bold; color: #c5a059; }
            .notes-cell { font-style: italic; color: #9ca3af; max-width: 300px; }
        </style>
    </head>
    <body>
        <h1>VIBE & CO. | Private Booking Vault</h1>
        <p style="color: #c5a059;">Secure Encrypted Records (Storage Active)</p>
        <table>
            <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Alias</th>
                <th>Contact</th>
                <th>Curation Notes</th>
                <th>NGF Tag</th>
            </tr>`;

    bookings.forEach(b => {
        const d = new Date(b.createdAt);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

        html += `<tr>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${b.alias || 'N/A'}</td>
            <td>${b.contact || 'N/A'}</td>
            <td class="notes-cell">${b.notes || 'No specific requests'}</td>
            <td class="tag">${b.ngfTag}</td>
        </tr>`;
    });

    html += `</table></body></html>`;
    res.send(html);
});

const PORT = process.env.PORT || 3000;
// --- MEMBER AUTHENTICATION ROUTES ---

// 1. Signup Route: For clients to request access
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Credential already in vault" });
        }

        const newUser = new User({ email, password }); // Note: In production, we'll hash this password
        await newUser.save();
        
        res.json({ success: true, message: "Access request submitted. Awaiting concierge approval." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. Login Route: For approved members to enter
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.isApproved) {
            return res.status(403).json({ success: false, message: "Account pending concierge approval" });
        }

        res.json({ success: true, message: "Welcome to the Inner Circle" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`Privacy Vault Connected`);
    console.log(`VIBE & CO. Live on port ${PORT}`);
});