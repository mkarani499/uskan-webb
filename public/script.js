// ============================================================
// USKAN - Main JavaScript File
// ============================================================

// ============================================================
// EMERGENCY FIX: Supabase fallback
// ============================================================

// If supabaseJs is not defined, try to get it from window
if (typeof supabaseJs === 'undefined') {
    console.warn('⚠️ supabaseJs not found, checking window...');
    // Try to get it from the global scope
    window.supabaseJs = window.supabase || window._supabase || {};
    console.log('🔍 supabaseJs fallback:', typeof window.supabaseJs);
}

// Create supabase client
const supabase = (typeof supabaseJs !== 'undefined' && supabaseJs.createClient) 
    ? supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (!supabase) {
    console.error('❌ Supabase failed to initialize!');
    // Create a dummy supabase for testing
    const dummySupabase = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: async () => ({ data: null, error: null }),
                    order: () => ({
                        limit: async () => ({ data: [], error: null })
                    })
                })
            }),
            insert: async () => ({ data: null, error: null }),
            update: async () => ({ data: null, error: null })
        }),
        raw: () => ({})
    };
    window.supabase = dummySupabase;
    console.log('⚠️ Using dummy Supabase for testing');
} else {
    window.supabase = supabase;
    console.log('✅ Supabase connected!');
}

// ============================================================
// USER FUNCTIONS
// ============================================================

async function getOrCreateUser(phoneNumber, email = null) {
    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();
    
    if (error && error.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                phone_number: phoneNumber,
                email: email
            })
            .select()
            .single();
        
        if (createError) throw createError;
        return newUser;
    }
    
    if (error) throw error;
    return user;
}

async function savePayment(userId, testId, phoneNumber, checkoutRequestId, merchantRequestId, referredBy = null) {
    const { data, error } = await supabase
        .from('payments')
        .insert({
            user_id: userId,
            test_id: testId,
            phone_number: phoneNumber,
            amount: 50,
            checkout_request_id: checkoutRequestId,
            merchant_request_id: merchantRequestId,
            status: 'pending',
            referred_by: referredBy
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function saveTestResults(userId, testId, results, answers, timeTaken) {
    const { data, error } = await supabase
        .from('test_results')
        .insert({
            user_id: userId,
            test_id: testId,
            overall_score: results.overallCorrect || 0,
            overall_percentage: results.overall || 0,
            abstract_score: results.abstract || 0,
            memory_score: results.memory || 0,
            spatial_score: results.spatial || 0,
            verbal_score: results.verbal || 0,
            speed_score: results.speed || 0,
            brain_type: results.brainType || 'Balanced Thinker',
            time_taken: Math.floor(timeTaken / 1000) || 0,
            answers: answers || []
        });
    
    if (error) throw error;
    return data;
}

// ============================================================
// TEST ENGINE
// ============================================================

let currentQuestion = 0;
let score = { abstract: 0, memory: 0, spatial: 0, verbal: 0, speed: 0 };
let categoryCounts = { abstract: 0, memory: 0, spatial: 0, verbal: 0, speed: 0 };
let userAnswers = [];
let timePerQuestion = [];
let timerInterval;
let timeLeft = 0;
let totalTime = 0;
let testData = null;

const categoryNames = {
    abstract: 'Abstract Reasoning',
    memory: 'Memory & Recall',
    spatial: 'Spatial Awareness',
    verbal: 'Verbal Reasoning',
    speed: 'Processing Speed'
};

const categoryEmojis = {
    abstract: '🧩',
    memory: '🧠',
    spatial: '🌀',
    verbal: '📝',
    speed: '⚡'
};

const categoryColors = {
    abstract: 'logic',
    memory: 'memory',
    spatial: 'spatial',
    verbal: 'verbal',
    speed: 'speed'
};

function startTest() {
    // Debug: Check if brainQuestions is available
    console.log('🧪 brainQuestions:', typeof brainQuestions);
    console.log('🧪 brainQuestions length:', brainQuestions?.length);
    
    const questions = brainQuestions || [];
    
    if (!questions || questions.length === 0) {
        document.getElementById('questionText').textContent = '⚠️ No questions found.';
        return;
    }
    
    currentQuestion = 0;
    score = { abstract: 0, memory: 0, spatial: 0, verbal: 0, speed: 0 };
    categoryCounts = { abstract: 0, memory: 0, spatial: 0, verbal: 0, speed: 0 };
    userAnswers = [];
    timePerQuestion = [];
    totalTime = 0;
    
    document.getElementById('totalQuestions').textContent = questions.length;
    showQuestion(questions);
}

function showQuestion(questions) {
    const q = questions[currentQuestion];
    if (!q) {
        finishTest(questions);
        return;
    }
    
    const progress = ((currentQuestion) / questions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progress').textContent = currentQuestion + 1;
    
    const categoryName = categoryNames[q.category] || q.category;
    const categoryEmoji = categoryEmojis[q.category] || '🧠';
    document.getElementById('categoryDisplay').textContent = `${categoryEmoji} ${categoryName}`;
    
    document.getElementById('questionText').textContent = q.question;
    
    const imageEl = document.getElementById('questionImage');
    if (q.image && q.image.length > 0) {
        imageEl.textContent = q.image;
        imageEl.style.display = 'flex';
    } else {
        imageEl.style.display = 'none';
    }
    
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.className = 'option-btn';
        btn.setAttribute('data-index', index);
        btn.onclick = () => selectAnswer(index, questions);
        optionsContainer.appendChild(btn);
    });
    
    timeLeft = q.timer || 15;
    startTimer(q, questions);
    
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'none';
    feedback.className = 'feedback';
}

function startTimer(q, questions) {
    const timerDisplay = document.getElementById('questionTimer');
    timerDisplay.textContent = timeLeft;
    timerDisplay.className = '';
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        if (timeLeft <= 5) {
            timerDisplay.className = 'timer-warning';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            selectAnswer(-1, questions);
        }
    }, 1000);
}

