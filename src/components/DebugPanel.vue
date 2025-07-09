<template>
  <div class="debug-panel">
    <h2>Socket Debug Panel</h2>
    
    <div class="debug-section">
      <h3>Connection Status</h3>
      <p>Connected: {{ socketService.isConnected() }}</p>
      <p>Socket ID: {{ socketService.getPlayerId() }}</p>
      <p>Current Room: {{ socketService.getCurrentRoom() }}</p>
      <button @click="connectManually" :disabled="socketService.isConnected()">Connect</button>
    </div>
    
    <div class="debug-section">
      <h3>Game State</h3>
      <pre>{{ JSON.stringify(gameState, null, 2) }}</pre>
    </div>
    
    <div class="debug-section">
      <h3>My Player</h3>
      <pre>{{ JSON.stringify(myPlayer, null, 2) }}</pre>
    </div>
    
    <div class="debug-section">
      <h3>Manual Join Test</h3>
      <input v-model="testName" placeholder="Test name" />
      <input v-model="testRoom" placeholder="Test room" />
      <button @click="testJoin" :disabled="!socketService.isConnected()">Test Join</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSocket } from '../services/socket'

const socketService = useSocket()
const { connect, joinRoom } = socketService

const testName = ref('TestPlayer')
const testRoom = ref('room1')

const gameState = computed(() => socketService.getGameState())
const myPlayer = computed(() => socketService.getMyPlayer())

onMounted(() => {
  console.log('Debug panel mounted, connecting...')
  setTimeout(() => {
    if (socketService.isConnected()) {
      console.log('Auto-testing join...')
      testJoin()
    }
  }, 1000)
})

const connectManually = () => {
  console.log('Manual connect clicked')
  socketService.connect()
}

const testJoin = () => {
  console.log('Test join clicked:', testName.value, testRoom.value)
  const result = joinRoom(testRoom.value, testName.value)
  console.log('Join result:', result)
}
</script>

<style scoped>
.debug-panel {
  padding: 20px;
  background: #f0f0f0;
  color: #333;
  font-family: monospace;
}

.debug-section {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.debug-section h3 {
  margin-top: 0;
  color: #666;
}

pre {
  background: #fff;
  padding: 10px;
  border-radius: 3px;
  overflow: auto;
  max-height: 200px;
}

button {
  padding: 8px 16px;
  margin: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input {
  padding: 8px;
  margin: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
</style>
