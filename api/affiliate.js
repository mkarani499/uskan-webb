// api/affiliate.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

  const action = req.body?.action;

  switch (action) {
    case 'register-affiliate': return handleRegisterAffiliate(req, res);
    case 'check-affiliate': return handleCheckAffiliate(req, res);
    case 'get-affiliate-data': return handleGetAffiliateData(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing action.' });
  }
}

async function handleRegisterAffiliate(req, res) {
  try {
    const { authUserId, mpesaPhone, referralCode } = req.body;
    if (!authUserId || !mpesaPhone || !referralCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users').select('id').eq('auth_user_id', authUserId).single();
    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return res.status(404).json({ error: 'User not found in database' });
    }

    const { data: existing } = await supabaseAdmin
      .from('affiliates').select('id').eq('user_id', user.id).single();
    if (existing) {
      return res.status(400).json({ error: 'You already have an affiliate account.' });
    }

    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .insert({
        user_id: user.id,
        auth_user_id: authUserId,
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
    return res.status(200).json({ success: true, affiliate, message: 'Affiliate account created successfully!' });
  } catch (error) {
    console.error('❌ Register affiliate error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCheckAffiliate(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const { data: user, error: userError } = await supabaseAnon
      .from('users').select('id').eq('auth_user_id', userId).single();
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const { data: affiliate, error } = await supabaseAnon
      .from('affiliates').select('id').eq('user_id', user.id).single();
    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.status(200).json({ hasAffiliate: affiliate !== null, affiliate });
  } catch (error) {
    console.error('Check affiliate error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetAffiliateData(req, res) {
  try {
    const { authUserId } = req.body;
    if (!authUserId) return res.status(400).json({ error: 'User ID required' });

    const { data: user, error: userError } = await supabaseAnon
      .from('users').select('id').eq('auth_user_id', authUserId).single();
    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return res.status(404).json({ error: 'User not found in database' });
    }

    const { data: affiliate, error: affiliateError } = await supabaseAnon
      .from('affiliates').select('*').eq('user_id', user.id).single();
    if (affiliateError && affiliateError.code !== 'PGRST116') {
      console.error('❌ Affiliate fetch error:', affiliateError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!affiliate) {
      return res.status(200).json({ hasAffiliate: false, affiliate: null });
    }

    const { data: referrals, error: referralsError } = await supabaseAnon
      .from('referrals').select('*').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false });
    if (referralsError) console.error('❌ Referrals fetch error:', referralsError);

    const totalReferrals = referrals?.length || 0;
    const totalEarnings = referrals?.filter(r => r.payout_status === 'completed' || r.manually_paid)
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
    const pendingEarnings = referrals?.filter(r => r.payout_status === 'pending' || r.payout_status === 'processing')
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    const formattedReferrals = (referrals || []).slice(0, 20).map(r => ({
      date: r.created_at,
      referred_phone: r.referred_phone || 'Unknown',
      amount: r.commission_amount || 20,
      status: r.manually_paid ? 'manual_paid' : r.payout_status || 'pending',
      statusLabel: r.manually_paid ? 'Manual' : (r.payout_status?.charAt(0).toUpperCase() + r.payout_status?.slice(1) || 'Pending')
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
      stats: { totalReferrals, totalEarnings, pendingEarnings },
      referrals: formattedReferrals
    });
  } catch (error) {
    console.error('❌ Get affiliate data error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}