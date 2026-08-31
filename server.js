import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🔍 Checking Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅' : '❌');
console.log('MPESA_CONSUMER_KEY:', process.env.MPESA_CONSUMER_KEY ? '✅' : '❌');
console.log('MPESA_CONSUMER_SECRET:', process.env.MPESA_CONSUMER_SECRET ? '✅' : '❌');
console.log('MPESA_PASSKEY:', process.env.MPESA_PASSKEY ? '✅' : '❌');
console.log('MPESA_SHORTCODE:', process.env.MPESA_SHORTCODE || '❌');
console.log('MPESA_TILL_NUMBER:', process.env.MPESA_TILL_NUMBER || '❌');
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '✅' : '❌');

// ============================================================
// API ROUTES (all logic now lives inside these 3 merged files)
// ============================================================
import authHandler from './api/auth.js';
import mpesaHandler from './api/mpesa.js';
import affiliateHandler from './api/affiliate.js';
import emailHandler from './api/email.js';
import unsubscribeHandler from './api/unsubscribe.js';

// auth.js handles: register, login, logout, verify-user, reset-password, update-password, admin-verify
app.post('/api/auth', async (req, res) => {
    console.log('🔐 Auth request:', req.body?.action);
    await authHandler(req, res);
});
app.get('/api/auth', async (req, res) => {
    console.log('🔐 Auth GET request:', req.query?.action);
    await authHandler(req, res);
});

// mpesa.js handles: stk, verify-payment, callback (via ?action=)
app.post('/api/mpesa', async (req, res) => {
    console.log('💰 M-Pesa request:', req.query?.action || req.body?.action);
    await mpesaHandler(req, res);
});

// affiliate.js handles: register-affiliate, check-affiliate, get-affiliate-data
app.post('/api/affiliate', async (req, res) => {
    console.log('🤝 Affiliate request:', req.body?.action);
    await affiliateHandler(req, res);
});

// email.js handles: send-pdf-report, send-mass-email
app.post('/api/email', async (req, res) => {
    console.log('📧 Email request:', req.body?.action);
    await emailHandler(req, res);
});

// unsubscribe.js handles: unsubscribe from emails
app.get('/api/unsubscribe', async (req, res) => {
    console.log('🚫 Unsubscribe request:', req.query?.email);
    await unsubscribeHandler(req, res);
});

// ============================================================
// SERVE HTML PAGES
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 USKAN running at http://localhost:${PORT}`);
    console.log(`📋 Press Ctrl+C to stop`);
});