// api/email.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import emailjs from '@emailjs/nodejs';
import { getSession, getVisitorToken, ensureVisitorToken } from './_session.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
});

function requireAdmin(req, res, handlerFn) {
  const session = getSession(req);
  if (!session?.isAdmin) {
    return res.status(403).json({ error: 'Admin login required' });
  }
  return handlerFn(req, res);
}

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

  const action = req.body?.action;

  switch (action) {
    case 'send-report': return handleSendReport(req, res);
    case 'send-mass-email': return requireAdmin(req, res, handleSendMassEmail);
    case 'send-feedback': return handleSendFeedback(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing action.' });
  }
}

// ============================================================
// SEND BRAIN REPORT (single user)
// ============================================================
async function handleSendReport(req, res) {
  try {
    const { email, results, username } = req.body;
    if (!email || !results) {
      return res.status(400).json({ error: 'Email and results are required' });
    }

    const htmlReport = generateHTMLReport(results, username);

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      {
        to_email: email,
        subject: 'Your USKAN Brain Test Results',
        html_body: htmlReport
      }
    );

    console.log(`✅ Report sent to ${email}`);
    return res.status(200).json({ success: true, message: 'Report sent successfully!' });
  } catch (error) {
    console.error('❌ Send report error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send report' });
  }
}

// ============================================================
// SEND FEEDBACK (rate-limited, body-only, from the feedback tab)
// ============================================================
async function handleSendFeedback(req, res) {
  try {
    const { message, replyEmail } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Feedback message is required' });
    }
    const trimmed = message.trim();
    if (trimmed.length > 200) {
      return res.status(400).json({ error: 'Feedback must be 200 characters or fewer' });
    }

    // Identify the sender — logged-in user or anonymous visitor cookie
    const session = getSession(req);
    const { token: visitorToken, cookieHeader } = ensureVisitorToken(req);
    if (cookieHeader) res.setHeader('Set-Cookie', cookieHeader);

    const identifier = session?.userId ? `user:${session.userId}` : `visitor:${visitorToken}`;

    // Rate limit: 2 per rolling 24 hours per identifier
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('feedback_log')
      .select('id', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('created_at', since);

    if (countError) {
      console.error('❌ Feedback count error:', countError);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if ((count || 0) >= 2) {
      return res.status(429).json({ error: 'You can only send 2 feedback messages per day. Please try again later.' });
    }

    // Log first, so a duplicate double-click can't slip past the limit
    await supabase.from('feedback_log').insert({
      identifier,
      message: trimmed,
      reply_email: replyEmail || null
    });

    const htmlBody = `
      <p><strong>Feedback:</strong></p>
      <p>${trimmed.replace(/\n/g, '<br />')}</p>
      ${replyEmail ? `<p><strong>Reply to:</strong> ${replyEmail}</p>` : ''}
    `;

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      {
        to_email: process.env.FEEDBACK_TO_EMAIL,
        subject: 'customer feed back',
        from_name: 'brain-app',
        html_body: htmlBody
      }
    );

    console.log('✅ Feedback sent from', identifier);
    return res.status(200).json({ success: true, message: 'Feedback sent!' });
  } catch (error) {
    console.error('❌ Send feedback error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send feedback' });
  }
}

