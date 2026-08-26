// ============================================================
// USKAN - Test Engine (Standalone)
// ============================================================

// Category data
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
let sequenceTimer = null;
let isMemorySequence = false;

function startTest() {
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
    
    // Update progress
    const progress = ((currentQuestion) / questions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progress').textContent = currentQuestion + 1;
    document.getElementById('qNumber').textContent = `Q${currentQuestion + 1}`;
    
    // Show category
    const categoryName = categoryNames[q.category] || q.category;
    const categoryEmoji = categoryEmojis[q.category] || '🧠';
    document.getElementById('categoryDisplay').textContent = `${categoryEmoji} ${categoryName}`;
    
    // Show question
    document.getElementById('questionText').textContent = q.question;
    
    // Reset feedback
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.style.display = 'none';
    feedbackEl.className = 'feedback';
    
    // Get elements
    const imageEl = document.getElementById('questionImage');
    const optionsContainer = document.getElementById('options');
    
    // Clear any existing timers
    clearInterval(timerInterval);
    clearTimeout(sequenceTimer);
    
    // ===== MEMORY QUESTION: Show sequence, then hide, then show options =====
    if (q.category === 'memory' && q.image && q.image.length > 0) {
        isMemorySequence = true;
        optionsContainer.style.display = 'none';
        
        // Show the sequence
        imageEl.textContent = q.image;
        imageEl.style.display = 'flex';
        imageEl.className = 'question-image';
        imageEl.style.opacity = '1';
        imageEl.style.transform = 'scale(1)';
        
        // Hide timer
        document.getElementById('questionTimer').textContent = '⏳';
        
        // After 5.6 seconds, hide the sequence and show options
        sequenceTimer = setTimeout(() => {
            imageEl.className = 'question-image fade-out';
            
            setTimeout(() => {
                imageEl.style.display = 'none';
                optionsContainer.style.display = 'grid';
                isMemorySequence = false;
                showOptions(q, questions);
                timeLeft = q.timer || 15;
                startTimer(q, questions);
            }, 500);
        }, 5600);
        
        optionsContainer.innerHTML = '';
        optionsContainer.style.display = 'none';
        return;
    }
    
    // ===== NORMAL QUESTION =====
    isMemorySequence = false;
    
    if (q.image && q.image.length > 0 && q.image !== 'cube-1' && q.image !== 'cube-3d') {
        imageEl.textContent = q.image;
        imageEl.style.display = 'flex';
        imageEl.className = 'question-image';
    } else {
        imageEl.style.display = 'none';
    }
    
    // Show options
    optionsContainer.style.display = 'grid';
    showOptions(q, questions);
    timeLeft = q.timer || 15;
    startTimer(q, questions);
}

function showOptions(q, questions) {
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
    optionsContainer.style.display = 'grid';
    
    const letters = ['A', 'B', 'C', 'D'];
    
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.className = 'option-btn';
        btn.setAttribute('data-index', index);
        btn.innerHTML = `${opt} <span class="letter">${letters[index]}</span>`;
        btn.onclick = () => selectAnswer(index, questions);
        optionsContainer.appendChild(btn);
    });
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
    clearTimeout(sequenceTimer);
    
    const q = questions[currentQuestion];
    const timeTaken = (q.timer || 15) - timeLeft;
    timePerQuestion.push(timeTaken);
    totalTime += timeTaken;
    
    const isCorrect = index === q.correct;
    
    userAnswers.push({
        questionId: q.id,
        category: q.category,
        selected: index,
        correct: q.correct,
        isCorrect: isCorrect,
        timeTaken: timeTaken
    });
    
    if (isCorrect) {
        score[q.category] = (score[q.category] || 0) + 1;
    }
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
    
    // Show feedback
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback ' + (isCorrect ? 'correct' : 'incorrect');
    feedback.innerHTML = `
        <strong>${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</strong>
        <p>${isCorrect ? 'Great job!' : 'The correct answer was: ' + q.options[q.correct]}</p>
        ${q.explanation ? `<p style="margin-top: 4px; font-size: 13px; color: var(--medium-grey);">💡 ${q.explanation}</p>` : ''}
    `;
    
    // Disable all options
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.className = 'option-btn disabled';
        const btnIndex = parseInt(btn.getAttribute('data-index'));
        if (btnIndex === q.correct) {
            btn.className = 'option-btn correct';
        } else if (btnIndex === index && !isCorrect) {
            btn.className = 'option-btn incorrect';
        }
    });
    
    setTimeout(() => {
        currentQuestion++;
        showQuestion(questions);
    }, 1500);
}

function finishTest(questions) {
    clearInterval(timerInterval);
    clearTimeout(sequenceTimer);
    
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
    
    // ===== SAVE PROGRESS =====
    // Save to localStorage for progress restoration
    const progressData = {
        results: result,
        answers: userAnswers,
        time: totalTime,
        timestamp: Date.now()
    };
    localStorage.setItem('testProgress', JSON.stringify(progressData));
    
    // Also save individual items for immediate use
    localStorage.setItem('testResults', JSON.stringify(result));
    localStorage.setItem('testAnswers', JSON.stringify(userAnswers));
    localStorage.setItem('testTime', JSON.stringify(totalTime));
    localStorage.setItem('testSlug', 'brain');
    
    console.log('📦 Progress saved:', progressData);
    
    window.location.href = 'results-preview.html';
}

function determineBrainType(results) {
    const categories = [
        { key: 'abstract', name: 'Logic Master' },
        { key: 'memory', name: 'Memory Pro' },
        { key: 'spatial', name: 'Visual Thinker' },
        { key: 'verbal', name: 'Word Wizard' },
        { key: 'speed', name: 'Speed Demon' }
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
// INITIALIZE
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Only run test engine if we're on the test page
    if (document.getElementById('questionText')) {
        // Check if brainQuestions is defined
        if (typeof brainQuestions !== 'undefined' && brainQuestions.length > 0) {
            console.log('📊 Test page loaded, questions:', brainQuestions.length);
            startTest();
        } else {
            console.error('❌ brainQuestions not loaded! Check that questions.js is included.');
            document.getElementById('questionText').textContent = '⚠️ Error loading questions. Please refresh.';
        }
    }
});

console.log('✅ Test engine loaded!');