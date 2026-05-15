import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, ArrowRight } from 'lucide-react';

function Landing() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    }
  };

  const createNewRoom = () => {
    const id = Math.random().toString(36).substring(2, 10);
    navigate(`/room/${id}`);
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="logo-section">
          <div className="logo-icon">
            <Video size={40} className="text-primary" />
          </div>
          <h1>WebRTC Meet</h1>
          <p>Premium video meetings. Now free for everyone.</p>
        </div>

        <div className="action-sections">
          <button onClick={createNewRoom} className="create-btn">
            <Plus size={20} />
            New Meeting
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <form onSubmit={handleJoin} className="join-form">
            <input
              type="text"
              placeholder="Enter a room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button type="submit" disabled={!roomId.trim()} className="join-btn">
              Join
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        <div className="landing-footer">
          <p>Secure, reliable, and high-quality video conferencing.</p>
        </div>
      </div>
    </div>
  );
}

export default Landing;
