/**
 * BettingManager - Handles betting logic and validation
 */
class BettingManager {
  constructor() {}

  validatePlayerAction(player, action, amount, currentBet, bigBlind) {
    switch (action) {
      case 'fold':
        return { valid: true };
      
      case 'call':
        const callAmount = currentBet - player.bet;
        if (player.chips >= callAmount) {
          return { valid: true, amount: callAmount };
        } else if (player.chips > 0) {
          return { valid: true, amount: player.chips, allIn: true };
        } else {
          return { valid: false, reason: 'No chips remaining' };
        }
      
      case 'check':
        if (player.bet < currentBet) {
          return { valid: false, reason: `Must call ${currentBet - player.bet}` };
        }
        return { valid: true };
      
      case 'raise':
        const raiseCallAmount = currentBet - player.bet;
        
        if (amount <= 0 || amount > player.chips) {
          return { valid: false, reason: 'Invalid raise amount' };
        }
        
        if (amount === player.chips) {
          return { valid: true, amount, allIn: true };
        }
        
        const minRaiseAmount = raiseCallAmount + bigBlind;
        if (amount >= minRaiseAmount) {
          return { valid: true, amount };
        } else {
          return { valid: false, reason: `Minimum raise is ${minRaiseAmount}` };
        }
      
      default:
        return { valid: false, reason: 'Unknown action' };
    }
  }

  processPlayerAction(player, action, amount, gameState) {
    const validation = this.validatePlayerAction(player, action, amount, gameState.currentBet, gameState.bigBlind);
    
    if (!validation.valid) {
      console.log(`${player.name} cannot ${action} - ${validation.reason}`);
      return false;
    }

    switch (action) {
      case 'fold':
        player.folded = true;
        console.log(`${player.name} folded`);
        break;
        
      case 'call':
        if (validation.allIn) {
          const allInAmount = player.chips;
          player.bet += allInAmount;
          gameState.pot += allInAmount;
          player.chips = 0;
          console.log(`${player.name} called all-in with ${allInAmount}, total bet now ${player.bet}`);
        } else {
          player.chips -= validation.amount;
          player.bet += validation.amount;
          gameState.pot += validation.amount;
          console.log(`${player.name} called ${validation.amount}, total bet now ${player.bet}`);
        }
        break;
        
      case 'check':
        console.log(`${player.name} checked`);
        break;
        
      case 'raise':
        if (validation.allIn) {
          const newTotalBet = player.bet + amount;
          player.chips = 0;
          gameState.pot += amount;
          player.bet = newTotalBet;
          
          if (newTotalBet > gameState.currentBet) {
            gameState.currentBet = newTotalBet;
            console.log(`${player.name} went all-in for ${amount}, new table bet ${newTotalBet}`);
          } else {
            console.log(`${player.name} went all-in for ${amount}, total bet ${newTotalBet} (no bet increase)`);
          }
        } else {
          const newTotalBet = player.bet + amount;
          player.chips -= amount;
          player.bet = newTotalBet;
          gameState.currentBet = newTotalBet;
          gameState.pot += amount;
          console.log(`${player.name} raised to ${newTotalBet} (bet ${amount})`);
        }
        break;
    }

    return true;
  }

  isBettingRoundComplete(activePlayers, gameState) {
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);

    if (nonFoldedPlayers.length <= 1) {
      return true;
    }

    // Special case: if all active players are all-in, skip to showdown
    const allPlayersAllIn = nonFoldedPlayers.every(p => p.chips === 0);
    if (allPlayersAllIn) {
      console.log('All active players are all-in, going directly to showdown');
      return true;
    }

    // For betting round to be complete, all active players must have matched the current bet OR be all-in
    const allMatchedBet = nonFoldedPlayers.every(p => p.bet === gameState.currentBet || p.chips === 0);
    
    if (!allMatchedBet) {
      console.log('Not all players have matched the current bet, betting round continues');
      return false;
    }
    
    // Check if all active players have had at least one action in this round
    const minActionsNeeded = nonFoldedPlayers.length;
    
    console.log(`Actions in round: ${gameState.actionsInRound}, non-folded players: ${nonFoldedPlayers.length}, needed: ${minActionsNeeded}`);
    
    // Ensure everyone has acted at least once
    if (gameState.actionsInRound < minActionsNeeded) {
      console.log('Not all players have acted yet, betting round continues');
      return false;
    }
    
    // Additional check: in heads-up, if current bet is 0 and both players have checked, round is complete
    if (nonFoldedPlayers.length === 2 && gameState.currentBet === 0 && gameState.actionsInRound >= 2) {
      console.log('Heads-up: both players have checked, betting round complete');
      return true;
    }
    
    // For more players: if everyone has matched the bet and acted, round is complete
    if (allMatchedBet && gameState.actionsInRound >= minActionsNeeded) {
      console.log('All players have acted and matched bets, betting round complete');
      return true;
    }
    
    return false;
  }

  resetBetsForNewRound(activePlayers) {
    activePlayers.forEach(player => {
      player.bet = 0;
    });
  }
}

module.exports = BettingManager;
