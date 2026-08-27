// api/register-affiliate.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // CORS headers
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
        const { authUserId, mpesaPhone, referralCode } = req.body;

        if (!authUserId || !mpesaPhone || !referralCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // ✅ First, find the user in the users table by auth_user_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', authUserId)
            .single();

        if (userError || !user) {
            console.error('❌ User not found:', userError);
            return res.status(404).json({ error: 'User not found in database' });
        }

        // ✅ Check if user already has an affiliate account
        const { data: existing, error: checkError } = await supabase
            .from('affiliates')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'You already have an affiliate account.' });
        }

        // ✅ Create affiliate account with the correct user_id
        const { data: affiliate, error } = await supabase
            .from('affiliates')
            .insert({
                user_id: user.id,           // ← Use the users table's id
                auth_user_id: authUserId,   // ← Keep this for reference
                referral_code: referralCode,
                mpesa_phone: mpesaPhone,
                total_earnings: 0,
                total_referrals: 0,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Affiliate insert error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log('✅ Affiliate created:', affiliate.referral_code);
        return res.status(200).json({
            success: true,
            affiliate: affiliate,
            message: 'Affiliate account created successfully!'
        });

    } catch (error) {
        console.error('❌ Register affiliate error:', error);
        return res.status(500).json({ error: error.message });
    }
}