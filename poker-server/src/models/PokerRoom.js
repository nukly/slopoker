const { getBestHand, compareHands, getHandDescription } = require('../utils/handEvaluator');

class PokerRoom {
  constructor(roomId, ioInstance) {
    this.roomId = roomId;
    this.io = ioInstance; // Store reference to socket.io instance
    this.players = new Map();
    this.gameState = {
      phase: 'waiting', // waiting, preflop, flop, turn, river, showdown
      pot: 0,
      currentBet: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      communityCards: [],
      deck: [],
      smallBlind: 10,
      bigBlind: 20,
      gameStarted: false,
      actionsInRound: 0, // Track actions in current betting round
      playersToAct: 0, // Track how many players need to act
      turnTimeLeft: 0, // Time left for current player in seconds
      turnTimer: null // Timer reference
    };
    this.turnTimeLimit = 30; // 30 seconds per turn
  }

  addPlayer(socketId, playerData) {
    const playerId = this.players.size + 1;
    this.players.set(socketId, {
      id: playerId,
      socketId,
      name: playerData.name,
      chips: 1000,
      cards: [],
      folded: false,
      bet: 0,
      isConnected: true,
      sittingOut: false,
      inCurrentHand: false // Track if player is in the current hand
    });

    // Auto-start game if we have 2+ players and game is not running
    const connectedPlayers = this.getConnectedPlayers();
    console.log(`Player added. Connected players: ${connectedPlayers.length}, Game started: ${this.gameState.gameStarted}, Phase: ${this.gameState.phase}`);
    if (connectedPlayers.length >= 2 && !this.gameState.gameStarted && this.gameState.phase === 'waiting') {
      console.log(`Auto-starting game with ${connectedPlayers.length} players`);
      setTimeout(() => {
        console.log('Executing auto-start game...');
        // Create a safe copy of gameState for logging (exclude circular references like timers)
        const safeGameState = { ...this.gameState, turnTimer: null };
        console.log('Current game state before start:', JSON.stringify(safeGameState, null, 2));
        if (this.startGame()) {
          console.log('Game started successfully, emitting to all clients...');
          const safeGameStateAfter = { ...this.gameState, turnTimer: null };
          console.log('Current game state after start:', JSON.stringify(safeGameStateAfter, null, 2));
          if (this.io) {
            // Create clean copies without circular references for emission
            const cleanGameState = this.getCleanGameState();
            const cleanPlayers = this.getCleanPlayers();
            
            this.io.to(this.roomId).emit('gameStarted', {
              gameState: cleanGameState,
              players: cleanPlayers
            });
            
            // Also emit a general game update to ensure all clients sync
            this.io.to(this.roomId).emit('gameUpdate', {
              gameState: cleanGameState,
              players: cleanPlayers
            });
          }
        } else {
          console.log('Failed to start game');
        }
      }, 1000); // 1 second delay to let UI update
    } else if (this.gameState.gameStarted && this.gameState.phase !== 'waiting') {
      // If a player joins mid-hand, validate the current player index
      console.log(`Player ${playerData.name} joined mid-hand, validating current player index...`);
      this.validateCurrentPlayerIndex();
    }

    return playerId;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      const wasCurrentPlayer = this.gameState.gameStarted && 
                              this.gameState.phase !== 'waiting' && 
                              this.getCurrentPlayer()?.socketId === socketId;
      
      player.isConnected = false;
      
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
        this.validateCurrentPlayerIndex();
      }
    }
    
    // Don't actually delete during game - just mark as disconnected
    if (this.gameState.phase === 'waiting') {
      this.players.delete(socketId);
    }
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getConnectedPlayers() {
    return Array.from(this.players.values()).filter(p => p.isConnected);
  }

  getActivePlayers() {
    // During a game, only return players who are in the current hand
    if (this.gameState.gameStarted && this.gameState.phase !== 'waiting') {
      return Array.from(this.players.values()).filter(p => p.isConnected && p.inCurrentHand);
    }
    // When waiting or not in a game, return all connected non-sitting-out players
    return Array.from(this.players.values()).filter(p => p.isConnected && !p.sittingOut);
  }

  createDeck() {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: `${rank}${suit}` });
      }
    }
    return this.shuffleDeck(deck);
  }

  shuffleDeck(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  startGame() {
    console.log('startGame() called');
    // First reset all players' hand state
    this.resetHandState();
    
    const eligiblePlayers = Array.from(this.players.values()).filter(p => p.isConnected && !p.sittingOut);
    console.log(`Eligible players: ${eligiblePlayers.length}`);
    if (eligiblePlayers.length < 2) {
      console.log('Not enough eligible players to start game');
      return false;
    }

    console.log('Resetting game state...');
    // Reset game state
    this.gameState.pot = 0;
    this.gameState.currentBet = this.gameState.bigBlind;
    this.gameState.phase = 'preflop';
    this.gameState.communityCards = [];
    this.gameState.deck = this.createDeck();
    this.gameState.gameStarted = true;

    console.log('Marking players as in current hand...');
    // Mark eligible players as in current hand and reset their hand state
    eligiblePlayers.forEach(player => {
      player.inCurrentHand = true;
      player.cards = [];
      player.folded = false;
      player.bet = 0;
      console.log(`Player ${player.name} is now in current hand`);
    });

    const activePlayers = this.getActivePlayers(); // Now only returns players in current hand
    console.log(`Active players for this hand: ${activePlayers.length}`);
    activePlayers.forEach((player, index) => {
      console.log(`Active player ${index}: ${player.name}`);
    });

    // Deal cards
    for (let i = 0; i < 2; i++) {
      activePlayers.forEach(player => {
        if (this.gameState.deck.length > 0) {
          player.cards.push(this.gameState.deck.pop());
        }
      });
    }

    // Post blinds
    const dealerPos = this.gameState.dealerIndex % activePlayers.length;
    
    let smallBlindPos, bigBlindPos, firstToActPos;
    
    if (activePlayers.length === 2) {
      // Heads-up: dealer is small blind, other player is big blind
      smallBlindPos = dealerPos;
      bigBlindPos = (dealerPos + 1) % activePlayers.length;
      firstToActPos = dealerPos; // Dealer acts first preflop in heads-up
    } else {
      // 3+ players: normal blind structure
      smallBlindPos = (dealerPos + 1) % activePlayers.length;
      bigBlindPos = (dealerPos + 2) % activePlayers.length;
      firstToActPos = (dealerPos + 3) % activePlayers.length;
    }

    const smallBlindPlayer = activePlayers[smallBlindPos];
    const bigBlindPlayer = activePlayers[bigBlindPos];

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

    console.log(`Blinds posted: Small blind ${smallBlindAmount} by ${smallBlindPlayer.name}, Big blind ${bigBlindAmount} by ${bigBlindPlayer.name}`);
    if (smallBlindAmount < this.gameState.smallBlind) {
      console.log(`${smallBlindPlayer.name} is all-in for small blind`);
    }
    if (bigBlindAmount < this.gameState.bigBlind) {
      console.log(`${bigBlindPlayer.name} is all-in for big blind`);
    }

    // Safety check for negative chips
    this.ensureValidChips();

    // Set first player to act
    this.gameState.currentPlayerIndex = firstToActPos;
    
    // Initialize betting round tracking
    this.gameState.actionsInRound = 0;
    this.gameState.playersToAct = activePlayers.length;
    
    console.log(`Game started with ${activePlayers.length} players`);
    console.log(`Dealer: ${activePlayers[dealerPos].name} (pos ${dealerPos})`);
    console.log(`Small Blind: ${smallBlindPlayer.name} (pos ${smallBlindPos})`);
    console.log(`Big Blind: ${bigBlindPlayer.name} (pos ${bigBlindPos})`);
    console.log(`First to act: ${activePlayers[firstToActPos].name} (pos ${firstToActPos})`);

    // Start the turn timer for the first player
    this.startTurnTimer();

    return true;
  }

  playerAction(socketId, action, amount = 0) {
    const player = this.players.get(socketId);
    if (!player || !this.gameState.gameStarted) {
      console.log(`Action rejected: player not found or game not started`);
      return false;
    }

    const activePlayers = this.getActivePlayers();
    const currentPlayer = activePlayers[this.gameState.currentPlayerIndex];
    
    if (!currentPlayer || currentPlayer.socketId !== socketId) {
      console.log(`Action rejected: not player's turn. Current: ${currentPlayer?.name}, Acting: ${player.name}`);
      return false; // Not player's turn
    }

    console.log(`Processing ${action} by ${player.name} (current bet: ${player.bet}, table bet: ${this.gameState.currentBet})`);

    switch (action) {
      case 'fold':
        player.folded = true;
        console.log(`${player.name} folded`);
        
        // Check if only one player remains after fold
        const remainingActivePlayers = this.getConnectedPlayers().filter(p => !p.folded);
        if (remainingActivePlayers.length === 1) {
          console.log(`Only one player remains after fold, ending hand early`);
          // Track that this player has acted before ending hand
          this.gameState.actionsInRound++;
          this.endHandEarly();
          return true;
        }
        break;
      case 'call':
        const callAmount = this.gameState.currentBet - player.bet;
        if (player.chips >= callAmount) {
          // Player has enough chips to call the full amount
          player.chips -= callAmount;
          player.bet += callAmount;
          this.gameState.pot += callAmount;
          console.log(`${player.name} called ${callAmount}, total bet now ${player.bet}`);
        } else if (player.chips > 0) {
          // Player doesn't have enough for full call - go all-in with remaining chips
          const allInAmount = player.chips;
          player.bet += allInAmount;
          this.gameState.pot += allInAmount;
          player.chips = 0; // All-in
          console.log(`${player.name} called all-in with ${allInAmount} (insufficient chips for full call of ${callAmount}), total bet now ${player.bet}`);
        } else {
          console.log(`${player.name} cannot call - no chips remaining`);
          return false;
        }
        break;
      case 'check':
        // Only allowed if no bet to call
        if (player.bet < this.gameState.currentBet) {
          console.log(`${player.name} cannot check - must call ${this.gameState.currentBet - player.bet}`);
          return false;
        }
        console.log(`${player.name} checked`);
        break;
      case 'raise':
        // amount represents the total chips the player wants to put into this round
        const raiseCallAmount = this.gameState.currentBet - player.bet;
        
        if (amount <= player.chips && amount > 0) {
          if (amount === player.chips) {
            // Player is going all-in
            const newTotalBet = player.bet + amount;
            player.chips = 0;
            this.gameState.pot += amount;
            player.bet = newTotalBet;
            
            // Only update table bet if this all-in is actually higher than current bet
            if (newTotalBet > this.gameState.currentBet) {
              this.gameState.currentBet = newTotalBet;
              console.log(`${player.name} went all-in for ${amount}, new table bet ${newTotalBet}`);
            } else {
              console.log(`${player.name} went all-in for ${amount}, total bet ${newTotalBet} (no bet increase)`);
            }
          } else {
            // Regular raise - must be at least a call + minimum raise
            const minRaiseAmount = raiseCallAmount + this.gameState.bigBlind;
            if (amount >= minRaiseAmount) {
              const newTotalBet = player.bet + amount;
              player.chips -= amount;
              player.bet = newTotalBet;
              this.gameState.currentBet = newTotalBet;
              this.gameState.pot += amount;
              console.log(`${player.name} raised to ${newTotalBet} (bet ${amount})`);
            } else {
              console.log(`${player.name} cannot raise - minimum raise is ${minRaiseAmount} (call ${raiseCallAmount} + big blind ${this.gameState.bigBlind})`);
              return false;
            }
          }
        } else {
          console.log(`${player.name} cannot raise - insufficient chips or invalid amount`);
          return false;
        }
        break;
      default:
        console.log(`Unknown action: ${action}`);
        return false;
    }

    // Track that this player has acted
    this.gameState.actionsInRound++;

    // Clear turn timer since player acted
    this.clearTurnTimer();

    // Safety check for negative chips
    this.ensureValidChips();

    // Move to next player
    this.nextPlayer();
    return true;
  }

  nextPlayer() {
    console.log(`nextPlayer() called`);
    
    // Validate current player index before proceeding
    this.validateCurrentPlayerIndex();
    
    const activePlayers = this.getActivePlayers(); // Use active players instead of connected
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);

    console.log(`Active players: ${activePlayers.length}, Non-folded: ${nonFoldedPlayers.length}`);
    activePlayers.forEach((player, index) => {
      console.log(`  Active player ${index}: ${player.name} (inCurrentHand: ${player.inCurrentHand}, folded: ${player.folded}, chips: ${player.chips})`);
    });

    // Check if only one player remains
    if (nonFoldedPlayers.length === 1) {
      this.endHandEarly();
      return;
    }

    // Check if all active players are all-in - if so, skip directly to next phase
    const allPlayersAllIn = nonFoldedPlayers.every(p => p.chips === 0);
    if (allPlayersAllIn) {
      console.log('All active players are all-in, proceeding to next phase');
      this.nextPhase();
      return;
    }

    // Find next active player who can still act (not folded and has chips)
    let nextIndex = (this.gameState.currentPlayerIndex + 1) % activePlayers.length;
    let attempts = 0;
    
    console.log(`Starting turn search from index ${nextIndex}`);
    
    while (attempts < activePlayers.length) {
      const nextPlayer = activePlayers[nextIndex];
      
      console.log(`Checking player ${nextIndex}: ${nextPlayer.name} (folded: ${nextPlayer.folded}, chips: ${nextPlayer.chips}, inCurrentHand: ${nextPlayer.inCurrentHand})`);
      
      // Skip if player is folded or all-in (has no chips to bet)
      if (!nextPlayer.folded && nextPlayer.chips > 0) {
        console.log(`Found player who can act: ${nextPlayer.name}`);
        break; // Found a player who can act
      }
      
      if (nextPlayer.folded) {
        console.log(`Skipping ${nextPlayer.name} - folded`);
      } else if (nextPlayer.chips === 0) {
        console.log(`Skipping ${nextPlayer.name} - all-in (0 chips)`);
      }
      
      nextIndex = (nextIndex + 1) % activePlayers.length;
      attempts++;
    }
    
    // If we've checked all players and none can act, the betting round is complete
    if (attempts >= activePlayers.length) {
      console.log('No players can act further, proceeding to next phase');
      this.nextPhase();
      return;
    }

    this.gameState.currentPlayerIndex = nextIndex;
    
    console.log(`Turn moved to: ${activePlayers[nextIndex].name} (pos ${nextIndex}) - ${activePlayers[nextIndex].chips} chips remaining`);

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      console.log(`Betting round complete, moving to next phase`);
      this.nextPhase();
    } else {
      // Start timer for the new current player
      this.startTurnTimer();
    }
  }

  isBettingRoundComplete() {
    const activePlayers = this.getActivePlayers(); // Use active players consistently
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

    // Check if there's at least one player who can still act (has chips and hasn't matched the bet)
    const playersWhoCanAct = nonFoldedPlayers.filter(p => p.chips > 0 && p.bet < this.gameState.currentBet);
    if (playersWhoCanAct.length === 0) {
      console.log('No players can act further, betting round complete');
      return true;
    }

    // For betting round to be complete, all active players must have:
    // 1. Matched the current bet, OR
    // 2. Be all-in (chips === 0)
    
    const allMatchedBet = nonFoldedPlayers.every(p => p.bet === this.gameState.currentBet || p.chips === 0);
    
    if (!allMatchedBet) {
      return false;
    }
    
    // Check if all active players have had at least one action in this round
    // The minimum actions needed should account for the current number of active players
    const minActionsNeeded = nonFoldedPlayers.length;
    
    console.log(`Actions in round: ${this.gameState.actionsInRound}, non-folded players: ${nonFoldedPlayers.length}, needed: ${minActionsNeeded}`);
    
    // Special case: if we're in heads-up and both players have acted at least once, end the round
    if (nonFoldedPlayers.length === 2 && this.gameState.actionsInRound >= 2) {
      return true;
    }
    
    // For more than 2 players, ensure everyone has acted
    if (this.gameState.actionsInRound < minActionsNeeded) {
      return false;
    }
    
    return true;
  }

  nextPhase() {
    // Check if all active players are all-in - if so, skip to showdown
    const activePlayers = this.getActivePlayers(); // Use active players consistently
    const nonFoldedPlayers = activePlayers.filter(p => !p.folded);
    const allPlayersAllIn = nonFoldedPlayers.every(p => p.chips === 0);
    
    if (allPlayersAllIn && nonFoldedPlayers.length > 1) {
      console.log('All players are all-in, dealing remaining community cards and going to showdown');
      
      // Deal all remaining community cards at once
      while (this.gameState.communityCards.length < 5 && this.gameState.deck.length > 0) {
        this.gameState.communityCards.push(this.gameState.deck.pop());
      }
      
      // Reset bets for showdown display
      activePlayers.forEach(player => {
        player.bet = 0;
      });
      this.gameState.currentBet = 0;
      
      // Emit game update to show all community cards
      if (this.io) {
        this.io.to(this.roomId).emit('gameUpdate', {
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
      
      // Wait a moment for players to see the cards, then go to showdown
      setTimeout(() => {
        this.gameState.phase = 'showdown';
        this.showdown();
      }, 2000); // 2 second delay to show the cards
      return;
    }

    // Reset bets for next round
    activePlayers.forEach(player => {
      player.bet = 0;
    });
    this.gameState.currentBet = 0;
    
    // Reset action tracking for new betting round
    this.gameState.actionsInRound = 0;

    switch (this.gameState.phase) {
      case 'preflop':
        // Deal flop (3 cards)
        for (let i = 0; i < 3; i++) {
          if (this.gameState.deck.length > 0) {
            this.gameState.communityCards.push(this.gameState.deck.pop());
          }
        }
        this.gameState.phase = 'flop';
        break;
      case 'flop':
        // Deal turn (1 card)
        if (this.gameState.deck.length > 0) {
          this.gameState.communityCards.push(this.gameState.deck.pop());
        }
        this.gameState.phase = 'turn';
        break;
      case 'turn':
        // Deal river (1 card)
        if (this.gameState.deck.length > 0) {
          this.gameState.communityCards.push(this.gameState.deck.pop());
        }
        this.gameState.phase = 'river';
        break;
      case 'river':
        this.gameState.phase = 'showdown';
        this.showdown();
        return;
    }

    // Set first player for post-flop betting
    const dealerPos = this.gameState.dealerIndex % activePlayers.length;
    
    let firstActivePos;
    
    if (activePlayers.length === 2) {
      // Heads-up: big blind (non-dealer) acts first post-flop
      firstActivePos = (dealerPos + 1) % activePlayers.length;
    } else {
      // 3+ players: first player after dealer acts first
      firstActivePos = (dealerPos + 1) % activePlayers.length;
    }
    
    // Find first non-folded player starting from the calculated position
    while (activePlayers[firstActivePos].folded && firstActivePos !== dealerPos) {
      firstActivePos = (firstActivePos + 1) % activePlayers.length;
    }
    
    this.gameState.currentPlayerIndex = firstActivePos;
    
    console.log(`Phase changed to ${this.gameState.phase}, first to act: ${activePlayers[firstActivePos].name} (pos ${firstActivePos})`);
    
    // Start timer for the new phase
    this.startTurnTimer();
  }

  /**
   * Ends the hand early when only one player remains (others folded or disconnected)
   */
  endHandEarly() {
    console.log('Ending hand early - only one player remains');
    
    const activePlayers = this.getActivePlayers().filter(p => !p.folded);
    if (activePlayers.length !== 1) {
      console.log(`Warning: endHandEarly called but ${activePlayers.length} active players remain`);
      return;
    }
    
    const winner = activePlayers[0];
    console.log(`${winner.name} wins the pot of ${this.gameState.pot} (everyone else folded)`);
    
    // Award the pot to the winner
    winner.chips += this.gameState.pot;
    
    // Reset game state for next hand
    this.resetForNextHand();
    
    // Emit game update to all clients
    if (this.io) {
      this.io.to(this.roomId).emit('handEnded', {
        winner: winner.name,
        winAmount: this.gameState.pot,
        reason: 'All other players folded',
        gameState: this.getCleanGameState(),
        players: this.getCleanPlayers()
      });
      
      // Also emit general game update
      this.io.to(this.roomId).emit('gameUpdate', {
        gameState: this.getCleanGameState(),
        players: this.getCleanPlayers()
      });
    }
    
    // Start next hand after a delay
    setTimeout(() => {
      this.startNextHand();
    }, 3000);
  }

  /**
   * Resets game state for the next hand
   */
  resetForNextHand() {
    // Move dealer button
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length >= 2) {
      this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % activePlayers.length;
    }
    
    // Reset game state
    this.gameState.phase = 'waiting';
    this.gameState.pot = 0;
    this.gameState.currentBet = 0;
    this.gameState.currentPlayerIndex = 0;
    this.gameState.communityCards = [];
    this.gameState.deck = [];
    this.gameState.gameStarted = false;
    this.gameState.actionsInRound = 0;
    this.gameState.playersToAct = 0;
    this.gameState.turnTimeLeft = 0;
    this.clearTurnTimer();
    
    // Reset all players for next hand
    this.clearCurrentHand();
  }

  /**
   * Starts the next hand if enough players are available
   */
  startNextHand() {
    const connectedPlayers = this.getConnectedPlayers();
    if (connectedPlayers.length >= 2) {
      console.log('Starting next hand...');
      this.startGame();
    } else {
      console.log('Not enough players for next hand, waiting...');
    }
  }

  /**
   * Handles the showdown phase - evaluates hands and determines winner(s)
   */
  showdown() {
    console.log('Starting showdown...');
    
    const activePlayers = this.getActivePlayers().filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      console.log('Error: No active players for showdown');
      return;
    }
    
    if (activePlayers.length === 1) {
      // Only one player left - they win by default
      const winner = activePlayers[0];
      console.log(`${winner.name} wins by default (only player remaining)`);
      
      winner.chips += this.gameState.pot;
      
      // Emit hand ended event
      if (this.io) {
        this.io.to(this.roomId).emit('handEnded', {
          winner: winner.name,
          winAmount: this.gameState.pot,
          reason: 'Only player remaining',
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
      
      this.resetForNextHand();
      setTimeout(() => this.startNextHand(), 3000);
      return;
    }
    
    // Evaluate all hands
    const handEvaluations = activePlayers.map(player => {
      const allCards = [...player.cards, ...this.gameState.communityCards];
      const bestHand = getBestHand(allCards);
      
      console.log(`${player.name} best hand:`, getHandDescription(bestHand));
      
      return {
        player,
        hand: bestHand,
        description: getHandDescription(bestHand)
      };
    });
    
    // Sort by hand strength (best first)
    handEvaluations.sort((a, b) => compareHands(b.hand, a.hand));
    
    // Determine winner(s) - all players with the same best hand strength
    const bestHandStrength = handEvaluations[0].hand.rank;
    const winners = handEvaluations.filter(handEval => handEval.hand.rank === bestHandStrength);
    
    // Split pot among winners
    const winAmount = Math.floor(this.gameState.pot / winners.length);
    const remainder = this.gameState.pot % winners.length;
    
    console.log(`Showdown complete:`);
    handEvaluations.forEach((handEval, index) => {
      console.log(`${index + 1}. ${handEval.player.name}: ${handEval.description}`);
    });
    
    if (winners.length === 1) {
      const winner = winners[0];
      winner.player.chips += this.gameState.pot;
      console.log(`${winner.player.name} wins ${this.gameState.pot} with ${winner.description}`);
      
      // Emit hand ended event
      if (this.io) {
        this.io.to(this.roomId).emit('handEnded', {
          winner: winner.player.name,
          winAmount: this.gameState.pot,
          winningHand: winner.description,
          handEvaluations: handEvaluations.map(handEval => ({
            playerName: handEval.player.name,
            cards: handEval.player.cards,
            handDescription: handEval.description,
            isWinner: handEval.player === winner.player
          })),
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
    } else {
      // Split pot
      console.log(`Split pot: ${winners.length} winners each get ${winAmount}`);
      winners.forEach((winner, index) => {
        let amount = winAmount;
        // Give remainder to first winner(s)
        if (index < remainder) amount++;
        
        winner.player.chips += amount;
        console.log(`${winner.player.name} gets ${amount} (${winner.description})`);
      });
      
      // Emit hand ended event for split pot
      if (this.io) {
        this.io.to(this.roomId).emit('handEnded', {
          winners: winners.map(w => w.player.name),
          winAmount: winAmount,
          splitPot: true,
          winningHand: winners[0].description,
          handEvaluations: handEvaluations.map(handEval => ({
            playerName: handEval.player.name,
            cards: handEval.player.cards,
            handDescription: handEval.description,
            isWinner: winners.some(w => w.player === handEval.player)
          })),
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
    }
    
    // Reset for next hand
    this.resetForNextHand();
    
    // Start next hand after delay
    setTimeout(() => {
      this.startNextHand();
    }, 5000); // 5 second delay to show results
  }

  /**
   * Ensures all players have valid (non-negative) chip amounts
   */
  ensureValidChips() {
    this.getPlayers().forEach(player => {
      if (player.chips < 0) {
        console.log(`Warning: Player ${player.name} had negative chips (${player.chips}), setting to 0`);
        player.chips = 0;
      }
    });
  }

  /**
   * Validates and corrects the currentPlayerIndex to ensure it points to a valid player
   * in the current hand. This is especially important when players join/leave mid-hand.
   */
  validateCurrentPlayerIndex() {
    const activePlayers = this.getActivePlayers();
    
    if (activePlayers.length === 0) {
      console.log('validateCurrentPlayerIndex: No active players, setting index to 0');
      this.gameState.currentPlayerIndex = 0;
      return false;
    }

    // Check if current index is valid
    if (this.gameState.currentPlayerIndex >= activePlayers.length) {
      console.log(`validateCurrentPlayerIndex: Index ${this.gameState.currentPlayerIndex} out of bounds (${activePlayers.length} players), correcting...`);
      this.gameState.currentPlayerIndex = this.gameState.currentPlayerIndex % activePlayers.length;
    }

    // Ensure the player at current index is actually in the current hand
    const currentPlayer = activePlayers[this.gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.inCurrentHand) {
      console.log(`validateCurrentPlayerIndex: Player at index ${this.gameState.currentPlayerIndex} is not in current hand, finding valid player...`);
      
      // Find the first valid player in the current hand
      for (let i = 0; i < activePlayers.length; i++) {
        if (activePlayers[i].inCurrentHand && !activePlayers[i].folded && activePlayers[i].chips > 0) {
          this.gameState.currentPlayerIndex = i;
          console.log(`validateCurrentPlayerIndex: Corrected to index ${i} (${activePlayers[i].name})`);
          return true;
        }
      }
      
      // If no valid player found, set to first player in hand (even if folded/all-in)
      for (let i = 0; i < activePlayers.length; i++) {
        if (activePlayers[i].inCurrentHand) {
          this.gameState.currentPlayerIndex = i;
          console.log(`validateCurrentPlayerIndex: No actionable players, set to first in hand: ${i} (${activePlayers[i].name})`);
          return true;
        }
      }
    }

    return true;
  }

  resetHandState() {
    // Reset inCurrentHand flag for all players when starting fresh
    this.getPlayers().forEach(player => {
      player.inCurrentHand = false;
    });
  }

  clearCurrentHand() {
    // Reset inCurrentHand flag for all players when ending a hand
    this.getPlayers().forEach(player => {
      player.inCurrentHand = false;
    });
  }

  getPlayersInCurrentHand() {
    return Array.from(this.players.values()).filter(p => p.inCurrentHand);
  }

  getCurrentPlayer() {
    // Use active players during the game (those in current hand)
    // Use connected players when waiting for game to start
    const players = this.gameState.gameStarted && this.gameState.phase !== 'waiting' 
      ? this.getActivePlayers() 
      : this.getConnectedPlayers();
    
    console.log(`getCurrentPlayer: gameStarted=${this.gameState.gameStarted}, phase=${this.gameState.phase}`);
    console.log(`Players array length: ${players.length}, currentPlayerIndex: ${this.gameState.currentPlayerIndex}`);
    
    // Validate current player index if game is active
    if (this.gameState.gameStarted && this.gameState.phase !== 'waiting' && players.length > 0) {
      this.validateCurrentPlayerIndex();
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

  startTurnTimer() {
    // Clear any existing timer
    this.clearTurnTimer();
    
    // Only start timer if game is active and there's a current player
    if (!this.gameState.gameStarted || this.gameState.phase === 'waiting' || this.gameState.phase === 'showdown') {
      return;
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.chips === 0) {
      return; // Don't start timer for all-in players
    }

    this.gameState.turnTimeLeft = this.turnTimeLimit;
    
    // Emit initial timer state
    if (this.io) {
      this.io.to(this.roomId).emit('turnTimer', {
        timeLeft: this.gameState.turnTimeLeft,
        currentPlayer: currentPlayer.socketId
      });
    }

    // Start countdown
    this.gameState.turnTimer = setInterval(() => {
      this.gameState.turnTimeLeft--;
      
      // Emit timer update
      if (this.io) {
        this.io.to(this.roomId).emit('turnTimer', {
          timeLeft: this.gameState.turnTimeLeft,
          currentPlayer: currentPlayer.socketId
        });
      }
      
      // Time's up - auto-fold the player
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

  // Helper methods to create clean data for emission (no circular references)
  getCleanGameState() {
    return {
      phase: this.gameState.phase,
      pot: this.gameState.pot,
      currentBet: this.gameState.currentBet,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      dealerIndex: this.gameState.dealerIndex,
      communityCards: this.gameState.communityCards,
      smallBlind: this.gameState.smallBlind,
      bigBlind: this.gameState.bigBlind,
      gameStarted: this.gameState.gameStarted,
      actionsInRound: this.gameState.actionsInRound,
      playersToAct: this.gameState.playersToAct,
      turnTimeLeft: this.gameState.turnTimeLeft,
      winner: this.gameState.winner
    };
  }

  getCleanPlayers() {
    return this.getPlayers().map(player => ({
      id: player.id,
      socketId: player.socketId,
      name: player.name,
      chips: player.chips,
      cards: player.cards,
      folded: player.folded,
      bet: player.bet,
      isConnected: player.isConnected,
      sittingOut: player.sittingOut,
      inCurrentHand: player.inCurrentHand
    }));
  }
}

module.exports = PokerRoom;
