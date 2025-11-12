import { getAccount, login, loginWithGoogle } from './appwriteService.js';

const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.getElementById('google-login-btn');
const authError = document.getElementById('auth-error');

/**
 * Displays an error message on the authentication screen.
 * @param {string} message The error message to display.
 */
function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
}

/**
 * Initializes all authentication-related event listeners.
 * @param {function} onLoginSuccess - A callback function to execute upon successful login.
 */
export function initializeAuth(onLoginSuccess) {

    /**
     * Handles the email/password login form submission.
     * @param {Event} e The form submission event.
     */
    async function handleLogin(e) {
        e.preventDefault();
        authError.classList.add('hidden');
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await login(email, password);
            if (onLoginSuccess) {
                onLoginSuccess();
            }
        } catch (error) {
            console.error('Login Failed:', error);
            showAuthError(`ההתחברות נכשלה: ${error.message}`);
        }
    }

    loginForm.addEventListener('submit', handleLogin);
    googleLoginBtn.addEventListener('click', loginWithGoogle);

    // The logic to auto-redirect logged-in users has been removed
    // to fulfill the requirement of always showing the start screen on page load.
    // The user must now click the "Start" button to proceed.
    // OAuth redirects will also land on the start screen, and the user can
    // click "Start" to enter the main application.
}
