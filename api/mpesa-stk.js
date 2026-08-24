import dotenv from 'dotenv';
dotenv.config();

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

        // Get BASE_URL from environment
        const baseUrl = process.env.BASE_URL || 'https://uskan-webb.vercel.app';

        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerBuyGoodsOnline',
            Amount: parseInt(amount) || 50,
            PartyA: cleanPhone,
            PartyB: tillNumber,
            PhoneNumber: cleanPhone,
            CallBackURL: `${baseUrl}/api/mpesa-callback`,
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
}