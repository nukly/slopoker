<template>
  <div class="poker-app">
    <!-- Player Lobby (when not connected) -->
    <div v-if="!playerInRoom" class="lobby-container">
      <div class="lobby-card">
        <div class="lobby-header">
          <h1 class="lobby-title">
            <span class="title-icon">♠</span>
            SLO Poker
            <span class="title-icon">♥</span>
          </h1>
          <p class="lobby-subtitle">Professional Texas Hold'em</p>
        </div>
        
        <div class="join-section">
          <!-- Connection Status -->
          <div class="connection-status" :class="{ 'connected': socketService.connected.value }">
            <div class="status-indicator">
              <span v-if="socketService.connected.value" class="status-dot connected"></span>
              <span v-else class="status-dot disconnected"></span>
              {{ socketService.connected.value ? 'Connected' : 'Connecting...' }}
            </div>
          </div>
          
          <div class="input-group">
            <input 
              v-model="playerName" 
              type="text" 
              placeholder="Enter your name"
              @keyup.enter="handleJoinGame"
              maxlength="20"
              class="player-name-input"
            />
            <button 
              @click="handleJoinGame" 
              :disabled="!playerName.trim() || !socketService.connected.value"
              class="btn btn-join"
            >
              <span class="btn-text">Join Table</span>
            </button>
          </div>
        </div>
        
        <div class="players-preview">
          <h3 class="preview-title">Players at Table ({{ getConnectedPlayers.length }}/8)</h3>
          <div class="players-grid">
            <div 
              v-for="player in getConnectedPlayers" 
              :key="player.id"
              class="player-preview-card"
            >
              <div class="player-avatar-small">{{ player.name.charAt(0).toUpperCase() }}</div>
              <div class="player-preview-info">
                <div class="player-preview-name">{{ player.name }}</div>
                <div class="player-preview-chips">${{ player.chips.toLocaleString() }}</div>
              </div>
            </div>
            
            <!-- Empty slots -->
            <div 
              v-for="n in (8 - getConnectedPlayers.length)" 
              :key="`empty-${n}`"
              class="player-preview-card empty"
            >
              <div class="empty-seat-icon">+</div>
              <div class="empty-seat-text">Open Seat</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Game Table (when connected) -->
    <div v-else class="game-container">
      <!-- Game Header -->
      <header class="game-header">
        <div class="header-left">
          <h1 class="game-title">
            <span class="poker-icon">♠</span>
            SLO Poker
          </h1>
          <div class="table-info">
            <span class="blinds-info">Blinds: ${{ gameState.smallBlind }}/${{ gameState.bigBlind }}</span>
          </div>
        </div>
        
        <div class="header-center">
          <div class="game-phase-indicator">
            <div class="phase-badge" :class="`phase-${gamePhase.toLowerCase()}`">
              {{ gamePhase.toUpperCase() }}
            </div>
          </div>
        </div>
        
        <div class="header-right">
          <button @click="handleLeaveGame" class="btn btn-leave">
            <span>Leave Table</span>
          </button>
        </div>
      </header>

      <!-- Main Table Area -->
      <div class="table-area">
        <div class="poker-table">
          <!-- Table Felt Background -->
          <div class="table-felt">
            
            <!-- Players positioned around the table -->
            <div class="player-positions">
              <PlayerSeat 
                v-for="(player, index) in players"
                :key="player.id"
                :player="player"
                :position="index"
                :isActive="index === currentPlayerIndex"
                :isHuman="player.socketId === currentPlayerId"
                :showCards="gamePhase === 'showdown'"
                :class="`position-${index}`"
              />
            </div>
            
            <!-- Community Cards Area -->
            <div class="community-area">
              <div class="community-cards">
                <div class="board-label">Board</div>
                <div class="cards-container">
                  <PlayingCard 
                    v-for="card in communityCards" 
                    :key="card.id"
                    :card="card"
                    :visible="true"
                    :isCommunity="true"
                    class="community-card"
                  />
                  <!-- Empty card slots -->
                  <div 
                    v-for="n in (5 - communityCards.length)" 
                    :key="`empty-${n}`"
                    class="empty-card-slot community-card"
                  ></div>
                </div>
              </div>
              
              <!-- Pot Display -->
              <div class="pot-container">
                <div class="pot-display">
                  <div class="pot-label">Total Pot</div>
                  <div class="pot-amount">${{ pot.toLocaleString() }}</div>
                </div>
              </div>
            </div>
            
            <!-- Dealer Button -->
            <div 
              v-if="players.length > 0" 
              class="dealer-button"
              :style="getDealerButtonPosition()"
            >
              <div class="dealer-chip">D</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Panel (Bottom) -->
      <div class="action-panel">
        <!-- Game Status Messages -->
        <div class="status-area">
          <div v-if="!gameStarted && getConnectedPlayers.length < 2" class="status-message waiting">
            <div class="status-icon">⏳</div>
            <div class="status-text">
              <div class="status-title">Waiting for Players</div>
              <div class="status-subtitle">Need {{ 2 - getConnectedPlayers.length }} more player(s) to start</div>
            </div>
          </div>
          
          <div v-else-if="!gameStarted && getConnectedPlayers.length >= 2" class="status-message starting">
            <div class="status-icon">🎮</div>
            <div class="status-text">
              <div class="status-title">Game Starting...</div>
            </div>
          </div>
          
          <div v-else-if="gamePhase === 'showdown'" class="status-message showdown">
            <div class="status-icon">🏆</div>
            <div class="status-text">
              <div v-if="gameState.winner" class="status-title">
                {{ gameState.winner }} wins ${{ gameState.winAmount?.toLocaleString() }}!
              </div>
              <div v-else-if="getConnectedPlayers.filter(p => !p.folded).length === 1" class="status-title">
                {{ getConnectedPlayers.filter(p => !p.folded)[0].name }} wins ${{ pot.toLocaleString() }}!
              </div>
              <div v-else class="status-title">Showdown in Progress...</div>
            </div>
          </div>
          
          <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId !== currentPlayerId" class="status-message waiting-turn">
            <div class="status-icon">⏱️</div>
            <div class="status-text">
              <div class="status-title">{{ currentPlayer.name }}'s Turn</div>
              <div v-if="gameState.turnTimeLeft > 0" class="turn-timer" :class="{ 'time-warning': gameState.turnTimeLeft <= 10 }">
                {{ gameState.turnTimeLeft }}s remaining
              </div>
            </div>
          </div>
          
          <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId === currentPlayerId && (myPlayer?.chips || 0) === 0" class="status-message all-in">
            <div class="status-icon">🎯</div>
            <div class="status-text">
              <div class="status-title">You're All-In!</div>
              <div class="status-subtitle">Waiting for other players...</div>
            </div>
          </div>
          
          <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId === currentPlayerId" class="status-message your-turn">
            <div class="status-icon">🎲</div>
            <div class="status-text">
              <div class="status-title">Your Turn - Make Your Move</div>
              <div v-if="gameState.turnTimeLeft > 0" class="turn-timer" :class="{ 'time-warning': gameState.turnTimeLeft <= 10 }">
                {{ gameState.turnTimeLeft }}s remaining
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="currentPlayer && currentPlayer.socketId === currentPlayerId && gameStarted && (myPlayer?.chips || 0) > 0" class="action-buttons">
          <div class="action-row">
            <!-- Primary Actions -->
            <div class="primary-actions">
              <button @click="playerFold" class="btn btn-fold">
                <span class="btn-text">Fold</span>
              </button>
              
              <button 
                v-if="currentBet > (myPlayer?.bet || 0)"
                @click="playerCall" 
                class="btn btn-call"
              >
                <span v-if="(myPlayer?.chips || 0) >= (currentBet - (myPlayer?.bet || 0))" class="btn-text">
                  Call ${{ (currentBet - (myPlayer?.bet || 0)).toLocaleString() }}
                </span>
                <span v-else class="btn-text">
                  All-in ${{ (myPlayer?.chips || 0).toLocaleString() }}
                </span>
              </button>
              
              <button 
                v-else
                @click="playerCheck" 
                class="btn btn-check"
              >
                <span class="btn-text">Check</span>
              </button>
            </div>
            
            <!-- Betting Actions -->
            <div class="betting-actions">
              <div class="raise-controls">
                <div class="bet-amount-input">
                  <input 
                    v-model.number="raiseAmount" 
                    type="number" 
                    :min="1"
                    :max="myPlayer?.chips || 0"
                    placeholder="Bet amount"
                    class="amount-input"
                  />
                </div>
                <button 
                  @click="playerRaise" 
                  :disabled="raiseAmount < 1 || raiseAmount > (myPlayer?.chips || 0) || raiseAmount <= 0"
                  class="btn btn-raise"
                >
                  <span v-if="raiseAmount === (myPlayer?.chips || 0)" class="btn-text">All-in</span>
                  <span v-else class="btn-text">
                    {{ currentBet > (myPlayer?.bet || 0) ? 'Raise' : 'Bet' }}
                  </span>
                </button>
              </div>
              
              <button 
                @click="goAllIn" 
                :disabled="(myPlayer?.chips || 0) <= 0"
                class="btn btn-all-in"
              >
                <span class="btn-text">All-In</span>
                <span class="btn-amount">${{ (myPlayer?.chips || 0).toLocaleString() }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rebuy Dialog -->
    <div v-if="gameState.showRebuyDialog" class="modal-overlay">
      <div class="rebuy-modal">
        <div class="modal-header">
          <h3 class="modal-title">Out of Chips!</h3>
        </div>
        <div class="modal-body">
          <p class="rebuy-message">{{ gameState.rebuyMessage }}</p>
          <div class="rebuy-options">
            <div class="chip-amount-selector">
              <label for="chipAmount">Buy chips:</label>
              <div class="amount-input-group">
                <span class="currency-symbol">$</span>
                <input 
                  id="chipAmount"
                  v-model.number="rebuyAmount" 
                  type="number" 
                  min="100" 
                  max="10000" 
                  step="100"
                  class="amount-input"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="handleRebuy(true)" class="btn btn-primary">
            Buy ${{ rebuyAmount?.toLocaleString() }} Chips
          </button>
          <button @click="handleRebuy(false)" class="btn btn-leave">
            Sit Out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../services/socket'
import PlayingCard from './PlayingCard.vue'
import PlayerSeat from './PlayerSeat.vue'

// Socket service setup
const socketService = useSocket()
const { joinRoom, leaveRoom, playerAction, rebuy } = socketService

// Reactive data
const playerName = ref('')
const roomId = ref('room1') // Default room for now
const raiseAmount = ref(0)
const rebuyAmount = ref(1000)

// Lifecycle
onMounted(() => {
  // Initialize socket connection
  console.log('Initializing socket connection...')
  socketService.connect()
})

onUnmounted(() => {
  socketService.disconnect()
})

// Computed properties from socket service
const gameState = computed(() => socketService.getGameState())
const myPlayer = computed(() => socketService.getMyPlayer())
const currentPlayer = computed(() => socketService.getCurrentPlayer())
const getConnectedPlayers = computed(() => gameState.value.players.filter(p => p.isConnected))
const activePlayers = computed(() => gameState.value.players.filter(p => !p.folded))

// Additional computed properties for template
const currentPlayerId = computed(() => socketService.getPlayerId())
const gameStarted = computed(() => gameState.value.phase !== 'waiting')
const players = computed(() => gameState.value.players)
const pot = computed(() => gameState.value.pot)
const currentBet = computed(() => gameState.value.currentBet)
const gamePhase = computed(() => gameState.value.phase)
const communityCards = computed(() => gameState.value.communityCards)
const currentPlayerIndex = computed(() => gameState.value.currentPlayerIndex)
const bigBlind = computed(() => 20) // Default big blind value
const playerInRoom = computed(() => {
  const myPlayerExists = myPlayer.value !== null
  const hasRoom = socketService.currentRoom.value !== null
  const isConnected = socketService.connected.value
  console.log('playerInRoom check:', { myPlayerExists, hasRoom, isConnected, myPlayer: myPlayer.value, currentRoom: socketService.currentRoom.value })
  return myPlayerExists && hasRoom && isConnected
})

// Actions
const handleJoinGame = () => {
  if (playerName.value.trim() && roomId.value.trim()) {
    console.log(`Joining game: ${playerName.value.trim()} in room ${roomId.value.trim()}`)
    const joinResult = joinRoom(roomId.value.trim(), playerName.value.trim())
    console.log('Join room result:', joinResult)
  } else {
    console.log(`Cannot join: playerName='${playerName.value}', roomId='${roomId.value}'`)
  }
}

const handleLeaveGame = () => {
  leaveRoom()
}

const playerFold = () => {
  playerAction('fold')
}

const playerCall = () => {
  playerAction('call')
}

const playerCheck = () => {
  playerAction('check')
}

const playerRaise = () => {
  if (raiseAmount.value > 0 && raiseAmount.value <= (myPlayer.value?.chips || 0)) {
    playerAction('raise', raiseAmount.value)
  }
}

const goAllIn = () => {
  const allInAmount = myPlayer.value?.chips || 0
  if (allInAmount > 0) {
    playerAction('raise', allInAmount)
  }
}

const handleRebuy = (buy) => {
  if (buy) {
    // Handle chip purchase logic
    const amount = rebuyAmount.value
    if (amount >= 100 && amount <= 10000) {
      rebuy(true, amount)
    }
  } else {
    // Sit out
    rebuy(false)
  }
  
  // Hide rebuy dialog
  gameState.value.showRebuyDialog = false
}

// Dealer button positioning
const getDealerButtonPosition = () => {
  const dealerIndex = gameState.value.dealerIndex || 0
  const playerCount = players.value.length
  
  if (playerCount === 0) return { top: '50%', left: '50%' }
  
  // Calculate position based on player seat positions
  const angle = (dealerIndex / playerCount) * 2 * Math.PI - Math.PI / 2
  const radius = 280 // Distance from center
  const centerX = 50
  const centerY = 50
  
  const x = centerX + Math.cos(angle) * (radius / 10)
  const y = centerY + Math.sin(angle) * (radius / 10)
  
  return {
    top: `${y}%`,
    left: `${x}%`,
    transform: 'translate(-50%, -50%)'
  }
}
</script>

<style scoped>
/* Professional Poker Table Styling */

.poker-app {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--poker-green-dark) 0%, var(--poker-green-main) 50%, var(--poker-green-light) 100%);
  position: relative;
}

