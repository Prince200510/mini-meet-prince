const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const allowedOrigins = [
  'http://localhost:3000',
  'https://mini-meet-prince.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
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
server.listen(PORT, () => console.log("Server running on port", PORT));
