import { getAccount, login, loginWithGoogle, logout } from './appwriteService.js';
import { initializeApp } from '../index.js';
import { showNotification } from './ui.js';

const authScreen = document.getElementById('auth-screen');
const startScreen = document.getElementById('start-screen');
const globalHeader = document.getElementById('global-header');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.getElementById('google-login-btn');
const authError = document.getElementById('auth-error');
const userGreeting = document.getElementById('user-greeting');

let isAppInitialized = false;

/**
 * Hides the authentication screen, shows the main app, and updates the user greeting.
 * It also initializes the main application logic if it hasn't been already.
 */
async function showApp() {
    authScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    globalHeader.classList.remove('hidden');

    // Fetch user and update greeting
    try {
        const user = await getAccount();
        if (user && userGreeting) {
            const displayName = user.name || user.email;
            userGreeting.textContent = `${displayName}`;
        }
    } catch (error) {
        console.warn("Could not fetch user account to display name.", error);
        if (userGreeting) userGreeting.textContent = '';
    }

    if (!isAppInitialized) {
        initializeApp();
        isAppInitialized = true;
    }
}

/**
 * Shows the login screen and ensures the main app is hidden.
 */
function showLogin() {
    startScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    globalHeader.classList.add('hidden');
    // Also hide any other potential screens
    document.getElementById('main-game-footer').classList.remove('visible');
    document.body.classList.remove('game-active');
}

/**
 * Displays an error message on the authentication screen.
 * @param {string} message The error message to display.
 */
function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
}

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
        await showApp();
    } catch (error) {
        console.error('Login Failed:', error);
        // Display the specific error message from Appwrite for better debugging.
        showAuthError(`ההתחברות נכשלה: ${error.message}`);
    }
}

/**
 * Initializes all authentication-related event listeners and checks for an existing session.
 */
export async function initializeAuth() {
    loginForm.addEventListener('submit', handleLogin);
    googleLoginBtn.addEventListener('click', loginWithGoogle);
    // The logout button listener is now initialized in index.js

    try {
        const user = await getAccount();
        if (user) {
            console.log('User already logged in:', user.name);
            await showApp();
        } else {
            showLogin();
        }
    } catch (error) {
        console.log('No active session found.');
        showLogin();
    }
}