import { io } from "socket.io-client";

let socket;

export function getSocket(){
    if(!socket){
        const socketUrl = typeof process !== "undefined" && process.env
            ? process.env.NEXT_PUBLIC_SOCKET_URL
            : undefined;
        const url = socketUrl || "http://localhost:4000";
        socket=io(url,{
            transports:["websocket", "polling"],
            autoConnect:true,
            reconnection:true,
            reconnectionAttempts:Infinity,
            reconnectionDelay:500,
            reconnectionDelayMax:5000,
        })
    }
    return socket;
}

export function disconnectSocket(){
    if(socket){
        socket.disconnect();
        socket=undefined;
    }
}