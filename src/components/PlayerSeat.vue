<template>
  <div class="player-seat-container">
    <!-- Player Seat -->
    <div class="player-seat" :class="{ 
      'active': isActive, 
      'folded': player.folded,
      'human': isHuman,
      'disconnected': !player.isConnected,
      'all-in': player.chips === 0 && !player.folded
    }">
      <!-- Active Player Glow -->
      <div v-if="isActive" class="active-glow"></div>
      
      <!-- Player Avatar -->
      <div class="player-avatar">
        <div class="avatar-ring">
          <div class="avatar-inner">
            {{ player.name.charAt(0).toUpperCase() }}
          </div>
        </div>
        
        <!-- Status Indicators -->
        <div v-if="!player.isConnected" class="status-indicator disconnected">
          <span class="status-icon">⚠</span>
        </div>
        <div v-else-if="player.folded" class="status-indicator folded">
          <span class="status-icon">✖</span>
        </div>
        <div v-else-if="player.chips === 0" class="status-indicator all-in">
          <span class="status-icon">🎯</span>
        </div>
        <div v-else-if="isActive" class="status-indicator active">
          <span class="status-icon">⏳</span>
        </div>
      </div>
      
      <!-- Player Info Panel -->
      <div class="player-info">
        <div class="player-name">{{ player.name }}</div>
        <div class="player-chips">${{ player.chips.toLocaleString() }}</div>
        <div v-if="player.bet > 0" class="player-bet">
          <span class="bet-label">Bet:</span>
          <span class="bet-amount">${{ player.bet.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- Player Cards (positioned relative to seat) -->
    <div v-if="player.cards && player.cards.length > 0" class="player-cards">
      <PlayingCard 
        v-for="(card, index) in player.cards"
        :key="`${player.id}-${index}`"
        :card="card"
        :visible="isHuman || showCards"
        :class="`card-${index}`"
        class="player-card"
      />
    </div>
    
    <!-- Bet Chips (when player has bet) -->
    <div v-if="player.bet > 0" class="bet-chips">
      <div class="chip-stack">
        <div class="chip chip-gold" v-for="n in Math.min(5, Math.ceil(player.bet / 100))" :key="n"></div>
      </div>
      <div class="bet-amount-display">${{ player.bet.toLocaleString() }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PlayingCard from './PlayingCard.vue'

const props = defineProps({
  player: {
    type: Object,
    required: true
  },
  position: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isHuman: {
    type: Boolean,
    default: false
  },
  showCards: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
/* Professional Player Seat Styling */

.player-seat-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.player-seat {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: var(--radius-2xl);
  background: rgba(0, 0, 0, 0.8);
  border: 3px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.player-seat::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.player-seat:hover::before {
  opacity: 1;
}

/* Active Player */
.player-seat.active {
  border-color: var(--gold-primary);
  background: rgba(255, 215, 0, 0.1);
  box-shadow: 
    0 0 20px rgba(255, 215, 0, 0.4),
    var(--shadow-xl);
  animation: active-pulse 2s ease-in-out infinite;
}

@keyframes active-pulse {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), var(--shadow-xl);
  }
  50% { 
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.6), var(--shadow-xl);
  }
}

/* Human Player */
.player-seat.human {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.player-seat.human.active {
  border-color: var(--gold-primary);
  background: rgba(255, 215, 0, 0.1);
}

/* Folded Player */
.player-seat.folded {
  opacity: 0.6;
  background: rgba(128, 128, 128, 0.3);
  border-color: var(--gray-500);
  filter: grayscale(50%);
}

/* Disconnected Player */
.player-seat.disconnected {
  opacity: 0.4;
  background: rgba(220, 53, 69, 0.2);
  border-color: var(--red-primary);
  animation: disconnect-blink 2s ease-in-out infinite;
}

@keyframes disconnect-blink {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

/* All-in Player */
.player-seat.all-in {
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.2);
  animation: all-in-glow 1.5s ease-in-out infinite alternate;
}

@keyframes all-in-glow {
  0% { box-shadow: 0 0 10px rgba(255, 107, 107, 0.3); }
  100% { box-shadow: 0 0 25px rgba(255, 107, 107, 0.6); }
}

/* Active Glow Effect */
.active-glow {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: var(--radius-2xl);
  background: linear-gradient(45deg, var(--gold-primary), var(--gold-light), var(--gold-primary));
  z-index: -1;
  animation: rotate-glow 3s linear infinite;
}

@keyframes rotate-glow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Player Avatar */
.player-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-ring {
  width: 70px;
  height: 70px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: var(--shadow-md);
}

.player-seat.human .avatar-ring {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
}

.player-seat.folded .avatar-ring {
  background: linear-gradient(135deg, var(--gray-500) 0%, var(--gray-600) 100%);
}

.player-seat.disconnected .avatar-ring {
  background: linear-gradient(135deg, var(--red-primary) 0%, var(--red-dark) 100%);
}

.player-seat.all-in .avatar-ring {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
}

.avatar-inner {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.8);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

/* Status Indicators */
.status-indicator {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border: 2px solid var(--white);
  box-shadow: var(--shadow-md);
}

.status-indicator.active {
  background: var(--gold-primary);
  color: var(--black);
  animation: status-pulse 1s ease-in-out infinite alternate;
}

.status-indicator.folded {
  background: var(--red-primary);
  color: var(--white);
}

.status-indicator.disconnected {
  background: #ff9500;
  color: var(--white);
}

.status-indicator.all-in {
  background: #ff6b6b;
  color: var(--white);
}

@keyframes status-pulse {
  0% { transform: scale(1); }
  100% { transform: scale(1.2); }
}

/* Player Info */
.player-info {
  position: absolute;
  bottom: -45px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  backdrop-filter: blur(10px);
  min-width: 100px;
  box-shadow: var(--shadow-md);
}

.player-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--white);
  margin-bottom: var(--space-1);
}

.player-chips {
  font-size: 0.75rem;
  color: var(--gold-light);
  font-weight: 700;
}

.player-bet {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.bet-label {
  color: var(--gray-300);
}

.bet-amount {
  color: var(--blue-light);
  font-weight: 600;
}

/* Player Cards */
.player-cards {
  display: flex;
  gap: -10px;
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.player-card {
  transition: all 0.3s ease;
  transform-origin: bottom center;
}

.card-0 {
  transform: rotate(-5deg);
  z-index: 2;
}

.card-1 {
  transform: rotate(5deg);
  z-index: 1;
}

.player-cards:hover .player-card {
  transform: translateY(-10px) rotate(0deg);
}

/* Bet Chips */
.bet-chips {
  position: absolute;
  top: -20px;
  left: 120%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  z-index: 3;
}

.chip-stack {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
}

.chip {
  width: 20px;
  height: 8px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 255, 255, 0.3);
  margin-top: -4px;
  box-shadow: var(--shadow-sm);
}

.chip-gold {
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
}

.bet-amount-display {
  background: rgba(0, 0, 0, 0.8);
  color: var(--gold-primary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--gold-primary);
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}

/* Responsive Design */
@media (max-width: 768px) {
  .player-seat {
    width: 80px;
    height: 80px;
  }
  
  .avatar-ring {
    width: 55px;
    height: 55px;
  }
  
  .avatar-inner {
    width: 45px;
    height: 45px;
    font-size: 1.25rem;
  }
  
  .player-info {
    bottom: -40px;
    padding: var(--space-1) var(--space-2);
    min-width: 80px;
  }
  
  .player-name {
    font-size: 0.75rem;
  }
  
  .player-chips,
  .player-bet {
    font-size: 0.625rem;
  }
  
  .bet-chips {
    left: 110%;
  }
}

@media (max-width: 480px) {
  .player-seat {
    width: 60px;
    height: 60px;
  }
  
  .avatar-ring {
    width: 40px;
    height: 40px;
  }
  
  .avatar-inner {
    width: 32px;
    height: 32px;
    font-size: 1rem;
  }
  
  .status-indicator {
    width: 18px;
    height: 18px;
    font-size: 0.625rem;
  }
  
  .player-cards {
    top: -30px;
  }
}
</style>
