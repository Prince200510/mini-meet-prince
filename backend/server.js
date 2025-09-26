const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require('cors');
const os = require('os');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
console.log(`Local IP Address: ${localIP}`);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', 
  `http://${localIP}:5173`,
  'http://10.139.58.116:5173',
  'https://mini-meet-prince.vercel.app',
  /^http:\/\/192\.168\.\d+\.\d+:5173$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:5173$/,
  /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:5173$/
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));
app.use(express.static("../"));  // Serve debug files from parent directory

app.get('/debug', (req, res) => {
  res.sendFile(require('path').resolve(__dirname, '../debug-test.html'));
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin (mobile apps, etc.)
      callback(null, true);
      return;
    }
    
    // Check string origins
    const stringOrigins = allowedOrigins.filter(o => typeof o === 'string');
    if (stringOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // Check regex origins
    const regexOrigins = allowedOrigins.filter(o => o instanceof RegExp);
    if (regexOrigins.some(regex => regex.test(origin))) {
      callback(null, true);
      return;
    }
    
    console.log(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

io.on("connection", socket => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId) => {
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit("peer-joined", socket.id);

    socket.on("offer", (data) => {
      console.log(`Offer received from ${socket.id} for room ${roomId}`);
      socket.to(roomId).emit("offer", {...data, from: socket.id});
    });

    socket.on("answer", (data) => {
      console.log(`Answer received from ${socket.id} for room ${roomId}`);
      socket.to(roomId).emit("answer", {...data, from: socket.id});
    });

    socket.on("candidate", (data) => {
      console.log(`Candidate received from ${socket.id} for room ${roomId}`);
      socket.to(roomId).emit("candidate", {...data, from: socket.id});
    });

    socket.on("wb-fallback", (data) => {
      console.log(`Whiteboard fallback message from ${socket.id} in room ${roomId}`);
      socket.to(roomId).emit("wb-fallback", data);
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected from room ${roomId}`);
      socket.to(roomId).emit("peer-left", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://${localIP}:${PORT}`);
  console.log(`Your IP access: http://10.139.58.116:${PORT}`);
});
