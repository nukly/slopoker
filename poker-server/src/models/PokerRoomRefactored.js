const GameState = require('./GameState');
const PlayerManager = require('./PlayerManager');
const DeckManager = require('./DeckManager');
const BettingManager = require('./BettingManager');
const TurnManager = require('./TurnManager');
const ShowdownManager = require('./ShowdownManager');

/**
 * PokerRoom - Main orchestrator that coordinates all poker game components
 * This class is now much smaller and focused on coordination rather than implementation
 */
class PokerRoom {
  constructor(roomId, ioInstance) {
    this.roomId = roomId;
    this.io = ioInstance;
    
    // Initialize all managers
    this.gameState = new GameState();
    this.playerManager = new PlayerManager();
    this.deckManager = new DeckManager();
    this.bettingManager = new BettingManager();
    this.turnManager = new TurnManager();
    this.showdownManager = new ShowdownManager();
    
    this.turnTimeLimit = 30; // 30 seconds per turn
    
    // Room settings - configurable game parameters
    this.settings = {
      autoRebuy: false,              // Whether to automatically give chips to broke players
      rebuyAmount: 1000,            // Amount of chips to give on auto-rebuy
      showdownDuration: 7000,       // How long to show showdown results (ms) - minimum 5 seconds
      handEndDelay: 3000,           // Delay before starting next hand (ms)
      minChipsToPlay: 10,           // Minimum chips required to play (should be at least big blind)
      maxRebuyCount: -1,            // Max rebuys per player (-1 = unlimited)
      blindIncreaseInterval: 0      // Rounds after which blinds increase (0 = never)
    };
    
    // Track rebuy count per player
    this.playerRebuyCount = new Map();
  }

  addPlayer(socketId, playerData) {
    const playerId = this.playerManager.addPlayer(socketId, playerData);

    // Auto-start game if we have 2+ players and game is not running
    const connectedPlayers = this.playerManager.getConnectedPlayers();
    console.log(`Player added. Connected players: ${connectedPlayers.length}, Game started: ${this.gameState.gameStarted}, Phase: ${this.gameState.phase}`);
    
    if (connectedPlayers.length >= 2 && !this.gameState.gameStarted && this.gameState.phase === 'waiting') {
      console.log(`Auto-starting game with ${connectedPlayers.length} players`);
      setTimeout(() => {
        console.log('Executing auto-start game...');
        this.startGame();
      }, 1000);
    } else if (this.gameState.gameStarted && this.gameState.phase !== 'waiting') {
      // If a player joins mid-hand, validate the current player index
      console.log(`Player ${playerData.name} joined mid-hand, validating current player index...`);
      this.validateAndFixCurrentPlayer();
    }

    return playerId;
  }

  removePlayer(socketId) {
    const player = this.playerManager.removePlayer(socketId);
    if (player) {
      const wasCurrentPlayer = this.gameState.gameStarted && 
                              this.gameState.phase !== 'waiting' && 
                              this.getCurrentPlayer()?.socketId === socketId;
      
      // If it was the current player's turn, automatically fold them and advance turn
      if (wasCurrentPlayer) {
        console.log(`Current player ${player.name} disconnected, folding and advancing turn`);
        player.folded = true;
        
        // Check if game should end early (only 1 player left)
        const activePlayers = this.getActivePlayers().filter(p => !p.folded);
        if (activePlayers.length <= 1) {
          this.endHandEarly();
          return;
        }
        
        // Advance to next player
        this.nextPlayer();
      } else if (this.gameState.gameStarted && this.gameState.phase !== 'waiting') {
        // If any player leaves during a hand, validate the current player index
        console.log(`Player ${player.name} left during hand, validating current player index...`);
        this.validateAndFixCurrentPlayer();
      }
    }
    
    // Don't actually delete during game - just mark as disconnected
    if (this.gameState.phase === 'waiting') {
      this.playerManager.deletePlayer(socketId);
    }
  }

  getPlayers() {
    return this.playerManager.getPlayers();
  }

  getConnectedPlayers() {
    return this.playerManager.getConnectedPlayers();
  }

  getActivePlayers() {
    return this.playerManager.getActivePlayers(this.gameState.gameStarted, this.gameState.phase);
  }

