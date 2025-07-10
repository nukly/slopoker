const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const setupSocketHandlers = require('./src/handlers/socketHandlers');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173", 
      "http://127.0.0.1:5173", 
      "http://localhost:5174", 
      "http://127.0.0.1:5174", 
      "http://localhost:5175", 
      "http://127.0.0.1:5175",
      "http://192.168.1.10:5173",
      "http://192.168.1.10:5174", 
      "http://192.168.1.10:5175"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Setup all socket event handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Poker server running on port ${PORT}`);
});
