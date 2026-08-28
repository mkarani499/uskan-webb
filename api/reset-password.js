// api/reset-password.js
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
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // ✅ Send password reset email via Supabase (server-side)
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.BASE_URL || 'https://uskan-webb.vercel.app'}/update-password.html`
        });

        if (error) {
            console.error('❌ Reset password error:', error);
            return res.status(400).json({ error: error.message });
        }

        console.log(`✅ Password reset email sent to: ${email}`);
        return res.status(200).json({
            success: true,
            message: 'Password reset email sent! Please check your inbox.'
        });

    } catch (error) {
        console.error('❌ Reset password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}