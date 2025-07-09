<template>
  <div class="playing-card" :class="{ 'face-down': !visible }">
    <div v-if="visible" class="card-content" :class="cardColor">
      <div class="rank-top">{{ card.rank }}</div>
      <div class="suit-center">{{ card.suit }}</div>
      <div class="rank-bottom">{{ card.rank }}</div>
    </div>
    <div v-else class="card-back">
      <div class="card-pattern"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  }
})

const cardColor = computed(() => {
  return props.card.suit === '♥' || props.card.suit === '♦' ? 'red' : 'black'
})
</script>

<style scoped>
.playing-card {
  width: 80px;
  height: 110px;
  border-radius: 8px;
  border: 2px solid #333;
  background: white;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: transform 0.3s ease;
  cursor: pointer;
}

.playing-card:hover {
  transform: translateY(-4px);
}

.face-down {
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
}

.card-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px;
  font-weight: bold;
  font-size: 14px;
}

.red {
  color: #dc2626;
}

.black {
  color: #1f2937;
}

.rank-top {
  align-self: flex-start;
  line-height: 1;
}

.suit-center {
  align-self: center;
  font-size: 36px;
  line-height: 1;
}

.rank-bottom {
  align-self: flex-end;
  transform: rotate(180deg);
  line-height: 1;
}

.card-back {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.card-pattern {
  width: 90%;
  height: 90%;
  background: repeating-linear-gradient(
    45deg,
    #60a5fa,
    #60a5fa 4px,
    #3b82f6 4px,
    #3b82f6 8px
  );
  border-radius: 4px;
  opacity: 0.8;
}

/* Special styling for face cards */
.card-content:has(.rank-top:is([contains="J"], [contains="Q"], [contains="K"])) .suit-center {
  font-size: 20px;
}

@media (max-width: 768px) {
  .playing-card {
    width: 60px;
    height: 85px;
  }
  
  .card-content {
    padding: 4px;
    font-size: 10px;
  }
  
  .suit-center {
    font-size: 16px !important;
  }
}
</style>
