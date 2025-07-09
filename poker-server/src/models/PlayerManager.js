/**
 * PlayerManager - Handles player operations and state management
 */
class PlayerManager {
  constructor() {
    this.players = new Map();
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
    return playerId;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.isConnected = false;
    }
    return player;
  }

  deletePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getConnectedPlayers() {
    return Array.from(this.players.values()).filter(p => p.isConnected);
  }

  getActivePlayers(gameStarted, phase) {
    // During a game, only return players who are in the current hand
    if (gameStarted && phase !== 'waiting') {
      return Array.from(this.players.values()).filter(p => p.isConnected && p.inCurrentHand);
    }
    // When waiting or not in a game, return all connected non-sitting-out players
    return Array.from(this.players.values()).filter(p => p.isConnected && !p.sittingOut);
  }

  getPlayersInCurrentHand() {
    return Array.from(this.players.values()).filter(p => p.inCurrentHand);
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

  markPlayersInHand(eligiblePlayers) {
    // Mark eligible players as in current hand and reset their hand state
    eligiblePlayers.forEach(player => {
      player.inCurrentHand = true;
      player.cards = [];
      player.folded = false;
      player.bet = 0;
      console.log(`Player ${player.name} is now in current hand`);
    });
  }

  ensureValidChips() {
    this.getPlayers().forEach(player => {
      if (player.chips < 0) {
        console.log(`Warning: Player ${player.name} had negative chips (${player.chips}), setting to 0`);
        player.chips = 0;
      }
    });
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

module.exports = PlayerManager;
