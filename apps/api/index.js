import dotenv from "dotenv";
import app from "./app.js";
import http from "http";
import connectDB from "./src/config/database.js";
import { initializeSocket } from "./src/websocket/index.js";


dotenv.config();

const server = http.createServer(app);

const io = initializeSocket(server);

const PORT = process.env.PORT || 3000;

await connectDB();
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});