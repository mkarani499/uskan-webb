// ============================================================
// ADMIN VERIFY API - Verifies admin password
// ============================================================

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

    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminPassword) {
            return res.status(500).json({ success: false, error: 'Admin password not configured' });
        }
        
        if (password === adminPassword) {
            return res.status(200).json({ success: true, message: 'Login successful' });
        } else {
            return res.status(401).json({ success: false, error: 'Incorrect password' });
        }
    } catch (error) {
        console.error('Admin verify error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
}