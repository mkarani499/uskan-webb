// api/send-mass-email.js
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';

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
        const { subject, body } = req.body;

        if (!subject || !body) {
            return res.status(400).json({ error: 'Subject and body are required' });
        }

        if (!RESEND_API_KEY || RESEND_API_KEY === 'your_resend_api_key') {
            return res.status(500).json({ error: 'Resend API key not configured' });
        }

        // ✅ Fetch all users with emails
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('email, username')
            .not('email', 'is', null);

        if (usersError) {
            console.error('❌ Error fetching users:', usersError);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        if (!users || users.length === 0) {
            return res.status(400).json({ error: 'No users found with email addresses' });
        }

        const validUsers = users.filter(user => user.email && user.email.includes('@'));

        if (validUsers.length === 0) {
            return res.status(400).json({ error: 'No valid email addresses found' });
        }

        console.log(`📧 Sending mass email to ${validUsers.length} users`);

        // ✅ Send in batches (Resend max 100 per request)
        const batchSize = 50;
        let sentCount = 0;
        let failedCount = 0;

        for (let i = 0; i < validUsers.length; i += batchSize) {
            const batch = validUsers.slice(i, i + batchSize);
            
            for (const user of batch) {
                try {
                    const htmlBody = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                            <title>${subject}</title>
                            <style>
                                body { font-family: Arial, sans-serif; background: #f7fafc; padding: 20px; }
                                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                                .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #EDF2F7; }
                                .header h1 { color: #1A2A3A; font-size: 28px; }
                                .header h1 span { color: #ED8936; }
                                .content { padding: 20px 0; color: #4A5568; line-height: 1.6; }
                                .content p { margin: 12px 0; }
                                .footer { text-align: center; padding-top: 20px; border-top: 1px solid #EDF2F7; font-size: 14px; color: #A0AEC0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>🇰🇪 US<span>KAN</span></h1>
                                </div>
                                <div class="content">
                                    ${body.replace(/\n/g, '<br />')}
                                </div>
                                <div class="footer">
                                    <p>© 2025 USKAN. All rights reserved.</p>
                                    <p style="font-size: 12px; margin-top: 8px;">
                                        You're receiving this email because you registered on USKAN.
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `;

                    const response = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${RESEND_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: FROM_EMAIL,
                            to: [user.email],
                            subject: subject,
                            html: htmlBody
                        })
                    });

                    if (response.ok) {
                        sentCount++;
                    } else {
                        failedCount++;
                        const errorData = await response.json();
                        console.error('❌ Failed to send to', user.email, ':', errorData);
                    }
                } catch (error) {
                    failedCount++;
                    console.error('❌ Error sending to', user.email, ':', error);
                }
            }

            // Small delay between batches
            if (i + batchSize < validUsers.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`✅ Completed: Sent ${sentCount}, Failed ${failedCount}`);

        return res.status(200).json({
            success: true,
            sentCount: sentCount,
            failedCount: failedCount,
            total: validUsers.length
        });

    } catch (error) {
        console.error('❌ Send mass email error:', error);
        return res.status(500).json({ error: error.message });
    }
}