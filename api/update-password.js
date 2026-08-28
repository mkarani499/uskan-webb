// api/update-password.js
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
        const { password, accessToken } = req.body;

        if (!password || !accessToken) {
            return res.status(400).json({ error: 'Password and access token are required' });
        }

        // ✅ Update password using Supabase Auth (server-side)
        const { data, error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            console.error('❌ Update password error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Password updated successfully');
        return res.status(200).json({
            success: true,
            message: 'Password updated successfully!'
        });

    } catch (error) {
        console.error('❌ Update password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}