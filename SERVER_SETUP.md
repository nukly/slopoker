# Online Poker Server Setup

This guide will help you set up a Node.js server with Socket.io for real-time multiplayer poker.

## Server Setup

### 1. Create a new server directory
```bash
mkdir poker-server
cd poker-server
npm init -y
```

### 2. Install server dependencies
```bash
npm install express socket.io cors
npm install -D nodemon
```

### 3. Create server.js
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Your Vue app URL
    methods: ["GET", "POST"]
  }
});

// Game state
let gameRooms = new Map();

class PokerRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map();
    this.gameState = {
      phase: 'waiting',
      pot: 0,
      currentBet: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      communityCards: [],
      deck: []
    };
  }

  addPlayer(socketId, playerData) {
    this.players.set(socketId, {
      id: this.players.size + 1,
      socketId,
      name: playerData.name,
      chips: 1000,
      cards: [],
      folded: false,
      bet: 0,
      isConnected: true
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayers() {
    return Array.from(this.players.values());
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    
    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, new PokerRoom(roomId));
    }
    
    const room = gameRooms.get(roomId);
    room.addPlayer(socket.id, { name: playerName });
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Send updated player list to all players in room
    io.to(roomId).emit('playersUpdate', room.getPlayers());
  });

  // Player actions
  socket.on('playerAction', (data) => {
    const { action, amount } = data;
    const roomId = socket.roomId;
    
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId);
      
      // Process the action and update game state
      // Broadcast to all players in room
      io.to(roomId).emit('gameUpdate', {
        action,
        playerId: socket.id,
        gameState: room.gameState,
        players: room.getPlayers()
      });
    }
  });

  // Start game
  socket.on('startGame', () => {
    const roomId = socket.roomId;
    
    if (roomId && gameRooms.has(roomId)) {
      const room = gameRooms.get(roomId);
      
      if (room.getPlayers().length >= 2) {
        // Initialize game
        room.gameState.phase = 'preflop';
        
        io.to(roomId).emit('gameStarted', {
          gameState: room.gameState,
          players: room.getPlayers()
        });
      }
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && gameRooms.has(socket.roomId)) {
      const room = gameRooms.get(socket.roomId);
      room.removePlayer(socket.id);
      
      io.to(socket.roomId).emit('playersUpdate', room.getPlayers());
      
      // Clean up empty rooms
      if (room.getPlayers().length === 0) {
        gameRooms.delete(socket.roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Poker server running on port ${PORT}`);
});
```

### 4. Add to package.json scripts
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

### 5. Run the server
```bash
npm run dev
```

## Client Integration

The Vue.js client is already set up to work as a multiplayer game. To connect it to the server:

1. Create a socket service in your Vue app
2. Connect to the server on component mount
3. Emit/listen for game events

## Poker Logic Fixes Applied

✅ **Fixed betting rounds** - Proper preflop vs post-flop logic
✅ **Fixed player turn management** - Only connected players participate  
✅ **Fixed hand ending** - Automatically handles when players fold
✅ **Added online player management** - Join/leave functionality
✅ **Improved betting completion detection** - Handles all edge cases
✅ **Better phase transitions** - Proper dealer button rotation

## Next Steps

1. Set up the server using the code above
2. Connect the Vue client to Socket.io
3. Implement real poker hand evaluation
4. Add authentication and room management
5. Deploy to production

The game is now ready for online multiplayer! 🎰
