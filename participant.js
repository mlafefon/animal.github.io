
        case 'finalRoundPre':
            showScreen('game');
            questionContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <h1 style="color: #ffeb3b; font-size: 4rem; text-align: center;">הסיבוב האחרון</h1>
                </div>
            `;
            participantControls.classList.add('hidden');
            waitingMessage.classList.add('hidden');
            break;
