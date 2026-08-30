// api/track.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const ALLOWED_PAGES = ['/', '/index.html', '/brain-test.html'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { page, userId, referrer } = req.body;

    if (!ALLOWED_PAGES.includes(page)) {
      return res.status(200).json({ success: true, tracked: false });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || '';

    await supabase.from('visits').insert({
      page,
      ip: ip || null,
      user_id: userId || null,
      referrer: referrer || '',
      user_agent: userAgent
    });

    // Auto-delete anything older than 72 hours
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    await supabase.from('visits').delete().lt('created_at', cutoff);

    return res.status(200).json({ success: true, tracked: true });
  } catch (error) {
    console.error('Track visit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}