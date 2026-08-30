// api/mpesa.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const passkey = process.env.MPESA_PASSKEY;
const shortcode = process.env.MPESA_SHORTCODE;
const tillNumber = process.env.MPESA_TILL_NUMBER;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'stk': return handleStkPush(req, res);
    case 'verify-payment': return handleVerifyPayment(req, res);
    case 'callback': return handleCallback(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing action. Use ?action=stk | verify-payment | callback' });
  }
}

async function handleStkPush(req, res) {
  try {
    const { phoneNumber, amount, accountReference, transactionDesc, referralCode, email } = req.body;
    let cleanPhone = phoneNumber.replace(/\s/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('254')) {
      cleanPhone = '254' + cleanPhone;
    }

    const accessToken = await getMpesaAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
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
      CallBackURL: `${baseUrl}/api/mpesa?action=callback`,
      AccountReference: accountReference || `USKAN-${Date.now()}`,
      TransactionDesc: transactionDesc || 'USKAN Brain Test'
    };

    console.log('📤 STK Push:', payload.PartyB, payload.Amount, payload.PhoneNumber);

    const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ResponseCode === '0') {
      // Create the pending payment record server-side (avoids browser->Supabase issues)
      try {
        await supabase.from('payments').insert({
          phone_number: cleanPhone,
          email: email || null,
          amount: parseInt(amount) || 50,
          checkout_request_id: data.CheckoutRequestID,
          merchant_request_id: data.MerchantRequestID,
          referral_code: referralCode || null,
          status: 'pending'
        });
      } catch (insertError) {
        console.error('⚠️ Could not save pending payment record:', insertError);
      }

      res.status(200).json({
        success: true,
        checkoutRequestID: data.CheckoutRequestID,
        merchantRequestID: data.MerchantRequestID,
        message: 'STK Push sent successfully.'
      });
    } else {
      console.error('❌ M-Pesa Error:', data);
      res.status(400).json({ success: false, error: data.errorMessage || 'Failed to send STK Push' });
    }
  } catch (error) {
    console.error('M-Pesa STK Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleVerifyPayment(req, res) {
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
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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

async function handleCallback(req, res) {
  try {
    const callbackData = req.body;
    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const resultDesc = callbackData.Body?.stkCallback?.ResultDesc;
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;

    console.log('📥 M-Pesa Callback:', { checkoutRequestID, resultCode, resultDesc });

    if (resultCode === '0') {
      await updatePaymentStatus(checkoutRequestID, 'completed', resultCode, resultDesc);
      console.log('✅ Payment successful');
      await createReferralIfApplicable(checkoutRequestID);
    } else {
      await updatePaymentStatus(checkoutRequestID, 'failed', resultCode, resultDesc);
      console.log('❌ Payment failed');
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePaymentStatus(checkoutRequestId, status, resultCode = null, resultDesc = null) {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status,
      result_code: resultCode,
      result_desc: resultDesc,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .eq('checkout_request_id', checkoutRequestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// CREATE REFERRAL RECORD (only runs after a successful payment)
// ============================================================
async function createReferralIfApplicable(checkoutRequestId) {
  try {
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('referral_code, phone_number')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (paymentError || !payment || !payment.referral_code) {
      return; // No referral code on this payment - nothing to do
    }

    // Prevent duplicates if Safaricom retries the callback
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (existingReferral) {
      console.log('ℹ️ Referral already recorded for this payment, skipping');
      return;
    }

    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id')
      .eq('referral_code', payment.referral_code)
      .single();

    if (affiliateError || !affiliate) {
      console.warn('⚠️ No affiliate found for referral code:', payment.referral_code);
      return;
    }

    await supabase.from('referrals').insert({
      affiliate_id: affiliate.id,
      referred_phone: payment.phone_number,
      commission_amount: 20,
      payout_status: 'pending',
      manually_paid: false,
      checkout_request_id: checkoutRequestId
    });

    console.log('✅ Referral created for affiliate:', affiliate.id);
  } catch (error) {
    console.error('❌ Error creating referral:', error);
  }
}