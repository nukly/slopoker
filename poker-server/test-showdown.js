#!/usr/bin/env node

/**
 * Test script to verify showdown winner info is correctly emitted
 */

const io = require('socket.io-client');

const ROOM_ID = 'test-showdown-room';
const SERVER_URL = 'http://localhost:3001';

// Create two test players
const player1 = io(SERVER_URL);
const player2 = io(SERVER_URL);

console.log('Testing showdown winner info emission...\n');

player1.on('connect', () => {
  console.log('Player 1 connected');
  
  // Join room
  player1.emit('joinRoom', {
    roomId: ROOM_ID,
    playerName: 'Alice'
  });
  
  // Enable auto-rebuy to prevent the "need more chips" issue
  setTimeout(() => {
    console.log('Enabling auto-rebuy...');
    player1.emit('updateSettings', {
      autoRebuy: true,
      rebuyAmount: 1000,
      minChipsToPlay: 10
    });
  }, 1000);
});

player2.on('connect', () => {
  console.log('Player 2 connected');
  
  // Join same room - this should trigger game start
  setTimeout(() => {
    player2.emit('joinRoom', {
      roomId: ROOM_ID,
      playerName: 'Bob'
    });
  }, 500);
  
  // Play a hand to get to showdown
  setTimeout(() => {
    console.log('\n--- Starting test hand ---');
  }, 2000);
});

// Listen for game events
[player1, player2].forEach((player, index) => {
  const playerName = index === 0 ? 'Alice' : 'Bob';
  
  player.on('gameStarted', (data) => {
    console.log(`${playerName}: Game started`);
  });
  
  player.on('gameUpdate', (data) => {
    if (data.gameState.phase === 'preflop' && data.gameState.currentPlayerIndex !== undefined) {
      const currentPlayer = data.players[data.gameState.currentPlayerIndex];
      if (currentPlayer.name === playerName) {
        console.log(`${playerName}: It's my turn, raising all-in to force showdown`);
        player.emit('playerAction', { action: 'raise', amount: currentPlayer.chips });
      }
    } else if (data.gameState.phase !== 'waiting' && data.gameState.phase !== 'showdown' && data.gameState.currentPlayerIndex !== undefined) {
      const currentPlayer = data.players[data.gameState.currentPlayerIndex];
      if (currentPlayer.name === playerName && currentPlayer.chips > 0) {
        console.log(`${playerName}: Phase ${data.gameState.phase}, calling/checking`);
        player.emit('playerAction', { action: 'call' });
      }
    }
  });
  
  player.on('showdownResult', (data) => {
    console.log(`\n${playerName}: Showdown result received!`);
    console.log(`  - Winner in data.gameState: ${data.gameState.winner}`);
    console.log(`  - Win amount in data.gameState: ${data.gameState.winAmount}`);
    console.log(`  - Winning hand in data.gameState: ${data.gameState.winningHand}`);
    console.log(`  - Split pot in data.gameState: ${data.gameState.splitPot}`);
    console.log(`  - showdownResult object:`, JSON.stringify(data.showdownResult, null, 2));
    
    if (data.gameState.winner) {
      console.log(`✅ SUCCESS: Winner info is correctly in data.gameState!`);
    } else {
      console.log(`❌ FAILURE: Winner info is still undefined in data.gameState`);
    }
    
    // Also test what the frontend would see after Object.assign
    const testGameState = {};
    Object.assign(testGameState, data.gameState);
    console.log(`  - After Object.assign, winner would be: ${testGameState.winner}`);
  });
  
  player.on('handEnded', (data) => {
    console.log(`${playerName}: Hand ended, winner: ${data.winner}`);
  });
  
  player.on('waitingForPlayers', (data) => {
    console.log(`${playerName}: Waiting for players - ${data.reason}`);
    console.log(`  Auto-rebuy enabled: ${data.autoRebuy}`);
  });
  
  player.on('playerRebuy', (data) => {
    console.log(`${playerName}: Player ${data.playerName} got rebuy: ${data.newChips} chips`);
  });
});

// Clean up after testing
setTimeout(() => {
  console.log('\n--- Test completed, disconnecting ---');
  player1.disconnect();
  player2.disconnect();
  process.exit(0);
}, 25000);
