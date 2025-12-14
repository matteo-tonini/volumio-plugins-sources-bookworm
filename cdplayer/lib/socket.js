const io = require("socket.io-client");

function getSocket() {
  console.log("[CDPlayer] WebSocket connection");
  const socket = io("http://localhost:3000", {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 5000, // fail fast if nothing is listening
    autoConnect: true,
  });
  return socket;
}

function safeEmit(self, event, payload) {
  if (self.socket && self.socket.connected) {
    self.socket.emit(event, payload);
  } else {
    self.log(`[web-socket] Socket not connected, skipping emit: ${event}`);
  }
}

module.exports = { getSocket, safeEmit };
