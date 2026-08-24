import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const callbackData = req.body;
        const resultCode = callbackData.Body?.stkCallback?.ResultCode;
        const resultDesc = callbackData.Body?.stkCallback?.ResultDesc;
        const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;

        console.log(`📥 M-Pesa Callback:`, { checkoutRequestID, resultCode, resultDesc });

        if (resultCode === '0') {
            await updatePaymentStatus(checkoutRequestID, 'completed', resultCode, resultDesc);
            console.log(`✅ Payment successful`);
        } else {
            await updatePaymentStatus(checkoutRequestID, 'failed', resultCode, resultDesc);
            console.log(`❌ Payment failed`);
        }

        res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

    } catch (error) {
        console.error('Callback Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function updatePaymentStatus(checkoutRequestId, status, resultCode = null, resultDesc = null) {
    try {
        const { data, error } = await supabase
            .from('payments')
            .update({
                status: status,
                result_code: resultCode,
                result_desc: resultDesc,
                completed_at: status === 'completed' ? new Date().toISOString() : null
            })
            .eq('checkout_request_id', checkoutRequestId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating payment:', error);
        throw error;
    }
}