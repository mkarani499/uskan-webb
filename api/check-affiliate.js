// api/check-affiliate.js
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
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        // Find user by auth_user_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_user_id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found in database' });
        }

        // Check if affiliate exists
        const { data: affiliate, error } = await supabase
            .from('affiliates')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        return res.status(200).json({
            hasAffiliate: affiliate !== null,
            affiliate: affiliate
        });

    } catch (error) {
        console.error('Check affiliate error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}