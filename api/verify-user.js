// api/verify-user.js
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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        let accessToken = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.substring(7);
        }

        if (!accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                username: profile?.username || user.email.split('@')[0],
                profile: profile,
                emailVerified: user.email_confirmed_at !== null
            }
        });

    } catch (error) {
        console.error('❌ Verify error:', error);
        return res.status(500).json({ error: error.message });
    }
}