"use client";

import { useSocket } from "@/context/SocketContext";
import VideoContainer from "./VideoContainer";
import { useCallback, useEffect, useState } from "react";
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff } from "react-icons/md";

const VideoCall = () => {
  const { localStream, peer, ongoingCall, handleHangUp, isCallEnded } = useSocket();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(isCallEnded);

  useEffect(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      setIsVideoOn(videoTrack.enabled);
      const audioTrack = localStream.getAudioTracks()[0];
      setIsMicOn(audioTrack.enabled);
    }
  }, [localStream]);
  useEffect(() => {
    if (isCallEnded) {
      const timer = setTimeout(() => {
        setIsTextVisible(false); // Sembunyikan teks setelah 1 detik
      }, 1000); // 1000 ms = 1 detik

      // Bersihkan timer saat komponen di-unmount atau ketika isCallEnded berubah
      return () => clearTimeout(timer);
    }
  }, [isCallEnded]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  }, [localStream]);

  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }, [localStream]);

  const isOnCall = localStream && peer && ongoingCall ? true : false;

  if (isCallEnded && isTextVisible) {
    return <div className="mt-5 text-rose-500 text-center">Call Ended</div>;
  }

  return (
    <div>
      <div className="mt-4 relative">
        {localStream && <VideoContainer stream={localStream} isLocalStream={true} isOnCall={isOnCall} />}
        {peer && peer.stream && <VideoContainer stream={peer?.stream} isLocalStream={false} isOnCall={isOnCall} />}
      </div>
      {localStream && (
        <div className="mt-8 flex items-center justify-center">
          <button onClick={toggleMic}>{isMicOn ? <MdMic size={28} /> : <MdMicOff size={28} />}</button>
          <button className="px-4 py-2 bg-rose-500 text-white rounded mx-4" onClick={() => handleHangUp({ ongoingCall: ongoingCall ? ongoingCall : undefined, isEmitHangup: true })}>
            End Call
          </button>
          <button onClick={toggleCamera}>{isVideoOn ? <MdVideocam size={28} /> : <MdVideocamOff size={28} />}</button>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
