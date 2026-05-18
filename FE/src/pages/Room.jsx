import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../services/socket";
import useMediaStream from "../hooks/useMediaStream";
import LocalVideo from "../components/LocalVideo";
import RemoteVideo from "../components/RemoteVideo";
import Controls from "../components/Controls";

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { stream: localStream, error: streamError, startMedia } = useMediaStream();
  
  // State
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [iceState, setIceState] = useState("new");
  const [connState, setConnState] = useState("new");
  const [sigState, setSigState] = useState("stable");
  const [p2pConnected, setP2pConnected] = useState(false);
  
  // Refs
  const pc = useRef(null);
  const dc = useRef(null);
  const screenStreamRef = useRef(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const remoteSocketId = useRef(null);

  const cleanup = useCallback(() => {
    console.log("Cleanup: Closing connections");
    if (dc.current) dc.current.close();
    if (pc.current) pc.current.close();
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    pc.current = null;
    dc.current = null;
    setRemoteStream(null);
    setP2pConnected(false);
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("user-joined");
  }, []);

  const initPeerConnection = useCallback(() => {
    console.log("Initializing RTCPeerConnection...");
    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ],
    };
    
    const newPc = new RTCPeerConnection(config);

    newPc.oniceconnectionstatechange = () => setIceState(newPc.iceConnectionState);
    newPc.onconnectionstatechange = () => setConnState(newPc.connectionState);
    newPc.onsignalingstatechange = () => setSigState(newPc.signalingState);

    newPc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", { candidate, roomId });
      }
    };

    newPc.ontrack = ({ streams }) => {
      console.log("Remote track received:", streams[0]);
      if (streams && streams[0]) {
        setRemoteStream(streams[0]);
      }
    };

    const setupDataChannel = (channel) => {
      dc.current = channel;
      channel.onopen = () => {
        console.log("P2P Linked");
        setP2pConnected(true);
      };
      channel.onclose = () => setP2pConnected(false);
    };

    newPc.ondatachannel = (event) => setupDataChannel(event.channel);
    setupDataChannel(newPc.createDataChannel("link"));

    newPc.onnegotiationneeded = async () => {
      try {
        console.log("Negotiation needed...");
        makingOffer.current = true;
        await newPc.setLocalDescription();
        socket.emit("offer", { 
          offer: newPc.localDescription, 
          roomId,
          from: socket.id 
        });
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    pc.current = newPc;
    return newPc;
  }, [roomId]);

  useEffect(() => {
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    const activePc = initPeerConnection();

    socket.on("user-joined", (userId) => {
      console.log("Peer joined:", userId);
      remoteSocketId.current = userId;
      if (activePc) activePc.onnegotiationneeded();
    });

    socket.on("offer", async ({ offer, from }) => {
      console.log("Offer from:", from);
      remoteSocketId.current = from;
      try {
        const isPolite = socket.id > from;
        const collision = makingOffer.current || activePc.signalingState !== "stable";
        ignoreOffer.current = !isPolite && collision;
        if (ignoreOffer.current) return;

        await activePc.setRemoteDescription(new RTCSessionDescription(offer));
        await activePc.setLocalDescription();
        socket.emit("answer", { answer: activePc.localDescription, roomId });
      } catch (err) { console.error(err); }
    });

    socket.on("answer", async ({ answer }) => {
      try {
        await activePc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) { console.error(err); }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        if (candidate) await activePc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { if (!ignoreOffer.current) console.error(err); }
    });

    socket.emit("join-room", roomId);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      cleanup();
    };
  }, [roomId, initPeerConnection, cleanup]);

  useEffect(() => {
    if (localStream && pc.current && !isScreenSharing) {
      const senders = pc.current.getSenders();
      localStream.getTracks().forEach((track) => {
        if (!senders.find(s => s.track?.id === track.id)) {
          pc.current.addTrack(track, localStream);
        }
      });
    }
  }, [localStream, isScreenSharing]);

  async function handleInitialMedia(type) {
    try {
      const stream = await startMedia(true, true);
      stream.getAudioTracks().forEach(t => t.enabled = (type === 'audio'));
      stream.getVideoTracks().forEach(t => t.enabled = (type === 'video'));
      setIsAudioEnabled(type === 'audio');
      setIsVideoEnabled(type === 'video');
    } catch (err) { console.error(err); }
  }

  const toggleAudio = async () => {
    if (!localStream) return await handleInitialMedia('audio');
    const e = !isAudioEnabled;
    localStream.getAudioTracks().forEach(t => t.enabled = e);
    setIsAudioEnabled(e);
  };

  const toggleVideo = async () => {
    if (!localStream) return await handleInitialMedia('video');
    const e = !isVideoEnabled;
    localStream.getVideoTracks().forEach(t => t.enabled = e);
    setIsVideoEnabled(e);
  };

  const shareScreen = async () => {
    try {
      if (isScreenSharing) {
        // Stop current share
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
        }
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setIsScreenSharing(true);

      const sender = pc.current.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        pc.current.addTrack(track, stream);
      }

      track.onended = () => {
        setIsScreenSharing(false);
        const camTrack = localStream?.getVideoTracks()[0];
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
        } else if (sender) {
          sender.replaceTrack(null);
        }
      };
    } catch (err) {
      console.error("Screen share error:", err);
      setIsScreenSharing(false);
    }
  };

  const disconnectCall = useCallback(() => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    cleanup();
    navigate('/');
  }, [localStream, cleanup, navigate]);

  return (
    <div className="room-container">
      <div className="debug-panel">
        <div className="debug-item">Server: <span className={socketConnected ? 'text-success' : 'text-danger'}>{socketConnected ? 'Connected' : 'Disconnected'}</span></div>
        <div className="debug-item">P2P: <span className={p2pConnected ? 'text-success' : 'text-danger'}>{p2pConnected ? 'Linked' : 'Not Linked'}</span></div>
        <div className="debug-item">ICE: <span>{iceState}</span></div>
        <div className="debug-item">Signaling: <span>{sigState}</span></div>
      </div>

      <div className="room-header">
        <div className="room-id-tag">
          <div className={`status-dot ${p2pConnected ? 'online' : socketConnected ? 'waiting' : 'offline'}`}></div>
          <span>Room:</span>
          <strong>{roomId}</strong>
        </div>
      </div>

      <div className="video-grid">
        <div className={`video-wrapper remote ${!remoteStream ? 'waiting' : ''}`}>
          {remoteStream ? (
            <RemoteVideo stream={remoteStream} />
          ) : (
            <div className="waiting-msg">
              <div className="pulse"></div>
              <span>{p2pConnected ? "Wait for remote media..." : "Establishing connection..."}</span>
            </div>
          )}
        </div>

        <div className={`video-wrapper local ${(!isVideoEnabled && !isScreenSharing) ? 'camera-off' : ''}`}>
          {isScreenSharing ? (
            <LocalVideo stream={screenStreamRef.current} />
          ) : localStream && isVideoEnabled ? (
            <LocalVideo stream={localStream} />
          ) : (
            <div className="local-placeholder">
              <div className="avatar">{roomId.charAt(0).toUpperCase()}</div>
              <span>Your camera is off</span>
            </div>
          )}
        </div>
      </div>

      <Controls
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        shareScreen={shareScreen}
        disconnectCall={disconnectCall}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
      />
    </div>
  );
}

export default Room;
