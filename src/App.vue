<template>
  <PokerTable />
</template>

<script setup>
import PokerTable from './components/PokerTable.vue'
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #0f3460;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
}
</style>
