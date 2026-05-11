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
    alias: String, contact: String, notes: String, ngfTag: String, createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', BookingSchema);

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }, 
    profilePic: { type: String, default: 'https://i.ibb.co/68Xk9wN4/IMG-5643.jpg' }, 
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const CompanionSchema = new mongoose.Schema({
    name: String, age: Number, height: String, specialty: String, imageUrl: String, isAvailable: { type: Boolean, default: true }
});
const Companion = mongoose.model('Companion', CompanionSchema);

// --- ROUTES ---

app.get('/vault-access', (req, res) => res.sendFile(__dirname + '/public/gallery.html'));

app.get('/api/companions', async (req, res) => {
    try { res.json(await Companion.find({ isAvailable: true })); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ success: false, message: "In Vault" });
        await new User({ email, password }).save();
        res.json({ success: true, message: "Awaiting approval." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(401).json({ success: false });
        if (!user.isApproved) return res.status(403).json({ success: false });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/reserve', async (req, res) => {
    try {
        const tag = `NGF-${Math.floor(1000 + Math.random() * 9000)}`;
        await new Booking({ ...req.body, ngfTag: tag }).save();
        res.json({ success: true, tag });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- ADMIN ROUTES ---

app.post('/api/approve/:id', async (req, res) => {
    try { await User.findByIdAndUpdate(req.params.id, { isApproved: true }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reset-password/:id', async (req, res) => {
    try { await User.findByIdAndUpdate(req.params.id, { password: '123456' }); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/vault', async (req, res) => {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    const members = await User.find().sort({ createdAt: -1 });
    const staff = await Companion.find();

    let html = `
    <html>
    <head>
        <title>VIBE & CO. | Private Vault</title>
        <style>
            body { background: #0a0e14; color: white; font-family: sans-serif; padding: 40px; }
            h1 { font-family: serif; color: #c5a059; border-bottom: 1px solid #c5a059; padding-bottom: 10px; }
            h2 { margin-top: 50px; text-transform: uppercase; letter-spacing: 2px; font-size: 12px; color: #9ca3af; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; background: rgba(255,255,255,0.02); }
            th, td { border: 1px solid rgba(197, 160, 89, 0.3); padding: 15px; text-align: left; }
            th { background: #c5a059; color: black; text-transform: uppercase; font-size: 12px; }
            .btn { background: #c5a059; color: black; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 10px; text-decoration:none; }
            img { border-radius: 8px; border: 1px solid #c5a059; object-fit: cover; }
        </style>
    </head>
    <body>
        <h1>VIBE & CO. | Private Command Center</h1>

        <h2>Active Roster (Staff)</h2>
        <table>
            <tr><th>Photo</th><th>Name</th><th>Details</th><th>Action</th></tr>`;
    staff.forEach(s => {
        html += `<tr>
            <td><img src="${s.imageUrl}" width="60" height="80"></td>
            <td><b>${s.name}</b></td>
            <td>${s.age} yrs | ${s.height} | ${s.specialty}</td>
            <td><button class="btn" onclick="updatePhoto('${s.name}')">UPDATE PHOTO</button></td>
        </tr>`;
    });
    html += `</table>

        <h2>Member Access Requests</h2>
        <table>
            <tr><th>Photo</th><th>Email</th><th>Status</th><th>Access</th><th>Security</th></tr>`;
    members.forEach(m => {
        html += `<tr>
            <td><img src="${m.profilePic}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
            <td>${m.email}</td>
            <td>${m.isApproved ? 'APPROVED' : 'PENDING'}</td>
            <td>${!m.isApproved ? `<button class="btn" onclick="approveUser('${m._id}')">APPROVE</button>` : 'Authorized'}</td>
            <td><button class="btn" style="background:#ef4444;" onclick="resetPassword('${m._id}')">RESET PW</button></td>
        </tr>`;
    });
    html += `</table>

        <h2>Secure Bookings</h2>
        <table>
            <tr><th>Alias</th><th>Contact</th><th>Tag</th></tr>`;
    bookings.forEach(b => {
        html += `<tr><td>${b.alias}</td><td>${b.contact}</td><td style="color:#c5a059">${b.ngfTag}</td></tr>`;
    });
    html += `</table>

    <script>
        async function approveUser(id) { await fetch('/api/approve/' + id, { method: 'POST' }); location.reload(); }
        async function resetPassword(id) { if(confirm("Reset to 123456?")) { await fetch('/api/reset-password/' + id, { method: 'POST' }); alert('Done'); } }
        function updatePhoto(name) {
            const url = prompt("Enter Direct Image URL for " + name);
            if(url) window.location.href = "/admin/manage-boy?name=" + name + "&imageUrl=" + url;
        }
    </script>
    </body></html>`;
    res.send(html);
});

app.get('/admin/manage-boy', async (req, res) => {
    try {
        const { name, age, height, specialty, imageUrl } = req.query;
        const updateData = { name, age: age ? parseInt(age) : undefined, height, specialty, imageUrl, isAvailable: true };
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        await Companion.findOneAndUpdate({ name }, updateData, { upsert: true });
        res.redirect('/admin/vault');
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/admin/update-member-photo', async (req, res) => {
    try {
        const { email, picUrl } = req.query;
        await User.findOneAndUpdate({ email }, { profilePic: picUrl });
        res.redirect('/admin/vault');
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`VIBE & CO. Live on port ${PORT}`));