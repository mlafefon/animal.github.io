
/**
 * --- Global Confirmation Modal ---
 * A promise-based confirmation modal to replace the native `confirm()`.
 */
let confirmModalResolve = null;
let _showConfirmModal;

export function initializeConfirmModal() {
    const overlay = document.getElementById('confirm-modal-overlay');
    const modalText = document.getElementById('confirm-modal-text');
    const confirmBtn = document.getElementById('confirm-modal-yes-btn');
    const cancelBtn = document.getElementById('confirm-modal-no-btn');
    
    if (!overlay || !modalText || !confirmBtn || !cancelBtn) return;

    const hide = () => overlay.classList.add('hidden');
    
    const resolve = (value) => {
        hide();
        if (confirmModalResolve) {
            confirmModalResolve(value);
            confirmModalResolve = null;
        }
    };

    confirmBtn.addEventListener('click', () => resolve(true));
    cancelBtn.addEventListener('click', () => resolve(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) resolve(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            resolve(false);
        }
    });
    
    // Assign the function to the module-level variable
    _showConfirmModal = (message) => {
        modalText.textContent = message;
        overlay.classList.remove('hidden');
        confirmBtn.focus();
        return new Promise((resolve) => {
            confirmModalResolve = resolve;
        });
    };
}

// Export a wrapper function that ensures the modal is initialized before use.
export const showConfirmModal = (message) => {
    if (!_showConfirmModal) {
        console.error("Confirm modal has not been initialized.");
        return Promise.resolve(false); // Fail gracefully
    }
    return _showConfirmModal(message);
};


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