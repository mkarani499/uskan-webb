// ============================================================
// USKAN - Authentication System (Supabase Auth)
// ============================================================

// ============================================================
// SUPABASE CLIENT - Uses global supabase from HTML config
// ============================================================

if (typeof supabase === 'undefined') {
    console.error('❌ supabase is not defined!');
    var supabase = null;
} else {
    console.log('✅ Supabase client available');
}

// ============================================================
// AUTH MODAL FUNCTIONS (Defined FIRST so they're available)
// ============================================================

function openLoginModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('verificationMessage').style.display = 'none';
    clearAuthErrors();
}

function openRegisterModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('active');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('verificationMessage').style.display = 'none';
    clearAuthErrors();
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('active');
    clearAuthErrors();
    const inputs = modal.querySelectorAll('input');
    inputs.forEach(input => input.value = '');
}

function switchToLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('verificationMessage').style.display = 'none';
    clearAuthErrors();
}

function switchToRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('verificationMessage').style.display = 'none';
    clearAuthErrors();
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'block';
    document.getElementById('verificationMessage').style.display = 'none';
    clearAuthErrors();
}

function clearAuthErrors() {
    document.querySelectorAll('.auth-error').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.auth-success').forEach(el => el.style.display = 'none');
}

function showAuthError(message) {
    clearAuthErrors();
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function showAuthSuccess(message) {
    clearAuthErrors();
    const successDiv = document.getElementById('authSuccess');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

async function checkSession() {
    try {
        if (!supabase) {
            console.warn('⚠️ Supabase not available');
            return { loggedIn: false, user: null, profile: null };
        }
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
            const user = session.user;
            console.log('✅ User logged in:', user.email);
            
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('auth_user_id', user.id)
                .single();
            
            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
            }
            
            return {
                loggedIn: true,
                user: user,
                profile: profile || null
            };
        } else {
            console.log('🔓 No active session');
            return {
                loggedIn: false,
                user: null,
                profile: null
            };
        }
    } catch (error) {
        console.error('Session check error:', error);
        return {
            loggedIn: false,
            user: null,
            profile: null
        };
    }
}

// ============================================================
// REGISTRATION
// ============================================================

async function registerUser(email, username, password) {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();
        
        if (existingUser) {
            return { success: false, error: 'Username already taken. Please choose another.' };
        }
        
        const { data: existingEmail, error: emailError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existingEmail) {
            return { success: false, error: 'Email already registered. Please login.' };
        }
        
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
            return { success: false, error: authError.message };
        }
        
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    email: email,
                    username: username,
                    auth_user_id: authData.user.id,
                    email_verified: false
                });
            
            if (profileError) {
                console.error('Error creating profile:', profileError);
            }
            
            const progress = localStorage.getItem('userProgress');
            if (progress) {
                console.log('📦 Progress found, will restore after verification');
                localStorage.setItem('pendingVerificationEmail', email);
            }
            
            return {
                success: true,
                message: 'Registration successful! Please check your email for verification.',
                user: authData.user,
                requiresVerification: true
            };
        }
        
        return { success: false, error: 'Registration failed. Please try again.' };
        
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// LOGIN
// ============================================================