// ============================================================
// SEND MASS EMAIL (all registered users) - ADMIN ONLY
// ============================================================
async function handleSendMassEmail(req, res) {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email, username')
      .not('email', 'is', null)
      .eq('unsubscribed', false);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    const validUsers = (users || []).filter(u => u.email && u.email.includes('@'));
    if (validUsers.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found' });
    }

    console.log(`📧 Sending mass email to ${validUsers.length} users`);

    let sentCount = 0;
    let failedCount = 0;

    for (const user of validUsers) {
      try {
        const htmlBody = generateMassEmailHTML(subject, body, user.email);
        await emailjs.send(
          process.env.EMAILJS_SERVICE_ID,
          process.env.EMAILJS_TEMPLATE_ID,
          {
            to_email: user.email,
            subject: subject,
            html_body: htmlBody
          }
        );
        sentCount++;
      } catch (sendError) {
        failedCount++;
        console.error('❌ Failed to send to', user.email, ':', sendError.message || sendError);
      }
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`✅ Completed: Sent ${sentCount}, Failed ${failedCount}`);
    return res.status(200).json({
      success: true,
      sentCount,
      failedCount,
      total: validUsers.length
    });
  } catch (error) {
    console.error('❌ Send mass email error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ============================================================
// GENERATE MASS EMAIL HTML (simple wrapper)
// ============================================================
function generateMassEmailHTML(subject, body, recipientEmail) {
  const baseUrl = process.env.BASE_URL || 'https://uskan-webb.vercel.app';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}`;
  return `
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
        .content { padding: 20px 0; color: #4A5568; line-height: 1.6; }
        .content p { margin: 12px 0; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #EDF2F7; font-size: 14px; color: #A0AEC0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>USKAN</h1></div>
        <div class="content">${body.replace(/\n/g, '<br />')}</div>
        <div class="footer">
          <p>© 2025 USKAN. All rights reserved.</p>
          <p style="font-size: 12px; margin-top: 8px;">You're receiving this email because you registered on USKAN.</p>
          <p style="font-size: 12px; margin-top: 8px;"><a href="${unsubscribeUrl}" style="color: #3182CE;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================
// GENERATE BRAIN REPORT HTML
// ============================================================
function generateHTMLReport(results, username) {
  const categoryNames = {
    abstract: 'Logic & Reasoning',
    memory: 'Memory & Recall',
    spatial: 'Spatial Awareness',
    verbal: 'Verbal Reasoning',
    speed: 'Processing Speed'
  };
  const categoryEmojis = {
    abstract: '🧩', memory: '🧠', spatial: '🌀', verbal: '📝', speed: '⚡'
  };
  const categoryColors = {
    abstract: '#3182CE', memory: '#E53E3E', spatial: '#38A169', verbal: '#805AD5', speed: '#D69E2E'
  };
  const categories = ['abstract', 'memory', 'spatial', 'verbal', 'speed'];

  let scoreBars = '';
  categories.forEach(cat => {
    const score = results[cat] || 0;
    const color = categoryColors[cat];
    scoreBars += `
      <tr>
        <td style="padding: 8px 12px; font-size: 14px; color: #4A5568; width: 180px;">
          ${categoryEmojis[cat]} ${categoryNames[cat]}
        </td>
        <td style="padding: 8px 12px; width: 60%;">
          <div style="background: #EDF2F7; border-radius: 6px; height: 20px; overflow: hidden; position: relative;">
            <div style="background: ${color}; height: 100%; width: ${score}%; border-radius: 6px;"></div>
          </div>
        </td>
        <td style="padding: 8px 12px; font-size: 14px; font-weight: 700; color: #1A2A3A; text-align: right; min-width: 50px;">
          ${score}%
        </td>
      </tr>
    `;
  });

  const brainType = results.brainType || 'Balanced Thinker';
  const overall = results.overall || 0;

  const categoriesText = [
    { key: 'abstract', text: 'You excel at solving complex puzzles and spotting patterns.' },
    { key: 'memory', text: 'You have an exceptional ability to remember details and sequences.' },
    { key: 'spatial', text: 'You can visualize objects in 3D and navigate spaces effortlessly.' },
    { key: 'verbal', text: 'You have a natural gift for language and communication.' },
    { key: 'speed', text: 'You process information and make decisions faster than most.' }
  ];

  let highest = { key: 'abstract', score: 0 };
  categoriesText.forEach(cat => {
    const score = results[cat.key] || 0;
    if (score > highest.score) highest = { key: cat.key, score };
  });
  const superpower = (categoriesText.find(c => c.key === highest.key) || {}).text
    || 'You have a unique combination of strengths.';

  let lowest = { key: 'abstract', score: 100 };
  categoriesText.forEach(cat => {
    const score = results[cat.key] || 0;
    if (score < lowest.score) lowest = { key: cat.key, score };
  });
  const blindspot = (categoriesText.find(c => c.key === lowest.key) || {}).text
    || 'Every brain has room for growth—keep challenging yourself!';

  const actionPlan = `
    <tr>
      <td style="padding: 8px 12px; font-weight: 700; color: #1A2A3A;">1</td>
      <td style="padding: 8px 12px; font-weight: 600;">Sudoku or Logic Puzzles</td>
      <td style="padding: 8px 12px; color: #718096;">5 min/day</td>
      <td style="padding: 8px 12px; color: #718096;">Trains pattern recognition and deductive reasoning</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; font-weight: 700; color: #1A2A3A;">2</td>
      <td style="padding: 8px 12px; font-weight: 600;">Visual Association Method</td>
      <td style="padding: 8px 12px; color: #718096;">3 min/day</td>
      <td style="padding: 8px 12px; color: #718096;">Connects new information to images you already know</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; font-weight: 700; color: #1A2A3A;">3</td>
      <td style="padding: 8px 12px; font-weight: 600;">Spaced Repetition Flashcards</td>
      <td style="padding: 8px 12px; color: #718096;">5 min/day</td>
      <td style="padding: 8px 12px; color: #718096;">Forces your brain to recall information just before it forgets</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your Brain Report - USKAN</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f7fafc; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #EDF2F7; }
        .header h1 { color: #1A2A3A; font-size: 32px; }
        .header .sub { color: #718096; font-size: 14px; }
        .overall { text-align: center; padding: 24px 0; }
        .overall .score { font-size: 48px; font-weight: 800; color: #1A2A3A; }
        .overall .label { font-size: 14px; color: #718096; }
        .overall .badge { display: inline-block; background: #F0FFF4; color: #38A169; padding: 4px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .section-title { font-size: 20px; font-weight: 700; color: #1A2A3A; margin: 20px 0 12px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .brain-type-box { background: linear-gradient(135deg, #6C3483, #AF7AC5); border-radius: 12px; padding: 16px; text-align: center; color: white; margin: 16px 0; }
        .brain-type-box .type { font-size: 24px; font-weight: 700; }
        .brain-type-box .tagline { font-size: 16px; opacity: 0.9; }
        .strength-card { background: #F0FFF4; border-left: 4px solid #38A169; padding: 12px 16px; margin: 8px 0; border-radius: 8px; }
        .strength-card .label { font-weight: 700; color: #1A2A3A; }
        .strength-card.blind { background: #FFF5F5; border-left-color: #E53E3E; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #EDF2F7; font-size: 14px; color: #A0AEC0; }
        .footer a { color: #3182CE; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>USKAN</h1>
          <p class="sub">Your Complete Brain Profile</p>
        </div>
        <div class="overall">
          <div class="score">${overall}%</div>
          <div class="label">Overall Score</div>
          <div class="badge">⬆ Above Average</div>
        </div>
        <div class="section-title">🧩 Your Cognitive Fingerprint</div>
        <table><tbody>${scoreBars}</tbody></table>
        <div class="brain-type-box">
          <div class="type">🧬 ${brainType}</div>
          <div class="tagline">"You think faster than most."</div>
        </div>
        <div class="strength-card">
          <div class="label">🦸 Your Superpower</div>
          <p style="margin: 4px 0 0; color: #4A5568;">${superpower}</p>
        </div>
        <div class="strength-card blind">
          <div class="label">🕳️ Your Blind Spot</div>
          <p style="margin: 4px 0 0; color: #4A5568;">${blindspot}</p>
        </div>
        <div class="section-title">⚡ Your Personalized Action Plan</div>
        <table>
          <thead>
            <tr>
              <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #718096;">Step</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #718096;">Exercise</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #718096;">Time</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #718096;">Why It Works</th>
            </tr>
          </thead>
          <tbody>${actionPlan}</tbody>
        </table>
        <div class="footer">
          <p>© 2025 USKAN. All rights reserved.</p>
          <p style="font-size: 12px; margin-top: 4px;">This report was generated for ${username || 'you'}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}