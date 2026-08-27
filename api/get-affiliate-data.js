// api/get-affiliate-data.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
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
        const { authUserId } = req.body;

        if (!authUserId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        // ✅ Step 1: Find the user in the users table by auth_user_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', authUserId)
            .single();

        if (userError || !user) {
            console.error('❌ User not found:', userError);
            return res.status(404).json({ error: 'User not found in database' });
        }

        // ✅ Step 2: Get affiliate record using internal ID
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (affiliateError && affiliateError.code !== 'PGRST116') {
            console.error('❌ Affiliate fetch error:', affiliateError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!affiliate) {
            return res.status(200).json({
                hasAffiliate: false,
                affiliate: null
            });
        }

        // ✅ Step 3: Get referrals
        const { data: referrals, error: referralsError } = await supabase
            .from('referrals')
            .select('*')
            .eq('affiliate_id', affiliate.id)
            .order('created_at', { ascending: false });

        if (referralsError) {
            console.error('❌ Referrals fetch error:', referralsError);
            // Still return affiliate data without referrals
        }

        // ✅ Step 4: Calculate stats
        const totalReferrals = referrals?.length || 0;
        const totalEarnings = referrals?.filter(r => r.payout_status === 'completed' || r.manually_paid)
            .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
        const pendingEarnings = referrals?.filter(r => r.payout_status === 'pending' || r.payout_status === 'processing')
            .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

        // ✅ Step 5: Format referrals for display
        const formattedReferrals = (referrals || []).slice(0, 20).map(r => ({
            date: r.created_at,
            referred_phone: r.referred_phone || 'Unknown',
            amount: r.commission_amount || 20,
            status: r.manually_paid ? 'manual_paid' : r.payout_status || 'pending',
            statusLabel: r.manually_paid ? 'Manual' : 
                (r.payout_status?.charAt(0).toUpperCase() + r.payout_status?.slice(1) || 'Pending')
        }));

        return res.status(200).json({
            hasAffiliate: true,
            affiliate: {
                id: affiliate.id,
                referral_code: affiliate.referral_code,
                mpesa_phone: affiliate.mpesa_phone,
                total_earnings: affiliate.total_earnings || 0,
                total_referrals: affiliate.total_referrals || 0
            },
            stats: {
                totalReferrals,
                totalEarnings,
                pendingEarnings
            },
            referrals: formattedReferrals
        });

    } catch (error) {
        console.error('❌ Get affiliate data error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}