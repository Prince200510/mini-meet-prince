import { useState, useEffect, useRef } from 'react';
import { FaPen,  FaEraser,  FaMinus,  FaSquare,  FaCircle,  FaArrowRight,  FaStop,  FaGem,  FaEllipsisH, FaFont, FaTrash, FaDownload, FaTimes, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaDesktop, FaRecordVinyl, FaComments, FaPhone, FaCog, FaUsers, FaPaperPlane, FaRocket, FaVolumeUp } from 'react-icons/fa';
import { BiStopCircle } from 'react-icons/bi';
import { MdScreenShare, MdStopScreenShare, MdVideocam, MdVideocamOff, MdMic, MdMicOff, MdChat, MdCallEnd, MdAudiotrack } from 'react-icons/md';
import { useSocket, useWebRTC } from './hooks/useWebRTC';
import { useWhiteboard } from './hooks/useWhiteboard';
import WhiteboardToolbar from './components/WhiteboardToolbar';

function Meet() {
  const [roomId, setRoomId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPreMeeting, setShowPreMeeting] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [mediaReady, setMediaReady] = useState(false);
  const [notification, setNotification] = useState(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const socket = useSocket();
  const webRTC = useWebRTC(socket);
  
  const addChatMessage = (message) => {
    setChatMessages(prev => [...prev, message]);
  };

  const whiteboard = useWhiteboard(
    webRTC.sendDataChannelMessage,
    roomId,
    socket
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('Socket connected to server');
      addChatMessage('[System] Connected to server');
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected from server');
      addChatMessage('[System] Disconnected from server');
    };

    const handleWbFallback = (data) => {
      console.log('Received wb-fallback message:', data.type);
      if (data.type === 'chat') {
        addChatMessage(`Peer: ${data.text}`);
      } else {
        whiteboard.handleRemoteMessage(data);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('wb-fallback', handleWbFallback);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('wb-fallback', handleWbFallback);
    };
  }, [socket, whiteboard]);

  const handleWebRTCMessage = (message) => {
    console.log('Received WebRTC message:', message.type);
    if (message.type === 'chat') {
      addChatMessage(`👥 ${message.from}: ${message.text}`);
    } else {
      whiteboard.handleRemoteMessage(message);
    }
  };

  const createRoom = async () => {
    console.log('Creating room with ID:', roomId);
    const newRoomId = roomId || Math.random().toString(36).slice(2, 9);
    setRoomId(newRoomId);
    
    const url = `${window.location.origin}${window.location.pathname}?room=${newRoomId}`;
    window.history.pushState({}, '', url);
    
    try {
      console.log('Starting local media...');
      await webRTC.startLocalMedia(audioOnly);
      setMediaReady(true);
      console.log('Initializing peer connection...');
      webRTC.initPeerConnection(newRoomId, handleWebRTCMessage);
      console.log('Joining room via socket...');
      socket.emit('join-room', newRoomId);
      addChatMessage('[System] Room created successfully! Share the link to invite others.');
      setIsConnected(true);
      setShowPreMeeting(false);
      setParticipantCount(webRTC.isConnected ? 2 : 1);
    } catch (error) {
      console.error('Error creating room:', error);
      addChatMessage(`[System] Error creating room: ${error.message}`);
    }
  };

  const joinRoom = async () => {
    if (!roomId) {
      alert('Please enter a room ID');
      return;
    }
    
    console.log('Joining room with ID:', roomId);
    try {
      console.log('Starting local media...');
      await webRTC.startLocalMedia(audioOnly);
      setMediaReady(true);
      console.log('Initializing peer connection...');
      webRTC.initPeerConnection(roomId, handleWebRTCMessage);
      console.log('Joining room via socket...');
      socket.emit('join-room', roomId);
      addChatMessage('[System] Joined room successfully! Waiting for peers to connect.');
      setIsConnected(true);
      setShowPreMeeting(false);
      setParticipantCount(webRTC.isConnected ? 2 : 1);
    } catch (error) {
      console.error('Error joining room:', error);
      addChatMessage(`[System] Error joining room: ${error.message}`);
    }
  };

  const toggleMute = () => {
    const muted = webRTC.toggleAudio();
    setIsMuted(muted);
    addChatMessage(`[System] Audio ${muted ? 'muted' : 'unmuted'}`);
  };

  const toggleCamera = () => {
    const camOff = webRTC.toggleVideo();
    setIsCamOff(camOff);
    addChatMessage(`[System] Camera ${camOff ? 'turned off' : 'turned on'}`);
  };

  const startScreenShare = async () => {
    try {
      await webRTC.shareScreen();
      setIsScreenSharing(true);
      addChatMessage('[System] Screen sharing started');
    } catch (error) {
      addChatMessage(`[System] Screen share failed: ${error.message}`);
    }
  };

  const startRecording = () => {
    if (!webRTC.localStream) {
      alert('Start media first');
      return;
    }

    if (!isRecording) {
      recordedChunksRef.current = [];
      recorderRef.current = new MediaRecorder(webRTC.localStream, {
        mimeType: 'video/webm; codecs=vp8,opus'
      });
      
      recorderRef.current.ondataavailable = (event) => {
        if (event.data.size) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      recorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mini-meet-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        a.click();
        addChatMessage('[System] Recording saved successfully!');
      };
      
      recorderRef.current.start();
      setIsRecording(true);
      addChatMessage('[System] Recording started');
    } else {
      recorderRef.current.stop();
      setIsRecording(false);
      addChatMessage('[System] Recording stopped');
    }
  };

  const endCall = () => {
    if (webRTC.localStream) {
      webRTC.localStream.getTracks().forEach(track => track.stop());
    }
    setShowPreMeeting(true);
    setIsConnected(false);
    setParticipantCount(1);
    setMediaReady(false);
    addChatMessage('[System] Call ended');
  };

  const sendChatMessage = (message) => {
    addChatMessage(`Me: ${message}`);
    const payload = { type: 'chat', from: 'Peer', text: message };
    
    console.log('Sending chat message:', message);
    const sentViaDataChannel = webRTC.sendDataChannelMessage(payload);
    
    if (!sentViaDataChannel && socket && roomId) {
      console.log('Sending chat via socket fallback');
      socket.emit('wb-fallback', { type: 'chat', text: message, room: roomId });
    }
  };

  const downloadWhiteboard = () => {
    if (whiteboard.canvasRef.current) {
      const canvas = whiteboard.canvasRef.current;
      const link = document.createElement('a');
      link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
      addChatMessage('[System] Whiteboard downloaded successfully!');
    }
  };

  useEffect(() => {
    addChatMessage('[System] Welcome to Mini Meet! Create a room or join an existing one to start your peer-to-peer video conference.');
  }, []);

  const initPreviewMedia = async () => {
    try {
      await webRTC.startLocalMedia(audioOnly);
      setMediaReady(true);
    } catch (error) {
      console.error('Error starting preview media:', error);
      addChatMessage(`[System] Error accessing media: ${error.message}`);
    }
  };

  useEffect(() => {
    if (showPreMeeting && !mediaReady) {
      initPreviewMedia();
    }
  }, [showPreMeeting, audioOnly]);

  useEffect(() => {
    if (showWhiteboard && whiteboard.canvasRef.current) {
      setTimeout(() => {
        // Initialize canvas with proper size and optimization
        whiteboard.optimizeCanvas?.();
        whiteboard.restoreWhiteboard();
        whiteboard.drawGrid();
        if (webRTC.isConnected) {
          whiteboard.requestWhiteboardState();
        }
      }, 100);
    }
  }, [showWhiteboard]);

  useEffect(() => {
    if (webRTC.peerLeft) {
      setParticipantCount(1);
      addChatMessage('[System] Participant has left the meeting');
    } else {
      setParticipantCount(webRTC.isConnected ? 2 : 1);
    }
  }, [webRTC.isConnected, webRTC.peerLeft]);

  // Auto-retry remote video if it's not playing
  useEffect(() => {
    if (webRTC.isConnected && webRTC.remoteStream && webRTC.remoteVideoRef.current) {
      const checkVideoInterval = setInterval(() => {
        const videoElement = webRTC.remoteVideoRef.current;
        if (videoElement && videoElement.srcObject && videoElement.paused && videoElement.readyState >= 2) {
          console.log('Auto-retrying remote video playback');
          videoElement.play().catch(e => {
            console.warn('Auto-retry play failed:', e);
            // Try force refresh as last resort
            if (webRTC.forceRefreshRemoteVideo) {
              webRTC.forceRefreshRemoteVideo();
            }
          });
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(checkVideoInterval);
    }
  }, [webRTC.isConnected, webRTC.remoteStream, webRTC.forceRefreshRemoteVideo]);

  if (showPreMeeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <MdVideocam className="text-white text-2xl" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">Mini Meet</h1>
            </div>
            <p className="text-lg text-gray-600 max-w-md mx-auto"> Lightweight P2P video calls with interactive whiteboard for rural areas </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Camera Preview</h3>
                <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden mb-6">
                  {mediaReady && webRTC.localStream ? (
                    <video
                      key="preview-video"
                      ref={webRTC.localVideoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                      <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4">
                        <MdVideocam className="text-3xl" />
                      </div>
                      <p className="text-center text-sm text-gray-300">
                        {mediaReady ? 'Camera initializing...' : 'Click "Start Camera" to preview'}
                      </p>
                    </div>
                  )}
                  {mediaReady && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <div className="flex space-x-3">
                        <button 
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            isMuted 
                              ? 'bg-red-500 hover:bg-red-600 text-white' 
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                          onClick={toggleMute}
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <MdMicOff /> : <MdMic />}
                        </button>
                        <button 
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            isCamOff 
                              ? 'bg-red-500 hover:bg-red-600 text-white' 
                              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                          onClick={toggleCamera}
                          title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
                        >
                          {isCamOff ? <MdVideocamOff /> : <MdVideocam />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${mediaReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">
                      {mediaReady ? 'Camera & Microphone Ready' : 'Setting up devices...'}
                    </span>
                  </div>
                  {webRTC.localStream && (
                    <>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-600">Video: {webRTC.localStream.getVideoTracks().length > 0 ? 'Active' : 'Disabled'}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-600">Audio: {webRTC.localStream.getAudioTracks().length > 0 ? 'Active' : 'Disabled'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">Join or Create Room</h3>
                {!mediaReady && (
                  <div className="mb-6">
                    <button className="btn-primary w-full flex items-center justify-center space-x-2 py-4" onClick={initPreviewMedia}>
                      <MdVideocam className="text-xl" />
                      <span className="text-lg">Start Camera</span>
                    </button>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room ID (optional)</label>
                    <input type="text" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg" placeholder="Enter room ID or leave blank for new room" value={roomId} onChange={(e) => setRoomId(e.target.value)}/>
                  </div>
                  <button className="btn-primary w-full flex items-center justify-center space-x-3 py-4 text-lg"  onClick={createRoom} disabled={!mediaReady}>
                    <FaRocket className="text-xl" />
                    <span>Create / Get Link</span>
                  </button>
        
                  <div className="text-center">
                    <span className="text-sm text-gray-500">or</span>
                  </div>
                  
                  <button className="btn-secondary w-full flex items-center justify-center space-x-3 py-4 text-lg"  onClick={joinRoom}  disabled={!roomId || !mediaReady}>
                    <FaUsers className="text-xl" />
                    <span>Join Room</span>
                  </button>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <label className="flex items-center space-x-3 text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                      <div className="flex items-center space-x-2">
                        <MdAudiotrack className="text-xl" />
                        <span>Audio Only Mode</span>
                        <span className="text-sm text-gray-500">(Faster for rural connections)</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MdVideocam className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Mini Meet</h1>
              <p className="text-sm text-gray-300">Room: {roomId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                webRTC.peerLeft ? 'bg-yellow-400' : 
                webRTC.isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">
                {webRTC.peerLeft 
                  ? 'Participant left' 
                  : webRTC.isConnected 
                    ? 'Connected' 
                    : 'Waiting for peer...'
                }
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <FaUsers className="text-gray-400" />
              <span>{participantCount} participant{participantCount > 1 ? 's' : ''}</span>
            </div>
            <div className="text-sm text-gray-300">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-6xl w-full">
          <div className={`grid gap-6 ${participantCount === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} mb-8`}>
            <div className="relative group">
              <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl aspect-video">
                {webRTC.localStream ? (
                  <video
                    key="local-video"
                    ref={webRTC.localVideoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <span className="text-3xl font-bold">Y</span>
                      </div>
                      <p className="text-gray-300">Your Camera</p>
                    </div>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-4 left-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-medium bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">You</span>
                      <div className="flex space-x-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}>
                          {isMuted ? <MdMicOff className="text-white" /> : <MdMic className="text-white" />}
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCamOff ? 'bg-red-500' : 'bg-green-500'}`}>
                          {isCamOff ? <MdVideocamOff className="text-white" /> : <MdVideocam className="text-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {participantCount === 2 && (
              <div className="relative group">
                <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl aspect-video">
                  {webRTC.remoteStream ? (
                    <div className="relative w-full h-full">
                      <video
                        key="remote-video"
                        ref={webRTC.remoteVideoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        muted={false}
                        playsInline
                        onLoadStart={() => console.log('Remote video load start')}
                        onCanPlay={() => console.log('Remote video can play')}
                        onPlaying={() => console.log('Remote video playing')}
                        onError={(e) => console.error('Remote video error:', e)}
                        onStalled={() => console.warn('Remote video stalled')}
                      />
                      {/* Video troubleshooting overlay */}
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => {
                            console.log('Manual video refresh clicked');
                            webRTC.forceRefreshRemoteVideo();
                            addChatMessage('[System] Attempting to refresh peer video');
                          }}
                          className="bg-black bg-opacity-50 text-white p-1 rounded text-xs hover:bg-opacity-70"
                          title="Refresh peer video"
                        >
                          🔄
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                      <div className="text-center">
                        <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <span className="text-3xl font-bold">
                            {webRTC.peerLeft ? '👋' : 'P'}
                          </span>
                        </div>
                        <p className="text-gray-300 mb-2">
                          {webRTC.peerLeft 
                            ? 'Participant has left the meeting' 
                            : webRTC.isConnected 
                              ? 'Loading peer video...' 
                              : 'Waiting for peer...'
                          }
                        </p>
                        {webRTC.peerLeft && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm text-gray-400">
                              Share the room link to invite others
                            </p>
                            <button
                              onClick={() => {
                                // Reset the peer left state and try to refresh the connection
                                console.log('Resetting meeting for new peer');
                                webRTC.resetPeerLeftState();
                                if (webRTC.initPeerConnection && socket) {
                                  webRTC.initPeerConnection(roomId, handleWebRTCMessage);
                                }
                                addChatMessage('[System] Ready for new participants to join');
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                            >
                              🔄 Wait for New Participant
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-4 left-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-medium bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">Peer</span>
                        <div className="flex space-x-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500">
                            <MdMic className="text-white" />
                          </div>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500">
                            <MdVideocam className="text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 px-6 py-4">
          <div className="flex items-center space-x-4">
            <button 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MdMicOff size={20} /> : <MdMic size={20} />}
            </button>
            
            <button 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isCamOff 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              onClick={toggleCamera}
              title={isCamOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCamOff ? <MdVideocamOff size={20} /> : <MdVideocam size={20} />}
            </button>
            
            <button 
              className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
              onClick={startScreenShare}
              title="Share screen"
            >
              <MdScreenShare size={20} />
            </button>
            
            <button 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              onClick={startRecording}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <BiStopCircle size={20} /> : <FaRecordVinyl size={20} />}
            </button>
            
            <button 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                showWhiteboard 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              onClick={() => setShowWhiteboard(!showWhiteboard)}
              title="Toggle whiteboard"
            >
              <FaPen size={16} />
            </button>

            {/* Debug/Refresh Video Button - only show when there are issues */}
            {webRTC.isConnected && (
              <button 
                className="w-14 h-14 rounded-full flex items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-white transition-all duration-200"
                onClick={() => {
                  console.log('Debug button clicked');
                  webRTC.debugVideoState();
                  if (webRTC.forceRefreshRemoteVideo) {
                    webRTC.forceRefreshRemoteVideo();
                  }
                  addChatMessage('[System] Video debug info logged to console');
                }}
                title="Debug & Refresh Video"
              >
                🔧
              </button>
            )}
            
            <div className="h-8 w-px bg-gray-600"></div>
            
            <button 
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                showSidebar 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              onClick={() => setShowSidebar(!showSidebar)}
              title="Toggle chat"
            >
              <MdChat size={20} />
            </button>
            
            <button 
              className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all duration-200" 
              onClick={endCall} 
              title="End call"
            >
              <MdCallEnd size={20} />
            </button>
          </div>
        </div>
      </div>
      <div className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl transform transition-transform duration-300 z-40 ${showSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Chat</h3>
          <button 
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-600 transition-colors"
            onClick={() => setShowSidebar(false)}
          >
            <FaTimes size={16} />
          </button>
        </div>
        <div className="flex-1 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-140px)]">
            {chatMessages.map((message, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg text-sm max-w-full break-words ${
                  message.startsWith('[') 
                    ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                    : message.startsWith('📤') 
                      ? 'bg-green-50 text-green-800 ml-8 border border-green-200' 
                      : 'bg-gray-50 text-gray-800 border border-gray-200'
                }`}
              >
                {message}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Type a message..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    sendChatMessage(e.target.value.trim());
                    e.target.value = '';
                  }
                }}
              />
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
                title="Send message"
                onClick={(e) => {
                  const input = e.target.parentElement.querySelector('input');
                  if (input.value.trim()) {
                    sendChatMessage(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                <FaPaperPlane size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
      {showWhiteboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FaPen className="text-white text-sm" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Enhanced Whiteboard</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    {whiteboard.syncStatus === 'requesting' && (
                      <span className="text-yellow-600">• Requesting sync...</span>
                    )}
                    {whiteboard.syncStatus === 'syncing' && (
                      <span className="text-blue-600">• Syncing...</span>
                    )}
                    {whiteboard.syncStatus === 'ready' && (
                      <span className="text-green-600">• Ready</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-600 transition-colors"
                onClick={() => setShowWhiteboard(false)}
                title="Close Whiteboard"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Enhanced Toolbar */}
            <div className="border-b border-gray-200 overflow-x-auto">
              <WhiteboardToolbar
                tool={whiteboard.tool}
                setTool={whiteboard.setTool}
                toolProperties={whiteboard.toolProperties}
                setToolProperties={whiteboard.setToolProperties}
                colorPalette={whiteboard.colorPalette}
                addToRecentColors={whiteboard.addToRecentColors}
                addCustomColor={whiteboard.addCustomColor}
                undo={whiteboard.undo}
                redo={whiteboard.redo}
                canUndo={whiteboard.canUndo}
                canRedo={whiteboard.canRedo}
                clearCanvas={whiteboard.clearCanvas}
                exportAsImage={whiteboard.exportAsImage}
                saveToLocalStorage={whiteboard.saveToLocalStorage}
                loadFromLocalStorage={whiteboard.loadFromLocalStorage}
                textInput={whiteboard.textInput}
                setTextInput={whiteboard.setTextInput}
              />
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-gray-50 overflow-hidden relative">
              <canvas
                ref={whiteboard.canvasRef}
                className="w-full h-full cursor-crosshair"
                onPointerDown={whiteboard.handlePointerDown}
                onPointerMove={whiteboard.handlePointerMove}
                onPointerUp={whiteboard.handlePointerUp}
                onPointerCancel={whiteboard.handlePointerCancel}
                width={1200}
                height={800}
              />
              
              {/* Drawing grid when enabled */}
              {whiteboard.toolProperties?.showGrid && (
                <div className="absolute inset-0 pointer-events-none opacity-30">
                  {/* Grid will be drawn by the drawGrid function */}
                </div>
              )}

              {/* Status indicator */}
              <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    whiteboard.syncStatus === 'ready' ? 'bg-green-500' :
                    whiteboard.syncStatus === 'syncing' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`}></div>
                  <span className="text-gray-600">
                    Tool: {whiteboard.tool || 'None'} | 
                    Actions: {whiteboard.whiteboardData?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Text Input Modal */}
            {whiteboard.textInput?.visible && (
              <div 
                className="absolute bg-white rounded-lg shadow-lg border border-gray-300 p-4 z-10"
                style={{
                  left: `${Math.min(whiteboard.textInput.x + 50, window.innerWidth - 300)}px`,
                  top: `${Math.min(whiteboard.textInput.y + 100, window.innerHeight - 200)}px`,
                }}
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    value={whiteboard.textInput.text}
                    onChange={(e) => whiteboard.setTextInput?.({ 
                      ...whiteboard.textInput, 
                      text: e.target.value 
                    })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        whiteboard.submitTextInput?.(e.target.value);
                      } else if (e.key === 'Escape') {
                        whiteboard.cancelTextInput?.();
                      }
                    }}
                    placeholder="Enter text..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => whiteboard.setTextInput?.(prev => ({ ...prev, bold: !prev.bold }))}
                        className={`px-2 py-1 text-xs border rounded font-bold ${
                          whiteboard.textInput.bold ? 'bg-blue-500 text-white' : 'bg-gray-100'
                        }`}
                      >
                        B
                      </button>
                      <button 
                        onClick={() => whiteboard.setTextInput?.(prev => ({ ...prev, italic: !prev.italic }))}
                        className={`px-2 py-1 text-xs border rounded italic ${
                          whiteboard.textInput.italic ? 'bg-blue-500 text-white' : 'bg-gray-100'
                        }`}
                      >
                        I
                      </button>
                      <button 
                        onClick={() => whiteboard.setTextInput?.(prev => ({ ...prev, underline: !prev.underline }))}
                        className={`px-2 py-1 text-xs border rounded underline ${
                          whiteboard.textInput.underline ? 'bg-blue-500 text-white' : 'bg-gray-100'
                        }`}
                      >
                        U
                      </button>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => whiteboard.submitTextInput?.(whiteboard.textInput.text)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Add
                      </button>
                      <button 
                        onClick={whiteboard.cancelTextInput}
                        className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
            {notification}
          </div>
        </div>
      )}
    </div>
  );
};

export default Meet;
