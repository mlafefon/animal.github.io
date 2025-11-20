

import { getTeamsWithScores, getFinalQuestionData, adjustScoreForTeam, clearGameState, broadcastGameState } from './game.js';
import { playSound } from './audio.js';
import { showLinkModal } from './ui.js';
import { unsubscribeAllRealtime, updateGameSession } from './appwriteService.js';
import { getState, initializeBettingState, updateTeamBet, getBettingData, revealBets, setParticipantState, getFinalAnswers, getAreFinalAnswersRevealed, revealFinalAnswers } from './gameState.js';


// --- Elements ---
const bettingScreen = document.getElementById('betting-screen');
const finalQuestionScreen = document.getElementById('final-question-screen');
const bettingTeamsContainer = document.getElementById('betting-teams-container');
const showFinalQuestionBtn = document.getElementById('show-final-question-btn');
const finalQuestionText = document.getElementById('final-question-text');
const finalAnswerContainer = document.getElementById('final-answer-container');
const finalAnswerText = document.getElementById('final-answer-text');
const finalAnswerLinkBtn = document.getElementById('final-answer-link-btn');
const showFinalAnswerBtn = document.getElementById('show-final-answer-btn');
const finalScoringContainer = document.getElementById('final-scoring-container');
const finalScoringTeams = document.getElementById('final-scoring-teams');
const endGameBtn = document.getElementById('end-game-btn');
const startScreen = document.getElementById('start-screen');
const mainGameFooter = document.getElementById('main-game-footer');
const revealBetsBtn = document.getElementById('reveal-bets-btn');
const revealTeamsAnswersBtn = document.getElementById('reveal-teams-answers-btn');
const finalAnswersGrid = document.getElementById('final-answers-grid');


// --- State ---
let teamsData = [];

function checkAllBetsPlaced() {
    const bettingData = getBettingData();
    // We consider a bet "placed" if it exists in currentBets or lockedBets.
    // Note: In this new logic, the button visibility is less critical as the Host can adjust manually
    // or wait for participants.
    // However, we can check if all teams have *some* bet value recorded.
    
    // For now, we let the Reveal button be always active or active if > 0 bets exist.
    // Simpler: Always show Reveal button. Logic for "Next" is handled by Reveal click.
}

function renderBettingCards() {
    bettingTeamsContainer.innerHTML = '';
    teamsData = getTeamsWithScores();
    const bettingData = getBettingData();
    const { currentBets, lockedBets, revealed } = bettingData;

    teamsData.forEach(team => {
        const canBet = team.score > 0;
        const currentBet = currentBets[team.index] || 0;
        const isLocked = lockedBets[team.index];
        
        const card = document.createElement('div');
        card.className = 'betting-team-card';
        
        let betDisplayContent = '';
        
        if (!canBet) {
             betDisplayContent = `
                <div class="bet-control no-bet">
                    <p>לא ניתן להמר</p>
                </div>`;
        } else {
            if (revealed) {
                // Show actual numbers, disable controls
                 betDisplayContent = `
                    <div class="bet-control revealed">
                        <span class="bet-amount">${currentBet}</span>
                    </div>`;
            } else {
                 // Not revealed. Show controls (Host manual override) AND Lock Status
                 // If locked by participant, show a lock/check icon.
                 // The number is still visible to the host for manual adjustment if needed, 
                 // OR we hide it if we want true "blind" betting until reveal.
                 // User request: "Host button to reveal bets of everyone". This implies hidden by default.
                 
                 // DECISION: Host sees values they manually set. If participant locks, it shows "Locked".
                 // To avoid cheating/peeking, we can hide the value if locked, or show a placeholder.
                 
                 if (isLocked) {
                      betDisplayContent = `
                        <div class="bet-control locked">
                            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 0 24 24" width="40px" fill="#4CAF50"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            <p style="margin:0; font-weight:bold; color:#4CAF50;">הימור התקבל</p>
                        </div>`;
                 } else {
                     // Standard manual controls
                     betDisplayContent = `
                        <div class="bet-control">
                            <button class="bet-stepper-btn bet-increase" data-index="${team.index}">+</button>
                            <span class="bet-amount" data-index="${team.index}">${currentBet}</span>
                            <button class="bet-stepper-btn bet-decrease" data-index="${team.index}">-</button>
                        </div>`;
                 }
            }
        }

        card.innerHTML = `
            <div class="team-icon">
                <img src="${team.icon}" alt="${team.name}">
            </div>
            <p class="team-name">${team.name}</p>
            <p class="team-score">ניקוד: ${team.score}</p>
            ${betDisplayContent}
        `;
        bettingTeamsContainer.appendChild(card);
    });
    
    // Button visibility logic
    if (revealed) {
        revealBetsBtn.classList.add('hidden');
        showFinalQuestionBtn.classList.remove('hidden');
    } else {
        revealBetsBtn.classList.remove('hidden');
        showFinalQuestionBtn.classList.add('hidden');
    }
}