function selectAnswer(index, questions) {
    clearInterval(timerInterval);
    
    const q = questions[currentQuestion];
    const timeTaken = (q.timer || 15) - timeLeft;
    timePerQuestion.push(timeTaken);
    totalTime += timeTaken;
    
    const isCorrect = index === q.correct;
    const selectedIndex = index;
    
    userAnswers.push({
        questionId: q.id,
        category: q.category,
        selected: selectedIndex,
        correct: q.correct,
        isCorrect: isCorrect,
        timeTaken: timeTaken
    });
    
    if (isCorrect) {
        score[q.category] = (score[q.category] || 0) + 1;
    }
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
    
    showFeedback(isCorrect, q.explanation, q.correct, q.options);
    
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.className = 'option-btn disabled';
        const btnIndex = parseInt(btn.getAttribute('data-index'));
        if (btnIndex === q.correct) {
            btn.className = 'option-btn correct';
        } else if (btnIndex === selectedIndex && !isCorrect) {
            btn.className = 'option-btn incorrect';
        }
    });
    
    setTimeout(() => {
        currentQuestion++;
        showQuestion(questions);
    }, 2000);
}

function showFeedback(isCorrect, explanation, correctIndex, options) {
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback ' + (isCorrect ? 'correct' : 'incorrect');
    
    const correctAnswer = options[correctIndex] || 'Unknown';
    feedback.innerHTML = `
        <strong>${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</strong>
        <p>${isCorrect ? 'Great job!' : 'The correct answer was: ' + correctAnswer}</p>
        ${explanation ? `<p style="margin-top: 4px; font-size: 13px; color: var(--medium-grey);">💡 ${explanation}</p>` : ''}
    `;
}

function finishTest(questions) {
    clearInterval(timerInterval);
    
    const finalScore = calculateScores(questions);
    
    localStorage.setItem('testResults', JSON.stringify(finalScore));
    localStorage.setItem('testAnswers', JSON.stringify(userAnswers));
    localStorage.setItem('testTime', JSON.stringify(totalTime));
    localStorage.setItem('testSlug', 'brain');
    
    window.location.href = 'results-preview.html';
}