async function loginUser(email, password) {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        const user = data.user;
        
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();
        
        if (!user.email_confirmed_at) {
            return { 
                success: true, 
                user: user,
                profile: profile,
                requiresVerification: true,
                message: 'Please verify your email before accessing affiliate features.'
            };
        }
        
        if (profile && !profile.email_verified) {
            await supabase
                .from('users')
                .update({ email_verified: true })
                .eq('auth_user_id', user.id);
        }
        
        const intendedAction = localStorage.getItem('intendedAction');
        if (intendedAction === 'affiliate') {
            localStorage.removeItem('intendedAction');
            setTimeout(() => {
                restoreUserProgress();
                openAffiliateDashboard();
            }, 1000);
        }
        
        return {
            success: true,
            user: user,
            profile: profile,
            requiresVerification: false,
            message: 'Login successful!'
        };
        
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        localStorage.removeItem('user');
        localStorage.removeItem('userProfile');
        
        return { success: true, message: 'Logged out successfully.' };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

async function resetPassword(email) {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password.html`
        });
        
        if (error) throw error;
        
        return {
            success: true,
            message: 'Password reset email sent! Please check your inbox.'
        };
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// UPDATE PASSWORD (After Reset)
// ============================================================

async function updatePassword(newPassword) {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        return {
            success: true,
            message: 'Password updated successfully!'
        };
    } catch (error) {
        console.error('Update password error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// RESTORE PROGRESS AFTER REGISTRATION
// ============================================================

async function restoreProgress() {
    const progress = localStorage.getItem('userProgress');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    
    if (progress && pendingEmail) {
        if (!supabase) return false;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            if (session.user.email === pendingEmail) {
                console.log('📦 Restoring progress for:', pendingEmail);
                localStorage.removeItem('pendingVerificationEmail');
                return true;
            }
        }
    }
    return false;
}

// ============================================================
// CHECK USERNAME AVAILABILITY
// ============================================================

async function checkUsername(username) {
    try {
        if (!supabase) {
            return { available: true, message: 'Supabase not available' };
        }
        const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();
        
        if (data) {
            return { available: false, message: 'Username is taken' };
        } else {
            return { available: true, message: 'Username is available' };
        }
    } catch (error) {
        return { available: true, message: 'Username is available' };
    }
}

// ============================================================
// GET CURRENT USER (Sync)
// ============================================================

function getCurrentUser() {
    const user = localStorage.getItem('user');
    if (user) {
        try {
            return JSON.parse(user);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// ============================================================
// UPDATE UI BASED ON AUTH STATE
// ============================================================

async function updateAuthUI() {
    const session = await checkSession();
    const authButtons = document.getElementById('authButtons');
    
    if (!authButtons) return;
    
    if (session.loggedIn) {
        const username = session.profile?.username || session.user?.email?.split('@')[0] || 'User';
        authButtons.innerHTML = `
            <div class="auth-user">
                <span class="username">👤 ${username}</span>
                <button onclick="handleLogout()" class="btn-logout">Logout</button>
            </div>
        `;
        authButtons.style.display = 'flex';
        
        localStorage.setItem('user', JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            username: username,
            profile: session.profile
        }));
        
        const affiliateBtn = document.getElementById('affiliateDashboardBtn');
        if (affiliateBtn) {
            affiliateBtn.style.display = 'flex';
        }
        
    } else {
        authButtons.innerHTML = `
            <button onclick="openLoginModal()" class="btn-login">Login</button>
            <button onclick="openRegisterModal()" class="btn-register">Register</button>
        `;
        authButtons.style.display = 'flex';
        
        const affiliateBtn = document.getElementById('affiliateDashboardBtn');
        if (affiliateBtn) {
            affiliateBtn.style.display = 'none';
        }
        
        localStorage.removeItem('user');
    }
}

// ============================================================
// HANDLE LOGOUT
// ============================================================

async function handleLogout() {
    const result = await logoutUser();
    if (result.success) {
        await updateAuthUI();
        showToast('👋 Logged out successfully!');
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } else {
        showToast('❌ Logout failed: ' + result.error);
    }
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ============================================================
// AFFILIATE DASHBOARD FUNCTIONS
// ============================================================

async function getAffiliateData(userId) {
    try {
        if (!supabase) return null;
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (affiliateError && affiliateError.code !== 'PGRST116') {
            console.error('Error fetching affiliate:', affiliateError);
            return null;
        }

        if (!affiliate) {
            return { hasAffiliate: false };
        }

        const { data: referrals, error: referralsError } = await supabase
            .from('referrals')
            .select('*')
            .eq('affiliate_id', affiliate.id);

        if (referralsError) {
            console.error('Error fetching referrals:', referralsError);
        }

        const totalReferrals = referrals?.length || 0;
        const totalEarnings = referrals?.filter(r => r.payout_status === 'completed' || r.manually_paid)
            .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
        const pendingEarnings = referrals?.filter(r => r.payout_status === 'pending' || r.payout_status === 'processing')
            .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

        return {
            hasAffiliate: true,
            affiliate: affiliate,
            stats: {
                totalReferrals,
                totalEarnings,
                pendingEarnings
            },
            referrals: referrals || []
        };
    } catch (error) {
        console.error('Error getting affiliate data:', error);
        return null;
    }
}

async function registerAffiliateAccount(userId, mpesaPhone) {
    try {
        if (!supabase) {
            return { success: false, error: 'Supabase not available' };
        }
        const { data: existing, error: checkError } = await supabase
            .from('affiliates')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existing) {
            return { success: false, error: 'You already have an affiliate account.' };
        }

        const referralCode = generateReferralCode();

        const { data: affiliate, error } = await supabase
            .from('affiliates')
            .insert({
                user_id: userId,
                referral_code: referralCode,
                mpesa_phone: mpesaPhone,
                total_earnings: 0,
                total_referrals: 0,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            affiliate: affiliate,
            message: 'Affiliate account created successfully!'
        };
    } catch (error) {
        console.error('Error registering affiliate:', error);
        return { success: false, error: error.message };
    }
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function loadAffiliateDashboard() {
    const content = document.getElementById('affiliateDashboardContent');
    if (!content) return;

    const session = await checkSession();
    if (!session.loggedIn) {
        content.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="font-size:48px; margin-bottom:12px;">🔐</p>
                <h3 style="color:var(--navy);">Please Login</h3>
                <p style="color:var(--medium-grey);">You need to be logged in to view your affiliate dashboard.</p>
                <button onclick="closeAffiliateDashboard(); openLoginModal();" class="auth-btn-primary" style="margin-top:16px;">
                    Login
                </button>
            </div>
        `;
        return;
    }

    const user = session.user;
    const profile = session.profile;
    const affiliateData = await getAffiliateData(profile?.id || user.id);

    if (!affiliateData) {
        content.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="font-size:48px; margin-bottom:12px;">⚠️</p>
                <h3 style="color:var(--navy);">Something went wrong</h3>
                <p style="color:var(--medium-grey);">Could not load affiliate data.</p>
                <button onclick="loadAffiliateDashboard()" class="auth-btn-primary" style="margin-top:16px;">
                    Retry
                </button>
            </div>
        `;
        return;
    }

    if (!affiliateData.hasAffiliate) {
        content.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="font-size:48px; margin-bottom:12px;">💰</p>
                <h3 style="color:var(--navy);">Start Earning Money!</h3>
                <p style="color:var(--medium-grey); margin-bottom:16px;">
                    Register your M-Pesa number to start earning<br>
                    <strong>KSh 20</strong> for every referral!
                </p>
                <div style="background:var(--off-white); border-radius:12px; padding:16px; text-align:left; margin-bottom:16px;">
                    <label style="font-weight:600; display:block; margin-bottom:4px;">📱 M-Pesa Number</label>
                    <div style="display:flex; gap:8px;">
                        <span style="background:var(--white); padding:8px 12px; border-radius:8px; border:1px solid #E2E8F0;">+254</span>
                        <input type="tel" id="affiliateMpesaPhone" placeholder="712345678" style="flex:1; padding:8px 12px; border:1px solid #E2E8F0; border-radius:8px;" />
                    </div>
                </div>
                <button onclick="registerAffiliateFromDashboard()" class="auth-btn-primary">
                    🔗 Register as Affiliate
                </button>
            </div>
        `;
        return;
    }

    const affiliate = affiliateData.affiliate;
    const stats = affiliateData.stats;
    const baseUrl = window.location.origin;
    const referralLink = `${baseUrl}/?ref=${affiliate.referral_code}`;

    content.innerHTML = `
        <div style="margin-bottom:20px;">
            <div style="background:linear-gradient(135deg, #F0FFF4, #E6FFFA); border-radius:12px; padding:16px; text-align:center; border:1px solid #C6F6D5;">
                <div style="font-size:14px; color:var(--success-green); font-weight:600;">🟢 Active Affiliate</div>
                <div style="font-size:12px; color:var(--medium-grey);">Referral Code: <strong>${affiliate.referral_code}</strong></div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div class="stat-item">
                <div class="stat-number">${stats.totalReferrals}</div>
                <div class="stat-label">👥 People Referred</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">KSh ${stats.totalEarnings}</div>
                <div class="stat-label">💰 Total Earned</div>
            </div>
        </div>

        <div style="background:var(--off-white); border-radius:12px; padding:16px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:14px;">
                <span style="color:var(--medium-grey);">📱 M-Pesa Number</span>
                <span style="font-weight:600;">${affiliate.mpesa_phone}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:4px;">
                <span style="color:var(--medium-grey);">⏳ Pending Earnings</span>
                <span style="font-weight:600; color:var(--primary-orange);">KSh ${stats.pendingEarnings}</span>
            </div>
        </div>

        <div class="referral-link-box">
            <label style="font-weight:600; font-size:14px; color:var(--navy);">🔗 Your Referral Link</label>
            <div class="link-display">
                <input type="text" id="affiliateDashboardLink" value="${referralLink}" readonly />
                <button onclick="copyAffiliateLink()" style="background:var(--logic-blue); color:white; border:none; border-radius:8px; padding:10px 16px; cursor:pointer; font-weight:600;">
                    📋 Copy
                </button>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                <button onclick="shareAffiliateLink('whatsapp')" style="background:#25D366; color:white; border:none; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:13px;">💬 WhatsApp</button>
                <button onclick="shareAffiliateLink('facebook')" style="background:#1877F2; color:white; border:none; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:13px;">📘 Facebook</button>
                <button onclick="shareAffiliateLink('twitter')" style="background:#000000; color:white; border:none; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:13px;">🐦 Twitter</button>
            </div>
        </div>

        <div style="font-size:12px; color:var(--medium-grey); text-align:center; margin-top:12px;">
            💰 Earn KSh 20 for every friend who takes the test using your link!
        </div>
    `;
}

