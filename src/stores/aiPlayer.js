// AI Player utilities for poker game
import { usePokerStore } from './poker'

export class AIPlayer {
  constructor(playerId) {
    this.playerId = playerId
    this.personality = this.generatePersonality()
  }

  generatePersonality() {
    const aggressionLevels = ['conservative', 'balanced', 'aggressive']
    const bluffFrequencies = ['rarely', 'sometimes', 'often']
    
    return {
      aggression: aggressionLevels[Math.floor(Math.random() * aggressionLevels.length)],
      bluffFrequency: bluffFrequencies[Math.floor(Math.random() * bluffFrequencies.length)],
      riskTolerance: Math.random() // 0-1, higher = more risk tolerant
    }
  }

  makeDecision(gameState) {
    const { currentBet, pot, player, communityCards, gamePhase } = gameState
    
    // Simple AI decision making based on hand strength and personality
    const handStrength = this.evaluateHandStrength(player.cards, communityCards)
    const callAmount = currentBet - player.bet
    const potOdds = callAmount / (pot + callAmount)
    
    console.log(`${player.name} evaluating: hand strength ${handStrength.toFixed(2)}, call amount ${callAmount}, pot odds ${potOdds.toFixed(2)}`)
    
    // Make AI less likely to fold early - be more aggressive
    if (handStrength < 0.15 && callAmount > player.chips * 0.2) {
      return { action: 'fold' }
    }
    
    // More likely to raise with decent hands
    if (handStrength > 0.6 && this.personality.aggression !== 'conservative') {
      const raiseAmount = Math.min(
        Math.floor(pot * 0.3 + Math.random() * pot * 0.4),
        player.chips - callAmount
      )
      if (raiseAmount > 0) {
        return { action: 'raise', amount: raiseAmount }
      }
    }
    
    if (callAmount === 0) {
      return { action: 'check' }
    }
    
    // More likely to call with weaker hands
    if (handStrength > potOdds || (handStrength > 0.25 && Math.random() < 0.6)) {
      return { action: 'call' }
    }
    
    return { action: 'fold' }
  }

  evaluateHandStrength(playerCards, communityCards) {
    // Very basic hand strength evaluation
    // In a real game, this would be much more sophisticated
    
    if (!playerCards || playerCards.length < 2) return 0
    
    let strength = 0
    const allCards = [...playerCards, ...communityCards]
    
    // Check for pairs, high cards, etc.
    const ranks = allCards.map(card => this.getRankValue(card.rank))
    const suits = allCards.map(card => card.suit)
    
    // High card value
    const maxRank = Math.max(...ranks.slice(0, 2)) // Only consider hole cards for now
    strength += maxRank / 14 * 0.3
    
    // Pair in hole cards
    if (playerCards[0].rank === playerCards[1].rank) {
      strength += 0.4
    }
    
    // Suited hole cards
    if (playerCards[0].suit === playerCards[1].suit) {
      strength += 0.1
    }
    
    // Connected cards
    const holeRanks = [this.getRankValue(playerCards[0].rank), this.getRankValue(playerCards[1].rank)]
    if (Math.abs(holeRanks[0] - holeRanks[1]) === 1) {
      strength += 0.05
    }
    
    return Math.min(strength, 1)
  }

  getRankValue(rank) {
    const rankValues = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      'J': 11, 'Q': 12, 'K': 13, 'A': 14
    }
    return rankValues[rank] || 0
  }
}

// Auto-play function for AI players
export const processAITurn = (pokerStore) => {
  const { currentPlayer, players, pot, currentBet, communityCards, gamePhase } = pokerStore
  
  if (currentPlayer.id === 1) return // Don't auto-play for human player
  
  console.log(`Processing AI turn for ${currentPlayer.name}`)
  
  const ai = new AIPlayer(currentPlayer.id)
  const gameState = {
    currentBet,
    pot,
    player: currentPlayer,
    communityCards,
    gamePhase
  }
  
  const decision = ai.makeDecision(gameState)
  console.log(`${currentPlayer.name} decided to ${decision.action}`)
  
  // Add a small delay to make it feel more natural but not too slow
  setTimeout(() => {
    switch (decision.action) {
      case 'fold':
        pokerStore.playerFold()
        break
      case 'call':
        pokerStore.playerCall()
        break
      case 'check':
        pokerStore.playerCheck()
        break
      case 'raise':
        pokerStore.playerRaise(decision.amount)
        break
    }
  }, 300 + Math.random() * 700) // Random delay between 0.3-1 seconds
}