function calculateScores(questions) {
    const totalQuestions = questions.length;
    const totalCorrect = Object.values(score).reduce((a, b) => a + b, 0);
    
    const result = {};
    for (let cat in categoryCounts) {
        const total = categoryCounts[cat] || 1;
        const correct = score[cat] || 0;
        result[cat] = Math.round((correct / total) * 100);
    }
    
    result.overall = Math.round((totalCorrect / totalQuestions) * 100);
    result.overallCorrect = totalCorrect;
    result.overallTotal = totalQuestions;
    result.brainType = determineBrainType(result);
    
    return result;
}

function determineBrainType(results) {
    const categories = [
        { key: 'abstract', name: 'Logic Master', emoji: '🧩' },
        { key: 'memory', name: 'Memory Pro', emoji: '🧠' },
        { key: 'spatial', name: 'Visual Thinker', emoji: '🌀' },
        { key: 'verbal', name: 'Word Wizard', emoji: '📝' },
        { key: 'speed', name: 'Speed Demon', emoji: '⚡' }
    ];
    
    let highest = { key: 'abstract', score: 0 };
    categories.forEach(cat => {
        const score = results[cat.key] || 0;
        if (score > highest.score) {
            highest = { key: cat.key, score: score };
        }
    });
    
    if (highest.score < 50) return 'Balanced Thinker';
    const found = categories.find(c => c.key === highest.key);
    return found ? found.name : 'Balanced Thinker';
}

// ============================================================
// RESULTS DISPLAY
// ============================================================

function displayFullResults() {
    const results = JSON.parse(localStorage.getItem('testResults') || '{}');
    
    document.getElementById('overallScore').textContent = (results.overall || 0) + '%';
    const comparison = Math.floor(Math.random() * 30 + 60);
    document.getElementById('scoreComparison').textContent = `Higher than ${comparison}% of test-takers`;
    
    const barsContainer = document.getElementById('scoreBars');
    barsContainer.innerHTML = '';
    
    const categories = ['abstract', 'memory', 'spatial', 'verbal', 'speed'];
    categories.forEach(cat => {
        const score = results[cat] || 0;
        const rating = getRating(score);
        
        const row = document.createElement('div');
        row.className = 'score-bar';
        row.innerHTML = `
            <span class="score-bar-label">${categoryEmojis[cat]} ${categoryNames[cat]}</span>
            <div class="score-bar-track">
                <div class="score-bar-fill ${categoryColors[cat]}" style="width: ${score}%"></div>
            </div>
            <span class="score-bar-percent">${score}% ${rating}</span>
        `;
        barsContainer.appendChild(row);
    });
    
    const brainType = results.brainType || 'Balanced Thinker';
    document.getElementById('brainType').textContent = brainType;
    document.getElementById('brainTypeTagline').textContent = getBrainTypeTagline(brainType);
    
    document.getElementById('superpowerText').textContent = getSuperpower(results);
    document.getElementById('blindspotText').textContent = getBlindspot(results);
    
    displayActionPlan(results);
    displayComparison(results);
}

function getRating(score) {
    if (score >= 90) return '⭐ Genius';
    if (score >= 75) return '✅ Strong';
    if (score >= 60) return '✅ Solid';
    if (score >= 40) return '⚠️ Average';
    return '⚠️ Needs Work';
}

function getBrainTypeTagline(type) {
    const taglines = {
        'Logic Master': '"You see patterns others miss."',
        'Memory Pro': '"You remember what others forget."',
        'Visual Thinker': '"You think in pictures and spaces."',
        'Word Wizard': '"You have a way with words."',
        'Speed Demon': '"You think faster than most."',
        'Balanced Thinker': '"You\'re a well-rounded thinker."'
    };
    return taglines[type] || '"You\'re a unique thinker."';
}

function getSuperpower(results) {
    const categories = [
        { key: 'abstract', text: 'You excel at solving complex puzzles and spotting patterns.' },
        { key: 'memory', text: 'You have an exceptional ability to remember details and sequences.' },
        { key: 'spatial', text: 'You can visualize objects in 3D and navigate spaces effortlessly.' },
        { key: 'verbal', text: 'You have a natural gift for language and communication.' },
        { key: 'speed', text: 'You process information and make decisions faster than most.' }
    ];
    
    let highest = { key: 'abstract', score: 0 };
    categories.forEach(cat => {
        const score = results[cat.key] || 0;
        if (score > highest.score) {
            highest = { key: cat.key, score: score };
        }
    });
    const found = categories.find(c => c.key === highest.key);
    return found ? found.text : 'You have a unique combination of strengths.';
}

