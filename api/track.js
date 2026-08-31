// api/track.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { ensureVisitorToken } from './_session.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ✅ Keep the allowed pages list
const ALLOWED_PAGES = ['/', '/index.html', '/brain-test.html'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, cookieHeader } = ensureVisitorToken(req);
  if (cookieHeader) res.setHeader('Set-Cookie', cookieHeader);

  const action = req.body?.action || 'visit';

  try {
    await supabase.from('visitor_progress')
      .upsert({ visitor_token: token }, { onConflict: 'visitor_token', ignoreDuplicates: true });

    if (action === 'test-complete') {
      const { results } = req.body;
      await supabase.from('visitor_progress')
        .update({ has_taken_test: true, test_results: results || null })
        .eq('visitor_token', token);
    } else {
      const { page, userId, referrer } = req.body;

      // ✅ ALLOWED PAGES CHECK (kept)
      if (!ALLOWED_PAGES.includes(page)) {
        return res.status(200).json({ success: true, tracked: false });
      }

      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;

      await supabase.from('visits').insert({
        page: page || null,
        user_id: userId || null,
        referrer: referrer || null,
        user_agent: userAgent,
        ip: ip || null
      });

      // 72-hour auto-delete
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      await supabase.from('visits').delete().lt('created_at', cutoff);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Track error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}