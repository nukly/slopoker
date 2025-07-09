const { getBestHand, compareHands, getHandDescription } = require('../utils/handEvaluator');

/**
 * ShowdownManager - Handles hand evaluation and winner determination
 */
class ShowdownManager {
  constructor() {}

  evaluateHands(activePlayers, communityCards) {
    console.log('Starting showdown...');
    console.log('Active players:', activePlayers.map(p => p.name));
    console.log('Community cards:', communityCards);
    
    // Ensure communityCards is an array
    if (!Array.isArray(communityCards)) {
      console.error('Error: communityCards is not an array:', communityCards);
      return null;
    }
    
    if (activePlayers.length === 0) {
      console.log('Error: No active players for showdown');
      return null;
    }
    
    if (activePlayers.length === 1) {
      // Only one player left - they win by default
      const winner = activePlayers[0];
      console.log(`${winner.name} wins by default (only player remaining)`);
      
      return {
        type: 'single',
        winner,
        reason: 'Only player remaining'
      };
    }
    
    // Evaluate all hands
    const handEvaluations = activePlayers.map(player => {
      console.log(`Evaluating hand for ${player.name} with cards:`, player.cards);
      const bestHandResult = getBestHand(player.cards, communityCards);
      
      if (!bestHandResult) {
        console.error(`Failed to evaluate hand for ${player.name}`);
        return null;
      }
      
      const handDescription = getHandDescription(bestHandResult.rank);
      console.log(`${player.name} best hand:`, handDescription);
      
      return {
        player,
        hand: bestHandResult.hand,
        rank: bestHandResult.rank,
        description: handDescription
      };
    }).filter(Boolean); // Remove any null entries
    
    // Sort by hand strength (best first)
    handEvaluations.sort((a, b) => compareHands(b.rank, a.rank));
    
    // Determine winner(s) - all players with the same best hand strength
    const bestHandStrength = handEvaluations[0].rank;
    const winners = handEvaluations.filter(handEval => compareHands(handEval.rank, bestHandStrength) === 0);
    
    console.log(`Showdown complete:`);
    handEvaluations.forEach((handEval, index) => {
      console.log(`${index + 1}. ${handEval.player.name}: ${handEval.description}`);
    });
    
    return {
      type: winners.length === 1 ? 'single' : 'split',
      winners,
      handEvaluations
    };
  }

  distributePot(pot, winners) {
    if (winners.length === 1) {
      const winner = winners[0];
      winner.player.chips += pot;
      console.log(`${winner.player.name} wins ${pot} with ${winner.description}`);
      
      return {
        type: 'single',
        winner: winner.player.name,
        winAmount: pot,
        winningHand: winner.description
      };
    } else {
      // Split pot
      const winAmount = Math.floor(pot / winners.length);
      const remainder = pot % winners.length;
      
      console.log(`Split pot: ${winners.length} winners each get ${winAmount}`);
      const winnerNames = [];
      
      winners.forEach((winner, index) => {
        let amount = winAmount;
        // Give remainder to first winner(s)
        if (index < remainder) amount++;
        
        winner.player.chips += amount;
        winnerNames.push(winner.player.name);
        console.log(`${winner.player.name} gets ${amount} (${winner.description})`);
      });
      
      return {
        type: 'split',
        winners: winnerNames,
        winAmount: winAmount,
        splitPot: true,
        winningHand: winners[0].description
      };
    }
  }

  createHandEndedEvent(showdownResult, handEvaluations, gameState, players) {
    const baseEvent = {
      gameState,
      players
    };

    if (showdownResult.type === 'single') {
      return {
        ...baseEvent,
        winner: showdownResult.winner,
        winAmount: showdownResult.winAmount,
        winningHand: showdownResult.winningHand,
        reason: showdownResult.reason,
        handEvaluations: handEvaluations ? handEvaluations.map(handEval => ({
          playerName: handEval.player.name,
          cards: handEval.player.cards,
          handDescription: handEval.description,
          isWinner: handEval.player.name === showdownResult.winner
        })) : undefined
      };
    } else {
      return {
        ...baseEvent,
        winners: showdownResult.winners,
        winAmount: showdownResult.winAmount,
        splitPot: true,
        winningHand: showdownResult.winningHand,
        handEvaluations: handEvaluations.map(handEval => ({
          playerName: handEval.player.name,
          cards: handEval.player.cards,
          handDescription: handEval.description,
          isWinner: showdownResult.winners.includes(handEval.player.name)
        }))
      };
    }
  }
}

module.exports = ShowdownManager;
