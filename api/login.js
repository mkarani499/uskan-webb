// api/login.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // CORS
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
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Login with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (data.user) {
            // Get user profile from your users table
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('auth_user_id', data.user.id)
                .single();

            return res.status(200).json({
                success: true,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    username: profile?.username || data.user.email.split('@')[0],
                    profile: profile
                },
                accessToken: data.session.access_token
            });
        }

        return res.status(400).json({ error: 'Login failed' });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}