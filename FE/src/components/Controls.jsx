import React from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff } from 'lucide-react';

function Controls({
  toggleAudio,
  toggleVideo,
  disconnectCall,
  shareScreen,
  isAudioEnabled = true,
  isVideoEnabled = true,
}) {
  return (
    <div className="controls-bar">
      <button 
        type="button"
        onClick={toggleAudio} 
        className={`control-btn ${!isAudioEnabled ? 'danger' : ''}`}
        title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
      >
        {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button 
        type="button"
        onClick={toggleVideo} 
        className={`control-btn ${!isVideoEnabled ? 'danger' : ''}`}
        title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
      >
        {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      <button 
        type="button"
        onClick={shareScreen} 
        className="control-btn"
        title="Share Screen"
      >
        <ScreenShare size={20} />
      </button>

      <button 
        type="button"
        onClick={disconnectCall} 
        className="control-btn danger"
        title="Leave Call"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
}

export default Controls;