function getBlindspot(results) {
    const categories = [
        { key: 'abstract', text: 'Complex patterns and abstract logic can sometimes feel overwhelming.' },
        { key: 'memory', text: 'Remembering details, names, or step-by-step instructions might be challenging.' },
        { key: 'spatial', text: 'Visualizing objects in 3D or navigating new spaces could use improvement.' },
        { key: 'verbal', text: 'Finding the right words or expressing complex ideas might take extra effort.' },
        { key: 'speed', text: 'Making quick decisions under pressure might be an area for growth.' }
    ];
    
    let lowest = { key: 'abstract', score: 100 };
    categories.forEach(cat => {
        const score = results[cat.key] || 0;
        if (score < lowest.score) {
            lowest = { key: cat.key, score: score };
        }
    });
    const found = categories.find(c => c.key === lowest.key);
    return found ? found.text : 'Every brain has room for growth—keep challenging yourself!';
}

function displayActionPlan(results) {
    const table = document.getElementById('actionTable');
    if (!table) return;
    
    const categories = [
        { key: 'abstract', name: 'Logic & Reasoning', exercise: 'Sudoku or Logic Puzzles', why: 'Trains pattern recognition and deductive reasoning' },
        { key: 'memory', name: 'Memory & Recall', exercise: 'Dual N-Back Training', why: 'Trains working memory and focus simultaneously' },
        { key: 'spatial', name: 'Spatial Awareness', exercise: 'Mental Rotation Exercises', why: 'Improves visualization and spatial thinking' },
        { key: 'verbal', name: 'Verbal Processing', exercise: 'Word Association Games', why: 'Builds vocabulary and verbal fluency' },
        { key: 'speed', name: 'Processing Speed', exercise: 'Quick Math Drills', why: 'Trains rapid decision-making' }
    ];
    
    let lowest = { key: 'abstract', score: 100 };
    categories.forEach(cat => {
        const score = results[cat.key] || 0;
        if (score < lowest.score) {
            lowest = { key: cat.key, score: score };
        }
    });
    const target = categories.find(c => c.key === lowest.key) || categories[0];
    
    table.innerHTML = `
        <div class="action-row">
            <span class="action-step">1</span>
            <span class="action-exercise">${target.exercise}</span>
            <span class="action-time">5 min/day</span>
            <span class="action-why">${target.why}</span>
        </div>
        <div class="action-row">
            <span class="action-step">2</span>
            <span class="action-exercise">Visual Association Method</span>
            <span class="action-time">3 min/day</span>
            <span class="action-why">Connects new information to images you already know</span>
        </div>
        <div class="action-row">
            <span class="action-step">3</span>
            <span class="action-exercise">Spaced Repetition Flashcards</span>
            <span class="action-time">5 min/day</span>
            <span class="action-why">Forces your brain to recall information just before it forgets</span>
        </div>
    `;
}

function displayComparison(results) {
    const container = document.getElementById('comparisonBars');
    if (!container) return;
    
    const comparisons = [
        { label: 'General Population', diff: '+8%' },
        { label: 'People Your Age', diff: '+12%' },
        { label: 'College Graduates', diff: '+3%' },
        { label: 'Engineers/Analysts', diff: '-5%' }
    ];
    
    container.innerHTML = '';
    
    comparisons.forEach(comp => {
        const isPositive = comp.diff.startsWith('+');
        const value = parseInt(comp.diff);
        const width = 50 + value * 2;
        
        const row = document.createElement('div');
        row.className = 'comparison-row';
        row.innerHTML = `
            <span class="comparison-label">${comp.label}</span>
            <div class="comparison-track">
                <div class="comparison-fill ${isPositive ? 'self' : 'comparison'}" style="width: ${Math.min(Math.max(width, 10), 95)}%"></div>
            </div>
            <span class="comparison-value ${isPositive ? 'positive' : 'negative'}">${comp.diff}</span>
        `;
        container.appendChild(row);
    });
}

