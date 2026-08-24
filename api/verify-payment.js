import dotenv from 'dotenv';
dotenv.config();

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const passkey = process.env.MPESA_PASSKEY;
const shortcode = process.env.MPESA_SHORTCODE;

async function getMpesaAccessToken() {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const data = await response.json();
    return data.access_token;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
}