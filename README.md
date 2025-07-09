# SLO Poker - Advanced Multiplayer Poker Game

A sophisticated, real-time multiplayer Texas Hold'em poker game built with Vue.js 3 and Node.js/Socket.io. Features a fully refactored, modular backend architecture with robust game logic and comprehensive settings management.

## 🎮 Features

### Game Features
- **Texas Hold'em Poker**: Complete implementation with all betting rounds (pre-flop, flop, turn, river)
- **Real-time Multiplayer**: Seamless online play with Socket.io
- **Room System**: Create or join game rooms with up to 8 players
- **Advanced Turn Management**: Robust handling of player joins/leaves and edge cases
- **All-in Support**: Proper side pot calculations and all-in scenarios
- **Showdown Logic**: Accurate hand evaluation with detailed winner information
- **Auto-fold on Timeout**: Configurable turn timers with automatic actions

### Technical Features
- **Modular Architecture**: Clean separation of concerns with dedicated managers
- **Configurable Settings**: Customizable game parameters (blinds, timers, rebuy settings)
- **Robust Error Handling**: Comprehensive validation and edge case management
- **Real-time Updates**: Live game state synchronization across all clients
- **Modern UI**: Beautiful, responsive design with smooth animations
- **Mobile Responsive**: Optimized for both desktop and mobile devices

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies for both client and server:
```bash
# Install client dependencies
npm install

# Install server dependencies
cd poker-server
npm install
```

2. Start the server:
```bash
cd poker-server
node server.js
```

3. Start the client (in a new terminal):
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🎯 How to Play

1. Enter your name and a room ID to join a game
2. Wait for at least 2 players to join the room
3. Click "Start Game" when ready
4. You'll be dealt 2 hole cards
5. Betting rounds occur after each phase: Preflop, Flop, Turn, River
6. Use the action buttons to:
   - **Fold**: Give up your hand
   - **Check**: Pass the action (when no bet to call)
   - **Call**: Match the current bet (or go all-in if insufficient chips)
   - **Raise**: Increase the bet amount

## 🏗️ Technology Stack

- **Frontend**: Vue.js 3 with Composition API
- **Backend**: Node.js with Express and Socket.io
- **State Management**: Pinia (client) + Real-time sync
- **Build Tool**: Vite
- **Styling**: CSS3 with modern features

## 🏗️ Architecture

### Backend Structure
The server is built with a modular architecture for maintainability and scalability:

```
poker-server/
├── server.js                 # Main server entry point
├── src/
│   ├── handlers/
│   │   └── socketHandlers.js # Socket.io event handlers
│   ├── managers/
│   │   └── RoomManager.js    # Room lifecycle management
│   ├── models/
│   │   ├── PokerRoomRefactored.js # Main game orchestrator
│   │   ├── GameState.js      # Game state management
│   │   ├── PlayerManager.js  # Player lifecycle and validation
│   │   ├── DeckManager.js    # Card deck operations
│   │   ├── BettingManager.js # Betting logic and validation
│   │   ├── TurnManager.js    # Turn order and progression
│   │   └── ShowdownManager.js # Hand evaluation and pot distribution
│   └── utils/
│       └── handEvaluator.js  # Poker hand ranking algorithms
└── test-*.js                 # Automated test scripts
```

### Key Managers
- **GameState**: Centralized game state with clean data access
- **PlayerManager**: Handles player connections, disconnections, and validation
- **BettingManager**: Manages all betting actions, validations, and round completion
- **TurnManager**: Robust turn progression with edge case handling
- **ShowdownManager**: Accurate hand evaluation and pot distribution
- **DeckManager**: Card shuffling and dealing operations

### Settings System
Comprehensive game configuration with real-time updates:
- Auto-rebuy settings and limits
- Customizable showdown duration (minimum 5 seconds)
- Configurable hand end delays
- Minimum chips requirements
- Turn timer settings
- Blind progression rules

## 🎯 Advanced Features

### Robust Game Logic
- **Edge Case Handling**: Proper management of player disconnections mid-hand
- **All-in Scenarios**: Complete side pot calculations for multiple all-in players
- **Turn Validation**: Automatic correction of turn order when players leave/join
- **Phase Progression**: Smooth transitions between betting rounds with proper validation
- **Showdown Management**: Accurate hand rankings with detailed winner information

### Real-time Communication
- **Game State Sync**: All clients receive consistent game state updates
- **Event-driven Architecture**: Clean separation of game events and UI updates
- **Error Handling**: Graceful handling of network issues and invalid actions
- **Debug Logging**: Comprehensive logging for troubleshooting and monitoring

## 🌐 Network Play

The game supports network play - other players can join from different devices on the same network. To enable this:

1. Start the server with network access:
```bash
npm run dev -- --host
```

2. Players can connect using your local IP address (e.g., `http://192.168.1.100:5173`)

**Enjoy playing SLO Poker with friends!** 🃏♠️♥️♦️♣️
