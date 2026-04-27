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

// Auto-Delete Schema (24h)
const BookingSchema = new mongoose.Schema({
    alias: String,
    contact: String,
    ngfTag: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});
const Booking = mongoose.model('Booking', BookingSchema);

// Reservation Route
app.post('/api/reserve', async (req, res) => {
    try {
        const ngfTag = `NGF-${Math.floor(1000 + Math.random() * 9000)}`;
        const newBooking = new Booking({
            alias: req.body.alias,
            contact: req.body.contact,
            ngfTag: ngfTag
        });
        await newBooking.save();
        res.json({ success: true, tag: ngfTag });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/admin/vault', async (req, res) => {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    let html = `
    <html>
    <head><style>
        body { background: #0a0e14; color: white; font-family: sans-serif; padding: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #c5a059; padding: 15px; text-align: left; }
        th { background: #c5a059; color: black; }
        .tag { font-family: serif; font-weight: bold; color: #c5a059; }
    </style></head>
    <body>
        <h1>VIBE & CO. | Private Booking Vault</h1>
        <p>Data shreds automatically after 24 hours.</p>
        <table>
            <tr><th>Time</th><th>Alias</th><th>Contact</th><th>NGF Tag</th></tr>`;
    
    bookings.forEach(b => {
        html += `<tr>
            <td>${b.createdAt.toLocaleTimeString()}</td>
            <td>${b.alias}</td>
            <td>${b.contact}</td>
            <td class="tag">${b.ngfTag}</td>
        </tr>`;
    });

    html += `</table></body></html>`;
    res.send(html);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 VIBE & CO. Live at http://localhost:${PORT}`)); // SECRET ADMIN VIEW
