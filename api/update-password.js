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
        const { password, accessToken, refreshToken } = req.body;

        if (!password || !accessToken) {
            return res.status(400).json({ error: 'Password and access token are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        console.log('🔑 Updating password with access token:', accessToken.substring(0, 20) + '...');

        // ✅ Set the auth session using the access token
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
        });

        if (sessionError) {
            console.error('❌ Session error:', sessionError);
            return res.status(401).json({ error: 'Invalid or expired reset link. Please request a new one.' });
        }

        // ✅ Update the password
        const { data, error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            console.error('❌ Update password error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Password updated successfully for user:', sessionData?.user?.email);
        return res.status(200).json({
            success: true,
            message: 'Password updated successfully!'
        });

    } catch (error) {
        console.error('❌ Update password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}