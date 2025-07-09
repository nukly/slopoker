const RoomManager = require('../managers/RoomManager');

function setupSocketHandlers(io) {
  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('joinRoom', (data) => {
      roomManager.handleJoinRoom(socket, data);
    });

    // Leave room
    socket.on('leaveRoom', () => {
      roomManager.handleLeaveRoom(socket);
    });

    // Player actions
    socket.on('playerAction', (data) => {
      roomManager.handlePlayerAction(socket, data);
    });

    // Rebuy chips
    socket.on('rebuy', (data) => {
      roomManager.handleRebuy(socket, data);
    });

    // Settings management
    socket.on('updateSettings', (data) => {
      roomManager.handleUpdateSettings(socket, data);
    });

    socket.on('getSettings', () => {
      roomManager.handleGetSettings(socket);
    });

    // Manual rebuy request
    socket.on('requestRebuy', () => {
      roomManager.handleRequestRebuy(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket);
    });
  });
}

module.exports = setupSocketHandlers;
