module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    // JOIN ROOM
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);
      // Notify others in the room that a new user joined
      socket.to(roomId).emit("user-joined", socket.id);
    });

    // OFFER
    socket.on("offer", ({ offer, roomId, from }) => {
      console.log(`Offer from ${from || socket.id} to room ${roomId}`);
      // Pass the sender ID along with the offer
      socket.to(roomId).emit("offer", { offer, from: from || socket.id });
    });

    // ANSWER
    socket.on("answer", ({ answer, roomId }) => {
      console.log(`Answer from ${socket.id} to room ${roomId}`);
      socket.to(roomId).emit("answer", { answer });
    });

    // ICE CANDIDATE
    socket.on("ice-candidate", ({ candidate, roomId }) => {
      console.log(`ICE Candidate from ${socket.id} to room ${roomId}`);
      socket.to(roomId).emit("ice-candidate", { candidate });
    });

    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.id);
    });
  });
};