async function registerAffiliateFromDashboard() {
    const phoneInput = document.getElementById('affiliateMpesaPhone');
    if (!phoneInput) return;

    const phone = phoneInput.value.trim();
    if (!phone || phone.length !== 9) {
        alert('Please enter a valid 9-digit M-Pesa number (e.g., 712345678)');
        return;
    }

    const formattedPhone = `254${phone}`;
    const session = await checkSession();
    if (!session.loggedIn) {
        alert('Please login first.');
        return;
    }

    const btn = document.querySelector('#affiliateDashboardContent .auth-btn-primary');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Registering...';
    }

    try {
        const result = await registerAffiliateAccount(session.profile?.id || session.user.id, formattedPhone);

        if (result.success) {
            alert('✅ Affiliate account created successfully! You can now start earning.');
            loadAffiliateDashboard();
        } else {
            alert('❌ ' + (result.error || 'Failed to register affiliate.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Something went wrong. Please try again.');
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔗 Register as Affiliate';
    }
}

function copyAffiliateLink() {
    const input = document.getElementById('affiliateDashboardLink');
    if (!input) return;
    input.select();
    document.execCommand('copy');
    showToast('✅ Referral link copied to clipboard!');
}

function shareAffiliateLink(platform) {
    const input = document.getElementById('affiliateDashboardLink');
    if (!input) return;
    const link = input.value;
    const text = '🧠 Take the USKAN Brain Test and earn KSh 20 per referral! Use my link:';

    let shareUrl = '';
    switch (platform) {
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + link)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
            break;
        default:
            return;
    }
    window.open(shareUrl, '_blank', 'width=600,height=500');
}

