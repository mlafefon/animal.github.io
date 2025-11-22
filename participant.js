            myTeam = { ...myTeamInSession, icon: IMAGE_URLS[myTeamInSession.iconKey] };
            myTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
            myTeamIcon.src = myTeam.icon;
            
            // Update Betting Screen Header on rejoin
            if (bettingTeamName) bettingTeamName.textContent = `אתם קבוצת ${myTeam.name}`;
            if (bettingTeamIcon) bettingTeamIcon.src = myTeam.icon;

            updateGameView(sessionData);
            showNotification('התחברת מחדש בהצלחה!', 'success');
            return true; // SUCCESS
        } else {