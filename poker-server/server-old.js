const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], // Your Vue app URLs
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Card utilities
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Game state
let gameRooms = new Map();

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
        this.moveToNextPlayer();
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
    const connectedPlayers = this.getConnectedPlayers();
    const activePlayers = connectedPlayers.filter(p => !p.folded);

    // Check if only one player remains
    if (activePlayers.length === 1) {
      this.endHandEarly();
      return;
    }

    // Check if all active players are all-in - if so, skip directly to next phase
    const allPlayersAllIn = activePlayers.every(p => p.chips === 0);
    if (allPlayersAllIn) {
      console.log('All active players are all-in, proceeding to next phase');
      this.nextPhase();
      return;
    }

    // Find next active player who can still act (not folded and has chips)
    let nextIndex = (this.gameState.currentPlayerIndex + 1) % connectedPlayers.length;
    let attempts = 0;
    
    while (attempts < connectedPlayers.length) {
      const nextPlayer = connectedPlayers[nextIndex];
      
      // Skip if player is folded or all-in (has no chips to bet)
      if (!nextPlayer.folded && nextPlayer.chips > 0) {
        break; // Found a player who can act
      }
      
      if (nextPlayer.folded) {
        console.log(`Skipping ${nextPlayer.name} - folded`);
      } else if (nextPlayer.chips === 0) {
        console.log(`Skipping ${nextPlayer.name} - all-in (0 chips)`);
      }
      
      nextIndex = (nextIndex + 1) % connectedPlayers.length;
      attempts++;
    }
    
    // If we've checked all players and none can act, the betting round is complete
    if (attempts >= connectedPlayers.length) {
      console.log('No players can act further, proceeding to next phase');
      this.nextPhase();
      return;
    }

    this.gameState.currentPlayerIndex = nextIndex;
    
    console.log(`Turn moved to: ${connectedPlayers[nextIndex].name} (pos ${nextIndex}) - ${connectedPlayers[nextIndex].chips} chips remaining`);

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      console.log(`Betting round complete, moving to next phase`);
      this.nextPhase();
    } else {
      // Start timer for the new current player
      this.startTurnTimer();
    }

    // Restart the turn timer for the new player
    this.startTurnTimer();
  }

  isBettingRoundComplete() {
    const connectedPlayers = this.getConnectedPlayers();
    const activePlayers = connectedPlayers.filter(p => !p.folded);

    if (activePlayers.length <= 1) {
      return true;
    }

    // Special case: if all active players are all-in, skip to showdown
    const allPlayersAllIn = activePlayers.every(p => p.chips === 0);
    if (allPlayersAllIn) {
      console.log('All active players are all-in, going directly to showdown');
      return true;
    }

    // Check if there's at least one player who can still act (has chips and hasn't matched the bet)
    const playersWhoCanAct = activePlayers.filter(p => p.chips > 0 && p.bet < this.gameState.currentBet);
    if (playersWhoCanAct.length === 0) {
      console.log('No players can act further, betting round complete');
      return true;
    }

    // For betting round to be complete, all active players must have:
    // 1. Matched the current bet, OR
    // 2. Be all-in (chips === 0)
    
    const allMatchedBet = activePlayers.every(p => p.bet === this.gameState.currentBet || p.chips === 0);
    
    if (!allMatchedBet) {
      return false;
    }
    
    // Check if all active players have had at least one action in this round
    // The minimum actions needed should account for the current number of active players
    const minActionsNeeded = activePlayers.length;
    
    console.log(`Actions in round: ${this.gameState.actionsInRound}, active players: ${activePlayers.length}, needed: ${minActionsNeeded}`);
    
    // Special case: if we're in heads-up and both players have acted at least once, end the round
    if (activePlayers.length === 2 && this.gameState.actionsInRound >= 2) {
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
    const allConnectedPlayers = this.getConnectedPlayers();
    const activePlayers = allConnectedPlayers.filter(p => !p.folded);
    const allPlayersAllIn = activePlayers.every(p => p.chips === 0);
    
    if (allPlayersAllIn && activePlayers.length > 1) {
      console.log('All players are all-in, dealing remaining community cards and going to showdown');
      
      // Deal all remaining community cards at once
      while (this.gameState.communityCards.length < 5 && this.gameState.deck.length > 0) {
        this.gameState.communityCards.push(this.gameState.deck.pop());
      }
      
      // Reset bets for showdown display
      allConnectedPlayers.forEach(player => {
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
    allConnectedPlayers.forEach(player => {
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
    const connectedPlayers = this.getConnectedPlayers();
    const dealerPos = this.gameState.dealerIndex % connectedPlayers.length;
    
    let firstActivePos;
    
    if (connectedPlayers.length === 2) {
      // Heads-up: big blind (non-dealer) acts first post-flop
      firstActivePos = (dealerPos + 1) % connectedPlayers.length;
    } else {
      // 3+ players: first player after dealer acts first
      firstActivePos = (dealerPos + 1) % connectedPlayers.length;
    }
    
    // Find first non-folded player starting from the calculated position
    while (connectedPlayers[firstActivePos].folded && firstActivePos !== dealerPos) {
      firstActivePos = (firstActivePos + 1) % connectedPlayers.length;
    }
    
    this.gameState.currentPlayerIndex = firstActivePos;
    
    console.log(`Phase changed to ${this.gameState.phase}, first to act: ${connectedPlayers[firstActivePos].name} (pos ${firstActivePos})`);
    
    // Start timer for the new phase
    this.startTurnTimer();
  }

  // Safety function to ensure chips never go negative
  ensureValidChips() {
    this.players.forEach(player => {
      if (player.chips < 0) {
        console.error(`WARNING: ${player.name} had negative chips (${player.chips}), setting to 0`);
        player.chips = 0;
      }
    });
  }

  endHandEarly() {
    // Clear any active timer
    this.clearTurnTimer();
    
    const connectedPlayers = this.getConnectedPlayers();
    const activePlayers = connectedPlayers.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.gameState.pot;
      
      // Store winner info for display
      this.gameState.winner = {
        name: winner.name,
        pot: this.gameState.pot
      };
      
      console.log(`${winner.name} wins by default (others folded) - pot: ${this.gameState.pot}`);
      
      // Reset pot since it's been awarded
      this.gameState.pot = 0;
      this.gameState.phase = 'showdown';
      
      // Emit showdown results immediately
      if (this.io) {
        this.io.to(this.roomId).emit('showdownResult', {
          winner: this.gameState.winner,
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
          // Start next hand after delay
    setTimeout(() => {
      console.log('Starting new hand after early end...');
      const activePlayers = this.getActivePlayers();
      this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % activePlayers.length;
      this.gameState.winner = null; // Clear winner info
      
      // Check for players with 0 chips before starting new hand
      if (this.checkForBrokePlayers()) {
        return; // Wait for players to rebuy
      }
      
      if (this.startGame()) {
        // Emit game update for new hand
        if (this.io) {
          this.io.to(this.roomId).emit('gameStarted', {
            gameState: this.getCleanGameState(),
            players: this.getCleanPlayers()
          });
        }
      }
    }, 5000); // 5 seconds to show winner
    }
  }

  showdown() {
    // Clear any active timer
    this.clearTurnTimer();
    
    const connectedPlayers = this.getConnectedPlayers();
    const activePlayers = connectedPlayers.filter(p => !p.folded);
    
    let winner;
    
    if (activePlayers.length === 1) {
      winner = activePlayers[0];
      winner.chips += this.gameState.pot;
      console.log(`${winner.name} wins by default (only player remaining)`);
    } else {
      // Evaluate all hands and find the winner
      let bestPlayer = null;
      let bestHandRank = [-1];
      
      console.log('Evaluating hands for showdown:');
      console.log('Community cards:', this.gameState.communityCards.map(c => `${c.rank}${c.suit}`).join(', '));
      
      activePlayers.forEach(player => {
        const result = getBestHand(player.cards, this.gameState.communityCards);
        const handDescription = getHandDescription(result.rank);
        
        console.log(`${player.name}: ${player.cards.map(c => `${c.rank}${c.suit}`).join(', ')} - ${handDescription}`);
        
        if (compareHands(result.rank, bestHandRank) > 0) {
          bestHandRank = result.rank;
          bestPlayer = player;
        }
      });
      
      winner = bestPlayer;
      winner.chips += this.gameState.pot;
      console.log(`${winner.name} wins the pot of ${this.gameState.pot} with ${getHandDescription(bestHandRank)}`);
    }

    // Store winner info for display
    this.gameState.winner = {
      name: winner.name,
      pot: this.gameState.pot
    };
    
    // Reset pot since it's been awarded
    this.gameState.pot = 0;

    // Emit showdown results immediately
    if (this.io) {
      this.io.to(this.roomId).emit('showdownResult', {
        winner: this.gameState.winner,
        gameState: this.getCleanGameState(),
        players: this.getCleanPlayers()
      });
    }

    console.log(`Showdown complete. Winner: ${winner.name}, Pot: ${this.gameState.winner.pot}`);
    console.log('Starting new hand in 5 seconds...');

    // Start next hand after delay
    setTimeout(() => {
      console.log('Starting new hand now...');
      const activePlayers = this.getActivePlayers();
      this.gameState.dealerIndex = (this.gameState.dealerIndex + 1) % activePlayers.length;
      this.gameState.winner = null; // Clear winner info
      
      // Check for players with 0 chips before starting new hand
      if (this.checkForBrokePlayers()) {
        return; // Wait for players to rebuy
      }
      
      if (this.startGame()) {
        // Emit game update for new hand
        if (this.io) {
          this.io.to(this.roomId).emit('gameStarted', {
            gameState: this.getCleanGameState(),
            players: this.getCleanPlayers()
          });
        }
      }
    }, 5000); // 5 seconds to show winner
  }

  checkForBrokePlayers() {
    const connectedPlayers = this.getConnectedPlayers();
    const brokePlayers = connectedPlayers.filter(p => p.chips === 0);
    
    if (brokePlayers.length > 0) {
      console.log(`Players with 0 chips found: ${brokePlayers.map(p => p.name).join(', ')}`);
      
      // Set game state to waiting for rebuys
      this.gameState.phase = 'waiting_rebuy';
      this.gameState.brokePlayers = brokePlayers.map(p => p.socketId);
      
      // Emit rebuy request to broke players
      if (this.io) {
        brokePlayers.forEach(player => {
          this.io.to(player.socketId).emit('rebuyRequest', {
            message: 'You have 0 chips left. Would you like to buy more chips to continue playing?',
            gameState: this.getCleanGameState(),
            players: this.getCleanPlayers()
          });
        });
        
        // Notify other players
        const playersWithChips = connectedPlayers.filter(p => p.chips > 0);
        playersWithChips.forEach(player => {
          this.io.to(player.socketId).emit('waitingForRebuys', {
            message: `Waiting for ${brokePlayers.map(p => p.name).join(', ')} to decide on buying more chips...`,
            brokePlayers: brokePlayers.map(p => p.name),
            gameState: this.getCleanGameState(),
            players: this.getCleanPlayers()
          });
        });
      }
      
      return true; // Indicate that we're waiting for rebuys
    }
    
    return false; // No broke players, can continue
  }

  handleRebuy(socketId, buyChips = true, chipAmount = 1000) {
    const player = this.players.get(socketId);
    if (!player) {
      console.log(`Rebuy failed: player not found`);
      return false;
    }

    if (this.gameState.phase !== 'waiting_rebuy') {
      console.log(`Rebuy failed: not in rebuy phase`);
      return false;
    }

    if (buyChips) {
      player.chips = chipAmount;
      console.log(`${player.name} bought ${chipAmount} chips`);
    } else {
      // Player declined to rebuy - mark as sitting out
      player.sittingOut = true;
      console.log(`${player.name} declined to rebuy - sitting out`);
    }

    // Remove player from broke players list
    if (this.gameState.brokePlayers) {
      this.gameState.brokePlayers = this.gameState.brokePlayers.filter(id => id !== socketId);
    }

    // Check if all broke players have responded
    if (!this.gameState.brokePlayers || this.gameState.brokePlayers.length === 0) {
      console.log('All broke players have responded, checking if game can continue');
      this.continueAfterRebuys();
    }

    return true;
  }

  continueAfterRebuys() {
    // Check if we still have enough players to continue
    const playersWithChips = this.getConnectedPlayers().filter(p => p.chips > 0 && !p.sittingOut);
    
    if (playersWithChips.length < 2) {
      console.log('Not enough players with chips to continue game');
      this.gameState.phase = 'waiting';
      this.gameState.gameStarted = false;
      
      // Reset inCurrentHand flag for all players when game ends
      this.resetHandState();
      
      if (this.io) {
        this.io.to(this.roomId).emit('gameEnded', {
          message: 'Game ended - not enough players with chips to continue',
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
      return;
    }

    // Continue with next hand
    console.log('Continuing game after rebuys...');
    this.gameState.phase = 'waiting';
    
    if (this.startGame()) {
      if (this.io) {
        this.io.to(this.roomId).emit('gameStarted', {
          gameState: this.getCleanGameState(),
          players: this.getCleanPlayers()
        });
      }
    }
  }

  resetHandState() {
    // Reset inCurrentHand flag for all players when starting fresh
    this.getPlayers().forEach(player => {
      player.inCurrentHand = false;
    });
  }

  getCurrentPlayer() {
    // Use active players during the game (those in current hand)
    // Use connected players when waiting for game to start
    const players = this.gameState.gameStarted && this.gameState.phase !== 'waiting' 
      ? this.getActivePlayers() 
      : this.getConnectedPlayers();
    
    if (players.length === 0 || this.gameState.currentPlayerIndex >= players.length) {
      return null;
    }
    return players[this.gameState.currentPlayerIndex];
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

// Poker hand evaluation functions
function getHandRank(cards) {
  const suits = cards.map(c => c.suit);
  const ranks = cards.map(c => c.rank);
  const rankCounts = {};
  
  // Count ranks
  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });
  
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(rankCounts).length;
  
  // Convert rank to number for comparison (A=14, K=13, Q=12, J=11)
  const rankValue = (rank) => {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  };
  
  const sortedRanks = Object.keys(rankCounts)
    .sort((a, b) => rankValue(b) - rankValue(a));
  
  const isFlush = suits.every(suit => suit === suits[0]);
  const rankValues = ranks.map(rankValue).sort((a, b) => b - a);
  const isStraight = rankValues.every((val, i) => i === 0 || val === rankValues[i-1] - 1);
  
  // Determine hand type and return [handRank, tiebreakers...]
  if (isStraight && isFlush) return [8, rankValues[0]]; // Straight flush
  if (counts[0] === 4) return [7, rankValue(sortedRanks[0])]; // Four of a kind
  if (counts[0] === 3 && counts[1] === 2) return [6, rankValue(sortedRanks[0]), rankValue(sortedRanks[1])]; // Full house
  if (isFlush) return [5, ...rankValues]; // Flush
  if (isStraight) return [4, rankValues[0]]; // Straight
  if (counts[0] === 3) return [3, rankValue(sortedRanks[0]), ...sortedRanks.slice(1).map(rankValue)]; // Three of a kind
  if (counts[0] === 2 && counts[1] === 2) {
    // Two pair
    const pairs = sortedRanks.filter(rank => rankCounts[rank] === 2).map(rankValue).sort((a, b) => b - a);
    const kicker = sortedRanks.find(rank => rankCounts[rank] === 1);
    return [2, pairs[0], pairs[1], rankValue(kicker)];
  }
  if (counts[0] === 2) {
    // One pair
    const pair = sortedRanks.find(rank => rankCounts[rank] === 2);
    const kickers = sortedRanks.filter(rank => rankCounts[rank] === 1).map(rankValue).sort((a, b) => b - a);
    return [1, rankValue(pair), ...kickers];
  }
  
  // High card
  return [0, ...rankValues];
}

function getBestHand(playerCards, communityCards) {
  const allCards = [...playerCards, ...communityCards];
  let bestHand = null;
  let bestRank = [-1];
  
  // Try all combinations of 5 cards from 7 available
  for (let i = 0; i < allCards.length - 4; i++) {
    for (let j = i + 1; j < allCards.length - 3; j++) {
      for (let k = j + 1; k < allCards.length - 2; k++) {
        for (let l = k + 1; l < allCards.length - 1; l++) {
          for (let m = l + 1; m < allCards.length; m++) {
            const hand = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
            const rank = getHandRank(hand);
            
            if (compareHands(rank, bestRank) > 0) {
              bestRank = rank;
              bestHand = hand;
            }
          }
        }
      }
    }
  }
  
  return { hand: bestHand, rank: bestRank };
}

function compareHands(hand1Rank, hand2Rank) {
  for (let i = 0; i < Math.max(hand1Rank.length, hand2Rank.length); i++) {
    const val1 = hand1Rank[i] || 0;
    const val2 = hand2Rank[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}

function getHandDescription(rank) {
  const handTypes = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  
  const rankName = (val) => {
    if (val === 14) return 'A';
    if (val === 13) return 'K';
    if (val === 12) return 'Q';
    if (val === 11) return 'J';
    return val.toString();
  };
  
  const handType = handTypes[rank[0]] || 'Unknown';
  
  switch (rank[0]) {
    case 1: // One pair
      return `${handType} (${rankName(rank[1])}s)`;
    case 2: // Two pair
      return `${handType} (${rankName(rank[1])}s and ${rankName(rank[2])}s)`;
    case 3: // Three of a kind
      return `${handType} (${rankName(rank[1])}s)`;
    case 6: // Full house
      return `${handType} (${rankName(rank[1])}s full of ${rankName(rank[2])}s)`;
    case 7: // Four of a kind
      return `${handType} (${rankName(rank[1])}s)`;
    default:
      return handType;
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    
    console.log(`Join room request: ${playerName} -> ${roomId}`);
    
    if (!gameRooms.has(roomId)) {
      console.log(`Creating new room: ${roomId}`);
      gameRooms.set(roomId, new PokerRoom(roomId, io));
    }
    
    const room = gameRooms.get(roomId);
    const playerId = room.addPlayer(socket.id, { name: playerName });
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    console.log(`Player ${playerName} joined room ${roomId}. Room now has ${room.getPlayers().length} players`);
    
    // Send updated player list to all players in room
    io.to(roomId).emit('playersUpdate', room.getCleanPlayers());
    
    // Send current game state to the new player
    socket.emit('gameUpdate', {
      gameState: room.getCleanGameState(),
      players: room.getCleanPlayers()
    });
  });

  // Leave room
  socket.on('leaveRoom', () => {
    if (socket.roomId && gameRooms.has(socket.roomId)) {
      const room = gameRooms.get(socket.roomId);
      room.removePlayer(socket.id);
      
      io.to(socket.roomId).emit('playersUpdate', room.getCleanPlayers());
      
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  // Player actions
  socket.on('playerAction', (data) => {
    const { action, amount } = data;
    const roomId = socket.roomId;
    
    console.log(`Player action: ${socket.id} -> ${action} ${amount || ''} in room ${roomId}`);
    
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId);
      
      if (room.playerAction(socket.id, action, amount)) {
        console.log(`Action processed successfully`);
        // Broadcast updated game state to all players in room
        io.to(roomId).emit('gameUpdate', {
          action,
          playerId: socket.id,
          gameState: room.getCleanGameState(),
          players: room.getCleanPlayers()
        });
      } else {
        console.log(`Action failed or invalid`);
      }
    }
  });

  // Rebuy chips
  socket.on('rebuy', (data) => {
    const { buyChips, chipAmount } = data;
    const roomId = socket.roomId;
    
    console.log(`Rebuy request: ${socket.id} -> buyChips: ${buyChips}, amount: ${chipAmount || 1000} in room ${roomId}`);
    
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId);
      
      if (room.handleRebuy(socket.id, buyChips, chipAmount || 1000)) {
        console.log(`Rebuy processed successfully`);
        // Broadcast updated game state to all players in room
        io.to(roomId).emit('gameUpdate', {
          gameState: room.getCleanGameState(),
          players: room.getCleanPlayers()
        });
      } else {
        console.log(`Rebuy failed`);
      }
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && gameRooms.has(socket.roomId)) {
      const room = gameRooms.get(socket.roomId);
      room.removePlayer(socket.id);
      
      io.to(socket.roomId).emit('playersUpdate', room.getCleanPlayers());
      
      // Clean up empty rooms
      if (room.getConnectedPlayers().length === 0) {
        gameRooms.delete(socket.roomId);
        console.log(`Room ${socket.roomId} deleted - no players remaining`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Poker server running on port ${PORT}`);
});