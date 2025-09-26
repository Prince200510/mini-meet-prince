import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://mini-meet-prince.onrender.com';

const STUN = [{ urls: "stun:stun.l.google.com:19302" }];

export const useSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return socket;
};

export const useWebRTC = (socket) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [pc, setPc] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const currentRoomId = useRef(null);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Updating local video element with stream');
      const videoElement = localVideoRef.current;
      
      if (videoElement.srcObject !== localStream) {
        videoElement.srcObject = localStream;
        videoElement.load();
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Local video playing successfully');
            })
            .catch(e => {
              console.warn('Local video play failed in effect:', e);
              setTimeout(() => {
                if (videoElement.srcObject === localStream) {
                  videoElement.load();
                  videoElement.play().catch(e2 => console.warn('Local video retry failed:', e2));
                }
              }, 500);
            });
        }
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Updating remote video element with stream');
      const videoElement = remoteVideoRef.current;
      
      // Check if stream has video tracks
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();
      console.log('Remote stream tracks - Video:', videoTracks.length, 'Audio:', audioTracks.length);
      
      // Only proceed if we have active tracks
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        if (videoElement.srcObject !== remoteStream) {
          console.log('Setting remote stream to video element');
          videoElement.srcObject = remoteStream;
          
          // Force load and play
          videoElement.load();
          
          // Add event listeners for debugging
          videoElement.onloadstart = () => console.log('Remote video load started');
          videoElement.oncanplay = () => console.log('Remote video can play');
          videoElement.onplaying = () => console.log('Remote video is playing');
          videoElement.onerror = (e) => console.error('Remote video error:', e);
          
          // Attempt to play with multiple retry attempts
          const attemptPlay = (retries = 3) => {
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Remote video playing successfully');
                })
                .catch(e => {
                  console.warn(`Remote video play failed (attempt ${4-retries}):`, e);
                  if (retries > 0) {
                    setTimeout(() => {
                      if (videoElement.srcObject === remoteStream) {
                        videoElement.load();
                        attemptPlay(retries - 1);
                      }
                    }, 1000);
                  }
                });
            }
          };
          
          // Start play attempts after a short delay
          setTimeout(() => attemptPlay(), 100);
        }
      } else {
        console.log('Remote stream has no active video tracks');
      }
    }
  }, [remoteStream]);
  useEffect(() => {
    if (localStream && pc && pc.signalingState !== 'closed') {
      console.log('Local stream and peer connection ready, adding tracks...');
      const senders = pc.getSenders();
      
      localStream.getTracks().forEach(track => {
        const existingSender = senders.find(sender => 
          sender.track && sender.track.kind === track.kind
        );
        
        if (!existingSender) {
          console.log('Adding track to peer connection:', track.kind, 'enabled:', track.enabled);
          try {
            pc.addTrack(track, localStream);
          } catch (error) {
            console.error('Error adding track:', error);
          }
        } else {
          console.log('Track already added:', track.kind);
        }
      });
    }
  }, [localStream, pc]);

  const startLocalMedia = async (audioOnly = false) => {
    console.log('Starting local media, audioOnly:', audioOnly);
    const constraints = audioOnly ? { audio: true, video: false } : {
      audio: true,
      video: { width: 320, height: 240, frameRate: 15 }
    };
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got local stream with tracks:', stream.getTracks().map(t => t.kind));
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  const initPeerConnection = (roomId, onMessage) => {
    console.log('Initializing peer connection for room:', roomId);
    currentRoomId.current = roomId;
    
    // Reset peer left state when initializing new connection
    setPeerLeft(false);
    
    const peerConnection = new RTCPeerConnection({ iceServers: STUN });
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setPeerConnected(true);
        console.log('Peer connection established!');
        
        // Ensure remote video is playing after connection
        setTimeout(() => {
          if (remoteStream && remoteVideoRef.current) {
            const videoElement = remoteVideoRef.current;
            if (videoElement.paused) {
              console.log('Remote video is paused, attempting to play');
              videoElement.play().catch(e => console.warn('Auto-play failed after connection:', e));
            }
          }
        }, 1000);
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        setPeerConnected(false);
        console.log('Peer connection lost');
        // Clear remote stream on disconnect
        setRemoteStream(null);
        setIsConnected(false);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
      
      // Additional handling for ICE connection states
      switch (peerConnection.iceConnectionState) {
        case 'connected':
        case 'completed':
          console.log('ICE connection successful, ensuring media playback');
          // Double-check that remote video is playing
          setTimeout(() => {
            if (remoteStream && remoteVideoRef.current) {
              const videoElement = remoteVideoRef.current;
              console.log('Checking remote video after ICE connected - paused:', videoElement.paused, 'readyState:', videoElement.readyState);
              if (videoElement.paused && videoElement.readyState >= 2) {
                videoElement.play().catch(e => console.warn('ICE connected auto-play failed:', e));
              }
            }
          }, 500);
          break;
        case 'disconnected':
          console.log('ICE disconnected, attempting to restart');
          // Attempt ICE restart if supported
          if (peerConnection.restartIce) {
            peerConnection.restartIce();
          }
          break;
        case 'failed':
          console.log('ICE connection failed');
          setRemoteStream(null);
          setIsConnected(false);
          setPeerConnected(false);
          break;
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, 'streams:', event.streams.length);
      console.log('Track state:', event.track.readyState, 'enabled:', event.track.enabled);
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('Setting remote stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}`));
        
        // Add event listeners to track changes
        stream.getTracks().forEach(track => {
          track.onended = () => {
            console.log(`Remote ${track.kind} track ended`);
          };
          track.onmute = () => {
            console.log(`Remote ${track.kind} track muted`);
          };
          track.onunmute = () => {
            console.log(`Remote ${track.kind} track unmuted`);
          };
        });
        
        setRemoteStream(stream);
        setIsConnected(true);
        
        // Force video element update after a short delay
        setTimeout(() => {
          if (remoteVideoRef.current && stream.getVideoTracks().length > 0) {
            const videoElement = remoteVideoRef.current;
            if (videoElement.srcObject !== stream) {
              console.log('Force updating remote video element after track received');
              videoElement.srcObject = stream;
              videoElement.load();
              videoElement.play().catch(e => console.warn('Force play failed:', e));
            }
          }
        }, 500);
      } else {
        console.warn('No streams in track event, creating new stream');
        // Create a new stream with the track
        const newStream = new MediaStream([event.track]);
        setRemoteStream(newStream);
        setIsConnected(true);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('Sending ICE candidate');
        socket.emit('candidate', event.candidate);
      } else if (!event.candidate) {
        console.log('ICE gathering completed');
      }
    };

    const channel = peerConnection.createDataChannel('messaging');
    setupDataChannel(channel, onMessage);
    setDataChannel(channel);

    peerConnection.ondatachannel = (event) => {
      console.log('Received data channel');
      const receivedChannel = event.channel;
      setupDataChannel(receivedChannel, onMessage);
      setDataChannel(receivedChannel);
    };

    if (socket) {
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
      socket.off('peer-joined');
      socket.off('peer-left');

      socket.on('offer', async (data) => {
        console.log('Received offer from:', data.from, 'Current signaling state:', peerConnection.signalingState);
        try {
          if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('Sending answer');
            socket.emit('answer', answer);
          } else {
            console.warn('Invalid signaling state for offer:', peerConnection.signalingState);
          }
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      });

      socket.on('answer', async (data) => {
        console.log('Received answer from:', data.from, 'Current signaling state:', peerConnection.signalingState);
        try {
          if (peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          } else {
            console.warn('Invalid signaling state for answer:', peerConnection.signalingState);
          }
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      });

      socket.on('candidate', async (candidate) => {
        console.log('Received ICE candidate');
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.warn('ICE candidate error:', error);
        }
      });

      socket.on('peer-joined', async (peerId) => {
        console.log('Peer joined, creating offer for peer:', peerId);
        setPeerLeft(false); // Reset peer left state
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log('Sending offer');
          socket.emit('offer', offer);
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      });

      socket.on('peer-left', (peerId) => {
        console.log('Peer left:', peerId);
        setPeerLeft(true);
        setRemoteStream(null);
        setIsConnected(false);
        setPeerConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
          remoteVideoRef.current.load();
        }
        // Clean up peer connection if it exists
        if (pc) {
          const receivers = pc.getReceivers();
          receivers.forEach(receiver => {
            if (receiver.track) {
              receiver.track.stop();
            }
          });
        }
      });
    }

    setPc(peerConnection);
    return peerConnection;
  };

  const setupDataChannel = (channel, onMessage) => {
    channel.onopen = () => {
      console.log('Data channel opened');
    };
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received data channel message:', message.type);
        onMessage(message);
      } catch (error) {
        console.error('Data channel message error:', error);
      }
    };
    channel.onclose = () => {
      console.log('Data channel closed');
    };
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  };

  const sendDataChannelMessage = (message) => {
    console.log('Attempting to send data channel message:', message.type);
    if (dataChannel && dataChannel.readyState === 'open') {
      console.log('Sending via data channel');
      dataChannel.send(JSON.stringify(message));
      return true;
    } else {
      console.log('Data channel not ready, state:', dataChannel?.readyState);
      return false;
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return !audioTracks[0]?.enabled;
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return !videoTracks[0]?.enabled;
    }
    return false;
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getTracks()[0];
      
      if (pc) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      videoTrack.onended = async () => {
        if (localStream && pc) {
          const cameraTrack = localStream.getVideoTracks()[0];
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender && cameraTrack) {
            await sender.replaceTrack(cameraTrack);
          }
        }
      };

      return videoTrack;
    } catch (error) {
      console.error('Screen sharing error:', error);
      throw error;
    }
  };

  const debugVideoState = () => {
    console.log('=== Video Debug Info ===');
    console.log('Local stream:', localStream ? 'Available' : 'None');
    console.log('Remote stream:', remoteStream ? 'Available' : 'None');
    console.log('Local video ref:', localVideoRef.current ? 'Available' : 'None');
    console.log('Remote video ref:', remoteVideoRef.current ? 'Available' : 'None');
    console.log('Peer connected:', peerConnected);
    console.log('Is connected:', isConnected);
    
    if (localStream) {
      console.log('Local tracks:', localStream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}`));
    }
    
    if (remoteStream) {
      console.log('Remote tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}`));
    }
    
    if (localVideoRef.current) {
      console.log('Local video srcObject:', localVideoRef.current.srcObject ? 'Set' : 'None');
      console.log('Local video paused:', localVideoRef.current.paused);
      console.log('Local video readyState:', localVideoRef.current.readyState);
    }
    
    if (remoteVideoRef.current) {
      console.log('Remote video srcObject:', remoteVideoRef.current.srcObject ? 'Set' : 'None');
      console.log('Remote video paused:', remoteVideoRef.current.paused);
      console.log('Remote video readyState:', remoteVideoRef.current.readyState);
    }
    
    if (pc) {
      console.log('PC signaling state:', pc.signalingState);
      console.log('PC connection state:', pc.connectionState);
      console.log('PC ice connection state:', pc.iceConnectionState);
      console.log('PC senders:', pc.getSenders().length);
      console.log('PC receivers:', pc.getReceivers().length);
    }
    console.log('========================');
  };

  const forceRefreshRemoteVideo = () => {
    console.log('Force refreshing remote video...');
    if (remoteStream && remoteVideoRef.current) {
      const videoElement = remoteVideoRef.current;
      const currentStream = remoteStream;
      
      // Clear and reset the video element
      videoElement.srcObject = null;
      videoElement.load();
      
      setTimeout(() => {
        videoElement.srcObject = currentStream;
        videoElement.load();
        videoElement.play()
          .then(() => console.log('Force refresh successful'))
          .catch(e => console.warn('Force refresh failed:', e));
      }, 100);
    }
  };

  const resetPeerLeftState = () => {
    console.log('Resetting peer left state');
    setPeerLeft(false);
  };

  return {
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isConnected: peerConnected, 
    peerLeft,
    startLocalMedia,
    initPeerConnection,
    sendDataChannelMessage,
    toggleAudio,
    toggleVideo,
    shareScreen,
    debugVideoState,
    forceRefreshRemoteVideo,
    resetPeerLeftState
  };
};