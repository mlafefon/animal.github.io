import { getTeamsWithScores, getFinalQuestionData, adjustScoreForTeam, clearGameState } from './game.js';
import { playSound } from './audio.js';
import { showLinkModal } from './ui.js';

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


// --- State ---
let teamBets = {};
let teamsData = [];

function checkAllBetsPlaced() {
    const allPlaced = teamsData.every(team => teamBets.hasOwnProperty(team.index) && teamBets[team.index] >= 0);
    if (allPlaced) {
        showFinalQuestionBtn.classList.remove('hidden');
    }
}

function renderBettingCards() {
    bettingTeamsContainer.innerHTML = '';
    teamsData = getTeamsWithScores();
    teamBets = {}; // Reset bets

    teamsData.forEach(team => {
        const canBet = team.score > 0;
        teamBets[team.index] = 0; // Default bet to 0 for everyone.

        const card = document.createElement('div');
        card.className = 'betting-team-card';
        card.innerHTML = `
            <div class="team-icon">
                <img src="${team.icon}" alt="${team.name}">
            </div>
            <p class="team-name">${team.name}</p>
            <p class="team-score">ניקוד: ${team.score}</p>
            ${canBet ? `
                <div class="bet-control">
                    <button class="bet-stepper-btn bet-increase" data-index="${team.index}">+</button>
                    <span class="bet-amount" data-index="${team.index}">0</span>
                    <button class="bet-stepper-btn bet-decrease" data-index="${team.index}">-</button>
                </div>
            ` : `
                <div class="bet-control no-bet">
                    <p>לא ניתן להמר</p>
                </div>
            `}
        `;
        bettingTeamsContainer.appendChild(card);
    });
    checkAllBetsPlaced(); // Check initially
}

function handleBetChange(teamIndex, direction) {
    const maxBet = teamsData.find(t => t.index === teamIndex)?.score || 0;
    let currentBet = teamBets[teamIndex];

    if (direction === 'increase') {
        currentBet = Math.min(currentBet + 5, maxBet);
    } else if (direction === 'decrease') {
        currentBet = Math.max(currentBet - 5, 0);
    }

    teamBets[teamIndex] = currentBet;
    
    const amountEl = bettingTeamsContainer.querySelector(`.bet-amount[data-index="${teamIndex}"]`);
    if (amountEl) {
        amountEl.textContent = currentBet;
    }
    checkAllBetsPlaced();
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
    const betAmount = teamBets[teamIndex];
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

    teamsData.forEach(team => {
        const teamElement = mainTeamsContainer.querySelector(`.team-member[data-index="${team.index}"]`);
        if (teamElement) {
            const scoreElement = teamElement.querySelector('.team-score');
            if (scoreElement) {
                const betAmount = teamBets[team.index];
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

    // Always hide the link button initially
    finalAnswerLinkBtn.classList.add('hidden');

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
                
                teamBets[index] = maxBet;
                
                const amountEl = bettingTeamsContainer.querySelector(`.bet-amount[data-index="${index}"]`);
                if (amountEl) {
                    amountEl.textContent = maxBet;
                }
                checkAllBetsPlaced();
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

    showFinalAnswerBtn.addEventListener('click', () => {
        finalAnswerContainer.classList.remove('hidden');
        showFinalAnswerBtn.classList.add('hidden');

        const finalQuestion = getFinalQuestionData();
        finalAnswerLinkBtn.classList.toggle('hidden', !finalQuestion || !finalQuestion.url);
        
        renderFinalScoringControls();
        finalScoringContainer.classList.remove('hidden');
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

    endGameBtn.addEventListener('click', () => {
        // 1. Hide the final screen and the game footer.
        finalQuestionScreen.classList.add('hidden');
        mainGameFooter.classList.remove('visible');
        document.body.classList.remove('game-active');

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
        showFinalAnswerBtn.classList.remove('hidden');
        endGameBtn.classList.add('hidden');
        finalAnswerLinkBtn.classList.add('hidden');
        
        // Last action: clear the saved state for the completed game.
        clearGameState();
    });
}
