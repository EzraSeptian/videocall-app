import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import onCall from "./socket-events/onCall.js";
import onWebrtcSignal from "./socket-events/onWebrtcSignal.js";
import onHangUp from "./socket-events/onHangUp.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
export let io;
console.log("running..>>");

app.prepare().then(() => {
  const httpServer = createServer(handler);
  let onlineUsers = [];

  io = new Server(httpServer);

  io.on("connection", (socket) => {
    socket.on("addNewUser", (clerkUser) => {
      if (clerkUser) {
        const existingUser = onlineUsers.find((user) => user.userId === clerkUser.id);

        if (!existingUser) {
          onlineUsers.push({ userId: clerkUser.id, socketId: socket.id, profile: clerkUser });
        } else {
          existingUser.socketId = socket.id;
        }

        io.emit("getUsers", onlineUsers);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
      io.emit("getUsers", onlineUsers);
    });

    socket.on("call", onCall);

    socket.on("webrtcSignal", onWebrtcSignal);

    socket.on("hangup", onHangUp);
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