function handleBetChange(teamIndex, direction) {
    const maxBet = teamsData.find(t => t.index === teamIndex)?.score || 0;
    const bettingData = getBettingData();
    let currentBet = bettingData.currentBets[teamIndex] || 0;

    if (direction === 'increase') {
        currentBet = Math.min(currentBet + 5, maxBet);
    } else if (direction === 'decrease') {
        currentBet = Math.max(currentBet - 5, 0);
    }

    // Update state
    updateTeamBet(teamIndex, currentBet, false); // False = not locked (manual edit)
    
    // Update UI locally
    const amountEl = bettingTeamsContainer.querySelector(`.bet-amount[data-index="${teamIndex}"]`);
    if (amountEl) {
        amountEl.textContent = currentBet;
    }
    
    // We don't broadcast every single increment to participants to save bandwidth/flicker,
    // as they have their own controls. But if Host changes it, it might overwrite.
    // Simplified: Host wins.
}

function renderFinalScoringControls() {
    finalScoringTeams.innerHTML = '';
    teamsData.forEach(team => {
        const scoreControl = document.createElement('div');
        scoreControl.className = 'final-scoring-card';
        scoreControl.innerHTML = `
            <p class="team-name">${team.name}</p>
            <div class="final-scoring-controls" data-index="${team.index}">
                <button class="final-scoring-correct">צדק</button>
                <button class="final-scoring-incorrect">טעה</button>
            </div>
        `;
        finalScoringTeams.appendChild(scoreControl);
    });
}

