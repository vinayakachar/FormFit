import {io} from "socket.io";

let socket;

export function getSocket(){
    if(!socket){
        const url=process.env.local.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
        socket=io(url,{
            transports:["websocket"],
            autoConnect:true,
            reconnection:true,
            reconnectionAttempts:5,
            reconnectionDelay:500,
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