function openAffiliateDashboard() {
    const panel = document.getElementById('affiliateDashboardPanel');
    const overlay = document.getElementById('affiliateDashboardOverlay');
    if (panel) {
        panel.classList.add('open');
        overlay.classList.add('active');
        loadAffiliateDashboard();
    }
}

function closeAffiliateDashboard() {
    const panel = document.getElementById('affiliateDashboardPanel');
    const overlay = document.getElementById('affiliateDashboardOverlay');
    if (panel) {
        panel.classList.remove('open');
        overlay.classList.remove('active');
    }
}

// ============================================================
// TRACK PAGE VISITS (Safe version)
// ============================================================

async function trackPageVisit() {
    try {
        if (!supabase) {
            console.warn('⚠️ Supabase not available for tracking');
            return;
        }

        const page = window.location.pathname;
        let ip = '';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            ip = ipData.ip;
        } catch (e) {
            console.log('Could not get IP:', e);
        }

        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const referrer = document.referrer || '';

        await supabase
            .from('visits')
            .insert({
                page: page,
                ip: ip || null,
                user_id: user?.profile?.id || null,
                referrer: referrer,
                user_agent: navigator.userAgent
            });
    } catch (error) {
        console.error('Error tracking visit:', error);
    }
}

// ============================================================
// HANDLE LOGIN (Called from HTML button)
// ============================================================

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showAuthError('Please enter both email and password.');
        return;
    }

    const btn = document.querySelector('#loginForm .auth-btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ Logging in...';

    try {
        const result = await loginUser(email, password);
        
        if (result.success) {
            if (result.requiresVerification) {
                showAuthSuccess('✅ Please verify your email before logging in.');
                btn.disabled = false;
                btn.textContent = 'Login';
                return;
            }
            
            showAuthSuccess('✅ Login successful!');
            setTimeout(() => {
                closeAuthModal();
                updateAuthUI();
                restoreProgress();
                window.location.reload();
            }, 1000);
        } else {
            showAuthError('❌ ' + result.error);
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    } catch (error) {
        console.error('Login error:', error);
        showAuthError('❌ Something went wrong. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

// ============================================================
// HANDLE REGISTER (Called from HTML button)
// ============================================================

async function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!email || !username || !password) {
        showAuthError('Please fill in all fields.');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        return;
    }

    const btn = document.querySelector('#registerForm .auth-btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ Registering...';

    try {
        const { available } = await checkUsername(username);
        if (!available) {
            showAuthError('❌ Username is already taken. Please choose another.');
            btn.disabled = false;
            btn.textContent = 'Register';
            return;
        }

        const result = await registerUser(email, username, password);
        
        if (result.success) {
            document.getElementById('verificationEmail').textContent = email;
            document.getElementById('verificationMessage').style.display = 'block';
            document.getElementById('registerForm').style.display = 'none';
            localStorage.setItem('pendingVerificationEmail', email);
            btn.disabled = false;
            btn.textContent = 'Register';
            showAuthSuccess('✅ Registration successful! Check your email.');
        } else {
            showAuthError('❌ ' + result.error);
            btn.disabled = false;
            btn.textContent = 'Register';
        }
    } catch (error) {
        console.error('Register error:', error);
        showAuthError('❌ Something went wrong. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Register';
    }
}

// ============================================================
// HANDLE RESET PASSWORD (Called from HTML button)
// ============================================================

async function handleResetPassword() {
    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
        showAuthError('Please enter your email address.');
        return;
    }

    const btn = document.querySelector('#forgotPasswordForm .auth-btn-primary');
    btn.disabled = true;
    btn.textContent = '⏳ Sending...';

    try {
        const result = await resetPassword(email);
        
        if (result.success) {
            showAuthSuccess('✅ ' + result.message);
            setTimeout(() => {
                switchToLogin();
            }, 2000);
        } else {
            showAuthError('❌ ' + result.error);
        }
    } catch (error) {
        showAuthError('❌ Something went wrong. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
}

// ============================================================
// EXPOSE ALL FUNCTIONS GLOBALLY
// ============================================================

window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.closeAuthModal = closeAuthModal;
window.switchToLogin = switchToLogin;
window.switchToRegister = switchToRegister;
window.showForgotPassword = showForgotPassword;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleResetPassword = handleResetPassword;
window.handleLogout = handleLogout;
window.updateAuthUI = updateAuthUI;
window.checkSession = checkSession;
window.restoreProgress = restoreProgress;
window.showToast = showToast;
window.showAuthError = showAuthError;
window.showAuthSuccess = showAuthSuccess;
window.clearAuthErrors = clearAuthErrors;
window.openAffiliateDashboard = openAffiliateDashboard;
window.closeAffiliateDashboard = closeAffiliateDashboard;
window.loadAffiliateDashboard = loadAffiliateDashboard;
window.registerAffiliateFromDashboard = registerAffiliateFromDashboard;
window.copyAffiliateLink = copyAffiliateLink;
window.shareAffiliateLink = shareAffiliateLink;
window.getAffiliateData = getAffiliateData;
window.registerAffiliateAccount = registerAffiliateAccount;
window.generateReferralCode = generateReferralCode;
window.trackPageVisit = trackPageVisit;

console.log('✅ Auth.js loaded successfully!');
console.log('✅ All auth functions exposed globally');