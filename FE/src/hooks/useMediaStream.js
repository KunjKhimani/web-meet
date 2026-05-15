import { useState, useCallback } from "react";

const useMediaStream = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  const startMedia = useCallback(async (requestVideo = true, requestAudio = true) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: requestVideo,
        audio: requestAudio,
      });
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      console.warn("Could not access requested media, trying fallback...", err);
      // Fallback: If video requested but failed, try audio only if audio was also requested
      if (requestVideo && requestAudio) {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          setStream(audioOnlyStream);
          return audioOnlyStream;
        } catch (audioErr) {
          setError("Permission denied or devices not found.");
          throw audioErr;
        }
      }
      setError("Permission denied or devices not found.");
      throw err;
    }
  }, []);

  return { stream, setStream, error, startMedia };
};

export default useMediaStream;
