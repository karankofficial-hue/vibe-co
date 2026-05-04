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
            <tr><th>Email</th><th>Status</th><th>Action</th></tr>`;

    members.forEach(m => {
        html += `<tr>
            <td>${m.email}</td>
            <td class="${m.isApproved ? 'status-approved' : 'status-pending'}">${m.isApproved ? 'APPROVED' : 'PENDING'}</td>
            <td>${!m.isApproved ? `<button class="approve-btn" onclick="approveUser('${m._id}')">APPROVE ACCESS</button>` : 'Authorized'}</td>
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
    </script>
    </body></html>`;
    res.send(html);
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
// --- ADMIN TOOL: ADD A NEW COMPANION ---
// Usage: Open your browser to /admin/add-boy?name=Aryan&age=24&height=6ft&specialty=Social Excellence&imageUrl=IMAGE_URL
app.get('/admin/add-boy', async (req, res) => {
    try {
        const { name, age, height, specialty, imageUrl } = req.query;
        
        const newBoy = new Companion({
            name,
            age,
            height,
            specialty,
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop'
        });

        await newBoy.save();
        res.send(`<h1>Success</h1><p>${name} has been added to the Elite Roster.</p><a href="/admin/vault">Back to Vault</a>`);
    } catch (error) {
        res.status(500).send("Error adding profile: " + error.message);
    }
});
app.listen(PORT, () => {
    console.log(`VIBE & CO. Live on port ${PORT}`);
});