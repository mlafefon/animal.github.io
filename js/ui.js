

let confirmModalResolve = null;

/**
 * Initializes the confirmation modal, attaching listeners to all possible buttons.
 */
export function initializeConfirmModal() {
    const overlay = document.getElementById('confirm-modal-overlay');
    const yesNoActions = document.getElementById('confirm-modal-yes-no-actions');
    const saveActions = document.getElementById('confirm-modal-save-actions');
    const confirmBtn = document.getElementById('confirm-modal-yes-btn');
    const cancelBtn = document.getElementById('confirm-modal-no-btn');
    const saveBtn = document.getElementById('confirm-modal-save-btn');
    const dontSaveBtn = document.getElementById('confirm-modal-dont-save-btn');
    const closeBtn = document.getElementById('close-confirm-modal-btn');
    
    if (!overlay || !confirmBtn || !cancelBtn || !saveBtn || !dontSaveBtn || !closeBtn) return;

    const hide = () => {
        overlay.classList.add('hidden');
        // Reset to default view for the next call
        yesNoActions.classList.remove('hidden');
        saveActions.classList.add('hidden');
    };
    
    const resolve = (value) => {
        hide();
        if (confirmModalResolve) {
            confirmModalResolve(value);
            confirmModalResolve = null;
        }
    };

    confirmBtn.addEventListener('click', () => resolve(true));
    cancelBtn.addEventListener('click', () => resolve(false));
    saveBtn.addEventListener('click', () => resolve('save'));
    dontSaveBtn.addEventListener('click', () => resolve('dont_save'));
    
    closeBtn.addEventListener('click', () => {
        if (saveActions && !saveActions.classList.contains('hidden')) {
            resolve('cancel');
        } else {
            resolve(false);
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (saveActions && !saveActions.classList.contains('hidden')) {
                resolve('cancel');
            } else {
                resolve(false);
            }
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
             if (saveActions && !saveActions.classList.contains('hidden')) {
                resolve('cancel');
            } else {
                resolve(false);
            }
        }
    });
}

/**
 * Shows a confirmation modal with different button configurations.
 * @param {string} message The message to display in the modal.
 * @param {'yes_no' | 'save_flow'} [type='yes_no'] The type of confirmation.
 * @returns {Promise<boolean | 'save' | 'dont_save' | 'cancel'>} A promise that resolves with the user's choice.
 */
export function showConfirmModal(message, type = 'yes_no') {
    return new Promise((resolve) => {
        confirmModalResolve = resolve;

        const overlay = document.getElementById('confirm-modal-overlay');
        const modalTitle = document.getElementById('confirm-modal-title');
        const modalText = document.getElementById('confirm-modal-text');
        const yesNoActions = document.getElementById('confirm-modal-yes-no-actions');
        const saveActions = document.getElementById('confirm-modal-save-actions');
        
        modalText.textContent = message;

        if (type === 'save_flow') {
            modalTitle.textContent = 'שינויים שלא נשמרו';
            yesNoActions.classList.add('hidden');
            saveActions.classList.remove('hidden');
            document.getElementById('confirm-modal-save-btn').focus();
        } else {
            modalTitle.textContent = 'אישור פעולה';
            saveActions.classList.add('hidden');
            yesNoActions.classList.remove('hidden');
            document.getElementById('confirm-modal-yes-btn').focus();
        }

        overlay.classList.remove('hidden');
    });
}


/**
 * --- Global Link Modal ---
 * Initializes a modal for displaying embedded web content via an iframe.
 */
let _showLinkModal;

export function initializeLinkModal() {
    const overlay = document.getElementById('link-modal-overlay');
    const iframe = document.getElementById('link-modal-iframe');
    const closeBtn = document.getElementById('close-link-modal-btn');
    const loader = document.getElementById('link-modal-loader');

    if (!overlay || !iframe || !closeBtn || !loader) return;

    const hide = () => {
        overlay.classList.add('hidden');
        iframe.src = 'about:blank'; // Clear content to stop videos/audio
    };

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hide();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            hide();
        }
    });

    iframe.addEventListener('load', () => {
        loader.style.display = 'none';
    });

    _showLinkModal = (url) => {
        if (!url) return;
        // Basic check to ensure it's a web URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.warn('Attempted to load invalid URL in modal:', url);
            return;
        }
        loader.style.display = 'block';
        iframe.src = url;
        overlay.classList.remove('hidden');
        closeBtn.focus();
    };
}

// Export a wrapper for the link modal show function
export const showLinkModal = (url) => {
    if (!_showLinkModal) {
        console.error("Link modal has not been initialized.");
        return;
    }
    _showLinkModal(url);
};

/**
 * --- Global Question Preview Modal ---
 */
let _showQuestionPreview;

export function initializeQuestionPreviewModal() {
    const overlay = document.getElementById('question-preview-modal-overlay');
    const closeBtn = document.getElementById('close-question-preview-modal-btn');
    const qText = document.getElementById('preview-question-text');
    const aText = document.getElementById('preview-answer-text');
    const aContainer = document.getElementById('preview-answer-container');
    const showAnswerBtn = document.getElementById('preview-show-answer-btn');

    if (!overlay || !closeBtn || !qText || !aText || !aContainer || !showAnswerBtn) return;

    const hide = () => {
        overlay.classList.add('hidden');
        // Reset state for next time
        aContainer.classList.add('hidden');
        showAnswerBtn.classList.remove('hidden');
    };

    closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hide();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            hide();
        }
    });

    showAnswerBtn.addEventListener('click', () => {
        aContainer.classList.remove('hidden');
        showAnswerBtn.classList.add('hidden');
    });

    _showQuestionPreview = (question, answer) => {
        qText.textContent = question || '(אין שאלה)';
        aText.textContent = answer || '(אין תשובה)';
        overlay.classList.remove('hidden');
        showAnswerBtn.focus();
    };
}

export const showQuestionPreview = (question, answer) => {
    if (!_showQuestionPreview) {
        console.error("Question preview modal has not been initialized.");
        return;
    }
    _showQuestionPreview(question, answer);
};


/**
 * --- Global Notification Toast System ---
 */
let _notificationContainer = null;

export function initializeNotification() {
    _notificationContainer = document.getElementById('notification-toast');
}

/**
 * Displays a non-blocking toast message at the top of the screen.
 * @param {string} message The message to display.
 * @param {'info' | 'success' | 'error'} [type='info'] The type of message, for styling.
 * @param {number} [duration=3000] The duration in milliseconds to show the message.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    if (!_notificationContainer) {
        // This can happen if the DOM isn't ready when a service tries to show an error.
        // Fallback to alert for critical notifications.
        if (type === 'error') {
            alert(`ERROR: ${message}`);
        }
        console.error("Notification container not found or initialized. Message:", message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');

    _notificationContainer.appendChild(toast);

    // Set timeout to start hiding the toast
    setTimeout(() => {
        toast.classList.add('hiding');
        // Wait for the fade-out animation to complete before removing
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, { once: true });
    }, duration);
}