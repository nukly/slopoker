<template>
  <div class="poker-table">
    <!-- Player Lobby (when not connected) -->
    <div v-if="!playerInRoom" class="lobby">
      <h2>Join Poker Game</h2>
      <div class="join-form">
        <input 
          v-model="playerName" 
          type="text" 
          placeholder="Enter your name"
          @keyup.enter="handleJoinGame"
          maxlength="20"
        />
        <button 
          @click="handleJoinGame" 
          :disabled="!playerName.trim()"
          class="btn btn-join"
        >
          Join Game
        </button>
      </div>
      
      <div class="connected-players">
        <h3>Connected Players ({{ getConnectedPlayers.length }}/4)</h3>
        <ul>
          <li v-for="player in getConnectedPlayers" :key="player.id">
            {{ player.name }} - ${{ player.chips }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Game Interface (when connected) -->
    <div v-else class="game-interface">
      <!-- Game Header -->
    <div class="game-header">
      <h1>SLO Poker</h1>
      <div class="pot-info">
        <div class="pot">Pot: ${{ pot }}</div>
        <div class="phase">{{ gamePhase }}</div>
      </div>
    </div>

    <!-- Poker Table Layout -->
    <div class="table-container">
      <!-- Central table area with community cards -->
      <div class="table-center">
        <div class="community-cards-table">
          <PlayingCard 
            v-for="card in communityCards" 
            :key="card.id"
            :card="card"
            :visible="true"
          />
          <!-- Empty slots for cards not yet dealt -->
          <div 
            v-for="n in (5 - communityCards.length)" 
            :key="`empty-${n}`"
            class="empty-card-slot"
          ></div>
        </div>
        <div class="pot-display">
          <div class="pot-amount">${{ pot }}</div>
          <div class="pot-label">Pot</div>
        </div>
      </div>

      <!-- Players arranged around the table -->
      <div class="players-around-table">
        <PlayerSeat 
          v-for="(player, index) in players"
          :key="player.id"
          :player="player"
          :isActive="index === currentPlayerIndex"
          :isHuman="player.socketId === currentPlayerId"
          :showCards="gamePhase === 'showdown'"
          :class="`seat-${index}`"
        />
      </div>
    </div>

    <!-- Action Buttons (only show for current player when it's their turn and they're not all-in) -->
    <div v-if="currentPlayer && currentPlayer.socketId === currentPlayerId && gameStarted && (myPlayer?.chips || 0) > 0" class="action-buttons">
      <button @click="playerFold" class="btn btn-fold">Fold</button>
      <button 
        v-if="currentBet > (myPlayer?.bet || 0)"
        @click="playerCall" 
        class="btn btn-call"
      >
        <span v-if="(myPlayer?.chips || 0) >= (currentBet - (myPlayer?.bet || 0))">
          Call ${{ currentBet - (myPlayer?.bet || 0) }}
        </span>
        <span v-else>
          All-in ${{ myPlayer?.chips || 0 }}
        </span>
      </button>
      <button 
        v-else
        @click="playerCheck" 
        class="btn btn-check"
      >
        Check
      </button>
      <div class="raise-section">
        <input 
          v-model.number="raiseAmount" 
          type="number" 
          :min="1"
          :max="myPlayer?.chips || 0"
          placeholder="Raise amount"
        />
        <button 
          @click="playerRaise" 
          :disabled="raiseAmount < 1 || raiseAmount > (myPlayer?.chips || 0) || raiseAmount <= 0"
          class="btn btn-raise"
        >
          <span v-if="raiseAmount === (myPlayer?.chips || 0)">All-in</span>
          <span v-else>Raise</span>
        </button>
        <button 
          @click="goAllIn" 
          :disabled="(myPlayer?.chips || 0) <= 0"
          class="btn btn-all-in"
        >
          All-in (${{ myPlayer?.chips || 0 }})
        </button>
      </div>
    </div>

    <!-- Game Controls -->
    <div class="game-controls">
      <!-- Waiting for players -->
      <div v-if="!gameStarted && getConnectedPlayers.length < 2" class="waiting-players">
        <p>Waiting for more players... ({{ getConnectedPlayers.length }}/2 minimum)</p>
      </div>
      
      <!-- Game starting message -->
      <div v-if="!gameStarted && getConnectedPlayers.length >= 2" class="game-starting">
        <p>Game starting...</p>
      </div>
      
      <!-- Leave game button -->
      <button @click="handleLeaveGame" class="btn btn-leave">Leave Game</button>
    </div>

    <!-- Game Status -->
    <div class="game-status">
      <div v-if="gamePhase === 'showdown'" class="showdown">
        <div v-if="gameState.winner">
          🏆 {{ gameState.winner.name }} wins the pot of ${{ gameState.winner.pot }}!
        </div>
        <div v-else-if="getConnectedPlayers.filter(p => !p.folded).length === 1">
          🏆 {{ getConnectedPlayers.filter(p => !p.folded)[0].name }} wins the pot of ${{ pot }}!
        </div>
        <div v-else>
          Showdown! Determining winner...
        </div>
      </div>
      <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId !== currentPlayerId" class="waiting">
        Waiting for {{ currentPlayer.name }}...
        <div v-if="gameState.turnTimeLeft > 0" class="turn-timer">
          Time left: {{ gameState.turnTimeLeft }}s
        </div>
      </div>
      <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId === currentPlayerId && (myPlayer?.chips || 0) === 0" class="all-in-waiting">
        You're all-in! Waiting for other players...
      </div>
      <div v-else-if="gameStarted && currentPlayer && currentPlayer.socketId === currentPlayerId" class="your-turn">
        Your turn! Make your move.
        <div v-if="gameState.turnTimeLeft > 0" class="turn-timer" :class="{ 'time-warning': gameState.turnTimeLeft <= 10 }">
          Time left: {{ gameState.turnTimeLeft }}s
        </div>
      </div>
    </div>
    
    </div> <!-- End game-interface -->

    <!-- Rebuy Dialog -->
    <div v-if="gameState.showRebuyDialog" class="rebuy-dialog-overlay">
      <div class="rebuy-dialog">
        <h3>Out of Chips!</h3>
        <p>{{ gameState.rebuyMessage }}</p>
        <div class="rebuy-options">
          <div class="chip-amount">
            <label for="chipAmount">Buy chips ($):</label>
            <input 
              id="chipAmount"
              v-model.number="rebuyAmount" 
              type="number" 
              min="100" 
              max="10000" 
              step="100"
            />
          </div>
          <div class="rebuy-buttons">
            <button @click="handleRebuy(true)" class="btn btn-rebuy">
              Buy ${{ rebuyAmount }} chips
            </button>
            <button @click="handleRebuy(false)" class="btn btn-decline">
              Sit out
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Waiting for Rebuys -->
    <div v-if="gameState.waitingMessage" class="waiting-rebuys">
      <p>{{ gameState.waitingMessage }}</p>
      <p v-if="gameState.brokePlayers">
        Players deciding: {{ gameState.brokePlayers.join(', ') }}
      </p>
    </div>

    <!-- Game Ended -->
    <div v-if="gameState.endMessage" class="game-ended">
      <p>{{ gameState.endMessage }}</p>
      <p>A new game will start automatically when players are available.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../services/socket'
import PlayingCard from './PlayingCard.vue'
import PlayerSeat from './PlayerSeat.vue'

const { 
  socketService,
  connect,
  joinRoom,
  leaveRoom,
  playerAction,
  rebuy
} = useSocket()

const playerName = ref('')
const roomId = ref('room1') // Default room
const raiseAmount = ref(20)
const rebuyAmount = ref(1000)

// Connect to server when component mounts
onMounted(() => {
  connect()
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
const playerInRoom = computed(() => myPlayer.value !== null)

// Actions
const handleJoinGame = () => {
  if (playerName.value.trim() && roomId.value.trim()) {
    console.log(`Joining game: ${playerName.value.trim()} in room ${roomId.value.trim()}`)
    joinRoom(roomId.value.trim(), playerName.value.trim())
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
</script>

<style scoped>
.poker-table {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f3460 0%, #16537e 100%);
  color: white;
  padding: 20px;
  font-family: 'Arial', sans-serif;
}

.game-header {
  text-align: center;
  margin-bottom: 30px;
}

.game-header h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.pot-info {
  display: flex;
  justify-content: center;
  gap: 30px;
  font-size: 1.2rem;
}

.pot {
  background: #2c5530;
  padding: 10px 20px;
  border-radius: 20px;
  border: 2px solid #4a7c59;
}

.phase {
  background: #4a4a4a;
  padding: 10px 20px;
  border-radius: 20px;
  border: 2px solid #666;
  text-transform: capitalize;
}

.empty-card-slot {
  width: 80px;
  height: 110px;
  border: 2px dashed #666;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
}

/* Poker Table Layout */
.table-container {
  position: relative;
  width: 900px;
  height: 700px;
  margin: 40px auto 160px;
  background: linear-gradient(135deg, #2d5a27 0%, #4a7c59 100%);
  border-radius: 50%;
  border: 8px solid #8b4513;
  box-shadow: 
    inset 0 0 50px rgba(0,0,0,0.3),
    0 10px 30px rgba(0,0,0,0.5);
}

.table-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.community-cards-table {
  display: flex;
  gap: 8px;
  background: rgba(0,0,0,0.2);
  padding: 15px;
  border-radius: 12px;
  border: 2px solid #ffd700;
}

.pot-display {
  text-align: center;
  background: rgba(0,0,0,0.4);
  padding: 10px 20px;
  border-radius: 20px;
  border: 2px solid #ffd700;
}

.pot-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd700;
}

.pot-label {
  font-size: 0.9rem;
  color: #fff;
  opacity: 0.8;
}

.players-around-table {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Position players around the table */
.players-around-table .seat-0 {
  position: absolute;
  bottom: -50px;
  left: 50%;
  transform: translateX(-50%);
}

.players-around-table .seat-1 {
  position: absolute;
  right: -90px;
  top: 65%;
  transform: translateY(-50%);
}

.players-around-table .seat-2 {
  position: absolute;
  right: -90px;
  top: 35%;
  transform: translateY(-50%);
}

.players-around-table .seat-3 {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
}

.players-around-table .seat-4 {
  position: absolute;
  left: -90px;
  top: 35%;
  transform: translateY(-50%);
}

.players-around-table .seat-5 {
  position: absolute;
  left: -90px;
  top: 65%;
  transform: translateY(-50%);
}

.players-around-table .seat-6 {
  position: absolute;
  bottom: -30px;
  right: 140px;
}

.players-around-table .seat-7 {
  position: absolute;
  bottom: -30px;
  left: 140px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
  margin: 30px 0 20px;
  position: relative;
  z-index: 10;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-fold {
  background: #dc3545;
  color: white;
}

.btn-fold:hover:not(:disabled) {
  background: #c82333;
}

.btn-call, .btn-check {
  background: #28a745;
  color: white;
}

.btn-call:hover:not(:disabled), .btn-check:hover:not(:disabled) {
  background: #218838;
}

.btn-raise {
  background: #ffc107;
  color: #212529;
}

.btn-raise:hover:not(:disabled) {
  background: #e0a800;
}

.btn-all-in {
  background: linear-gradient(135deg, #9c27b0 0%, #673ab7 100%);
  color: white;
  margin-left: 10px;
}

.btn-all-in:hover:not(:disabled) {
  background: linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%);
  transform: translateY(-1px);
}

.raise-section {
  display: flex;
  gap: 10px;
  align-items: center;
}

.raise-section input {
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  width: 120px;
  font-size: 1rem;
}

.game-status {
  text-align: center;
  font-size: 1.1rem;
  min-height: 30px;
}

.showdown {
  color: #ffd700;
  font-weight: bold;
  animation: pulse 2s infinite;
}

.waiting {
  color: #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.btn-skip {
  background: #6c757d;
  color: white;
  font-size: 0.9rem;
  padding: 8px 16px;
}

.btn-skip:hover:not(:disabled) {
  background: #5a6268;
}

.lobby {
  text-align: center;
  max-width: 500px;
  margin: 50px auto;
  padding: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.lobby h2 {
  color: #ffd700;
  margin-bottom: 30px;
  font-size: 2rem;
}

.join-form {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  justify-content: center;
}

.join-form input {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  min-width: 200px;
}

.btn-join {
  background: #28a745;
  color: white;
}

.btn-join:hover:not(:disabled) {
  background: #218838;
}

.connected-players {
  text-align: left;
}

.connected-players h3 {
  color: #ffd700;
  margin-bottom: 15px;
  text-align: center;
}

.connected-players ul {
  list-style: none;
  padding: 0;
}

.connected-players li {
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  margin: 5px 0;
  border-radius: 5px;
}

.game-controls {
  text-align: center;
  margin: 30px 0;
  position: relative;
  z-index: 10;
}

.waiting-players {
  color: #ffc107;
  font-size: 1.1rem;
  margin: 15px 0;
}

.btn-leave {
  background: #dc3545;
  color: white;
  margin-top: 10px;
}

.btn-leave:hover:not(:disabled) {
  background: #c82333;
}

.your-turn {
  color: #28a745;
  font-weight: bold;
  font-size: 1.2rem;
}

.all-in-waiting {
  color: #ffc107;
  font-weight: bold;
  font-size: 1.2rem;
  animation: pulse 2s infinite;
}

.rebuy-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.rebuy-dialog {
  background: #2c2c2c;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.rebuy-dialog h3 {
  margin-bottom: 15px;
  color: #ffd700;
}

.rebuy-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.chip-amount {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chip-amount label {
  font-size: 0.9rem;
  color: #ccc;
  text-align: left;
}

.chip-amount input {
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  width: 100%;
  font-size: 1rem;
}

.rebuy-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-rebuy {
  background: #28a745;
  color: white;
}

.btn-rebuy:hover:not(:disabled) {
  background: #218838;
}

.btn-decline {
  background: #dc3545;
  color: white;
}

.btn-decline:hover:not(:disabled) {
  background: #c82333;
}

.waiting-rebuys {
  text-align: center;
  margin: 20px 0;
  color: #ffc107;
  font-size: 1.1rem;
}

.game-ended {
  text-align: center;
  margin: 20px 0;
  color: #ffd700;
  font-size: 1.2rem;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@media (max-width: 768px) {
  .poker-table {
    padding: 10px;
  }
  
  .game-header h1 {
    font-size: 2rem;
  }
  
  .pot-info {
    flex-direction: column;
    gap: 10px;
  }
  
  .action-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .raise-section {
    flex-direction: column;
  }
  
  /* Mobile table layout */
  .table-container {
    width: 380px;
    height: 380px;
    margin: 30px auto 120px;
  }
  
  .community-cards-table {
    padding: 8px;
    gap: 4px;
  }
  
  .pot-display {
    padding: 8px 15px;
  }
  
  .pot-amount {
    font-size: 1.2rem;
  }
  
  /* Adjust player positions for mobile */
  .players-around-table .seat-0 {
    bottom: -40px;
  }
  
  .players-around-table .seat-1 {
    right: -60px;
    top: 70%;
  }
  
  .players-around-table .seat-2 {
    right: -60px;
    top: 30%;
  }
  
  .players-around-table .seat-3 {
    top: -40px;
  }
  
  .players-around-table .seat-4 {
    left: -60px;
    top: 30%;
  }
  
  .players-around-table .seat-5 {
    left: -60px;
    top: 70%;
  }
  
  .players-around-table .seat-6 {
    right: 80px;
    bottom: -25px;
  }
  
  .players-around-table .seat-7 {
    left: 80px;
    bottom: -25px;
  }
  
  .turn-timer {
    font-size: 0.9rem;
  }
}
</style>
