import CallNotification from "@/components/ui/CallNotification";
import ListOnlineUsers from "@/components/ui/ListOnlineUsers";
import VideoCall from "@/components/ui/VideoCall";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      <ListOnlineUsers />
      <CallNotification />
      <VideoCall />
    </div>
  );
}