// ============================================================
// MPESA PAYMENT
// ============================================================

let checkoutRequestID = null;
let userId = null;
let paymentId = null;

window.handlePayment = async function(e) {
    e.preventDefault();
    
    console.log('📥 Payment form submitted');
    
    const phoneInput = document.getElementById('phoneNumber');
    const emailInput = document.getElementById('email');
    const payBtn = document.getElementById('payBtn');
    
    const phoneNumber = phoneInput.value.replace(/\D/g, '');
    
    if (phoneNumber.length !== 9) {
        showToast('❌ Please enter a valid 9-digit phone number');
        return;
    }
    
    const formattedPhone = `254${phoneNumber}`;
    const email = emailInput?.value || null;
    
    payBtn.disabled = true;
    payBtn.textContent = '⏳ Processing...';
    
    try {
        const user = await getOrCreateUser(formattedPhone, email);
        userId = user.id;
        localStorage.setItem('userId', userId);
        
        const testSlug = localStorage.getItem('testSlug') || 'brain';
        const { data: testData } = await supabase
            .from('tests')
            .select('*')
            .eq('slug', testSlug)
            .single();
        
        const response = await fetch('/api/mpesa-stk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: formattedPhone,
                amount: 50,
                accountReference: `USKAN-${Date.now()}`,
                transactionDesc: 'USKAN Brain Test'
            })
        });
        
        const data = await response.json();
        console.log('📤 Response:', data);
        
        if (data.success) {
            checkoutRequestID = data.checkoutRequestID;
            
            await savePayment(
                userId,
                testData.id,
                formattedPhone,
                checkoutRequestID,
                data.merchantRequestID
            );
            
            localStorage.setItem('checkoutRequestID', checkoutRequestID);
            
            document.getElementById('paymentStatus').style.display = 'block';
            document.getElementById('mpesaForm').style.display = 'none';
            
            startPolling(checkoutRequestID);
        } else {
            showToast('❌ Payment failed: ' + (data.error || 'Unknown error'));
            payBtn.disabled = false;
            payBtn.textContent = '📲 Pay KSh 50 via M-Pesa';
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('❌ Something went wrong. Please try again.');
        payBtn.disabled = false;
        payBtn.textContent = '📲 Pay KSh 50 via M-Pesa';
    }
};

function startPolling(checkoutID) {
    let attempts = 0;
    const maxAttempts = 30;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkoutRequestID: checkoutID })
            });
            
            const data = await response.json();
            
            if (data.status === 'completed') {
                clearInterval(pollInterval);
                document.getElementById('paymentStatus').style.display = 'none';
                document.getElementById('paymentSuccess').style.display = 'block';
                
                const results = JSON.parse(localStorage.getItem('testResults') || '{}');
                const answers = JSON.parse(localStorage.getItem('testAnswers') || '[]');
                const timeTaken = parseInt(localStorage.getItem('testTime') || '0');
                
                const { data: testData } = await supabase
                    .from('tests')
                    .select('*')
                    .eq('slug', 'brain')
                    .single();
                
                await saveTestResults(userId, testData.id, results, answers, timeTaken);
                
                setTimeout(() => {
                    window.location.href = 'results-full.html';
                }, 3000);
            } else if (data.status === 'failed' || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                showToast('⏳ Payment still processing. You can check status manually.');
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 5000);
}

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
// AFFILIATE SYSTEM
// ============================================================

