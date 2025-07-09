const PokerRoom = require('../models/PokerRoomRefactored');

class RoomManager {
  constructor(ioInstance) {
    this.io = ioInstance;
    this.rooms = new Map();
  }

  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      console.log(`Creating new room: ${roomId}`);
      this.rooms.set(roomId, new PokerRoom(roomId, this.io));
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted - no players remaining`);
    }
  }

  handleJoinRoom(socket, data) {
    const { roomId, playerName } = data;
    
    console.log(`Join room request: ${playerName} -> ${roomId}`);
    
    const room = this.createRoom(roomId);
    const playerId = room.addPlayer(socket.id, { name: playerName });
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    console.log(`Player ${playerName} joined room ${roomId}. Room now has ${room.getPlayers().length} players`);
    
    // Send updated player list to all players in room
    this.io.to(roomId).emit('playersUpdate', room.getCleanPlayers());
    
    // Send current game state to the new player
    socket.emit('gameUpdate', {
      gameState: room.getCleanGameState(),
      players: room.getCleanPlayers()
    });
  }

  handleLeaveRoom(socket) {
    if (socket.roomId && this.rooms.has(socket.roomId)) {
      const room = this.rooms.get(socket.roomId);
      room.removePlayer(socket.id);
      
      this.io.to(socket.roomId).emit('playersUpdate', room.getCleanPlayers());
      
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  }

  handlePlayerAction(socket, data) {
    const { action, amount } = data;
    const roomId = socket.roomId;
    
    console.log(`Player action: ${socket.id} -> ${action} ${amount || ''} in room ${roomId}`);
    
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      
      if (room.playerAction(socket.id, action, amount)) {
        console.log(`Action processed successfully`);
        // Broadcast updated game state to all players in room
        this.io.to(roomId).emit('gameUpdate', {
          action,
          playerId: socket.id,
          gameState: room.getCleanGameState(),
          players: room.getCleanPlayers()
        });
      } else {
        console.log(`Action failed or invalid`);
      }
    }
  }

  handleRebuy(socket, data) {
    const { buyChips, chipAmount } = data;
    const roomId = socket.roomId;
    
    console.log(`Rebuy request: ${socket.id} -> buyChips: ${buyChips}, amount: ${chipAmount || 1000} in room ${roomId}`);
    
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      
      if (room.handleRebuy(socket.id, buyChips, chipAmount || 1000)) {
        console.log(`Rebuy processed successfully`);
        // Broadcast updated game state to all players in room
        this.io.to(roomId).emit('gameUpdate', {
          gameState: room.getCleanGameState(),
          players: room.getCleanPlayers()
        });
      } else {
        console.log(`Rebuy failed`);
      }
    }
  }

  handleDisconnect(socket) {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId && this.rooms.has(socket.roomId)) {
      const room = this.rooms.get(socket.roomId);
      room.removePlayer(socket.id);
      
      this.io.to(socket.roomId).emit('playersUpdate', room.getCleanPlayers());
      
      // Clean up empty rooms
      if (room.getConnectedPlayers().length === 0) {
        this.deleteRoom(socket.roomId);
      }
    }
  }

  handleUpdateSettings(socket, data) {
    const roomId = socket.roomId;
    
    console.log(`Settings update request from ${socket.id} in room ${roomId}:`, data);
    
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      
      try {
        const updatedSettings = room.updateSettings(data);
        
        // Broadcast settings update to all players in room
        this.io.to(roomId).emit('settingsUpdated', {
          settings: updatedSettings
        });
        
        socket.emit('settingsUpdateResult', {
          success: true,
          settings: updatedSettings
        });
        
        console.log('Settings updated successfully:', updatedSettings);
      } catch (error) {
        console.error('Failed to update settings:', error);
        socket.emit('settingsUpdateResult', {
          success: false,
          error: error.message
        });
      }
    }
  }

  handleGetSettings(socket) {
    const roomId = socket.roomId;
    
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      const settings = room.getSettings();
      
      socket.emit('settingsData', { settings });
    } else {
      socket.emit('settingsData', { error: 'Room not found' });
    }
  }

  handleRequestRebuy(socket) {
    const roomId = socket.roomId;
    
    console.log(`Manual rebuy request from ${socket.id} in room ${roomId}`);
    
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      const result = room.requestRebuy(socket.id);
      
      socket.emit('rebuyResult', result);
      
      if (result.success) {
        // Broadcast updated game state to all players in room
        this.io.to(roomId).emit('gameUpdate', {
          gameState: room.getCleanGameState(),
          players: room.getCleanPlayers()
        });
      }
    } else {
      socket.emit('rebuyResult', {
        success: false,
        error: 'Room not found'
      });
    }
  }
}

module.exports = RoomManager;
