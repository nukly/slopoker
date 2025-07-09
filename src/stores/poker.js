import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// Card utilities
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const usePokerStore = defineStore('poker', () => {
  // Game state
  const players = ref([
    { id: 1, name: 'Player 1', chips: 1000, cards: [], folded: false, bet: 0, isActive: true, isConnected: true },
    { id: 2, name: 'Player 2', chips: 1000, cards: [], folded: false, bet: 0, isActive: false, isConnected: false },
    { id: 3, name: 'Player 3', chips: 1000, cards: [], folded: false, bet: 0, isActive: false, isConnected: false },
    { id: 4, name: 'Player 4', chips: 1000, cards: [], folded: false, bet: 0, isActive: false, isConnected: false }
  ])
  
  const deck = ref([])
  const communityCards = ref([])
  const pot = ref(0)
  const currentBet = ref(0)
  const gamePhase = ref('waiting') // waiting, preflop, flop, turn, river, showdown
  const currentPlayerIndex = ref(0)
  const dealerIndex = ref(0)
  const smallBlind = ref(10)
  const bigBlind = ref(20)
  const gameStarted = ref(false)

  // Remove AI watcher - no more AI players

  // Online game management
  const joinGame = (playerId, playerName) => {
    const player = players.value.find(p => p.id === playerId)
    if (player) {
      player.name = playerName
      player.isConnected = true
      player.chips = 1000 // Reset chips when joining
    }
  }

  const leaveGame = (playerId) => {
    const player = players.value.find(p => p.id === playerId)
    if (player) {
      player.isConnected = false
      player.folded = true
    }
  }

  const getConnectedPlayers = computed(() => players.value.filter(p => p.isConnected))
  const canStartGame = computed(() => getConnectedPlayers.value.length >= 2)

  // Create a new deck
  const createDeck = () => {
    const newDeck = []
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        newDeck.push({ suit, rank, id: `${rank}${suit}` })
      }
    }
    return shuffleDeck(newDeck)
  }

  // Shuffle deck
  const shuffleDeck = (cards) => {
    const shuffled = [...cards]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Deal cards to players
  const dealCards = () => {
    // Reset players
    players.value.forEach(player => {
      player.cards = []
      player.folded = false
      player.bet = 0
    })
    
    // Create new deck
    deck.value = createDeck()
    communityCards.value = []
    
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      players.value.forEach(player => {
        if (deck.value.length > 0) {
          player.cards.push(deck.value.pop())
        }
      })
    }
  }

  // Start new game
  const startNewGame = () => {
    if (!canStartGame.value) {
      console.log('Need at least 2 players to start game')
      return
    }

    pot.value = 0
    currentBet.value = bigBlind.value
    gamePhase.value = 'preflop'
    
    // Reset all connected players
    getConnectedPlayers.value.forEach(player => {
      player.folded = false
      player.bet = 0
    })
    
    // Find connected players for blinds
    const connectedPlayers = getConnectedPlayers.value
    const dealerPos = dealerIndex.value % connectedPlayers.length
    const smallBlindPos = (dealerPos + 1) % connectedPlayers.length
    const bigBlindPos = (dealerPos + 2) % connectedPlayers.length
    
    // Post blinds
    const smallBlindPlayer = connectedPlayers[smallBlindPos]
    const bigBlindPlayer = connectedPlayers[bigBlindPos]
    
    smallBlindPlayer.bet = smallBlind.value
    smallBlindPlayer.chips -= smallBlind.value
    bigBlindPlayer.bet = bigBlind.value
    bigBlindPlayer.chips -= bigBlind.value
    
    pot.value = smallBlind.value + bigBlind.value
    
    // Set current player (after big blind in preflop)
    const firstToActPos = (dealerPos + 3) % connectedPlayers.length
    currentPlayerIndex.value = players.value.findIndex(p => p.id === connectedPlayers[firstToActPos].id)
    
    dealCards()
    gameStarted.value = true
  }

  // Player actions
  const playerFold = () => {
    const currentPlayer = players.value[currentPlayerIndex.value]
    currentPlayer.folded = true
    nextPlayer()
  }

  const playerCall = () => {
    const currentPlayer = players.value[currentPlayerIndex.value]
    const callAmount = currentBet.value - currentPlayer.bet
    
    if (currentPlayer.chips >= callAmount) {
      currentPlayer.chips -= callAmount
      currentPlayer.bet += callAmount
      pot.value += callAmount
    }
    
    nextPlayer()
  }

  const playerRaise = (amount) => {
    const currentPlayer = players.value[currentPlayerIndex.value]
    const totalBet = currentBet.value + amount
    const betAmount = totalBet - currentPlayer.bet
    
    if (currentPlayer.chips >= betAmount) {
      currentPlayer.chips -= betAmount
      currentPlayer.bet = totalBet
      currentBet.value = totalBet
      pot.value += betAmount
    }
    
    nextPlayer()
  }

  const playerCheck = () => {
    nextPlayer()
  }

  // Move to next player
  const nextPlayer = () => {
    // Check if only one player remains active (others folded)
    const activePlayers = getConnectedPlayers.value.filter(p => !p.folded)
    if (activePlayers.length === 1) {
      // Only one player left, they win immediately
      endHandEarly()
      return
    }
    
    const connectedPlayers = getConnectedPlayers.value
    const currentConnectedIndex = connectedPlayers.findIndex(p => p.id === currentPlayer.value.id)
    let nextConnectedIndex = (currentConnectedIndex + 1) % connectedPlayers.length
    
    // Find next active connected player
    while (connectedPlayers[nextConnectedIndex].folded && nextConnectedIndex !== currentConnectedIndex) {
      nextConnectedIndex = (nextConnectedIndex + 1) % connectedPlayers.length
    }
    
    // Update current player index to match the player in the main players array
    currentPlayerIndex.value = players.value.findIndex(p => p.id === connectedPlayers[nextConnectedIndex].id)
    
    // Check if betting round is complete
    if (isBettingRoundComplete()) {
      nextPhase()
    }
  }

  // End hand early when only one player remains
  const endHandEarly = () => {
    const activePlayers = getConnectedPlayers.value.filter(p => !p.folded)
    if (activePlayers.length === 1) {
      // Winner takes the pot
      activePlayers[0].chips += pot.value
      console.log(`${activePlayers[0].name} wins the pot of $${pot.value}!`)
      
      // Show brief winner message
      gamePhase.value = 'showdown'
      
      // Start next hand after short delay
      setTimeout(() => {
        dealerIndex.value = (dealerIndex.value + 1) % getConnectedPlayers.value.length
        startNewGame()
      }, 1500)
    }
  }

  // Check if betting round is complete
  const isBettingRoundComplete = () => {
    const activePlayers = getConnectedPlayers.value.filter(p => !p.folded)
    
    // If only one player left, end immediately
    if (activePlayers.length <= 1) {
      return true
    }
    
    // In preflop, need to check if we've gone around the table once after big blind
    if (gamePhase.value === 'preflop') {
      // All active players must have acted and either matched the current bet or be all-in
      return activePlayers.every(p => 
        (p.bet === currentBet.value || p.chips === 0) && 
        p.bet > 0 // Ensure they've acted (posted blind or made a decision)
      )
    }
    
    // Post-flop: all active players have matched the current bet or are all-in
    return activePlayers.every(p => p.bet === currentBet.value || p.chips === 0)
  }

  // Move to next phase
  const nextPhase = () => {
    // Reset bets for next round
    getConnectedPlayers.value.forEach(player => {
      player.bet = 0
    })
    currentBet.value = 0
    
    switch (gamePhase.value) {
      case 'preflop':
        // Deal flop (3 cards)
        for (let i = 0; i < 3; i++) {
          if (deck.value.length > 0) {
            communityCards.value.push(deck.value.pop())
          }
        }
        gamePhase.value = 'flop'
        break
      case 'flop':
        // Deal turn (1 card)
        if (deck.value.length > 0) {
          communityCards.value.push(deck.value.pop())
        }
        gamePhase.value = 'turn'
        break
      case 'turn':
        // Deal river (1 card)
        if (deck.value.length > 0) {
          communityCards.value.push(deck.value.pop())
        }
        gamePhase.value = 'river'
        break
      case 'river':
        gamePhase.value = 'showdown'
        showdown()
        return // Don't set next player for showdown
    }
    
    // For post-flop betting, start with first active player after dealer
    const connectedPlayers = getConnectedPlayers.value
    const dealerPos = dealerIndex.value % connectedPlayers.length
    
    // Find first active player after dealer
    let firstActivePos = (dealerPos + 1) % connectedPlayers.length
    while (connectedPlayers[firstActivePos].folded && firstActivePos !== dealerPos) {
      firstActivePos = (firstActivePos + 1) % connectedPlayers.length
    }
    
    currentPlayerIndex.value = players.value.findIndex(p => p.id === connectedPlayers[firstActivePos].id)
  }

  // Showdown logic
  const showdown = () => {
    const activePlayers = players.value.filter(p => !p.folded)
    
    if (activePlayers.length === 1) {
      // Only one player left, they win
      activePlayers[0].chips += pot.value
    } else {
      // Evaluate hands and determine winner
      // For now, just give pot to first active player
      // TODO: Implement proper hand evaluation
      activePlayers[0].chips += pot.value
    }
    
    // Prepare for next hand
    setTimeout(() => {
      dealerIndex.value = (dealerIndex.value + 1) % players.value.length
      startNewGame()
    }, 3000)
  }

  // Computed properties
  const currentPlayer = computed(() => players.value[currentPlayerIndex.value])
  const humanPlayer = computed(() => players.value[0])
  const activePlayers = computed(() => players.value.filter(p => !p.folded))

  return {
    // State
    players,
    communityCards,
    pot,
    currentBet,
    gamePhase,
    currentPlayerIndex,
    gameStarted,
    smallBlind,
    bigBlind,
    
    // Actions
    startNewGame,
    playerFold,
    playerCall,
    playerRaise,
    playerCheck,
    joinGame,
    leaveGame,
    
    // Computed
    currentPlayer,
    humanPlayer,
    activePlayers,
    getConnectedPlayers,
    canStartGame
  }
})
