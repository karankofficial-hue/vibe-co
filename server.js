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

const BookingSchema = new mongoose.Schema({
    alias: String,
    contact: String,
    notes: String,
    ngfTag: String,
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', BookingSchema);

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, 
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const CompanionSchema = new mongoose.Schema({
    name: String,
    age: Number,
    height: String,
    specialty: String,
    imageUrl: String,
    isAvailable: { type: Boolean, default: true }
});
const Companion = mongoose.model('Companion', CompanionSchema);

// Route to serve the Gallery page
app.get('/vault-access', (req, res) => {
    res.sendFile(__dirname + '/public/gallery.html');
});

// API to get the companions from the database
app.get('/api/companions', async (req, res) => {
    try {
        const boys = await Companion.find({ isAvailable: true });
        res.json(boys);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AUTH & RESERVATION ROUTES ---

app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "Credential already in vault" });

        const newUser = new User({ email, password });
        await newUser.save();
        res.json({ success: true, message: "Access request submitted. Awaiting concierge approval." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
        if (!user.isApproved) return res.status(403).json({ success: false, message: "Account pending concierge approval" });

        res.json({ success: true, message: "Welcome to the Inner Circle" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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

// --- ADMIN & APPROVAL ROUTES ---

app.post('/api/approve/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { isApproved: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Password Reset Route
app.post('/api/reset-password/:id', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.id, { password: '123456' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/admin/vault', async (req, res) => {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    const members = await User.find().sort({ createdAt: -1 });

    let html = `
    <html>
    <head>
        <title>VIBE & CO. | Private Vault</title>
        <style>
            body { background: #0a0e14; color: white; font-family: sans-serif; padding: 40px; }
            h1 { font-family: serif; color: #c5a059; border-bottom: 1px solid #c5a059; padding-bottom: 10px; }
            h2 { margin-top: 50px; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; color: #9ca3af; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; background: rgba(255,255,255,0.02); }
            th, td { border: 1px solid rgba(197, 160, 89, 0.3); padding: 15px; text-align: left; }
            th { background: #c5a059; color: black; text-transform: uppercase; font-size: 12px; }
            .tag { font-family: serif; font-weight: bold; color: #c5a059; }
            .status-approved { color: #22c55e; font-weight: bold; }
            .status-pending { color: #ef4444; font-weight: bold; }
            .approve-btn { background: #c5a059; color: black; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 10px; }
            .notes-cell { font-style: italic; color: #9ca3af; max-width: 300px; }
        </style>
    </head>
    <body>
        <h1>VIBE & CO. | Private Command Center</h1>

        <h2>Member Access Requests</h2>
        <table>
            <tr><th>Email</th><th>Status</th><th>Access Action</th><th>Security</th></tr>`;

    members.forEach(m => {
        html += `<tr>
            <td>${m.email}</td>
            <td class="${m.isApproved ? 'status-approved' : 'status-pending'}">${m.isApproved ? 'APPROVED' : 'PENDING'}</td>
            <td>${!m.isApproved ? `<button class="approve-btn" onclick="approveUser('${m._id}')">APPROVE ACCESS</button>` : 'Authorized'}</td>
            <td><button class="approve-btn" style="background: #ef4444;" onclick="resetPassword('${m._id}')">RESET PW</button></td>
        </tr>`;
    });

    html += `</table>

        <h2>Secure Booking Records</h2>
        <table>
            <tr><th>Date</th><th>Alias</th><th>Contact</th><th>Curation Notes</th><th>Tag</th></tr>`;

    bookings.forEach(b => {
        const d = new Date(b.createdAt);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
        html += `<tr>
            <td>${dateStr}</td>
            <td>${b.alias || 'N/A'}</td>
            <td>${b.contact || 'N/A'}</td>
            <td class="notes-cell">${b.notes || '-'}</td>
            <td class="tag">${b.ngfTag}</td>
        </tr>`;
    });

    html += `</table>
    <script>
        async function approveUser(id) {
            const res = await fetch('/api/approve/' + id, { method: 'POST' });
            if (res.ok) location.reload();
        }

        async function resetPassword(id) {
            if(confirm("Reset this user's password to '123456'?")) {
                const res = await fetch('/api/reset-password/' + id, { method: 'POST' });
                if (res.ok) alert("Password has been reset to: 123456");
            }
        }
    </script>
    </body></html>`;
    res.send(html);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;

app.get('/admin/manage-boy', async (req, res) => {
    try {
        const { name, age, height, specialty, imageUrl } = req.query;
        if (!name) return res.status(400).send("Name is required to update or add a profile.");
        const cleanData = (val) => Array.isArray(val) ? val[0] : val;
        const updateData = {
            name: cleanData(name),
            age: age ? parseInt(cleanData(age)) : undefined,
            height: cleanData(height),
            specialty: cleanData(specialty),
            imageUrl: cleanData(imageUrl),
            isAvailable: true
        };
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        const boy = await Companion.findOneAndUpdate(
            { name: cleanData(name) }, 
            updateData, 
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.send(`<h1>Success</h1><p>${boy.name}'s profile has been updated in the Vault.</p><a href="/admin/vault">Back to Vault</a>`);
    } catch (error) {
        res.status(500).send("Update Error: " + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`VIBE & CO. Live on port ${PORT}`);
});