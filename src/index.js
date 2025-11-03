// /server/src/index.js
import http from "http";
import { initSocket } from "./rtm/socket.js";

// after creating `app` and session middleware:
const server = http.createServer(app);
const io = initSocket(server, sessionMiddleware);
app.set("io", io);

server.listen(process.env.PORT || 4000, () => {
  console.log("API listening");
});
