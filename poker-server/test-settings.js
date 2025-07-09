#!/usr/bin/env node

/**
 * Test script to demonstrate the new settings system and showdown timing
 */

const io = require('socket.io-client');

const ROOM_ID = 'test-settings-room';
const SERVER_URL = 'http://localhost:3001';

// Create two test players
const player1 = io(SERVER_URL);
const player2 = io(SERVER_URL);

console.log('Testing the new settings system and showdown timing...\n');

player1.on('connect', () => {
  console.log('Player 1 connected');
  
  // Join room
  player1.emit('joinRoom', {
    roomId: ROOM_ID,
    playerName: 'Alice'
  });
  
  // Request current settings
  setTimeout(() => {
    console.log('\n--- Getting current room settings ---');
    player1.emit('getSettings');
  }, 1000);
  
  // Update settings to enable auto-rebuy and set shorter showdown duration
  setTimeout(() => {
    console.log('\n--- Updating settings ---');
    player1.emit('updateSettings', {
      autoRebuy: true,
      rebuyAmount: 500,
      showdownDuration: 5000,  // Minimum 5 seconds
      handEndDelay: 2000
    });
  }, 2000);
  
  // Try to set invalid showdown duration (below 5 seconds)
  setTimeout(() => {
    console.log('\n--- Testing minimum showdown duration validation ---');
    player1.emit('updateSettings', {
      showdownDuration: 3000  // Should be increased to 5000ms
    });
  }, 3000);
});

player2.on('connect', () => {
  console.log('Player 2 connected');
  
  // Join same room
  setTimeout(() => {
    player2.emit('joinRoom', {
      roomId: ROOM_ID,
      playerName: 'Bob'
    });
  }, 500);
  
  // Test manual rebuy when auto-rebuy is disabled
  setTimeout(() => {
    console.log('\n--- Testing manual rebuy request ---');
    player2.emit('requestRebuy');
  }, 4000);
});

// Listen for settings events
player1.on('settingsData', (data) => {
  console.log('Current settings:', JSON.stringify(data.settings, null, 2));
});

player1.on('settingsUpdateResult', (data) => {
  console.log('Settings update result:', data);
});

player1.on('settingsUpdated', (data) => {
  console.log('Settings updated broadcast:', JSON.stringify(data.settings, null, 2));
});

player2.on('rebuyResult', (data) => {
  console.log('Rebuy result:', data);
});

player1.on('gameUpdate', (data) => {
  if (data.type === 'waitingForPlayers') {
    console.log('Waiting for players:', data);
  }
});

// Listen for player rebuy notifications
[player1, player2].forEach(player => {
  player.on('playerRebuy', (data) => {
    console.log(`Player rebuy: ${data.playerName} got ${data.newChips} chips (rebuy #${data.rebuyCount})`);
  });
});

// Clean up after testing
setTimeout(() => {
  console.log('\n--- Test completed, disconnecting ---');
  player1.disconnect();
  player2.disconnect();
  process.exit(0);
}, 8000);
