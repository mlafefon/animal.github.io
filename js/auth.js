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
 * Initializes all authentication-related event listeners and checks for OAuth redirects.
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

    // After the page reloads from an OAuth provider (like Google), a session
    // will be available. We check for it here. If it exists, we trigger
    // the success callback to take the user directly into the app,
    // bypassing the start screen.
    getAccount().then(user => {
        if (user) {
            console.log('OAuth redirect session found for:', user.name);
            document.getElementById('start-screen').classList.add('hidden'); // Hide start screen if visible
            if (onLoginSuccess) {
                onLoginSuccess();
            }
        }
    }).catch(() => {
        // No session found from OAuth, normal flow continues.
    });
}
