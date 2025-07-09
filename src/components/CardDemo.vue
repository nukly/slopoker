<template>
  <div class="card-demo">
    <h2>Professional Playing Card Component</h2>
    
    <div class="demo-section">
      <h3>Standard Cards</h3>
      <div class="card-grid">
        <PlayingCard :card="{ rank: 'A', suit: '♠' }" />
        <PlayingCard :card="{ rank: 'K', suit: '♥' }" />
        <PlayingCard :card="{ rank: 'Q', suit: '♦' }" />
        <PlayingCard :card="{ rank: 'J', suit: '♣' }" />
        <PlayingCard :card="{ rank: '10', suit: '♠' }" />
      </div>
    </div>

    <div class="demo-section">
      <h3>Community Cards</h3>
      <div class="card-grid">
        <PlayingCard :card="{ rank: 'A', suit: '♠' }" :is-community="true" />
        <PlayingCard :card="{ rank: 'K', suit: '♥' }" :is-community="true" />
        <PlayingCard :card="{ rank: 'Q', suit: '♦' }" :is-community="true" />
        <PlayingCard :card="{ rank: 'J', suit: '♣' }" :is-community="true" />
        <PlayingCard :card="{ rank: '10', suit: '♠' }" :is-community="true" />
      </div>
    </div>

    <div class="demo-section">
      <h3>Face Down Cards</h3>
      <div class="card-grid">
        <PlayingCard :card="{ rank: 'A', suit: '♠' }" :visible="false" />
        <PlayingCard :card="{ rank: 'K', suit: '♥' }" :visible="false" />
        <PlayingCard :card="{ rank: 'Q', suit: '♦' }" :visible="false" />
        <PlayingCard :card="{ rank: 'J', suit: '♣' }" :visible="false" />
        <PlayingCard :card="{ rank: '10', suit: '♠' }" :visible="false" />
      </div>
    </div>

    <div class="demo-section">
      <h3>Animated Cards</h3>
      <div class="card-grid">
        <PlayingCard :card="{ rank: 'A', suit: '♠' }" :is-dealing="true" />
        <PlayingCard :card="{ rank: 'K', suit: '♥' }" :is-highlighted="true" />
        <PlayingCard :card="{ rank: 'Q', suit: '♦' }" :is-dealing="true" />
        <PlayingCard :card="{ rank: 'J', suit: '♣' }" :is-highlighted="true" />
        <PlayingCard :card="{ rank: '10', suit: '♠' }" :is-dealing="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import PlayingCard from './PlayingCard.vue'
</script>

<style scoped>
.card-demo {
  padding: var(--space-8);
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  min-height: 100vh;
  color: white;
}

.demo-section {
  margin-bottom: var(--space-8);
}

.demo-section h3 {
  margin-bottom: var(--space-4);
  color: var(--gold-primary);
  font-weight: 600;
}

.card-grid {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  align-items: center;
}

.card-demo h2 {
  text-align: center;
  margin-bottom: var(--space-8);
  color: var(--gold-primary);
  font-size: 2.5rem;
  font-weight: 700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}
</style>
