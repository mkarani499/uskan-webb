// ============================================================
// USER PROGRESS RESTORATION
// ============================================================

async function restoreUserProgress() {
    try {
        // Check if user is logged in
        const session = await checkSession();
        if (!session.loggedIn) {
            console.log('🔓 User not logged in, skipping progress restore');
            return false;
        }
        
        // Check if there's pending progress
        const progress = localStorage.getItem('testProgress');
        const pendingEmail = localStorage.getItem('pendingVerificationEmail');
        
        if (!progress) {
            console.log('📦 No progress to restore');
            return false;
        }
        
        // Check if the logged-in user matches the pending email
        if (pendingEmail && session.user.email === pendingEmail) {
            console.log('📦 Restoring progress for:', pendingEmail);
            
            // Restore the progress
            const progressData = JSON.parse(progress);
            
            // Restore results
            if (progressData.results) {
                localStorage.setItem('testResults', JSON.stringify(progressData.results));
            }
            if (progressData.answers) {
                localStorage.setItem('testAnswers', JSON.stringify(progressData.answers));
            }
            if (progressData.time) {
                localStorage.setItem('testTime', JSON.stringify(progressData.time));
            }
            
            // Clear pending flag
            localStorage.removeItem('pendingVerificationEmail');
            
            console.log('✅ Progress restored successfully!');
            return true;
        }
        
        // If user is logged in but not the one who saved progress,
        // check if we should still restore (if they want to)
        if (!pendingEmail) {
            // No pending email, but there's progress - check if user wants to restore
            const shouldRestore = confirm('We found saved test progress. Would you like to continue where you left off?');
            if (shouldRestore) {
                const progressData = JSON.parse(progress);
                if (progressData.results) {
                    localStorage.setItem('testResults', JSON.stringify(progressData.results));
                }
                if (progressData.answers) {
                    localStorage.setItem('testAnswers', JSON.stringify(progressData.answers));
                }
                if (progressData.time) {
                    localStorage.setItem('testTime', JSON.stringify(progressData.time));
                }
                console.log('✅ Progress restored by user request');
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error restoring progress:', error);
        return false;
    }
}

// ============================================================
// SAVE USER PROGRESS (Called after test completion)
// ============================================================

async function saveUserProgress(results, answers, timeTaken) {
    try {
        const progressData = {
            results: results,
            answers: answers,
            time: timeTaken,
            timestamp: Date.now()
        };
        
        localStorage.setItem('testProgress', JSON.stringify(progressData));
        localStorage.setItem('testResults', JSON.stringify(results));
        localStorage.setItem('testAnswers', JSON.stringify(answers));
        localStorage.setItem('testTime', JSON.stringify(timeTaken));
        
        console.log('📦 Progress saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving progress:', error);
        return false;
    }
}

// ============================================================
// CHECK IF USER HAS PROGRESS
// ============================================================

function hasSavedProgress() {
    const progress = localStorage.getItem('testProgress');
    const results = localStorage.getItem('testResults');
    return !!(progress || results);
}

// ============================================================
// CLEAR USER PROGRESS
// ============================================================

function clearUserProgress() {
    localStorage.removeItem('testProgress');
    localStorage.removeItem('testResults');
    localStorage.removeItem('testAnswers');
    localStorage.removeItem('testTime');
    localStorage.removeItem('testSlug');
    console.log('🗑️ Progress cleared');
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================

window.restoreUserProgress = restoreUserProgress;
window.saveUserProgress = saveUserProgress;
window.hasSavedProgress = hasSavedProgress;
window.clearUserProgress = clearUserProgress;

console.log('✅ user-progress.js loaded');