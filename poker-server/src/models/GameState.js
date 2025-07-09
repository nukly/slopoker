/**
 * GameState - Manages the poker game state and phase transitions
 */
class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.communityCards = [];
    this.deck = [];
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.gameStarted = false;
    this.actionsInRound = 0; // Track actions in current betting round
    this.playersToAct = 0; // Track how many players need to act
    this.turnTimeLeft = 0; // Time left for current player in seconds
    this.turnTimer = null; // Timer reference
  }

  nextPhase() {
    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        break;
      case 'flop':
        this.phase = 'turn';
        break;
      case 'turn':
        this.phase = 'river';
        break;
      case 'river':
        this.phase = 'showdown';
        break;
      default:
        this.phase = 'waiting';
    }
    
    // Reset betting for new phase
    this.currentBet = 0;
    this.actionsInRound = 0;
  }

  startGame() {
    this.phase = 'preflop';
    this.pot = 0;
    this.currentBet = this.bigBlind;
    this.gameStarted = true;
    this.actionsInRound = 0;
    this.communityCards = [];
  }

  endGame() {
    this.phase = 'waiting';
    this.gameStarted = false;
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayerIndex = 0;
    this.communityCards = [];
    this.deck = [];
    this.actionsInRound = 0;
    this.playersToAct = 0;
    this.turnTimeLeft = 0;
  }

  getCleanState() {
    return {
      phase: this.phase,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      communityCards: this.communityCards,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      gameStarted: this.gameStarted,
      actionsInRound: this.actionsInRound,
      playersToAct: this.playersToAct,
      turnTimeLeft: this.turnTimeLeft
    };
  }
}

module.exports = GameState;