function renderFinalAnswersGrid() {
    finalAnswersGrid.innerHTML = '';
    const submittedAnswers = getFinalAnswers();
    const isRevealed = getAreFinalAnswersRevealed();
    
    teamsData.forEach(team => {
        if (team.score <= 0) return; // Skip teams that couldn't bet

        const answerData = submittedAnswers[team.index];
        const hasAnswer = !!answerData;
        
        const card = document.createElement('div');
        card.className = 'final-answer-card';
        if (hasAnswer && !isRevealed) card.classList.add('submitted');
        if (isRevealed) card.classList.add('revealed');

        // Determine content
        let contentHtml;
        if (isRevealed) {
            contentHtml = `<div class="final-answer-text-display">${hasAnswer ? answerData.text : '-'}</div>`;
        } else {
            if (hasAnswer) {
                contentHtml = `
                    <div class="status-indicator success">
                        <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 0 24 24" width="48px" fill="#fff"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
                        <span>תשובה הוגשה</span>
                    </div>
                `;
            } else {
                contentHtml = `
                    <div class="status-indicator waiting">
                        <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 0 24 24" width="48px" fill="#ccc"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/></svg>
                        <span>ממתין...</span>
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div class="team-header">
                <img src="${team.icon}" alt="${team.name}">
                <span>${team.name}</span>
            </div>
            <div class="answer-body">
                ${contentHtml}
            </div>
        `;
        finalAnswersGrid.appendChild(card);
    });
    
    // Show the Reveal button if not already revealed
    if (!isRevealed) {
        revealTeamsAnswersBtn.classList.remove('hidden');
        showFinalAnswerBtn.classList.add('hidden'); // Hide "Show Correct Answer" until teams revealed
    } else {
        revealTeamsAnswersBtn.classList.add('hidden');
        showFinalAnswerBtn.classList.remove('hidden');
    }
}


/**
 * Finds the winner(s) and displays a celebratory announcement.
 */
function findAndDisplayWinner() {
    const finalScores = getTeamsWithScores();
    if (finalScores.length === 0) return;

    playSound('winner');

    const maxScore = Math.max(...finalScores.map(t => t.score));
    const winners = finalScores.filter(t => t.score === maxScore);

    const finalContent = document.querySelector('.final-question-content');
    
    const winnerDisplay = document.createElement('div');
    winnerDisplay.className = 'winner-announcement';

    const title = document.createElement('h1');
    title.textContent = winners.length > 1 ? 'תיקו!' : 'הקבוצה המנצחת!';
    
    const winnersContainer = document.createElement('div');
    winnersContainer.className = 'winners-container';

    winners.forEach(winner => {
        const card = document.createElement('div');
        card.className = 'winner-card';
        
        card.innerHTML = `
            <div class="team-icon">
                <img src="${winner.icon}" alt="${winner.name}">
            </div>
            <p class="team-name">${winner.name}</p>
            <p class="team-score">${winner.score}</p>
        `;
        winnersContainer.appendChild(card);
    });
    
    winnerDisplay.appendChild(title);
    winnerDisplay.appendChild(winnersContainer);
    finalContent.appendChild(winnerDisplay);

    // Highlight the winning team(s) in the main footer
    const mainTeamsContainer = document.getElementById('main-teams-container');
    if (mainTeamsContainer) {
        winners.forEach(winner => {
            const winnerFooterEl = mainTeamsContainer.querySelector(`.team-member[data-index="${winner.index}"]`);
            if (winnerFooterEl) {
                winnerFooterEl.classList.add('winner');
            }
        });
    }

    // Show the end game button after a delay to appreciate the animation
    setTimeout(() => {
        endGameBtn.classList.remove('hidden');
    }, 2000);
}

/**
 * Hides the question/answer and scoring, then starts the winner announcement.
 */
function triggerWinSequence() {
    document.getElementById('final-q-a-wrapper').classList.add('hidden');
    document.getElementById('final-scoring-container').classList.add('hidden');
    
    // Smooth transition before showing the winner
    setTimeout(findAndDisplayWinner, 500);
}


function checkAllTeamsScored() {
    const remainingControls = finalScoringTeams.querySelectorAll('.final-scoring-controls');
    if (remainingControls.length === 0) {
        // Instead of showing the button immediately, trigger the win sequence.
        triggerWinSequence();
    }
}

function handleFinalScore(teamIndex, wasCorrect) {
    const bettingData = getBettingData();
    const betAmount = bettingData.currentBets[teamIndex] || 0;
    const scoreChange = wasCorrect ? betAmount : -betAmount;

    // Play the correct sound based on the result
    if (wasCorrect) {
        playSound('correct');
    } else {
        playSound('incorrect');
    }

    // Adjust the score instantly without animation
    adjustScoreForTeam(teamIndex, scoreChange, null, true);

    const controls = finalScoringTeams.querySelector(`.final-scoring-controls[data-index="${teamIndex}"]`);
    if (controls) {
        // To maintain layout, replace the controls rather than removing the parent
        const parentCard = controls.parentElement;
        controls.remove();
        const p = document.createElement('p');
        p.textContent = `הניקוד עודכן!`;
        parentCard.appendChild(p);
    }
    checkAllTeamsScored();
}


export function showBettingScreen() {
    initializeBettingState(); // Reset bets structure in state
    broadcastGameState(); // Let participants know we are in betting mode
    
    renderBettingCards();
    
    // When moving to the final betting screen, remove the active team highlight
    const mainTeamsContainer = document.getElementById('main-teams-container');
    if (mainTeamsContainer) {
        const activeTeam = mainTeamsContainer.querySelector('.team-member.active');
        if (activeTeam) {
            activeTeam.classList.remove('active');
        }
    }
    
    // Hide the manual score controls (+/-) during betting
    const scoreControls = document.querySelector('.score-controls');
    if (scoreControls) {
        scoreControls.classList.add('hidden');
    }

    document.getElementById('pre-question-screen').classList.add('hidden');
    bettingScreen.classList.remove('hidden');
}

/**
 * Updates the main game footer to show each team's bet next to their score.
 */
function updateFooterWithBets() {
    const mainTeamsContainer = document.getElementById('main-teams-container');
    if (!mainTeamsContainer) return;
    const bettingData = getBettingData();

    teamsData.forEach(team => {
        const teamElement = mainTeamsContainer.querySelector(`.team-member[data-index="${team.index}"]`);
        if (teamElement) {
            const scoreElement = teamElement.querySelector('.team-score');
            if (scoreElement) {
                const betAmount = bettingData.currentBets[team.index] || 0;
                // team.score holds the score at the time the betting screen was shown.
                scoreElement.innerHTML = `${team.score} <span class="bet-display">(${betAmount})</span>`;
            }
        }
    });
}

function showFinalQuestion() {
    bettingScreen.classList.add('hidden');
    
    const scoreControls = document.querySelector('.score-controls');
    if (scoreControls) {
        scoreControls.classList.add('hidden');
    }

    const finalQuestion = getFinalQuestionData();
    if (finalQuestion) {
        finalQuestionText.textContent = finalQuestion.q;
        finalAnswerText.textContent = finalQuestion.a;
    } else {
        finalQuestionText.textContent = 'לא נמצאה שאלה סופית.';
        finalAnswerText.textContent = '';
    }
    
    // Set state to 'finalQuestionActive' to show the input form to participants
    setParticipantState('finalQuestionActive');
    broadcastGameState();

    // Always hide the link button initially
    finalAnswerLinkBtn.classList.add('hidden');
    
    // Render the empty answers grid
    finalAnswersGrid.classList.remove('hidden');
    renderFinalAnswersGrid();

    updateFooterWithBets(); // Show the bets in the footer
    finalQuestionScreen.classList.remove('hidden');
}


export function initializeFinalRound() {
    let longPressTimer = null;
    let longPressTriggered = false;

    const startPress = (e) => {
        const target = e.target;
        if (target.matches('.bet-increase')) {
            e.preventDefault();
            longPressTriggered = false; // Reset on each new press
            longPressTimer = setTimeout(() => {
                longPressTriggered = true; // Mark that long press happened
                const index = parseInt(target.dataset.index, 10);
                const maxBet = teamsData.find(t => t.index === index)?.score || 0;
                
                // Update directly
                updateTeamBet(index, maxBet, false);
                
                const amountEl = bettingTeamsContainer.querySelector(`.bet-amount[data-index="${index}"]`);
                if (amountEl) {
                    amountEl.textContent = maxBet;
                }
            }, 500); // Long press duration
        }
    };

    const cancelPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
    };

    bettingTeamsContainer.addEventListener('click', (e) => {
        if (longPressTriggered) {
            e.preventDefault(); // Prevent click from firing after long press
            longPressTriggered = false; // Reset for next interaction
            return;
        }
        
        const target = e.target;
        if (target.matches('.bet-stepper-btn')) {
            const index = parseInt(target.dataset.index, 10);
            const direction = target.classList.contains('bet-increase') ? 'increase' : 'decrease';
            handleBetChange(index, direction);
        }
    });

    bettingTeamsContainer.addEventListener('mousedown', startPress);
    bettingTeamsContainer.addEventListener('mouseup', cancelPress);
    bettingTeamsContainer.addEventListener('mouseleave', cancelPress);
    bettingTeamsContainer.addEventListener('touchstart', startPress);
    bettingTeamsContainer.addEventListener('touchend', cancelPress);

    showFinalQuestionBtn.addEventListener('click', showFinalQuestion);
    
    revealBetsBtn.addEventListener('click', () => {
        revealBets(); // Update state
        renderBettingCards(); // Re-render UI
        broadcastGameState(); // Broadcast revealed state
    });

    showFinalAnswerBtn.addEventListener('click', () => {
        finalAnswerContainer.classList.remove('hidden');
        showFinalAnswerBtn.classList.add('hidden');

        const finalQuestion = getFinalQuestionData();
        finalAnswerLinkBtn.classList.toggle('hidden', !finalQuestion || !finalQuestion.url);
        
        renderFinalScoringControls();
        finalScoringContainer.classList.remove('hidden');
    });
    
    revealTeamsAnswersBtn.addEventListener('click', () => {
        revealFinalAnswers();
        renderFinalAnswersGrid();
    });
    
    finalAnswerLinkBtn.addEventListener('click', () => {
        const finalQuestion = getFinalQuestionData();
        if (finalQuestion && finalQuestion.url) {
            showLinkModal(finalQuestion.url);
        }
    });

    finalScoringTeams.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('button')) {
            const controlsDiv = target.closest('.final-scoring-controls');
            if (controlsDiv) {
                const index = parseInt(controlsDiv.dataset.index, 10);
                const wasCorrect = target.classList.contains('final-scoring-correct');
                handleFinalScore(index, wasCorrect);
            }
        }
    });

    endGameBtn.addEventListener('click', async () => {
        // Notify participants that the game is over
        const { sessionDocumentId } = getState();
        if (sessionDocumentId) {
            try {
                // We update with a minimal payload just to trigger the realtime event
                await updateGameSession(sessionDocumentId, { gameState: 'finished' });
            } catch (error) {
                console.warn("Could not notify participants of game end:", error);
            }
        }

        // 1. Hide the final screen and the game footer.
        finalQuestionScreen.classList.add('hidden');
        mainGameFooter.classList.remove('visible');
        document.body.classList.remove('game-active');

        // Stop listening to Appwrite events for this game
        unsubscribeAllRealtime();
        // Remove the global event listener for broadcasting
        document.removeEventListener('gamestatechange', () => {});


        // 2. Show the main start screen and header.
        startScreen.classList.remove('hidden');
        document.getElementById('global-header').classList.remove('hidden');


        // 3. Clean up UI elements for the next game.
        // Remove the dynamically added winner announcement.
        const winnerAnnouncement = finalQuestionScreen.querySelector('.winner-announcement');
        if (winnerAnnouncement) {
            winnerAnnouncement.remove();
        }

        // Remove the winner highlight from the footer icons.
        const winnerIcons = mainGameFooter.querySelectorAll('.team-member.winner');
        winnerIcons.forEach(icon => icon.classList.remove('winner'));

        // Clean up bet display from scores in the footer
        const footerScores = mainGameFooter.querySelectorAll('.team-score');
        footerScores.forEach(scoreEl => {
            const scoreSpan = scoreEl.querySelector('.bet-display');
            if (scoreSpan) {
                // Keep only the score, remove the bet span
                scoreEl.innerHTML = scoreEl.innerHTML.replace(scoreSpan.outerHTML, '');
            }
        });

        // Reset the state of the final screen itself.
        finalAnswerContainer.classList.add('hidden');
        finalScoringContainer.classList.add('hidden');
        finalAnswersGrid.classList.add('hidden'); // Hide grid
        showFinalAnswerBtn.classList.remove('hidden');
        revealTeamsAnswersBtn.classList.add('hidden');
        endGameBtn.classList.add('hidden');
        finalAnswerLinkBtn.classList.add('hidden');
        
        // Last action: clear the saved state for the completed game.
        clearGameState();
    });

    // Listener for re-rendering betting UI when a participant locks a bet
    document.addEventListener('bettingupdate', () => {
        if (!bettingScreen.classList.contains('hidden')) {
             renderBettingCards();
        }
    });
    
    // Listener for updating final answer submitted status
    document.addEventListener('finalanswerupdate', () => {
        if (!finalQuestionScreen.classList.contains('hidden')) {
            renderFinalAnswersGrid();
        }
    });
}