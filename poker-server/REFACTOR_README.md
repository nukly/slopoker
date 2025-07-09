# Poker Server - Refactored Structure

This poker server has been refactored into a modular structure for better maintainability.

## File Structure

```
poker-server/
├── server.js                    # Original monolithic server (1000+ lines)
├── server-new.js               # New clean server entry point (~25 lines)
├── src/
│   ├── models/
│   │   └── PokerRoom.js        # PokerRoom class with game logic
│   ├── managers/
│   │   └── RoomManager.js      # Room management and coordination
│   ├── handlers/
│   │   └── socketHandlers.js   # Socket.IO event handlers
│   └── utils/
│       └── handEvaluator.js    # Poker hand evaluation functions
└── package.json
```

## Key Changes

### 1. **PokerRoom.js** (~900 lines)
- Contains the core poker game logic
- Handles player management, betting, turn progression
- Manages game phases (preflop, flop, turn, river, showdown)
- **Fixed turn logic**: Now uses `getActivePlayers()` consistently instead of mixing `getConnectedPlayers()` and `getActivePlayers()`

### 2. **RoomManager.js** (~100 lines)
- Manages multiple poker rooms
- Handles room creation/deletion
- Coordinates player joining/leaving
- Delegates game actions to PokerRoom instances

### 3. **socketHandlers.js** (~50 lines)
- Sets up all Socket.IO event listeners
- Clean separation of socket events from business logic

### 4. **handEvaluator.js** (~150 lines)
- Pure functions for poker hand evaluation
- No dependencies on game state
- Reusable and testable

### 5. **server-new.js** (~25 lines)
- Clean entry point
- Just Express/Socket.IO setup and handler registration

## Running the Refactored Server

```bash
# Run the original server
npm start

# Run the new refactored server
npm run new

# Development with auto-restart
npm run dev
```

## Bug Fixes

The refactoring also fixed the "Barbi doesn't get turn" issue by:

1. **Consistent player arrays**: Using `getActivePlayers()` instead of mixing connected and active players
2. **Fixed turn indexing**: Ensuring turn indices are calculated against the same player array used for current player lookup
3. **Removed duplicate timer calls**: Cleaned up duplicate `startTurnTimer()` calls in `nextPlayer()`

## Benefits

- **Maintainability**: Each file has a single responsibility
- **Testability**: Pure functions and clear separation of concerns
- **Readability**: Much easier to understand and debug
- **Modularity**: Easy to add new features or modify existing ones
- **Bug fixes**: Resolved turn management issues

The original `server.js` is kept for reference, but `server-new.js` is the recommended entry point going forward.
