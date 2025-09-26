// Simple test script to check backend connection
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to backend server!', socket.id);
  
  // Test joining a room
  socket.emit('join-room', 'test-room');
  console.log('📝 Joined test room');
  
  setTimeout(() => {
    socket.disconnect();
    console.log('🔌 Disconnected from server');
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('peer-joined', (peerId) => {
  console.log('👥 Peer joined:', peerId);
});

console.log('🔄 Attempting to connect to backend...');