<template>
  <div class="player-seat-container">
    <!-- Player Seat - Now contains cards -->
    <div class="player-seat" :class="{ 
      'active': isActive, 
      'folded': player.folded,
      'human': isHuman,
      'disconnected': !player.isConnected,
      'all-in': player.chips === 0 && !player.folded
    }">
      <!-- Active Player Glow -->
      <div v-if="isActive" class="active-glow"></div>
      
      <!-- Player Cards (now in main seat area) -->
      <div v-if="player.cards && player.cards.length > 0" class="player-cards">
        <PlayingCard 
          v-for="(card, index) in player.cards"
          :key="`${player.id}-${index}`"
          :card="card"
          :visible="showCards"
          :class="`card-${index}`"
          class="player-card"
        />
      </div>
      
      <!-- Empty seat placeholder when no cards -->
      <div v-else class="empty-seat">
        <div class="seat-placeholder">{{ player.name.charAt(0).toUpperCase() }}</div>
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

    <!-- Player Info Panel (with small avatar circle) -->
    <div class="player-info">
      <div class="player-header">
        <div class="mini-avatar">{{ player.name.charAt(0).toUpperCase() }}</div>
        <div class="player-name">{{ player.name }}</div>
      </div>
      <div class="player-chips">${{ player.chips.toLocaleString() }}</div>
      <div v-if="player.bet > 0" class="player-bet">
        <span class="bet-label">Bet:</span>
        <span class="bet-amount">${{ player.bet.toLocaleString() }}</span>
      </div>
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
  z-index: 20; /* Above table felt */
  width: 120px; /* Fixed width to prevent layout issues */
}

.player-seat {
  position: relative;
  width: 120px;
  height: 80px;
  border-radius: var(--radius-lg);
  background: rgba(0, 0, 0, 0.9);
  border: 3px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  backdrop-filter: blur(15px);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: visible; /* Allow cards to extend beyond seat */
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
  border-radius: var(--radius-lg);
  background: linear-gradient(45deg, var(--gold-primary), var(--gold-light), var(--gold-primary));
  z-index: -1;
  animation: rotate-glow 3s linear infinite;
}

@keyframes rotate-glow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Player Cards in Main Seat Area */
.player-cards {
  display: flex;
  gap: -12px;
  z-index: 30; /* Above everything else */
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
}

.player-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom center;
  position: relative;
}

.card-0 {
  transform: rotate(-8deg);
  z-index: 32;
}

.card-1 {
  transform: rotate(8deg);
  z-index: 31;
}

.player-cards:hover .player-card {
  transform: translateY(-4px) rotate(0deg);
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5));
}

/* Empty Seat Placeholder */
.empty-seat {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  opacity: 0.3;
}

.seat-placeholder {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
}

/* Status Indicators */
.status-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border: 2px solid var(--white);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  z-index: 35; /* Above cards */
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
  text-align: center;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  backdrop-filter: blur(15px);
  min-width: 110px;
  max-width: 140px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.6),
    0 0 15px rgba(255, 215, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  z-index: 25; /* Ensure info panel is visible */
  margin-top: var(--space-3); /* Add some space between seat and info */
  position: relative;
}

.player-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, transparent 50%);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.mini-avatar {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
  border: 2px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--black);
  text-shadow: none;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.player-seat.human .mini-avatar {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: var(--white);
}

.player-seat.folded .mini-avatar {
  background: linear-gradient(135deg, var(--gray-500) 0%, var(--gray-600) 100%);
  color: var(--white);
}

.player-seat.disconnected .mini-avatar {
  background: linear-gradient(135deg, var(--red-primary) 0%, var(--red-dark) 100%);
  color: var(--white);
}

.player-seat.all-in .mini-avatar {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: var(--white);
}

.player-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--white);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
  flex: 1;
}

.player-chips {
  font-size: 0.8rem;
  color: var(--gold-primary);
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  position: relative;
  z-index: 1;
}

.player-bet {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  margin-top: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 215, 0, 0.3);
  position: relative;
  z-index: 1;
}

.bet-label {
  color: var(--gray-300);
}

.bet-amount {
  color: var(--blue-light);
  font-weight: 600;
}

/* Bet Chips */
.bet-chips {
  position: absolute;
  top: -20px;
  left: 105%;
  display: flex;
  flex-direction: column;
  align-items: center;
    gap: var(--space-2);
    z-index: 25;
    min-width: 60px;
}

.chip-stack {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
}

.chip {
  width: 22px;
  height: 7px;
  border-radius: var(--radius-full);
  border: 2px solid rgba(255, 255, 255, 0.9);
  margin-top: -2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.chip-gold {
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.bet-amount-display {
  background: rgba(0, 0, 0, 0.95);
  color: var(--gold-primary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 2px solid var(--gold-primary);
  white-space: nowrap;
  box-shadow: 
    0 2px 12px rgba(0, 0, 0, 0.5),
    0 0 15px rgba(255, 215, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
}

/* Responsive Design */
@media (max-width: 768px) {
  .player-seat-container {
    width: 100px;
  }
  
  .player-seat {
    width: 100px;
    height: 70px;
  }
  
  .player-info {
    padding: var(--space-2) var(--space-3);
    min-width: 95px;
    max-width: 120px;
  }
  
  .player-name {
    font-size: 0.8rem;
  }
  
  .player-chips {
    font-size: 0.75rem;
  }
  
  .bet-chips {
    left: 100%;
    top: -15px;
  }
  
  .mini-avatar {
    width: 18px;
    height: 18px;
    font-size: 0.6rem;
  }
  
  .chip {
    width: 20px;
    height: 6px;
  }
  
  .bet-amount-display {
    font-size: 0.7rem;
    padding: var(--space-1) var(--space-2);
  }
}

@media (max-width: 480px) {
  .player-seat-container {
    width: 85px;
  }
  
  .player-seat {
    width: 85px;
    height: 60px;
  }
  
  .status-indicator {
    width: 18px;
    height: 18px;
    font-size: 0.6rem;
    top: -6px;
    right: -6px;
  }
  
  .player-info {
    padding: var(--space-2);
    min-width: 80px;
    max-width: 100px;
  }
  
  .player-name {
    font-size: 0.75rem;
  }
  
  .player-chips {
    font-size: 0.7rem;
  }
  
  .bet-chips {
    left: 95%;
    top: -12px;
  }
  
  .mini-avatar {
    width: 16px;
    height: 16px;
    font-size: 0.55rem;
  }
  
  .chip {
    width: 18px;
    height: 5px;
  }
  
  .bet-amount-display {
    font-size: 0.65rem;
    padding: 2px var(--space-1);
  }
}
</style>
