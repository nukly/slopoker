import { io } from 'socket.io-client'
import { ref, reactive } from 'vue'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = ref(false)
    this.currentRoom = ref(null)
    this.playerId = ref(null)
    
    // Game state that syncs with server
    this.gameState = reactive({
      players: [],
      pot: 0,
      currentBet: 0,
      currentPlayerIndex: 0,
      phase: 'waiting', // Changed from gamePhase to phase to match server
      communityCards: [],
      dealerIndex: 0,
      winner: null, // Add winner info for showdown
      turnTimeLeft: 0 // Add turn timer info
    })
  }

  connect(serverUrl) {
    if (this.socket && this.socket.connected) {
      return
    }

    // Auto-detect server URL if not provided
    if (!serverUrl) {
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:3001'
      } else {
        // For mobile devices or other network access, use the detected IP
        serverUrl = `http://${hostname}:3001`
      }
    }

    console.log('Connecting to server:', serverUrl)
    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: true
    })

    this.setupEventListeners()
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id)
      this.connected.value = true
      this.playerId.value = this.socket.id
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server. Reason:', reason)
      this.connected.value = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts')
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed - giving up')
    })

    this.socket.on('playersUpdate', (players) => {
      console.log('Players updated:', players)
      this.gameState.players = players
    })

    this.socket.on('gameStarted', (data) => {
      console.log('Game started event received:', data)
      console.log('Current gameState before gameStarted update:', { ...this.gameState })
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
      console.log('GameState after gameStarted update:', { ...this.gameState })
    })

    this.socket.on('gameUpdate', (data) => {
      console.log('Game update:', data)
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
    })

    this.socket.on('showdownResult', (data) => {
      console.log('Showdown result received:', data)
      console.log('Current gameState before update:', { ...this.gameState })
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
      console.log('GameState after showdown update:', { ...this.gameState })
      console.log('Winner info:', data.gameState.winner)
      // The winner info is now in gameState.winner
    })

    this.socket.on('rebuyRequest', (data) => {
      console.log('Rebuy request received:', data)
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
      this.gameState.rebuyMessage = data.message
      this.gameState.showRebuyDialog = true
    })

    this.socket.on('waitingForRebuys', (data) => {
      console.log('Waiting for rebuys:', data)
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
      this.gameState.waitingMessage = data.message
      this.gameState.brokePlayers = data.brokePlayers
    })

    this.socket.on('gameEnded', (data) => {
      console.log('Game ended:', data)
      Object.assign(this.gameState, data.gameState)
      this.gameState.players = data.players
      this.gameState.endMessage = data.message
    })

    this.socket.on('turnTimer', (data) => {
      console.log('Turn timer update:', data)
      this.gameState.turnTimeLeft = data.timeLeft
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  }

  joinRoom(roomId, playerName) {
    if (!this.socket || !this.connected.value) {
      console.error('Not connected to server')
      return false
    }

    console.log(`Attempting to join room: ${roomId} as ${playerName}`)
    this.socket.emit('joinRoom', { roomId, playerName })
    this.currentRoom.value = roomId // Set immediately to track the room we're joining
    return true
  }

  leaveRoom() {
    if (!this.socket || !this.connected.value) {
      return
    }

    this.socket.emit('leaveRoom')
    this.currentRoom.value = null
  }

  startGame() {
    if (!this.socket || !this.connected.value) {
      return
    }

    this.socket.emit('startGame')
  }

  playerAction(action, amount = 0) {
    if (!this.socket || !this.connected.value) {
      console.error('Not connected to server')
      return
    }

    console.log(`Sending player action: ${action} ${amount}`)
    this.socket.emit('playerAction', { action, amount })
  }

  rebuy(buyChips = true, chipAmount = 1000) {
    if (!this.socket || !this.connected.value) {
      console.error('Not connected to server')
      return
    }

    console.log(`Sending rebuy: buyChips=${buyChips}, amount=${chipAmount}`)
    this.socket.emit('rebuy', { buyChips, chipAmount })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected.value = false
      this.currentRoom.value = null
      this.playerId.value = null
    }
  }

  // Getters for reactive state
  isConnected() {
    return this.connected.value
  }

  getCurrentRoom() {
    return this.currentRoom.value
  }

  getPlayerId() {
    return this.playerId.value
  }

  getGameState() {
    return this.gameState
  }

  getCurrentPlayer() {
    const currentIndex = this.gameState.currentPlayerIndex
    return this.gameState.players[currentIndex] || null
  }

  getMyPlayer() {
    return this.gameState.players.find(p => p.socketId === this.playerId.value) || null
  }

  isMyTurn() {
    const currentPlayer = this.getCurrentPlayer()
    return currentPlayer && currentPlayer.socketId === this.playerId.value
  }
}

// Create singleton instance
export const socketService = new SocketService()

// Vue composable for easy use in components
export function useSocket() {
  return {
    socketService,
    connected: socketService.connected,
    currentRoom: socketService.currentRoom,
    playerId: socketService.playerId,
    gameState: socketService.gameState,
    
    connect: socketService.connect.bind(socketService),
    joinRoom: socketService.joinRoom.bind(socketService),
    leaveRoom: socketService.leaveRoom.bind(socketService),
    startGame: socketService.startGame.bind(socketService),
    playerAction: socketService.playerAction.bind(socketService),
    rebuy: socketService.rebuy.bind(socketService),
    disconnect: socketService.disconnect.bind(socketService),
    
    isConnected: socketService.isConnected.bind(socketService),
    getCurrentRoom: socketService.getCurrentRoom.bind(socketService),
    getPlayerId: socketService.getPlayerId.bind(socketService),
    getGameState: socketService.getGameState.bind(socketService),
    getCurrentPlayer: socketService.getCurrentPlayer.bind(socketService),
    getMyPlayer: socketService.getMyPlayer.bind(socketService),
    isMyTurn: socketService.isMyTurn.bind(socketService)
  }
}
