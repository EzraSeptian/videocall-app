"use client";
import { useSocket } from "@/context/SocketContext";
import { useUser } from "@clerk/nextjs";
import React from "react";
import Avatar from "./Avatar";

const ListOnlineUsers = () => {
  const { user } = useUser();
  const { onlineUsers, handleCall } = useSocket();
  return (
    <div key={`${user?.id}`} className="flex gap-4">
      {onlineUsers &&
        onlineUsers.map((onlineUser, index) => {
          if (onlineUser.userId === user?.id) return null;
          const userKey = `${onlineUser.userId} ${index}`;
          return (
            <div key={`${userKey}`} onClick={() => handleCall(onlineUser)} className="cursor-pointer flex flex-col items-center justify-center">
              <Avatar src={onlineUser.profile.imageUrl} />
              <div>{onlineUser.profile.fullName?.split(" ")[0]}</div>
            </div>
          );
        })}
    </div>
  );
};

export default ListOnlineUsers;
