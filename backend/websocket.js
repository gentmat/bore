const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;
const userSockets = new Map(); // userId -> Set of socket IDs

/**
 * Initialize WebSocket server
 */
function initializeWebSocket(httpServer, jwtSecret) {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Configure appropriately for production
      methods: ['GET', 'POST']
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });
  
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.userId = decoded.user_id;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 WebSocket client connected: ${userId}`);
    
    // Track user's sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    
    // Join user-specific room
    socket.join(`user:${userId}`);
    
    // Send welcome message
    socket.emit('connected', {
      message: 'WebSocket connected successfully',
      timestamp: Date.now()
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket client disconnected: ${userId} (${reason})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
    
    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Handle subscription to specific instances
    socket.on('subscribe', (data) => {
      const { instanceId } = data;
      if (instanceId) {
        socket.join(`instance:${instanceId}`);
        socket.emit('subscribed', { instanceId });
      }
    });
    
    socket.on('unsubscribe', (data) => {
      const { instanceId } = data;
      if (instanceId) {
        socket.leave(`instance:${instanceId}`);
        socket.emit('unsubscribed', { instanceId });
      }
    });
  });
  
  console.log('✅ WebSocket server initialized');
  return io;
}

/**
 * Broadcast status change to user's connected clients
 */
function broadcastStatusChange(userId, instanceId, status) {
  if (!io) return;
  
  const event = {
    instanceId,
    status,
    timestamp: Date.now()
  };
  
  // Emit to user's room
  io.to(`user:${userId}`).emit('status-change', event);
  
  // Also emit to instance-specific room
  io.to(`instance:${instanceId}`).emit('status-change', event);
}

/**
 * Broadcast custom event to user
 */
function emitToUser(userId, eventName, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(eventName, data);
}

/**
 * Broadcast to all connected clients
 */
function broadcastToAll(eventName, data) {
  if (!io) return;
  io.emit(eventName, data);
}

/**
 * Get stats about WebSocket connections
 */
function getWebSocketStats() {
  if (!io) return { connected: 0, users: 0 };
  
  return {
    connected: io.engine.clientsCount,
    users: userSockets.size,
    socketsByUser: Array.from(userSockets.entries()).map(([userId, sockets]) => ({
      userId,
      socketCount: sockets.size
    }))
  };
}

/**
 * Close all connections (for graceful shutdown)
 */
function closeAllConnections() {
  if (!io) return;
  
  io.emit('server-shutdown', {
    message: 'Server is shutting down',
    timestamp: Date.now()
  });
  
  io.close();
}

module.exports = {
  initializeWebSocket,
  broadcastStatusChange,
  emitToUser,
  broadcastToAll,
  getWebSocketStats,
  closeAllConnections,
};