  getCurrentPlayer() {
    const players = this.gameState.gameStarted && this.gameState.phase !== 'waiting' 
      ? this.getActivePlayers() 
      : this.getConnectedPlayers();
    
    console.log(`getCurrentPlayer: gameStarted=${this.gameState.gameStarted}, phase=${this.gameState.phase}`);
    console.log(`Players array length: ${players.length}, currentPlayerIndex: ${this.gameState.currentPlayerIndex}`);
    
    // Validate current player index if game is active
    if (this.gameState.gameStarted && this.gameState.phase !== 'waiting' && players.length > 0) {
      this.validateAndFixCurrentPlayer();
    }
    
    if (players.length > 0) {
      players.forEach((player, index) => {
        console.log(`  Player ${index}: ${player.name} (inCurrentHand: ${player.inCurrentHand}, cards: ${player.cards.length})`);
      });
    }
    
    if (players.length === 0 || this.gameState.currentPlayerIndex >= players.length) {
      console.log(`getCurrentPlayer: returning null (no players or index out of bounds)`);
      return null;
    }
    
    const currentPlayer = players[this.gameState.currentPlayerIndex];
    console.log(`getCurrentPlayer: returning ${currentPlayer.name} (inCurrentHand: ${currentPlayer.inCurrentHand})`);
    return currentPlayer;
  }

  validateAndFixCurrentPlayer() {
    const activePlayers = this.getActivePlayers();
    const result = this.turnManager.validateCurrentPlayerIndex(activePlayers, this.gameState.currentPlayerIndex);
    this.gameState.currentPlayerIndex = result.index;
  }

  startGame() {
    console.log('startGame() called');
    
    // Reset player hand state
    this.playerManager.resetHandState();
    
    const eligiblePlayers = this.playerManager.getConnectedPlayers().filter(p => !p.sittingOut);
    console.log(`Eligible players: ${eligiblePlayers.length}`);
    
    if (eligiblePlayers.length < 2) {
      console.log('Not enough eligible players to start game');
      return false;
    }

    // Initialize game components
    this.gameState.startGame();
    this.gameState.deck = this.deckManager.createDeck();
    this.playerManager.markPlayersInHand(eligiblePlayers);

    const activePlayers = this.getActivePlayers();
    console.log(`Active players for this hand: ${activePlayers.length}`);

    // Deal hole cards
    this.dealHoleCards(activePlayers);

    // Post blinds and set initial positions
    this.postBlinds(activePlayers);

    // Safety check for negative chips
    this.playerManager.ensureValidChips();

    console.log(`Game started with ${activePlayers.length} players`);

    // Start the turn timer for the first player
    this.startTurnTimer();

    // Emit game updates
    this.emitGameUpdate('gameStarted');
    
    return true;
  }

  dealHoleCards(activePlayers) {
    for (let i = 0; i < 2; i++) {
      activePlayers.forEach(player => {
        const card = this.deckManager.dealCard();
        if (card) {
          player.cards.push(card);
        }
      });
    }
  }

  postBlinds(activePlayers) {
    const positions = this.turnManager.getBlindPositions(activePlayers, this.gameState.dealerIndex);
    
    const smallBlindPlayer = activePlayers[positions.smallBlindPos];
    const bigBlindPlayer = activePlayers[positions.bigBlindPos];

    // Post small blind (or all-in if insufficient chips)
    const smallBlindAmount = Math.min(this.gameState.smallBlind, smallBlindPlayer.chips);
    smallBlindPlayer.bet = smallBlindAmount;
    smallBlindPlayer.chips -= smallBlindAmount;

    // Post big blind (or all-in if insufficient chips)
    const bigBlindAmount = Math.min(this.gameState.bigBlind, bigBlindPlayer.chips);
    bigBlindPlayer.bet = bigBlindAmount;
    bigBlindPlayer.chips -= bigBlindAmount;

    this.gameState.pot = smallBlindAmount + bigBlindAmount;
    this.gameState.currentBet = Math.max(smallBlindAmount, bigBlindAmount);

    // Set first player to act
    this.gameState.currentPlayerIndex = positions.firstToActPos;
    this.gameState.actionsInRound = 0;
    this.gameState.playersToAct = activePlayers.length;

    console.log(`Blinds posted: Small blind ${smallBlindAmount} by ${smallBlindPlayer.name}, Big blind ${bigBlindAmount} by ${bigBlindPlayer.name}`);
    console.log(`First to act: ${activePlayers[positions.firstToActPos].name} (pos ${positions.firstToActPos})`);
  }

