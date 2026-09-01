// api/unsubscribe.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from './_session.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send('Missing or invalid unsubscribe link.');
    }

    const email = verifyUnsubscribeToken(token);
    if (!email) {
      return res.status(400).send('This unsubscribe link is invalid or has expired.');
    }

    const { error } = await supabase
      .from('users')
      .update({ unsubscribed: true })
      .eq('email', email);

    if (error) {
      console.error('❌ Unsubscribe error:', error);
      return res.status(500).send('Something went wrong. Please try again later.');
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8" /><title>Unsubscribed - USKAN</title></head>
      <body style="font-family: Arial, sans-serif; background: #f7fafc; padding: 60px 20px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="color: #1A2A3A;">You've been unsubscribed</h2>
          <p style="color: #4A5568;">${email} will no longer receive emails from USKAN.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Unsubscribe error:', error);
    return res.status(500).send('Something went wrong.');
  }
}