import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getSession, getVisitorToken } from './_session.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PAGE_RULES = {
  'accrandum-dashboard.html':     { admin: true },
  'accrandum-email.html':         { admin: true },
  'affiliate-register.html':  { loggedIn: true, hasPaid: true, hasTakenTest: true },
  'results-preview.html':     { hasTakenTest: true },
  'results-full.html':        { hasPaid: true, hasTakenTest: true },
  'affiliate-dashboard.html': { isAffiliate: true },
};

export default async function handler(req, res) {
  const page = req.query.page;
  const rule = PAGE_RULES[page];
  if (!rule) return res.status(404).send('Not found');

  const session = getSession(req);
  if (session?.isAdmin) return servePage(res, page); // admin bypasses everything
  if (rule.admin) return res.status(403).send('Admin login required');

  let loggedIn = false, hasPaid = false, hasTakenTest = false, isAffiliate = false;

  if (session?.userId) {
    loggedIn = true;
    const { data: profile } = await supabase
      .from('users').select('has_paid, has_taken_test').eq('id', session.userId).single();
    if (profile) {
      hasPaid = !!profile.has_paid;
      hasTakenTest = !!profile.has_taken_test;
    }
    const { data: affiliate } = await supabase
      .from('affiliates').select('id').eq('user_id', session.userId).single();
    isAffiliate = !!affiliate;
  }

  // Fall back to anonymous visitor progress for flags not yet on an account
  if (!hasPaid || !hasTakenTest) {
    const visitorToken = getVisitorToken(req);
    if (visitorToken) {
      const { data: vp } = await supabase
        .from('visitor_progress').select('has_paid, has_taken_test').eq('visitor_token', visitorToken).single();
      if (vp) {
        hasPaid = hasPaid || !!vp.has_paid;
        hasTakenTest = hasTakenTest || !!vp.has_taken_test;
      }
    }
  }

  if (rule.loggedIn && !loggedIn) return res.status(403).send('Please log in');
  if (rule.hasPaid && !hasPaid) return res.status(403).send('Payment required');
  if (rule.hasTakenTest && !hasTakenTest) return res.status(403).send('Please complete the test first');
  if (rule.isAffiliate && !isAffiliate) return res.status(403).send('Please register as an affiliate first');

  return servePage(res, page);
}

function servePage(res, page) {
  const filePath = path.join(process.cwd(), 'protected', page);
  const html = fs.readFileSync(filePath, 'utf-8');
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}