  playerAction(socketId, action, amount = 0) {
    const player = this.playerManager.getPlayer(socketId);
    if (!player || !this.gameState.gameStarted) {
      console.log(`Action rejected: player not found or game not started`);
      return false;
    }

    const activePlayers = this.getActivePlayers();
    const currentPlayer = activePlayers[this.gameState.currentPlayerIndex];
    
    if (!currentPlayer || currentPlayer.socketId !== socketId) {
      console.log(`Action rejected: not player's turn. Current: ${currentPlayer?.name}, Acting: ${player.name}`);
      return false;
    }

    console.log(`Processing ${action} by ${player.name} (current bet: ${player.bet}, table bet: ${this.gameState.currentBet})`);

    // Process the action using BettingManager
    const success = this.bettingManager.processPlayerAction(player, action, amount, this.gameState);
    
    if (!success) {
      return false;
    }

    // Special handling for fold
    if (action === 'fold') {
      const remainingActivePlayers = this.getActivePlayers().filter(p => !p.folded);
      if (remainingActivePlayers.length === 1) {
        console.log(`Only one player remains after fold, ending hand early`);
        this.gameState.actionsInRound++;
        this.endHandEarly();
        return true;
      }
    }

    // Track that this player has acted
    this.gameState.actionsInRound++;

    // Clear turn timer since player acted
    this.clearTurnTimer();

    // Safety check for negative chips
    this.playerManager.ensureValidChips();

    // Move to next player
    this.nextPlayer();
    return true;
  }

  nextPlayer() {
    console.log(`nextPlayer() called`);
    
    // Validate current player index before proceeding
    this.validateAndFixCurrentPlayer();
    
    const activePlayers = this.getActivePlayers();
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);

    console.log(`Active players: ${activePlayers.length}, Non-folded: ${nonFoldedPlayers.length}`);
    activePlayers.forEach((player, index) => {
      console.log(`  Active player ${index}: ${player.name} (inCurrentHand: ${player.inCurrentHand}, folded: ${player.folded}, chips: ${player.chips})`);
    });

    const result = this.turnManager.findNextPlayer(activePlayers, this.gameState.currentPlayerIndex);
    
    if (result.endHand) {
      this.endHandEarly();
      return;
    }
    
    if (result.nextPhase) {
      console.log(`Betting round complete, moving to next phase`);
      this.nextPhase();
      return;
    }

    // Move to the next player
    this.gameState.currentPlayerIndex = result.nextIndex;
    console.log(`Turn moved to: ${result.player.name} (pos ${result.nextIndex}) - ${result.player.chips} chips remaining`);

    // Check if betting round is complete AFTER moving to next player
    if (this.bettingManager.isBettingRoundComplete(activePlayers, this.gameState)) {
      console.log(`Betting round complete, moving to next phase`);
      this.nextPhase();
      return;
    }

    // If the next player can't act (all-in), check if round is complete and skip to next player
    if (result.player.chips === 0) {
      console.log(`Next player ${result.player.name} is all-in, checking if round complete`);
      if (this.bettingManager.isBettingRoundComplete(activePlayers, this.gameState)) {
        console.log(`Betting round complete, moving to next phase`);
        this.nextPhase();
        return;
      } else {
        // Skip to next player who can act
        this.nextPlayer();
        return;
      }
    }

