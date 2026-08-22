"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import api from "@/lib/apiClient";
import { jsx } from "react/jsx-runtime";

const currentUser=null;
const subscribers=new Set();
function readSession(){
    try{
        const token= typeof window !== "undefined" ? localStorage.getItem("token")  : null ;
        const userJson= typeof window !== "undefined" ? localStorage.getItem("user") : null ;
        currentUser= userJson ? JSON.parse(userJson) : null;
        return {token, user: currentUser};
    }
    catch{
        currentUser=null;
        return{token:null,user:null};
    }
}

function noftify(){
    for(const cb of subscribers) cb(currentUser);
}
export default function useAuth({requireAuth=false}={}){
    const router=useRouter();
    const [user,setUser]=useState(currentUser);
    const [ready,setReady]=useState(false);

    useEffect(()=>{
        const {token, user}=readSession();
        setUser(user);

        if(requireAuth && !token){
            router.replace=("/login");
            return;
        }

        subscribers.add(setUser);
        setReady(true);

        if(token){
            (async()=>{
                try{
                const resp=await api.get("/users/me");
                const fresh=(resp && (resp.data?.data ?? resp.data)) || {};
                const merged={...(user || {}),...fresh};

                if(typeof window!=="undefined"){
                    localStorage.setItem("user",JSON.stringify(merged));
                }

                currentUser=merged;
                noftify();
            }catch(e){

            }
            })();
        }
        return ()=>subscribers.delete(setUser);
    },[requireAuth,router]);

    const login=useCallback((payload)=>{
        localStorage.setItem("token",payload.token);
        localStorage.setItem("user",JSON.stringify(payload.user));
        currentUser=payload.user;
        noftify();

        useEffect(())
    })
}