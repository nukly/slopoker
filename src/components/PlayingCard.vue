<template>
  <div 
    class="playing-card" 
    :class="{ 
      'face-down': !visible, 
      'community': isCommunity,
      'dealing': isDealing,
      'highlighted': isHighlighted 
    }"
  >
    <div v-if="visible" class="card-face" :class="cardColor">
      <div class="card-corner top-left">
        <div class="rank">{{ displayRank }}</div>
        <div class="suit">{{ card.suit }}</div>
      </div>
      
      <div class="card-center">
        <div class="suit-center">{{ card.suit }}</div>
      </div>
      
      <div class="card-corner bottom-right">
        <div class="rank">{{ displayRank }}</div>
        <div class="suit">{{ card.suit }}</div>
      </div>
      
      <!-- Card shine effect -->
      <div class="card-shine"></div>
    </div>
    
    <div v-else class="card-back">
      <div class="back-pattern">
        <div class="pattern-grid">
          <div v-for="n in 25" :key="n" class="pattern-dot"></div>
        </div>
        <div class="back-logo">♠</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: {
    type: Object,
    required: true,
    validator: (value) => {
      return value && typeof value.rank === 'string' && typeof value.suit === 'string'
    }
  },
  visible: {
    type: Boolean,
    default: true
  },
  isCommunity: {
    type: Boolean,
    default: false
  },
  isDealing: {
    type: Boolean,
    default: false
  },
  isHighlighted: {
    type: Boolean,
    default: false
  }
})

const cardColor = computed(() => {
  return props.card.suit === '♥' || props.card.suit === '♦' ? 'red' : 'black'
})

const displayRank = computed(() => {
  const rank = props.card.rank
  if (rank === '11') return 'J'
  if (rank === '12') return 'Q'
  if (rank === '13') return 'K'
  if (rank === '14' || rank === '1') return 'A'
  return rank
})
</script>

<style scoped>
/* Professional Playing Card Design */

.playing-card {
  width: 64px;
  height: 88px;
  border-radius: var(--radius-md);
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  transform-style: preserve-3d;
  box-shadow: var(--shadow-md);
  user-select: none;
}

.playing-card.community {
  width: 72px;
  height: 100px;
}

.playing-card:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: var(--shadow-xl);
}

.playing-card.face-down:hover {
  transform: translateY(-2px) rotateY(5deg);
}

.playing-card.highlighted {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  border: 2px solid #3b82f6;
}

/* Card Face */
.card-face {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: var(--radius-md);
  border: 2px solid #e5e7eb;
  position: relative;
  overflow: hidden;
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.card-face.red {
  color: #dc2626;
  text-shadow: 0 0 1px rgba(220, 38, 38, 0.5);
}

.card-face.black {
  color: #1f2937;
  text-shadow: 0 0 1px rgba(31, 41, 55, 0.5);
}

/* Card Corners */
.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: 700;
  line-height: 1;
  font-family: 'Georgia', serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.card-corner.top-left {
  top: 4px;
  left: 4px;
}

.card-corner.bottom-right {
  bottom: 4px;
  right: 4px;
  transform: rotate(180deg);
}

.card-corner .rank {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 1px;
}

.card-corner .suit {
  font-size: 11px;
  line-height: 1;
}

/* Community card larger corners */
.playing-card.community .card-corner .rank {
  font-size: 15px;
}

.playing-card.community .card-corner .suit {
  font-size: 13px;
}

/* Card Center */
.card-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.suit-center {
  font-size: 30px;
  font-weight: 400;
  opacity: 0.8;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.1);
}

.playing-card.community .suit-center {
  font-size: 40px;
}

/* Card Shine Effect */
.card-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.4) 50%, 
    transparent 100%
  );
  transition: left 0.6s ease;
  pointer-events: none;
  border-radius: var(--radius-md);
}

.playing-card:hover .card-shine {
  left: 100%;
}

/* Card Back */
.card-back {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%);
  border-radius: var(--radius-md);
  border: 2px solid #1e40af;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.back-pattern {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pattern-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 2px;
  padding: 8px;
  opacity: 0.3;
}

.pattern-dot {
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-full);
  width: 3px;
  height: 3px;
  justify-self: center;
  align-self: center;
  box-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
}

.back-logo {
  font-size: 26px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  z-index: 1;
}

.playing-card.community .back-logo {
  font-size: 36px;
}

/* Animations */
.face-down {
  animation: card-flip 0.6s ease-in-out;
}

@keyframes card-flip {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}

.dealing {
  animation: deal-card 0.8s ease-out;
}

@keyframes deal-card {
  0% {
    transform: translate(-100px, -150px) rotate(-45deg) scale(0.3);
    opacity: 0;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .playing-card {
    width: 44px;
    height: 62px;
  }
  
  .playing-card.community {
    width: 52px;
    height: 72px;
  }
  
  .card-corner .rank {
    font-size: 8px;
  }
  
  .card-corner .suit {
    font-size: 6px;
  }
  
  .suit-center {
    font-size: 18px;
  }
  
  .playing-card.community .suit-center {
    font-size: 24px;
  }
  
  .back-logo {
    font-size: 16px;
  }
  
  .playing-card.community .back-logo {
    font-size: 20px;
  }
  
  .pattern-grid {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 1px;
    padding: 6px;
  }
  
  .pattern-dot {
    width: 2px;
    height: 2px;
  }
}

@media (max-width: 480px) {
  .playing-card {
    width: 36px;
    height: 50px;
  }
  
  .playing-card.community {
    width: 44px;
    height: 62px;
  }
  
  .card-corner {
    top: 2px;
    left: 2px;
  }
  
  .card-corner.bottom-right {
    bottom: 2px;
    right: 2px;
  }
  
  .card-corner .rank {
    font-size: 6px;
  }
  
  .card-corner .suit {
    font-size: 5px;
  }
  
  .suit-center {
    font-size: 14px;
  }
  
  .playing-card.community .suit-center {
    font-size: 18px;
  }
  
  .back-logo {
    font-size: 12px;
  }
  
  .playing-card.community .back-logo {
    font-size: 16px;
  }
  
  .pattern-grid {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    padding: 4px;
  }
}
</style>
