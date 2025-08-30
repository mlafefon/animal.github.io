// This selector targets all interactive elements that should be navigable with arrow keys.
// It includes standard buttons, inputs, and custom elements acting as buttons.
const FOCUSABLE_SELECTOR = `
  button:not([tabindex="-1"]), 
  [role="button"], 
  input,
  select,
  textarea,
  .btn, 
  .selection-list li, 
  .treasure-chest, 
  .answer-btn,
  .team-member-modal-select, 
  .bet-stepper-btn,
  .final-scoring-controls button,
  .reorder-btn,
  .delete-question-btn,
  #settings-btn,
  #fullscreen-toggle-btn
`;

/**
 * Initializes keyboard navigation (arrow keys, enter, space) for a given container.
 * @param {HTMLElement} container The container element whose children should be navigable.
 */
export function initKeyboardNav(container) {
    if (!container) return;

    container.addEventListener('keydown', (e) => {
        const key = e.key;

        // --- Pass Question Modal Navigation & Focus Trap ---
        const passModal = document.getElementById('pass-question-modal-overlay');
        const isPassModalVisible = passModal && passModal.offsetParent !== null;

        if (isPassModalVisible) {
            const focusableInModal = Array.from(
                passModal.querySelectorAll('.team-member-modal-select, #cancel-pass-question-btn')
            );
            const activeElement = document.activeElement;
            const currentIndex = focusableInModal.indexOf(activeElement);

            // Handle Tab key for focus trapping
            if (key === 'Tab') {
                e.preventDefault();
                let nextIndex = 0;
                if (currentIndex !== -1) {
                    nextIndex = e.shiftKey
                        ? (currentIndex - 1 + focusableInModal.length) % focusableInModal.length
                        : (currentIndex + 1) % focusableInModal.length;
                }
                focusableInModal[nextIndex].focus();
                return; // Event handled
            }

            // Handle Arrow keys for custom navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                e.preventDefault();
                const teamIcons = focusableInModal.filter(el => el.matches('.team-member-modal-select'));
                const cancelButton = focusableInModal.find(el => el.id === 'cancel-pass-question-btn');
                const isTeamIconFocused = teamIcons.includes(activeElement);
                const isCancelButtonFocused = (activeElement === cancelButton);

                if (isTeamIconFocused) {
                    const currentTeamIndex = teamIcons.indexOf(activeElement);
                    if (key === 'ArrowDown' && cancelButton) {
                        cancelButton.focus();
                    } else if (key === 'ArrowRight') { // RTL: Right arrow moves to previous element in DOM
                        const nextIndex = (currentTeamIndex - 1 + teamIcons.length) % teamIcons.length;
                        teamIcons[nextIndex].focus();
                    } else if (key === 'ArrowLeft') { // RTL: Left arrow moves to next element in DOM
                        const nextIndex = (currentTeamIndex + 1) % teamIcons.length;
                        teamIcons[nextIndex].focus();
                    }
                } else if (isCancelButtonFocused) {
                    if (key === 'ArrowUp' && teamIcons.length > 0) {
                        // From cancel button, move up to the first team icon
                        teamIcons[0].focus();
                    }
                }
                return; // Event handled
            }
            
            // Handle activation keys within the modal
            if (key === 'Enter' || key === ' ') {
                if (focusableInModal.includes(activeElement)) {
                    e.preventDefault();
                    activeElement.click();
                }
                return; // Event handled
            }
            
            // Stop any other general navigation logic from running while the modal is open
            return;
        }

        // --- General App Navigation (runs only if modal is not visible) ---

        if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(key)) {
            return;
        }

        const activeElement = document.activeElement;
        
        // --- Vertical Navigation (Up/Down) for specific lists ---
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            // START SCREEN NAVIGATION
            const isStartScreenVisible = document.getElementById('start-screen').offsetParent !== null;
            if (isStartScreenVisible && key === 'ArrowDown') {
                // From anywhere on start screen, down arrow focuses the main start button.
                e.preventDefault();
                const startButton = document.getElementById('go-to-setup-btn');
                if (startButton) {
                    startButton.focus();
                }
                return; // Navigation handled
            }

            // Specific navigation from treasure chest to return button
            const isBoxesScreenVisible = document.getElementById('boxes-screen').offsetParent !== null;
            const returnBtn = document.getElementById('return-from-boxes-btn');
            if (key === 'ArrowDown' && isBoxesScreenVisible && activeElement.matches('.treasure-chest') && returnBtn.classList.contains('visible')) {
                e.preventDefault();
                returnBtn.focus();
                return; // Navigation handled
            }

            const parentList = activeElement.closest('.selection-list');
            
            // This logic applies only when focus is inside a .selection-list on the setup screen
            if (parentList && activeElement.tagName === 'LI') {
                e.preventDefault();
                const listItems = Array.from(parentList.querySelectorAll('li'));
                const currentIndex = listItems.indexOf(activeElement);

                if (key === 'ArrowDown') {
                    if (currentIndex === listItems.length - 1) {
                        // At the bottom of a list, move to the shuffle checkbox
                        const shuffleCheckbox = document.getElementById('shuffle-questions');
                        if (shuffleCheckbox) {
                            shuffleCheckbox.focus();
                        }
                    } else {
                        listItems[currentIndex + 1].focus();
                    }
                } else { // ArrowUp
                    if (currentIndex === 0) {
                        // At the top of a list, wrap to the bottom for easier navigation
                        listItems[listItems.length - 1].focus();
                    } else {
                        listItems[currentIndex - 1].focus();
                    }
                }
                return; // Stop further processing for this key event
            }
            
            // Navigate from the shuffle checkbox to the start button
            if (activeElement.id === 'shuffle-questions' && key === 'ArrowDown') {
                e.preventDefault();
                const startButton = document.getElementById('start-btn');
                if (startButton) {
                    startButton.focus();
                }
                return; // Navigation handled
            }

            // Navigate from the shuffle checkbox UP to the lists above
            if (activeElement.id === 'shuffle-questions' && key === 'ArrowUp') {
                e.preventDefault();
                // A sensible target is the selected item in the right-most list (groups)
                const selectedItem = document.querySelector('#group-list li.selected') || document.querySelector('#group-list li');
                if (selectedItem) {
                    selectedItem.focus();
                }
                return; // Navigation handled
            }

            // Navigate from the start button up to the shuffle checkbox
            if (activeElement.id === 'start-btn' && key === 'ArrowUp') {
                e.preventDefault();
                const shuffleCheckbox = document.getElementById('shuffle-questions');
                if (shuffleCheckbox) {
                    shuffleCheckbox.focus();
                }
                return; // Navigation handled
            }

            // --- Betting Screen Navigation ---
            const isBettingScreenVisible = document.getElementById('betting-screen').offsetParent !== null;
            if (key === 'ArrowDown' && isBettingScreenVisible) {
                const finalQuestionBtn = document.getElementById('show-final-question-btn');
                // Check if the button is actually visible and can be focused
                if (finalQuestionBtn && finalQuestionBtn.offsetParent !== null) {
                    e.preventDefault();
                    finalQuestionBtn.focus();
                    return; // Navigation handled
                }
            }
        }
        
        // --- Horizontal Navigation (Left/Right) for specific lists on setup screen ---
        if (key === 'ArrowRight' || key === 'ArrowLeft') {
            const isSetupScreenVisible = document.getElementById('setup-screen').offsetParent !== null;
            const parentList = activeElement.closest('.selection-list');

            if (isSetupScreenVisible && parentList && activeElement.tagName === 'LI') {
                e.preventDefault(); // Prevent both default browser action and generic nav
                
                const groupList = document.getElementById('group-list');
                const gameList = document.getElementById('game-list');
                
                let targetList = null;

                // User-requested logic: ArrowLeft moves visually left, ArrowRight moves visually right.
                if (key === 'ArrowLeft' && parentList.id === 'group-list') {
                    // From groups (visually on the right) to games (visually on the left)
                    targetList = gameList;
                } else if (key === 'ArrowRight' && parentList.id === 'game-list') {
                    // From games (visually on the left) to groups (visually on the right)
                    targetList = groupList;
                }


                if (targetList) {
                    // Focus the selected item in the target list, or the first item as a fallback
                    const selectedItem = targetList.querySelector('.selected') || targetList.querySelector('li');
                    if (selectedItem) {
                        selectedItem.focus();
                    }
                }
                // If a horizontal arrow is pressed but there's no target (e.g., ArrowLeft in groups list),
                // we just prevent default and return, effectively doing nothing.
                return; // Navigation handled (or intentionally ignored), so we stop here.
            }
        }


        // --- Generic Fallback Navigation for all other cases ---
        const focusableElements = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter(el => el.offsetParent !== null && !el.disabled && el.closest('.hidden') === null);

        if (focusableElements.length === 0) {
            return;
        }

        const currentFocusedIndex = focusableElements.indexOf(activeElement);

        if (key === 'ArrowRight' || key === 'ArrowLeft') {
            e.preventDefault();
            let nextIndex = 0;

            if (currentFocusedIndex !== -1) {
                // For RTL layout, right arrow moves to the PREVIOUS element in DOM order,
                // and left arrow moves to the NEXT element in DOM order.
                if (key === 'ArrowRight') {
                    nextIndex = (currentFocusedIndex - 1 + focusableElements.length) % focusableElements.length;
                } else { // ArrowLeft
                    nextIndex = (currentFocusedIndex + 1) % focusableElements.length;
                }
            } else {
                 // If nothing is focused yet, pressing an arrow key will focus the first element.
                focusableElements[0].focus();
                return;
            }
            focusableElements[nextIndex].focus();
        } 
        // --- Activation (Enter/Space) ---
        else if (key === 'Enter' || key === ' ') {
            // Check if the active element is one of our targets before acting.
            if (activeElement && focusableElements.includes(activeElement)) {
                // For elements where typing is the primary interaction (textareas, inputs),
                // we should not override the default behavior of Enter and Space.
                if (activeElement.tagName === 'TEXTAREA' || 
                    (activeElement.tagName === 'INPUT' && (activeElement.type === 'text' || activeElement.type === 'number'))) {
                    return; // Allow default browser action (e.g., typing a space, creating a newline).
                }

                // For all other interactive elements (buttons, etc.), treat Enter/Space as a click.
                e.preventDefault(); // Prevent space from scrolling, or enter from submitting a form.
                activeElement.click();
            }
        }
    });
}