import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

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

import adminVerify from './api/admin-verify.js';
import mpesaStk from './api/mpesa-stk.js';
import mpesaCallback from './api/mpesa-callback.js';
import verifyPayment from './api/verify-payment.js';

app.post('/api/admin-verify', async (req, res) => {
    await adminVerify(req, res);
});

app.post('/api/mpesa-stk', async (req, res) => {
    console.log('📥 M-Pesa STK request');
    console.log('  Phone:', req.body.phoneNumber);
    console.log('  Amount:', req.body.amount);
    await mpesaStk(req, res);
});

app.post('/api/mpesa-callback', async (req, res) => {
    console.log('📥 M-Pesa Callback received');
    await mpesaCallback(req, res);
});

app.post('/api/verify-payment', async (req, res) => {
    console.log('📥 Verify payment request');
    await verifyPayment(req, res);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path));
});

app.listen(PORT, () => {
    console.log(`🚀 USKAN running at http://localhost:${PORT}`);
    console.log(`📋 Press Ctrl+C to stop`);
});