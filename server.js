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
// ADMIN VERIFY API
// ============================================================
app.post('/api/admin-verify', async (req, res) => {
    console.log('📥 Admin verify request');
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
        return res.status(500).json({ success: false, error: 'Admin password not configured' });
    }
    
    if (password === adminPassword) {
        return res.status(200).json({ success: true, message: 'Login successful' });
    } else {
        return res.status(401).json({ success: false, error: 'Incorrect password' });
    }
});

// ============================================================
// MPESA STK API
// ============================================================
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const passkey = process.env.MPESA_PASSKEY;
const shortcode = process.env.MPESA_SHORTCODE;
const tillNumber = process.env.MPESA_TILL_NUMBER;

async function getMpesaAccessToken() {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const data = await response.json();
    return data.access_token;
}

app.post('/api/mpesa-stk', async (req, res) => {
    console.log('📥 M-Pesa STK request');
    console.log('  Phone:', req.body.phoneNumber);
    console.log('  Amount:', req.body.amount);

    try {
        const { phoneNumber, amount, accountReference, transactionDesc } = req.body;

        let cleanPhone = phoneNumber.replace(/\s/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '254' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('254')) {
            cleanPhone = '254' + cleanPhone;
        }

        const accessToken = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerBuyGoodsOnline',
            Amount: parseInt(amount) || 50,
            PartyA: cleanPhone,
            PartyB: tillNumber,
            PhoneNumber: cleanPhone,
            CallBackURL: `${process.env.BASE_URL}/api/mpesa-callback`,
            AccountReference: accountReference || `USKAN-${Date.now()}`,
            TransactionDesc: transactionDesc || 'USKAN Brain Test'
        };

        console.log('📤 Sending STK Push:');
        console.log('  TransactionType:', payload.TransactionType);
        console.log('  PartyB (Till):', payload.PartyB);
        console.log('  Amount:', payload.Amount);
        console.log('  Phone:', payload.PhoneNumber);
        console.log('  CallBackURL:', payload.CallBackURL);

        const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('📥 M-Pesa Response:', data);

        if (data.ResponseCode === '0') {
            res.status(200).json({
                success: true,
                checkoutRequestID: data.CheckoutRequestID,
                merchantRequestID: data.MerchantRequestID,
                message: 'STK Push sent successfully.'
            });
        } else {
            console.error('❌ M-Pesa Error:', data);
            res.status(400).json({
                success: false,
                error: data.errorMessage || 'Failed to send STK Push'
            });
        }

    } catch (error) {
        console.error('M-Pesa STK Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// MPESA CALLBACK API
// ============================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/mpesa-callback', async (req, res) => {
    console.log('📥 M-Pesa Callback received');

    try {
        const callbackData = req.body;
        const resultCode = callbackData.Body?.stkCallback?.ResultCode;
        const resultDesc = callbackData.Body?.stkCallback?.ResultDesc;
        const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;

        console.log('  CheckoutRequestID:', checkoutRequestID);
        console.log('  ResultCode:', resultCode);
        console.log('  ResultDesc:', resultDesc);

        if (resultCode === '0') {
            await supabase
                .from('payments')
                .update({
                    status: 'completed',
                    result_code: resultCode,
                    result_desc: resultDesc,
                    completed_at: new Date().toISOString()
                })
                .eq('checkout_request_id', checkoutRequestID);
            console.log('✅ Payment successful for', checkoutRequestID);
        } else {
            await supabase
                .from('payments')
                .update({
                    status: 'failed',
                    result_code: resultCode,
                    result_desc: resultDesc
                })
                .eq('checkout_request_id', checkoutRequestID);
            console.log('❌ Payment failed for', checkoutRequestID);
        }

        res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

    } catch (error) {
        console.error('Callback Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// VERIFY PAYMENT API
// ============================================================
app.post('/api/verify-payment', async (req, res) => {
    console.log('📥 Verify payment request');

    try {
        const { checkoutRequestID } = req.body;
        if (!checkoutRequestID) {
            return res.status(400).json({ error: 'checkoutRequestID is required' });
        }

        const accessToken = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        };

        const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('📥 Verify response:', data);

        if (data.ResultCode === '0') {
            res.status(200).json({ success: true, status: 'completed' });
        } else if (data.ResultCode === '1') {
            res.status(200).json({ success: false, status: 'pending' });
        } else {
            res.status(200).json({ success: false, status: 'failed' });
        }

    } catch (error) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// AUTH API ROUTES
// ============================================================
import registerHandler from './api/register.js';
import loginHandler from './api/login.js';
import logoutHandler from './api/logout.js';
import verifyUserHandler from './api/verify-user.js';

app.post('/api/register', async (req, res) => {
    console.log('📝 Register request received');
    console.log('  Email:', req.body.email);
    console.log('  Username:', req.body.username);
    await registerHandler(req, res);
});

app.post('/api/login', async (req, res) => {
    console.log('🔑 Login request received');
    console.log('  Email:', req.body.email);
    await loginHandler(req, res);
});

app.post('/api/logout', async (req, res) => {
    console.log('🚪 Logout request received');
    await logoutHandler(req, res);
});

app.get('/api/verify-user', async (req, res) => {
    console.log('🔍 Verify user request received');
    await verifyUserHandler(req, res);
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