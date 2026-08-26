// api/register.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin operations
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
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
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // 1. Check if username exists in DB
        const { data: existingUser } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // 2. Check if email exists in DB
        const { data: existingEmail } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // 3. Register user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    email: email
                }
            }
        });

        if (authError) {
            console.error('Auth Error:', authError);
            return res.status(400).json({ error: authError.message });
        }

        if (authData.user) {
            // 4. Insert user into your users table
            await supabase
                .from('users')
                .insert({
                    email: email,
                    username: username,
                    auth_user_id: authData.user.id,
                    email_verified: false
                });

            return res.status(200).json({
                success: true,
                message: 'Account created! Please check your email for verification.',
                user: {
                    id: authData.user.id,
                    email: email,
                    username: username
                }
            });
        }

        return res.status(400).json({ error: 'Registration failed' });

    } catch (error) {
        console.error('Register Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}