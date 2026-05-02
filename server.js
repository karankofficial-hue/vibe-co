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

// Updated Schema: Added 'notes' and removed the auto-delete 'expires' timer
const BookingSchema = new mongoose.Schema({
    alias: String,
    contact: String,
    notes: String, // <--- New field for client preferences
    ngfTag: String,
    createdAt: { type: Date, default: Date.now } // Auto-shredding removed as per request
});
const Booking = mongoose.model('Booking', BookingSchema);

// Reservation Route
app.post('/api/reserve', async (req, res) => {
    try {
        const ngfTag = `NGF-${Math.floor(1000 + Math.random() * 9000)}`;
        const newBooking = new Booking({
            alias: req.body.alias,
            contact: req.body.contact,
            notes: req.body.notes, // <--- Now saving notes to database
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

// Updated Admin Vault: Added "Curation Notes" column
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
                <th>Curation Notes</th> <!-- New Column -->
                <th>NGF Tag</th>
            </tr>`;

    bookings.forEach(b => {
        const d = new Date(b.createdAt);
        const dateStr = d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            timeZone: 'Asia/Kolkata' 
        });
        const timeStr = d.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: 'Asia/Kolkata' 
        });

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
app.listen(PORT, () => {
    console.log(`Privacy Vault Connected`);
    console.log(`VIBE & CO. Live on port ${PORT}`);
});