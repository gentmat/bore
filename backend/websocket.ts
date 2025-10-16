import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Server as HTTPServer } from 'http';
import config from './config';

interface SocketWithAuth extends Socket {
  userId?: string;
  userEmail?: string;
}

interface WebSocketStats {
  connected: number;
  users: number;
  socketsByUser?: Array<{
    userId: string;
    socketCount: number;
  }>;
}

let io: Server | null = null;
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socket IDs

/**
 * Initialize WebSocket server with secure CORS configuration
 * @param {Object} httpServer - HTTP server instance
 * @param {string} jwtSecret - JWT secret for authentication
 * @returns {Object} Socket.IO server instance
 */
function initializeWebSocket(httpServer: HTTPServer, jwtSecret: string): Server {
  const ALLOWED_ORIGINS = config.cors.allowedOrigins;
  const NODE_ENV = config.server.nodeEnv;
  
  io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || NODE_ENV === 'development') {
          callback(null, true);
        } else {
          console.warn(`⚠️  WebSocket CORS: Blocked connection from unauthorized origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST']
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });
  
  // Authentication middleware
  io.use((socket: SocketWithAuth, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    try {
      const decoded = jwt.verify(token, jwtSecret) as { user_id: string; email: string };
      socket.userId = decoded.user_id;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket: SocketWithAuth) => {
    const userId = socket.userId!;
    console.log(`🔌 WebSocket client connected: ${userId}`);
    
    // Track user's sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    
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
    socket.on('subscribe', (data: { instanceId?: string }) => {
      const { instanceId } = data;
      if (instanceId) {
        socket.join(`instance:${instanceId}`);
        socket.emit('subscribed', { instanceId });
      }
    });
    
    socket.on('unsubscribe', (data: { instanceId?: string }) => {
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
 * @param {string} userId - User ID to broadcast to
 * @param {string} instanceId - Instance ID that changed
 * @param {string} status - New status value
 */
function broadcastStatusChange(userId: string, instanceId: string, status: string): void {
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
 * Broadcast custom event to specific user
 * @param {string} userId - User ID to send event to
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 */
function emitToUser(userId: string, eventName: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(eventName, data);
}

/**
 * Broadcast event to all connected clients
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 */
function broadcastToAll(eventName: string, data: any): void {
  if (!io) return;
  io.emit(eventName, data);
}

/**
 * Get statistics about WebSocket connections
 * @returns {Object} Connection statistics
 */
function getWebSocketStats(): WebSocketStats {
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
 * Close all WebSocket connections (for graceful shutdown)
 */
function closeAllConnections(): void {
  if (!io) return;
  
  io.emit('server-shutdown', {
    message: 'Server is shutting down',
    timestamp: Date.now()
  });
  
  io.close();
}

export {
  initializeWebSocket,
  broadcastStatusChange,
  emitToUser,
  broadcastToAll,
  getWebSocketStats,
  closeAllConnections,
};