async function registerAffiliate(userId, mpesaPhone) {
    const referralCode = generateReferralCode();
    
    const { data, error } = await supabase
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
    return data;
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function getAffiliateByUserId(userId) {
    const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function getAffiliateStats(affiliateId) {
    const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('affiliate_id', affiliateId);
    
    if (error) throw error;
    
    const total = data.length;
    const earnings = data
        .filter(r => r.payout_status === 'completed' || r.manually_paid)
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
    const pendingEarnings = data
        .filter(r => r.payout_status === 'pending' || r.payout_status === 'processing')
        .reduce((sum, r) => sum + (r.commission_amount || 0), 0);
    
    return { total, earnings, pendingEarnings };
}

// ============================================================
// ADMIN FUNCTIONS
// ============================================================

async function loadAdminData() {
    try {
        const { count: usersCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        const { count: paymentsCount } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');
        
        const { count: affiliatesCount } = await supabase
            .from('affiliates')
            .select('*', { count: 'exact', head: true });
        
        const { data: referrals } = await supabase
            .from('referrals')
            .select('commission_amount, payout_status')
            .in('payout_status', ['completed', 'manual_paid']);
        
        const totalCommissions = referrals?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
        
        const { data: pendingReferrals } = await supabase
            .from('referrals')
            .select('commission_amount')
            .in('payout_status', ['pending', 'processing']);
        
        const pendingCommissions = pendingReferrals?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
        
        document.getElementById('statUsers').textContent = usersCount || 0;
        document.getElementById('statPayments').textContent = paymentsCount || 0;
        document.getElementById('statAffiliates').textContent = affiliatesCount || 0;
        document.getElementById('statCommissions').textContent = `KSh ${totalCommissions}`;
        document.getElementById('statPendingCommission').textContent = `Pending: KSh ${pendingCommissions}`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================================
// SHARE RESULTS
// ============================================================

function shareResults(platform) {
    const results = JSON.parse(localStorage.getItem('testResults') || '{}');
    const score = results.overall || 72;
    const brainType = results.brainType || 'Balanced Thinker';
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/?ref=${platform}&score=${score}&type=${encodeURIComponent(brainType)}`;
    
    const shareText = `🧠 I scored ${score}% on the USKAN Brain Test! My brain type is "${brainType}". Can you beat my score? Take the test here:`;
    
    let shareLink = '';
    switch(platform) {
        case 'facebook':
            shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
            break;
        case 'twitter':
            shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            break;
        case 'whatsapp':
            shareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            break;
        case 'copy':
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
                showToast('✅ Link copied to clipboard!');
            });
            return;
        default:
            return;
    }
    
    if (shareLink) {
        window.open(shareLink, '_blank', 'width=600,height=500');
    }
}

// ============================================================
// ADMIN LOGIN
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Admin login form
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('adminPassword').value;
            const errorDiv = document.getElementById('loginError');
            
            errorDiv.classList.remove('show');
            
            try {
                const response = await fetch('/api/admin-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('adminSession', 'true');
                    window.location.href = 'admin-dashboard.html';
                } else {
                    errorDiv.textContent = '❌ Incorrect password';
                    errorDiv.classList.add('show');
                }
            } catch (error) {
                errorDiv.textContent = '❌ Network error';
                errorDiv.classList.add('show');
            }
        });
    }
    
    // Admin dashboard
    if (document.getElementById('statsGrid')) {
        const session = localStorage.getItem('adminSession');
        if (!session) {
            window.location.href = 'admin.html';
            return;
        }
        loadAdminData();
    }
    
    // Test engine
    if (document.getElementById('questionText')) {
        startTest();
    }
    
    // Full results
    if (document.getElementById('scoreBars')) {
        displayFullResults();
    }
});

window.shareResults = shareResults;
window.copyReferralLink = function() {
    const link = document.getElementById('referralLink');
    if (link) {
        navigator.clipboard.writeText(link.value).then(() => {
            showToast('✅ Link copied to clipboard!');
        });
    }
};

window.shareReferral = function(platform) {
    const link = document.getElementById('referralLink');
    if (!link) return;
    
    const text = '🧠 Take the USKAN Brain Test and earn KSh 20 per referral! Use my link:';
    const shareUrl = link.value;
    
    let shareLink = '';
    switch(platform) {
        case 'facebook':
            shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
            break;
        case 'whatsapp':
            shareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
            break;
        case 'twitter':
            shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
            break;
        default:
            return;
    }
    window.open(shareLink, '_blank', 'width=600,height=500');
};

window.logout = function() {
    localStorage.removeItem('adminSession');
    window.location.href = 'admin.html';
};

console.log('✅ USKAN script loaded!');