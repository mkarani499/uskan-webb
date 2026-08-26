// ============================================================
// USKAN - Authentication System (Supabase Auth)
// ============================================================

// ============================================================
// SUPABASE CLIENT (Reuse existing or create new)
// ============================================================

// If supabase is already defined in script.js, use it
// Otherwise, create a new client
if (typeof supabase === 'undefined') {
    const supabaseUrl = SUPABASE_URL;
    const supabaseAnonKey = SUPABASE_ANON_KEY;
    var supabase = supabaseJs.createClient(supabaseUrl, supabaseAnonKey);
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

// Check if user is logged in
async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
            // User is logged in
            const user = session.user;
            console.log('✅ User logged in:', user.email);
            
            // Get user profile from users table
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
        // 1. Check if username is already taken
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();
        
        if (existingUser) {
            return { success: false, error: 'Username already taken. Please choose another.' };
        }
        
        // 2. Check if email is already taken
        const { data: existingEmail, error: emailError } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existingEmail) {
            return { success: false, error: 'Email already registered. Please login.' };
        }
        
        // 3. Register with Supabase Auth
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
        
        // 4. Create user profile in users table
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
                // Don't return error here, user is created in auth
            }
            
            // 5. Check if there's progress in localStorage
            const progress = localStorage.getItem('userProgress');
            if (progress) {
                console.log('📦 Progress found, will restore after verification');
                // Store email to restore progress after verification
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
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        // User is logged in
        const user = data.user;
        
        // Get profile from users table
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();
        
        // Check if email is verified
        if (!user.email_confirmed_at) {
            return { 
                success: true, 
                user: user,
                profile: profile,
                requiresVerification: true,
                message: 'Please verify your email before accessing affiliate features.'
            };
        }
        
        // Update email_verified in users table
        if (profile && !profile.email_verified) {
            await supabase
                .from('users')
                .update({ email_verified: true })
                .eq('auth_user_id', user.id);
        }
        
        // Check for pending progress
        const progress = localStorage.getItem('userProgress');
        if (progress) {
            console.log('📦 Restoring saved progress...');
            // Progress will be restored by the page
        }
        
        // ============================================================
        // CHECK FOR INTENDED ACTION
        // ============================================================
        const intendedAction = localStorage.getItem('intendedAction');
        if (intendedAction === 'affiliate') {
            localStorage.removeItem('intendedAction');
            // Restore progress and open affiliate dashboard
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
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear any stored user data
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
    // Check if there's pending progress
    const progress = localStorage.getItem('userProgress');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    
    if (progress && pendingEmail) {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Check if the logged-in user matches the pending email
            if (session.user.email === pendingEmail) {
                console.log('📦 Restoring progress for:', pendingEmail);
                // Progress will be restored by the page that saved it
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
        // No user found means available
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
    const userDisplay = document.getElementById('userDisplay');
    
    if (!authButtons) return;
    
    if (session.loggedIn) {
        // User is logged in
        const username = session.profile?.username || session.user?.email?.split('@')[0] || 'User';
        authButtons.innerHTML = `
            <div class="auth-user">
                <span class="username">👤 ${username}</span>
                <button onclick="handleLogout()" class="btn-logout">Logout</button>
            </div>
        `;
        authButtons.style.display = 'flex';
        
        // Store user info
        localStorage.setItem('user', JSON.stringify({
            id: session.user.id,
            email: session.user.email,
            username: username,
            profile: session.profile
        }));
        
        // Show affiliate button if available
        const affiliateBtn = document.getElementById('affiliateDashboardBtn');
        if (affiliateBtn) {
            affiliateBtn.style.display = 'flex';
        }
        
    } else {
        // User is not logged in
        authButtons.innerHTML = `
            <button onclick="openLoginModal()" class="btn-login">Login</button>
            <button onclick="openRegisterModal()" class="btn-register">Register</button>
        `;
        authButtons.style.display = 'flex';
        
        // Hide affiliate button
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
        // Reload the page to reset state
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
        // Get affiliate profile
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

        // Get referral stats
        const { data: referrals, error: referralsError } = await supabase
            .from('referrals')
            .select('*')
            .eq('affiliate_id', affiliate.id);

        if (referralsError) {
            console.error('Error fetching referrals:', referralsError);
        }

        const totalReferrals = referrals?.length || 0;
        const completedReferrals = referrals?.filter(r => r.payout_status === 'completed' || r.manually_paid).length || 0;
        const totalEarnings = referrals?.reduce((sum, r) => {
            if (r.payout_status === 'completed' || r.manually_paid) {
                return sum + (r.commission_amount || 0);
            }
            return sum;
        }, 0) || 0;

        const pendingEarnings = referrals?.reduce((sum, r) => {
            if (r.payout_status === 'pending' || r.payout_status === 'processing') {
                return sum + (r.commission_amount || 0);
            }
            return sum;
        }, 0) || 0;

        return {
            hasAffiliate: true,
            affiliate: affiliate,
            stats: {
                totalReferrals,
                completedReferrals,
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
        // Check if user already has an affiliate account
        const { data: existing, error: checkError } = await supabase
            .from('affiliates')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existing) {
            return { success: false, error: 'You already have an affiliate account.' };
        }

        // Generate unique referral code
        const referralCode = generateReferralCode();

        // Create affiliate account
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

    // Check if user is logged in
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

    // Get user data
    const user = session.user;
    const profile = session.profile;

    // Get affiliate data
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
        // User doesn't have an affiliate account yet
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

    // User has affiliate account - show dashboard
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

    // Get current user
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

// ============================================================
// EXPOSE NEW FUNCTIONS
// ============================================================

window.getAffiliateData = getAffiliateData;
window.registerAffiliateAccount = registerAffiliateAccount;
window.generateReferralCode = generateReferralCode;
window.loadAffiliateDashboard = loadAffiliateDashboard;
window.registerAffiliateFromDashboard = registerAffiliateFromDashboard;
window.copyAffiliateLink = copyAffiliateLink;
window.shareAffiliateLink = shareAffiliateLink;

console.log('✅ Affiliate functions loaded!');
console.log('✅ Auth.js loaded!');