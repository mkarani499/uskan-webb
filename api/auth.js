// api/auth.js
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { createSessionCookie, clearSessionCookie, getVisitorToken, ensureVisitorToken } from './_session.js';

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query.action || req.body?.action;

  if (req.method === 'GET' && action === 'verify-user') {
    return handleVerifyUser(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  switch (action) {
    case 'register': return handleRegister(req, res);
    case 'login': return handleLogin(req, res);
    case 'logout': return handleLogout(req, res);
    case 'reset-password': return handleResetPassword(req, res);
    case 'update-password': return handleUpdatePassword(req, res);
    case 'admin-verify': return handleAdminVerify(req, res);
    case 'delete-account': return handleDeleteAccount(req, res);
    default: return res.status(400).json({ error: 'Unknown or missing action.' });
  }
}

async function handleRegister(req, res) {
  try {
    const { token, cookieHeader } = ensureVisitorToken(req);
    if (cookieHeader) res.setHeader('Set-Cookie', cookieHeader);

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { count: recentRegistrations } = await supabaseAdmin
      .from('registration_log')
      .select('*', { count: 'exact', head: true })
      .eq('visitor_token', token)
      .gte('registered_at', twelveHoursAgo);

    if ((recentRegistrations || 0) >= 1) {
      return res.status(429).json({ error: 'Try again after a few hours.' });
    }

    const { username, email, password, referralCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users').select('username').eq('username', username).single();
    if (existingUser) {
      return res.status(400).json({ error: 'Unable to register with these details' });
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('users').select('email').eq('email', email).single();
    if (existingEmail) {
      return res.status(400).json({ error: 'Unable to register with these details' });
    }

    const baseUrl = process.env.BASE_URL || 'https://uskan-webb.vercel.app';
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email, password,
      options: {
        data: { username, email },
        emailRedirectTo: `${baseUrl}/verified.html`
      }
    });

    if (authError) {
      console.error('Auth Error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (authData.user) {
      await supabaseAdmin.from('users').insert({
        email, username,
        auth_user_id: authData.user.id,
        email_verified: false,
        referred_by_code: referralCode || null
      });

      await supabaseAdmin.from('registration_log').insert({ visitor_token: token });

      return res.status(200).json({
        success: true,
        message: 'Account created! Please check your email for verification.',
        user: { id: authData.user.id, email, username }
      });
    }
    return res.status(400).json({ error: 'Registration failed' });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: 'Invalid email or password' });

    if (data.user) {
      const { data: profile } = await supabaseAnon
        .from('users').select('*').eq('auth_user_id', data.user.id).single();

      // Merge anonymous test/payment progress into this account
      const visitorToken = getVisitorToken(req);
      if (visitorToken && profile) {
        const { data: vp } = await supabaseAdmin
          .from('visitor_progress').select('*').eq('visitor_token', visitorToken).single();
        if (vp) {
          const updates = {};
          if (vp.has_taken_test && !profile.has_taken_test) updates.has_taken_test = true;
          if (vp.has_paid && !profile.has_paid) updates.has_paid = true;
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('users').update(updates).eq('id', profile.id);
          }
        }
      }

      res.setHeader('Set-Cookie', createSessionCookie({ userId: profile?.id, isAdmin: false }));

      return res.status(200).json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: profile?.username || data.user.email.split('@')[0],
          profile
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

async function handleLogout(req, res) {
  try {
    const { error } = await supabaseAnon.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleVerifyUser(req, res) {
  try {
    const authHeader = req.headers.authorization;
    let accessToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
    if (!accessToken) return res.status(401).json({ error: 'Not authenticated' });

    const { data: { user }, error } = await supabaseAnon.auth.getUser(accessToken);
    if (error || !user) return res.status(401).json({ error: 'Invalid session' });

    const { data: profile } = await supabaseAnon
      .from('users').select('*').eq('auth_user_id', user.id).single();

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: profile?.username || user.email.split('@')[0],
        profile,
        emailVerified: user.email_confirmed_at !== null
      }
    });
  } catch (error) {
    console.error('❌ Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleResetPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const baseUrl = process.env.BASE_URL || 'https://uskan-webb.vercel.app';
    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/update-password.html`
    });

    if (error) {
      console.error('❌ Reset password error:', error);
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ success: true, message: 'Password reset email sent! Please check your inbox.' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUpdatePassword(req, res) {
  try {
    const { password, accessToken, refreshToken } = req.body;
    if (!password || !accessToken) {
      return res.status(400).json({ error: 'Password and access token are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || ''
    });

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return res.status(401).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const { error } = await supabaseAnon.auth.updateUser({ password });
    if (error) {
      console.error('❌ Update password error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('✅ Password updated for:', sessionData?.user?.email);
    return res.status(200).json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('❌ Update password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleAdminVerify(req, res) {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentAttempts } = await supabaseAdmin
      .from('admin_login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('attempted_at', fifteenMinAgo);

    if ((recentAttempts || 0) >= 5) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please try again in 15 minutes.' });
    }

    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({ success: false, error: 'Admin credentials not configured' });
    }

    if (email !== adminEmail || password !== adminPassword) {
      await supabaseAdmin.from('admin_login_attempts').insert({ ip });
      return res.status(401).json({ success: false, error: 'Incorrect email or password' });
    }

    res.setHeader('Set-Cookie', createSessionCookie({ userId: null, isAdmin: true }));
    return res.status(200).json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Admin verify error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

// ============================================================
// DELETE ACCOUNT - GDPR/Privacy compliance
// ============================================================
async function handleDeleteAccount(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Re-authenticate right now to confirm this is genuinely them
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const authUserId = authData.user.id;

    const { data: profile } = await supabaseAdmin
      .from('users').select('*').eq('auth_user_id', authUserId).single();

    if (!profile) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // ============================================================
    // 1. Anonymize referrals where THIS person was the one referred
    //    (matched via phone numbers used on their payments)
    // ============================================================
    const { data: theirPayments } = await supabaseAdmin
      .from('payments')
      .select('phone_number')
      .eq('user_id', profile.id);

    const theirPhoneNumbers = [...new Set((theirPayments || [])
      .map(p => p.phone_number)
      .filter(Boolean))];

    if (theirPhoneNumbers.length > 0) {
      await supabaseAdmin
        .from('referrals')
        .update({ referred_phone: null })
        .in('referred_phone', theirPhoneNumbers);
    }

    // ============================================================
    // 2. Anonymize their OWN affiliate account (if they have one)
    //    Keep mpesa_phone + referral_code so any pending commission
    //    owed TO them can still be looked up and paid from admin-dashboard
    // ============================================================
    const { data: affiliate } = await supabaseAdmin
      .from('affiliates').select('id').eq('user_id', profile.id).single();

    if (affiliate) {
      await supabaseAdmin
        .from('affiliates')
        .update({ user_id: null, auth_user_id: null, is_active: false })
        .eq('id', affiliate.id);
    }

    // ============================================================
    // 3. Anonymize their payment records (keep amount/status for
    //    revenue accounting, strip personal contact info)
    // ============================================================
    await supabaseAdmin
      .from('payments')
      .update({ email: null, phone_number: null, user_id: null })
      .eq('user_id', profile.id);

    // ============================================================
    // 4. Fully delete anything with no accounting value
    // ============================================================
    await supabaseAdmin.from('test_results').delete().eq('user_id', profile.id);
    await supabaseAdmin.from('visits').delete().eq('user_id', profile.id);

    // ============================================================
    // 5. Delete their profile row
    // ============================================================
    await supabaseAdmin.from('users').delete().eq('id', profile.id);

    // ============================================================
    // 6. Delete the actual login (Supabase Auth)
    // ============================================================
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    console.error('❌ Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}