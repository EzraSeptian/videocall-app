"use client";
import { OngoingCall, Participants, PeerData, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";

interface iSocketContext {
  onlineUsers: SocketUser[] | null;
  handleCall: (user: SocketUser) => void;
  localStream: MediaStream | null;
  ongoingCall: OngoingCall | null;
  peer: PeerData | null;
  isCallEnded: boolean;
  handleJoinCall: (ongoingCall: OngoingCall) => void;
  handleHangUp: (data: { ongoingCall?: OngoingCall; isEmitHangup?: boolean }) => void;
}

export const SocketContext = createContext<iSocketContext | null>(null);

export const SocketContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
  const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);
  const currentSocketUser = onlineUsers?.find((onlineUsers) => onlineUsers.userId === user?.id);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<PeerData | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);

  const getMediaStream = useCallback(
    async (faceMode?: string) => {
      if (localStream) {
        return localStream;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: {
              min: 640,
              ideal: 1280,
              max: 1920,
            },
            height: {
              min: 480,
              ideal: 720,
              max: 1080,
            },
            frameRate: {
              min: 16,
              ideal: 30,
              max: 30,
            },
            facingMode: videoDevices.length > 0 ? faceMode : undefined,
          },
        });

        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.log("Failed to get the stream", error);
        setLocalStream(null);
        return null;
      }
    },
    [localStream]
  );

  const handleCall = useCallback(
    async (user: SocketUser) => {
      setIsCallEnded(false);
      if (!currentSocketUser) return;
      const stream = await getMediaStream();

      if (!stream) {
        console.log("No stream in handleCall");
        return;
      }

      const participants = {
        caller: currentSocketUser,
        receiver: user,
      };
      setOngoingCall({ participants: participants, isRinging: false });

      socket?.emit("call", participants);
    },
    [socket, currentSocketUser, ongoingCall]
  );

  const onIncomingCall = useCallback(
    (participants: Participants) => {
      setOngoingCall({ participants, isRinging: true });
    },
    [socket, user, ongoingCall]
  );

  const handleHangUp = useCallback(
    (data: { ongoingCall?: OngoingCall | null; isEmitHangup?: boolean }) => {
      if (socket && user && data?.ongoingCall && data?.isEmitHangup) {
        socket.emit("hangup", { ongoingCall: data.ongoingCall, userHangupId: user.id });
      }

      setOngoingCall(null);
      setPeer(null);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }

      setIsCallEnded(true);
    },
    [socket, user, localStream]
  );

  const createPeer = useCallback(
    (stream: MediaStream, initiator: boolean) => {
      const iceServers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] }];

      const createPeer = new Peer({
        stream,
        initiator,
        trickle: true,
        config: { iceServers },
      });
      createPeer.on("stream", (stream) => {
        setPeer((prevPeer) => {
          if (prevPeer) {
            return { ...prevPeer, stream };
          }
          return prevPeer;
        });
      });

      createPeer.on("error", console.error);
      createPeer.on("close", () => {
        handleHangUp({});
      });

      const rtcPeerConnection: RTCPeerConnection = (createPeer as any)._pc;

      rtcPeerConnection.onconnectionstatechange = async () => {
        if (rtcPeerConnection.iceConnectionState === "disconnected" || rtcPeerConnection.iceConnectionState === "failed") {
          handleHangUp({});
        }
      };
      return createPeer;
    },
    [ongoingCall, setPeer]
  );

  const completePeerConnection = useCallback(
    async (connectionData: { data: { sdp: SignalData; ongoingCall: OngoingCall; isCaller: boolean } }) => {
      if (!localStream) return;

      // Cek apakah ongoingCall dan participants ada
      if (peer) {
        peer.peerConnection.signal(connectionData.data.sdp); // Akses dengan connectionData.data
        return;
      }
      // Ini buat caller
      const newPeer = createPeer(localStream, true);

      // Pastikan ongoingCall dan participants ada sebelum diakses
      if (!connectionData.data.ongoingCall || !connectionData.data.ongoingCall.participants) {
        console.error("Ongoing call or participants are missing.");
        return;
      }

      setPeer({
        peerConnection: newPeer,
        participants: connectionData.data.ongoingCall.participants.receiver,
        stream: undefined,
      });

      newPeer.on("signal", async (data: SignalData) => {
        if (socket) {
          socket.emit("webrtcSignal", {
            sdp: data,
            ongoingCall,
            isCaller: true,
          });
        }
      });
    },
    [localStream, createPeer, peer, ongoingCall]
  );

  const handleJoinCall = useCallback(
    async (ongoingCall: OngoingCall) => {
      setIsCallEnded(false);
      setOngoingCall((prev) => {
        if (prev) {
          return { ...prev, isRinging: false };
        }
        return prev;
      });
      const stream = await getMediaStream();
      if (!stream) return;
      const newPeer = createPeer(stream, true);

      setPeer({ peerConnection: newPeer, participants: ongoingCall.participants.caller, stream: undefined });

      newPeer.on("signal", async (data: SignalData) => {
        if (socket) {
          socket.emit("webrtcSignal", {
            sdp: data,
            ongoingCall,
            isCaller: false,
          });
        }
      });
    },
    [socket, currentSocketUser]
  );

  useEffect(() => {
    const newSocket = io();
    console.log;
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [user]);
  useEffect(() => {
    if (socket === null) return;
    if (socket.connected) {
      onConnect();
    }
    function onConnect() {
      setIsSocketConnected(true);
    }

    function onDisconnect() {
      setIsSocketConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isSocketConnected) return;
    socket.emit("addNewUser", user);
    socket.on("getUsers", (res) => {
      setOnlineUsers(res);
    });

    return () => {
      socket.off("getUsers", (res) => {
        setOnlineUsers(res);
      });
    };
  }, [socket, isSocketConnected, user]);

  useEffect(() => {
    if (!socket || !isSocketConnected) return;

    socket.on("incomingCall", onIncomingCall);
    socket.on("hangup", handleHangUp);
    socket.on("webrtcSignal", completePeerConnection);

    return () => {
      socket.off("incomingCall", onIncomingCall);
      socket.off("webrtcSignal", completePeerConnection);
      socket.off("hangup", handleHangUp);
    };
  }, [socket, isSocketConnected, user, onIncomingCall, completePeerConnection]);

  return <SocketContext.Provider value={{ peer, isCallEnded, handleJoinCall, localStream, onlineUsers, ongoingCall, handleHangUp, handleCall }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (context === null) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }

  return context;
};