/* ===== LOBBY STYLES ===== */
.lobby-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
}

.lobby-card {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-2xl);
  border: 2px solid rgba(255, 215, 0, 0.3);
  padding: var(--space-10);
  max-width: 600px;
  width: 100%;
  box-shadow: var(--shadow-2xl);
}

.lobby-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.lobby-title {
  font-size: 3rem;
  font-weight: 700;
  background: linear-gradient(45deg, var(--gold-primary), var(--gold-light), var(--gold-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: var(--space-2);
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.title-icon {
  font-size: 3.5rem;
  margin: 0 var(--space-4);
  animation: sparkle 2s ease-in-out infinite alternate;
}

@keyframes sparkle {
  0% { opacity: 0.7; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.1); }
}

.lobby-subtitle {
  color: var(--gray-300);
  font-size: 1.125rem;
  margin: 0;
}

.join-section {
  margin-bottom: var(--space-8);
}

.connection-status {
  text-align: center;
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.connection-status.connected {
  background: rgba(40, 167, 69, 0.2);
  border-color: #28a745;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--gray-300);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.status-dot.connected {
  background: #28a745;
  animation: pulse-green 2s ease-in-out infinite;
}

.status-dot.disconnected {
  background: #ff9500;
  animation: pulse-orange 1s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-orange {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.input-group {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.player-name-input {
  flex: 1;
  padding: var(--space-4) var(--space-6);
  font-size: 1.125rem;
  border-radius: var(--radius-lg);
  border: 2px solid rgba(255, 215, 0, 0.3);
  background: rgba(0, 0, 0, 0.4);
  color: var(--white);
  transition: all 0.3s ease;
}

.player-name-input:focus {
  border-color: var(--gold-primary);
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
  background: rgba(0, 0, 0, 0.6);
}

.players-preview {
  margin-top: var(--space-8);
}

.preview-title {
  color: var(--gray-200);
  font-size: 1.25rem;
  margin-bottom: var(--space-4);
  text-align: center;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.player-preview-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.player-preview-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.player-preview-card.empty {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  justify-content: center;
  flex-direction: column;
  text-align: center;
  color: var(--gray-400);
}

.player-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--gold-primary), var(--gold-dark));
  color: var(--black);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
}

.player-preview-info {
  flex: 1;
}

.player-preview-name {
  font-weight: 600;
  color: var(--white);
}

.player-preview-chips {
  color: var(--gray-300);
  font-size: 0.875rem;
}

.empty-seat-icon {
  font-size: 2rem;
  color: var(--gray-500);
  margin-bottom: var(--space-2);
}

.empty-seat-text {
  font-size: 0.875rem;
  color: var(--gray-500);
}

/* ===== GAME CONTAINER STYLES ===== */
.game-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 100vw;
  overflow: hidden;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid rgba(255, 215, 0, 0.3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.game-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--gold-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.poker-icon {
  font-size: 2rem;
  animation: rotate 4s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.table-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.blinds-info {
  color: var(--gray-300);
  font-size: 0.875rem;
  font-weight: 500;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.game-phase-indicator {
  display: flex;
  align-items: center;
}

.phase-badge {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.5px;
  border: 2px solid;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.phase-waiting {
  color: var(--gray-300);
  border-color: var(--gray-500);
}

.phase-preflop {
  color: var(--blue-light);
  border-color: var(--blue-primary);
}

.phase-flop {
  color: var(--gold-light);
  border-color: var(--gold-primary);
}

.phase-turn {
  color: #ff9500;
  border-color: #ff7700;
}

.phase-river {
  color: var(--red-light);
  border-color: var(--red-primary);
}

.phase-showdown {
  color: var(--gold-light);
  border-color: var(--gold-primary);
  animation: phase-glow 1.5s ease-in-out infinite alternate;
}

@keyframes phase-glow {
  0% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
  100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6); }
}

.header-right {
  display: flex;
  align-items: center;
}

/* ===== TABLE AREA STYLES ===== */
.table-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  min-height: 70vh;
}

.poker-table {
  position: relative;
  width: 100%;
  max-width: 900px;
  aspect-ratio: 1.4;
  max-height: 650px;
}

.table-felt {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, var(--poker-felt-texture) 0%, var(--poker-green-main) 70%, var(--poker-green-dark) 100%);
  border-radius: 50%;
  border: 8px solid #8B4513;
  box-shadow: 
    inset 0 0 50px rgba(0, 0, 0, 0.3),
    0 0 50px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.table-felt::before {
  content: '';
  position: absolute;
  top: 10%;
  left: 10%;
  right: 10%;
  bottom: 10%;
  border: 2px solid rgba(255, 215, 0, 0.2);
  border-radius: 50%;
  pointer-events: none;
}

.player-positions {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

/* Player position styles for 8-max table */
.position-0 { position: absolute; top: 50%; left: 5%; transform: translateY(-50%); }
.position-1 { position: absolute; top: 20%; left: 15%; transform: translate(-50%, -50%); }
.position-2 { position: absolute; top: 5%; left: 50%; transform: translate(-50%, -50%); }
.position-3 { position: absolute; top: 20%; right: 15%; transform: translate(50%, -50%); }
.position-4 { position: absolute; top: 50%; right: 5%; transform: translateY(-50%); }
.position-5 { position: absolute; bottom: 20%; right: 15%; transform: translate(50%, 50%); }
.position-6 { position: absolute; bottom: 5%; left: 50%; transform: translate(-50%, 50%); }
.position-7 { position: absolute; bottom: 20%; left: 15%; transform: translate(-50%, 50%); }

.community-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.community-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.board-label {
  color: var(--gold-primary);
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.cards-container {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.community-card {
  transition: all 0.3s ease;
}

.community-card:hover {
  transform: translateY(-4px);
}

.empty-card-slot {
  width: 60px;
  height: 84px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.1);
}

.pot-container {
  display: flex;
  justify-content: center;
}

.pot-display {
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid var(--gold-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-6);
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.pot-label {
  color: var(--gold-primary);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--space-1);
}

.pot-amount {
  color: var(--white);
  font-size: 1.5rem;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.dealer-button {
  position: absolute;
  transition: all 0.5s ease;
  z-index: 10;
}

.dealer-chip {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
  border: 2px solid var(--white);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--black);
  font-size: 0.875rem;
  box-shadow: var(--shadow-lg);
  animation: dealer-pulse 2s ease-in-out infinite;
}

@keyframes dealer-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* ===== ACTION PANEL STYLES ===== */
.action-panel {
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border-top: 2px solid rgba(255, 215, 0, 0.3);
  padding: var(--space-6);
  min-height: 140px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.status-area {
  display: flex;
  justify-content: center;
  min-height: 60px;
}

.status-message {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.status-message.your-turn {
  background: rgba(255, 215, 0, 0.2);
  border-color: var(--gold-primary);
  animation: status-glow 2s ease-in-out infinite alternate;
}

@keyframes status-glow {
  0% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
  100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6); }
}

.status-message.waiting-turn {
  background: rgba(100, 149, 237, 0.2);
  border-color: var(--blue-primary);
}

.status-message.all-in {
  background: rgba(255, 107, 107, 0.2);
  border-color: #ff6b6b;
}

.status-message.showdown {
  background: rgba(255, 215, 0, 0.2);
  border-color: var(--gold-primary);
  animation: showdown-celebration 1s ease-in-out infinite alternate;
}

@keyframes showdown-celebration {
  0% { transform: scale(1); }
  100% { transform: scale(1.02); }
}

.status-icon {
  font-size: 1.5rem;
}

.status-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.status-title {
  font-weight: 600;
  font-size: 1.125rem;
  color: var(--white);
}

.status-subtitle {
  color: var(--gray-300);
  font-size: 0.875rem;
}

.turn-timer {
  font-weight: 700;
  color: var(--gold-primary);
  font-size: 0.875rem;
}

.turn-timer.time-warning {
  color: var(--red-primary);
  animation: timer-warning 0.5s ease-in-out infinite alternate;
}

@keyframes timer-warning {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.action-row {
  display: flex;
  gap: var(--space-6);
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.primary-actions {
  display: flex;
  gap: var(--space-3);
}

.betting-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.raise-controls {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.bet-amount-input {
  position: relative;
}

.amount-input {
  width: 120px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 2px solid rgba(255, 215, 0, 0.3);
  background: rgba(0, 0, 0, 0.4);
  color: var(--white);
  font-weight: 600;
  text-align: center;
}

.amount-input:focus {
  border-color: var(--gold-primary);
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
}

.btn-text {
  display: block;
}

.btn-amount {
  display: block;
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 2px;
}

/* ===== MODAL STYLES ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.rebuy-modal {
  background: rgba(0, 0, 0, 0.95);
  border-radius: var(--radius-2xl);
  border: 2px solid var(--gold-primary);
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow-2xl);
  backdrop-filter: blur(20px);
}

.modal-header {
  padding: var(--space-6) var(--space-6) var(--space-4);
  text-align: center;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}

.modal-title {
  color: var(--gold-primary);
  font-size: 1.5rem;
  margin: 0;
}

.modal-body {
  padding: var(--space-6);
}

.rebuy-message {
  color: var(--gray-200);
  text-align: center;
  margin-bottom: var(--space-6);
}

.chip-amount-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.amount-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: var(--space-3);
  color: var(--gold-primary);
  font-weight: 700;
  z-index: 1;
}

.amount-input-group .amount-input {
  width: 100%;
  padding-left: var(--space-8);
}

.modal-footer {
  padding: var(--space-4) var(--space-6) var(--space-6);
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: var(--space-3);
    text-align: center;
  }
  
  .header-left,
  .header-center,
  .header-right {
    width: 100%;
    justify-content: center;
  }
  
  .poker-table {
    max-width: 100%;
    aspect-ratio: 1;
  }
  
  .action-row {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .primary-actions,
  .betting-actions {
    width: 100%;
    justify-content: center;
  }
  
  .lobby-card {
    margin: var(--space-4);
    padding: var(--space-6);
  }
  
  .lobby-title {
    font-size: 2rem;
  }
  
  .input-group {
    flex-direction: column;
  }
  
  .players-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .table-area {
    padding: var(--space-3);
  }
  
  .action-panel {
    padding: var(--space-4);
  }
  
  .status-message {
    padding: var(--space-3);
    text-align: center;
  }
  
  .btn {
    min-width: 80px;
    font-size: 0.75rem;
    padding: var(--space-2) var(--space-4);
  }
}
</style>