    // Start timer for the new current player
    this.startTurnTimer();
  }

  nextPhase() {
    const activePlayers = this.getActivePlayers();
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);
    const allPlayersAllIn = nonFoldedPlayers.every(p => p.chips === 0);
    
    if (allPlayersAllIn && nonFoldedPlayers.length > 1) {
      console.log('All players are all-in, dealing remaining community cards and going to showdown');
      this.dealRemainingCommunityCards();
      this.bettingManager.resetBetsForNewRound(activePlayers);
      this.gameState.currentBet = 0;
      
      this.emitGameUpdate('gameUpdate');
      
      setTimeout(() => {
        this.gameState.phase = 'showdown';
        this.showdown();
      }, 2000);
      return;
    }

    this.bettingManager.resetBetsForNewRound(activePlayers);
    this.gameState.nextPhase();

    // Deal community cards based on phase
    this.dealCommunityCards();

    if (this.gameState.phase === 'showdown') {
      this.showdown();
      return;
    }

    // Set first player for new phase
    const firstActivePos = this.turnManager.getFirstPlayerForPhase(activePlayers, this.gameState.dealerIndex, this.gameState.phase);
    this.gameState.currentPlayerIndex = firstActivePos;
    
    console.log(`Phase changed to ${this.gameState.phase}, first to act: ${activePlayers[firstActivePos].name} (pos ${firstActivePos})`);
    
    this.startTurnTimer();
  }

  dealCommunityCards() {
    switch (this.gameState.phase) {
      case 'flop':
        for (let i = 0; i < 3; i++) {
          const card = this.deckManager.dealCard();
          if (card) this.gameState.communityCards.push(card);
        }
        break;
      case 'turn':
      case 'river':
        const card = this.deckManager.dealCard();
        if (card) this.gameState.communityCards.push(card);
        break;
    }
  }

  dealRemainingCommunityCards() {
    while (this.gameState.communityCards.length < 5) {
      const card = this.deckManager.dealCard();
      if (card) {
        this.gameState.communityCards.push(card);
      } else {
        break;
      }
    }
  }

  showdown() {
    console.log('Starting showdown phase...');
    this.gameState.phase = 'showdown';
    
    const activePlayers = this.getActivePlayers().filter(p => !p.folded);
    const showdownResult = this.showdownManager.evaluateHands(activePlayers, this.gameState.communityCards);
    
    if (!showdownResult) return;

    let distributionResult;
    let handEvaluations;

    if (showdownResult.type === 'single' && showdownResult.reason) {
      // Single winner by default (everyone else folded)
      showdownResult.winner.chips += this.gameState.pot;
      distributionResult = {
        type: 'single',
        winner: showdownResult.winner.name,
        winAmount: this.gameState.pot,
        reason: showdownResult.reason
      };
    } else {
      // Normal showdown with hand evaluation
      distributionResult = this.showdownManager.distributePot(this.gameState.pot, showdownResult.winners);
      handEvaluations = showdownResult.handEvaluations;
    }

    // Emit showdown results with winner info in gameState for frontend compatibility
    console.log('DEBUG: About to emit showdown result with custom gameState...');
    console.log('DEBUG: distributionResult:', distributionResult);
    
    if (this.io) {
      const gameStateWithWinner = {
        ...this.getCleanGameState(),
        winner: distributionResult.winner || (distributionResult.winners ? distributionResult.winners[0] : null),
        winAmount: distributionResult.winAmount,
        winningHand: distributionResult.winningHand,
        splitPot: distributionResult.splitPot || false
      };
      
      console.log('DEBUG: gameStateWithWinner:', gameStateWithWinner);
      
      const data = {
        gameState: gameStateWithWinner,
        players: this.getCleanPlayers(),
        showdownResult: distributionResult,
        handEvaluations
      };
      
      console.log('DEBUG: Emitting showdownResult with data.gameState.winner:', data.gameState.winner);
      
      this.io.to(this.roomId).emit('showdownResult', data);
      this.io.to(this.roomId).emit('gameUpdate', data);
    }

    // Wait for configurable showdown duration to show results before ending hand
    setTimeout(() => {
      // Emit hand ended event
      if (this.io) {
        const event = this.showdownManager.createHandEndedEvent(
          distributionResult, 
          handEvaluations,
          this.getCleanGameState(), 
          this.getCleanPlayers()
        );
        this.io.to(this.roomId).emit('handEnded', event);
      }

      this.resetForNextHand();
      
      // Wait for configurable delay before starting next hand
      setTimeout(() => this.startNextHand(), this.settings.handEndDelay);
    }, this.settings.showdownDuration);
  }

  endHandEarly() {
    console.log('Ending hand early - only one player remains');
    
    const activePlayers = this.getActivePlayers().filter(p => !p.folded);
    if (activePlayers.length !== 1) {
      console.log(`Warning: endHandEarly called but ${activePlayers.length} active players remain`);
      return;
    }
    
    const winner = activePlayers[0];
    console.log(`${winner.name} wins the pot of ${this.gameState.pot} (everyone else folded)`);
    
    winner.chips += this.gameState.pot;
    
    this.emitGameUpdate('handEnded', {
      winner: winner.name,
      winAmount: this.gameState.pot,
      reason: 'All other players folded'
    });
    
    this.resetForNextHand();
    setTimeout(() => this.startNextHand(), this.settings.handEndDelay);
  }

  resetForNextHand() {
    // Move dealer button
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length >= 2) {
      this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % activePlayers.length;
    }
    
    this.gameState.endGame();
    this.deckManager.reset();
    this.playerManager.clearCurrentHand();
    this.clearTurnTimer();
  }

  startNextHand() {
    const connectedPlayers = this.getConnectedPlayers();
    
    // Handle broke players based on settings
    connectedPlayers.forEach(player => {
      // Check if player needs a rebuy (has insufficient chips to play)
      const needsRebuy = player.chips <= this.settings.minChipsToPlay;
      
      if (needsRebuy) {
        if (this.settings.autoRebuy) {
          this.performRebuy(player);
        } else {
          console.log(`${player.name} has ${player.chips} chips (needs more than ${this.settings.minChipsToPlay}) but auto-rebuy is disabled`);
        }
      }
    });
    
    // Only start if we have enough players with sufficient chips to play
    const playersWithChips = connectedPlayers.filter(p => p.chips > this.settings.minChipsToPlay);
    
    if (playersWithChips.length >= 2) {
      console.log(`Starting next hand with ${playersWithChips.length} players...`);
      this.startGame();
    } else {
      console.log(`Not enough players with sufficient chips for next hand (${playersWithChips.length}/2), waiting...`);
      
      // Notify players why the game isn't starting
      if (connectedPlayers.length >= 2 && playersWithChips.length < 2) {
        this.emitGameUpdate('waitingForPlayers', {
          reason: 'Players need more chips to continue',
          autoRebuy: this.settings.autoRebuy,
          minChips: this.settings.minChipsToPlay
        });
      }
    }
  }

  startTurnTimer() {
    this.clearTurnTimer();
    
    if (!this.gameState.gameStarted || this.gameState.phase === 'waiting' || this.gameState.phase === 'showdown') {
      return;
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.chips === 0) {
      return;
    }

    this.gameState.turnTimeLeft = this.turnTimeLimit;
    
    if (this.io) {
      this.io.to(this.roomId).emit('turnTimer', {
        timeLeft: this.gameState.turnTimeLeft,
        currentPlayer: currentPlayer.socketId
      });
    }

    this.gameState.turnTimer = setInterval(() => {
      this.gameState.turnTimeLeft--;
      
      if (this.io) {
        this.io.to(this.roomId).emit('turnTimer', {
          timeLeft: this.gameState.turnTimeLeft,
          currentPlayer: currentPlayer.socketId
        });
      }
      
      if (this.gameState.turnTimeLeft <= 0) {
        console.log(`Time expired for ${currentPlayer.name}, auto-folding`);
        this.clearTurnTimer();
        this.playerAction(currentPlayer.socketId, 'fold');
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.gameState.turnTimer) {
      clearInterval(this.gameState.turnTimer);
      this.gameState.turnTimer = null;
    }
    this.gameState.turnTimeLeft = 0;
  }

  emitGameUpdate(eventType, additionalData = {}) {
    if (this.io) {
      const data = {
        gameState: this.getCleanGameState(),
        players: this.getCleanPlayers(),
        ...additionalData
      };
      
      this.io.to(this.roomId).emit(eventType, data);
      
      if (eventType !== 'gameUpdate') {
        this.io.to(this.roomId).emit('gameUpdate', data);
      }
    }
  }

  getCleanGameState() {
    return this.gameState.getCleanState();
  }

  getCleanPlayers() {
    return this.playerManager.getCleanPlayers();
  }

  // Settings management methods
  updateSettings(newSettings) {
    console.log('Updating room settings:', newSettings);
    
    // Validate and merge settings
    const validKeys = Object.keys(this.settings);
    const updates = {};
    
    for (const [key, value] of Object.entries(newSettings)) {
      if (validKeys.includes(key)) {
        // Apply validation rules
        if (key === 'showdownDuration' && value < 5000) {
          console.warn(`Showdown duration cannot be less than 5 seconds. Setting to 5000ms.`);
          updates[key] = 5000;
        } else if (key === 'handEndDelay' && value < 1000) {
          console.warn(`Hand end delay cannot be less than 1 second. Setting to 1000ms.`);
          updates[key] = 1000;
        } else if (key === 'rebuyAmount' && value <= 0) {
          console.warn(`Rebuy amount must be positive. Setting to 1000.`);
          updates[key] = 1000;
        } else {
          updates[key] = value;
        }
      } else {
        console.warn(`Invalid setting key: ${key}`);
      }
    }
    
    this.settings = { ...this.settings, ...updates };
    console.log('Updated settings:', this.settings);
    
    // Notify players of settings change
    this.emitGameUpdate('settingsUpdated', { settings: this.settings });
    
    return this.settings;
  }
  
  getSettings() {
    return { ...this.settings };
  }
  
  canPlayerRebuy(player) {
    if (!this.settings.autoRebuy) return false;
    if (player.chips > this.settings.minChipsToPlay) return false;
    
    const rebuyCount = this.playerRebuyCount.get(player.socketId) || 0;
    if (this.settings.maxRebuyCount >= 0 && rebuyCount >= this.settings.maxRebuyCount) {
      return false;
    }
    
    return true;
  }
  
  performRebuy(player) {
    if (!this.canPlayerRebuy(player)) {
      console.log(`${player.name} cannot rebuy (auto-rebuy disabled or limit reached)`);
      return false;
    }
    
    const rebuyCount = this.playerRebuyCount.get(player.socketId) || 0;
    this.playerRebuyCount.set(player.socketId, rebuyCount + 1);
    
    player.chips = this.settings.rebuyAmount;
    console.log(`${player.name} received auto-rebuy: ${this.settings.rebuyAmount} chips (rebuy #${rebuyCount + 1})`);
    
    // Notify players of the rebuy
    this.emitGameUpdate('playerRebuy', {
      playerName: player.name,
      newChips: player.chips,
      rebuyCount: rebuyCount + 1
    });
    
    return true;
  }

  // Manual rebuy handling (for when auto-rebuy is disabled)
  requestRebuy(socketId) {
    const player = this.playerManager.findPlayerBySocketId(socketId);
    if (!player) {
      console.log('Rebuy requested by unknown player');
      return { success: false, error: 'Player not found' };
    }
    
    // Check if player needs a rebuy
    if (player.chips > this.settings.minChipsToPlay) {
      return { success: false, error: 'Player has sufficient chips' };
    }
    
    // Check rebuy limits
    const rebuyCount = this.playerRebuyCount.get(player.socketId) || 0;
    if (this.settings.maxRebuyCount >= 0 && rebuyCount >= this.settings.maxRebuyCount) {
      return { success: false, error: `Maximum rebuy limit reached (${this.settings.maxRebuyCount})` };
    }
    
    // Perform the rebuy
    const success = this.performRebuy(player);
    if (success) {
      return { 
        success: true, 
        newChips: player.chips,
        rebuyCount: this.playerRebuyCount.get(player.socketId)
      };
    } else {
      return { success: false, error: 'Rebuy failed' };
    }
  }

  // Legacy rebuy method for compatibility with old socket handler
  handleRebuy(socketId, buyChips, chipAmount) {
    console.log(`Legacy rebuy: ${socketId}, buyChips: ${buyChips}, amount: ${chipAmount}`);
    
    const player = this.playerManager.findPlayerBySocketId(socketId);
    if (!player) {
      console.log('Rebuy failed: Player not found');
      return false;
    }
    
    if (buyChips === true || buyChips === 'true') {
      // Manual rebuy request
      const result = this.requestRebuy(socketId);
      return result.success;
    } else {
      console.log('Legacy rebuy: Invalid buyChips parameter:', buyChips);
      return false;
    }
  }
}

module.exports = PokerRoom;
