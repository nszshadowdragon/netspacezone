// backend/app.js
require('dotenv').config();

const dns      = require('dns');
const express  = require('express');
const http     = require('http');
const mongoose = require('mongoose');
const cors     = require('cors');
const { Server } = require('socket.io');

const authRoutes           = require('./routes/auth');
const friendRequestRoutes  = require('./routes/friendRequests');
const chatRoutes           = require('./routes/chatRoutes');    // ← new
const User                 = require('./models/User');

// ───── Force IPv4 resolution ─────
dns.setDefaultResultOrder && dns.setDefaultResultOrder('ipv4first');

// ───── Connect to MongoDB Atlas ─────
;(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
})();

// ───── Express setup ─────
const app = express();

// Allow Vite (5173) to call both REST and socket endpoints
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ─── Mount your API routes under /api ───────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', friendRequestRoutes);
app.use('/api/chat', chatRoutes);    // ← chat routes

// Optional health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Create HTTP server & attach Socket.IO ─────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET','POST'],
    credentials: true
  },
  path: '/socket.io'
});

io.on('connection', socket => {
  console.log('⚡️ Socket connected:', socket.id);

  // join a room for this chat
  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`🔑 Socket ${socket.id} joined chat ${chatId}`);
  });

  // receive a chatMessage and broadcast to that chat room
  socket.on('chatMessage', (msg) => {
    // optionally save to DB here, then emit saved version
    io.to(msg.chatId).emit('chatMessage', msg);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// ─── Start server ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
