import { getAccount, login, loginWithGoogle, logout } from './appwriteService.js';
import { initializeApp } from '../index.js';

const authScreen = document.getElementById('auth-screen');
const startScreen = document.getElementById('start-screen');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const editScreenLogoutBtn = document.getElementById('edit-screen-logout-btn');
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
 * Handles the logout process.
 */
async function handleLogout() {
    // Check for unsaved changes in the editor before logging out
    const saveBtn = document.getElementById('toolbar-save-btn');
    if (saveBtn && saveBtn.classList.contains('unsaved')) {
        const userConfirmed = await window.showConfirmModal('יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך להתנתק? השינויים יאבדו.');
         if (!userConfirmed) {
            return; // User cancelled the action
        }
    }

    try {
        await logout();
        window.location.reload(); // Easiest way to reset all state
    } catch (error) {
        console.error('Logout Failed:', error);
        alert('ההתנתקות נכשלה.');
    }
}

/**
 * Initializes all authentication-related event listeners and checks for an existing session.
 */
export async function initializeAuth() {
    loginForm.addEventListener('submit', handleLogin);
    googleLoginBtn.addEventListener('click', loginWithGoogle);
    logoutBtn.addEventListener('click', handleLogout);
    if (editScreenLogoutBtn) {
        editScreenLogoutBtn.addEventListener('click', handleLogout);
    }

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