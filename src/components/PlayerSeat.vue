<template>
  <div class="player-container">
    <!-- Player Avatar/Initial -->
    <div class="player-seat" :class="{ 
      'active': isActive, 
      'folded': player.folded,
      'human': isHuman,
      'disconnected': !player.isConnected
    }">
      <div class="player-avatar">
        {{ player.name.charAt(0).toUpperCase() }}
      </div>
      
      <!-- Player Info Tooltip (shows on hover) -->
      <div class="player-tooltip">
        <div class="player-name">{{ player.name }}</div>
        <div class="player-chips">${{ player.chips }}</div>
        <div v-if="player.bet > 0" class="player-bet">Bet: ${{ player.bet }}</div>
        <div v-if="!player.isConnected" class="status-text">DISCONNECTED</div>
        <div v-else-if="player.folded" class="status-text">FOLDED</div>
        <div v-else-if="isActive" class="status-text">ACTIVE</div>
        <div v-if="player.chips === 0" class="status-text">ALL IN</div>
      </div>
    </div>

    <!-- Player Cards on table -->
    <div v-if="player.cards && player.cards.length > 0" class="player-cards-on-table">
      <PlayingCard 
        v-for="(card, index) in player.cards"
        :key="`${player.id}-${index}`"
        :card="card"
        :visible="isHuman || showCards"
        class="table-card"
      />
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

// For showdown, we might want to show all cards
// const showCards = ref(false) // Now using prop instead
</script>

<style scoped>
.player-seat {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  border-radius: 50%;
  padding: 10px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.player-seat.active {
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
  background: rgba(255, 215, 0, 0.1);
}

.player-seat.folded {
  opacity: 0.6;
  background: rgba(128, 128, 128, 0.1);
}

.player-seat.human {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.player-seat.human.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
}

.player-seat.disconnected {
  opacity: 0.4;
  background: rgba(128, 128, 128, 0.1);
}

.player-avatar {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

.player-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 100;
  margin-bottom: 8px;
}

.player-seat:hover .player-tooltip {
  opacity: 1;
}

.player-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.player-name {
  font-weight: bold;
  margin-bottom: 2px;
}

.player-chips {
  color: #4ade80;
  font-size: 0.75rem;
}

.player-bet {
  color: #fbbf24;
  font-size: 0.75rem;
}

.status-text {
  font-size: 0.7rem;
  color: #fbbf24;
  font-weight: bold;
  margin-top: 2px;
}

.player-cards-indicator {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  border: 2px solid white;
}

.player-info {
  text-align: center;
  margin-bottom: 15px;
}

.player-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 5px;
  color: #fff;
}

.player-chips {
  font-size: 1rem;
  color: #28a745;
  margin-bottom: 3px;
}

.player-bet {
  font-size: 0.9rem;
  color: #ffc107;
  font-weight: bold;
}

.player-cards {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 15px;
  min-height: 110px;
  align-items: center;
}

/* Specific positioning for different seats to place cards ON the table */
.seat-0 .player-cards-on-table {
  top: -200%;
  transform: translate(-50%, 0);
}

.seat-3 .player-cards-on-table {
  top: 350%;
  transform: translate(-50%, 0);
}

.seat-1 .player-cards-on-table,
.seat-2 .player-cards-on-table {
  left: -200%;
  top: 50%;
  transform: translate(0, -50%);
}

.seat-4 .player-cards-on-table,
.seat-5 .player-cards-on-table {
  left: 300%;
  top: 50%;
  transform: translate(-100%, -50%);
}

.seat-6 .player-cards-on-table {
  top: -150%;
  left: 30%;
  transform: translate(-50%, 0);
}

.seat-7 .player-cards-on-table {
  top: -150%;
  left: 70%;
  transform: translate(-50%, 0);
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .player-seat {
    width: 60px;
    height: 60px;
    padding: 8px;
  }
  
  .player-avatar {
    font-size: 1.2rem;
  }
  
  .player-tooltip {
    font-size: 0.7rem;
    padding: 6px 8px;
  }
  
  .player-cards-indicator {
    width: 16px;
    height: 16px;
    font-size: 0.6rem;
  }
  
  .seat-0 .player-cards-on-table {
    top: -180%;
  }
  
  .seat-3 .player-cards-on-table {
    top: 320%;
  }
  
  .seat-1 .player-cards-on-table,
  .seat-2 .player-cards-on-table {
    left: -180%;
  }
  
  .seat-4 .player-cards-on-table,
  .seat-5 .player-cards-on-table {
    left: 280%;
  }
  
  .seat-6 .player-cards-on-table {
    top: -130%;
  }
  
  .seat-7 .player-cards-on-table {
    top: -130%;
  }
  
  .table-card {
    transform: scale(0.7);
  }
  
  .table-card:hover {
    transform: scale(0.8);
  }
}

/* Player container and cards on table */
.player-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.player-cards-on-table {
  position: absolute;
  display: flex;
  gap: 4px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
}

.table-card {
  transform: scale(0.9);
  transition: transform 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.table-card:hover {
  transform: scale(1.0);
}
</style>
