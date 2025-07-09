/**
 * TurnManager - Handles turn rotation and player index validation
 */
class TurnManager {
  constructor() {}

  validateCurrentPlayerIndex(activePlayers, currentPlayerIndex) {
    if (activePlayers.length === 0) {
      console.log('validateCurrentPlayerIndex: No active players, setting index to 0');
      return { index: 0, valid: false };
    }

    // Check if current index is valid
    if (currentPlayerIndex >= activePlayers.length) {
      console.log(`validateCurrentPlayerIndex: Index ${currentPlayerIndex} out of bounds (${activePlayers.length} players), correcting...`);
      currentPlayerIndex = currentPlayerIndex % activePlayers.length;
    }

    // Ensure the player at current index is actually in the current hand
    const currentPlayer = activePlayers[currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.inCurrentHand) {
      console.log(`validateCurrentPlayerIndex: Player at index ${currentPlayerIndex} is not in current hand, finding valid player...`);
      
      // Find the first valid player in the current hand
      for (let i = 0; i < activePlayers.length; i++) {
        if (activePlayers[i].inCurrentHand && !activePlayers[i].folded && activePlayers[i].chips > 0) {
          console.log(`validateCurrentPlayerIndex: Corrected to index ${i} (${activePlayers[i].name})`);
          return { index: i, valid: true };
        }
      }
      
      // If no valid player found, set to first player in hand (even if folded/all-in)
      for (let i = 0; i < activePlayers.length; i++) {
        if (activePlayers[i].inCurrentHand) {
          console.log(`validateCurrentPlayerIndex: No actionable players, set to first in hand: ${i} (${activePlayers[i].name})`);
          return { index: i, valid: true };
        }
      }
    }

    return { index: currentPlayerIndex, valid: true };
  }

  findNextPlayer(activePlayers, currentPlayerIndex) {
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);

    // Check if only one player remains
    if (nonFoldedPlayers.length === 1) {
      return { nextIndex: -1, endHand: true };
    }

    // Check if all active players are all-in
    const allPlayersAllIn = nonFoldedPlayers.every(p => p.chips === 0);
    if (allPlayersAllIn) {
      console.log('All active players are all-in, proceeding to next phase');
      return { nextIndex: -1, nextPhase: true };
    }

    // Find next active player in turn order (including all-in players)
    let nextIndex = (currentPlayerIndex + 1) % activePlayers.length;
    let attempts = 0;
    
    console.log(`Starting turn search from index ${nextIndex}`);
    
    while (attempts < activePlayers.length) {
      const nextPlayer = activePlayers[nextIndex];
      
      console.log(`Checking player ${nextIndex}: ${nextPlayer.name} (folded: ${nextPlayer.folded}, chips: ${nextPlayer.chips}, inCurrentHand: ${nextPlayer.inCurrentHand})`);
      
      // Skip if player is folded
      if (nextPlayer.folded) {
        console.log(`Skipping ${nextPlayer.name} - folded`);
        nextIndex = (nextIndex + 1) % activePlayers.length;
        attempts++;
        continue;
      }
      
      // Found next player in turn order (regardless of chips)
      console.log(`Found next player in turn order: ${nextPlayer.name}`);
      return { nextIndex, player: nextPlayer };
    }
    
    // If no non-folded players found, something is wrong
    console.log('No valid players found in turn order');
    return { nextIndex: -1, nextPhase: true };
  }

  getFirstPlayerForPhase(activePlayers, dealerIndex, phase) {
    const dealerPos = dealerIndex % activePlayers.length;
    
    let firstActivePos;
    
    if (phase === 'preflop') {
      if (activePlayers.length === 2) {
        // Heads-up: dealer acts first preflop
        firstActivePos = dealerPos;
      } else {
        // 3+ players: first player after big blind acts first
        firstActivePos = (dealerPos + 3) % activePlayers.length;
      }
    } else {
      // Post-flop phases
      if (activePlayers.length === 2) {
        // Heads-up: big blind (non-dealer) acts first post-flop
        firstActivePos = (dealerPos + 1) % activePlayers.length;
      } else {
        // 3+ players: first player after dealer acts first
        firstActivePos = (dealerPos + 1) % activePlayers.length;
      }
    }
    
    // Find first non-folded player starting from the calculated position
    let attempts = 0;
    while (activePlayers[firstActivePos].folded && attempts < activePlayers.length) {
      firstActivePos = (firstActivePos + 1) % activePlayers.length;
      attempts++;
    }
    
    return firstActivePos;
  }

  getBlindPositions(activePlayers, dealerIndex) {
    const dealerPos = dealerIndex % activePlayers.length;
    
    if (activePlayers.length === 2) {
      // Heads-up: dealer is small blind, other player is big blind
      return {
        smallBlindPos: dealerPos,
        bigBlindPos: (dealerPos + 1) % activePlayers.length,
        firstToActPos: dealerPos // Dealer acts first preflop in heads-up
      };
    } else {
      // 3+ players: normal blind structure
      return {
        smallBlindPos: (dealerPos + 1) % activePlayers.length,
        bigBlindPos: (dealerPos + 2) % activePlayers.length,
        firstToActPos: (dealerPos + 3) % activePlayers.length
      };
    }
  }
}

module.exports = TurnManager;
