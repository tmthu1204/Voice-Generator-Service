const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./db');
const voiceRoutes = require('./routes/voiceRoutes');
const authMiddleware = require('./middleware/auth');
const { startConsumer, registerSocket, unregisterSocket } = require('./consumer');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Cho phép tất cả các origin trong môi trường development
    methods: ["GET", "POST"]
  }
});

// Lưu trữ các kết nối socket theo job_id
const socketConnections = new Map();

// Xử lý kết nối WebSocket
io.on('connection', (socket) => {
  console.log('Client đã kết nối:', socket.id);

  // Lắng nghe sự kiện đăng ký theo dõi job
  socket.on('subscribe_job', (jobId) => {
    registerSocket(jobId, socket);
  });

  // Lắng nghe sự kiện ngắt kết nối
  socket.on('disconnect', () => {
    console.log('Client đã ngắt kết nối:', socket.id);
    // Tìm và xóa tất cả các job mà client này đang theo dõi
    for (const [jobId, sock] of socketConnections.entries()) {
      if (sock.id === socket.id) {
        unregisterSocket(jobId);
      }
    }
  });
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads/voices', express.static(path.join(__dirname, 'uploads/voices')));
app.use('/samples', express.static(path.join(__dirname, 'public/samples'))); // For preview files

// Routes
app.use('/api/voice', authMiddleware, voiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Có lỗi xảy ra',
    error: err.message 
  });
});

// Export io để sử dụng trong các module khác
app.set('io', io);
app.set('socketConnections', socketConnections);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Voice service running on port ${PORT}`);
  // Khởi động consumer sau khi server đã chạy
  startConsumer().catch(err => {
    console.error('Lỗi khi khởi động consumer:', err);
    process.exit(1);
  });
});

// Xử lý khi tắt server
process.on('SIGTERM', () => {
  console.log('Đang tắt server...');
  httpServer.close(() => {
    console.log('Server đã tắt');
    process.exit(0);
  });
});

module.exports = app;
