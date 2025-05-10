// SERVER CODE (Node.js + Express + Socket.IO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const lobbies = {};


io.on('connection', (socket) => {
  console.log('🟢 Neue Verbindung:', socket.id);

  socket.on('createLobby', ({ playerName }, callback) => {
    const lobbyCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    lobbies[lobbyCode] = {
      players: [{ id: socket.id, name: playerName }],
      started: false,
      ownerId: socket.id,
      currentSpies: []
    };
    socket.join(lobbyCode);
    io.to(lobbyCode).emit('updatePlayers', lobbies[lobbyCode].players);
    callback({ lobbyCode });
  });

  socket.on('joinLobby', ({ lobbyCode, playerName }, callback) => {
    const lobby = lobbies[lobbyCode];
    if (!lobby || lobby.started) {
      return callback({ error: 'Lobby nicht gefunden oder schon gestartet.' });
    }
    lobby.players.push({ id: socket.id, name: playerName });
    socket.join(lobbyCode);
    io.to(lobbyCode).emit('updatePlayers', lobby.players);
    callback({ success: true });
  });

  socket.on('reconnectPlayer', ({ lobbyCode, playerName }, callback) => {
    const lobby = lobbies[lobbyCode];
    if (!lobby) return callback({ error: 'Lobby nicht gefunden.' });

    const player = lobby.players.find(p => p.name === playerName);
    if (player) {
      player.id = socket.id;
      socket.join(lobbyCode);
      io.to(lobbyCode).emit('updatePlayers', lobby.players);
      return callback({ success: true });
    } else {
      return callback({ error: 'Spielername nicht gefunden.' });
    }
  });

  socket.on('startGame', ({ lobbyCode, spyCount, category }) => {
    startNewGame(lobbyCode, spyCount, category);
  });

  socket.on('endGame', ({ lobbyCode }) => {
    const lobby = lobbies[lobbyCode];
    if (!lobby || lobby.ownerId !== socket.id) return;
    const spyNames = lobby.currentSpies.map(p => p.name);
    io.to(lobbyCode).emit('gameEnd', { spyNames });
    lobby.started = false;
  });

  socket.on('restartGame', ({ lobbyCode, spyCount, category }) => {
    const lobby = lobbies[lobbyCode];
    if (!lobby || lobby.ownerId !== socket.id || lobby.started) return;
    startNewGame(lobbyCode, spyCount, category);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Verbindung getrennt:', socket.id);
    for (const code in lobbies) {
      // Spieler bleibt erhalten für Reconnect-Funktion
      // lobbies[code].players = lobbies[code].players.filter(p => p.id !== socket.id);
      io.to(code).emit('updatePlayers', lobbies[code].players);
    }
  });
});



app.get('/', (req, res) => {
  res.send('🕵️ Spion Backend läuft!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
