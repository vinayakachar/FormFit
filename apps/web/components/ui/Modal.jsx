"use client";

import Button from "./Button";
import { X } from "lucide-react";

export default function Modal({isOpen, onClose, title, children}){
    if (!isOpen) return null;
    return(
        <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
         <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4 z-50">
         <div className="bg-brand-bg border border-white/10 rounded-3xl p-6 shadow-2xl ">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-brand-text">{title}</h2>
                <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2!">
                    <X className="h-5 w-5"/> 
                </Button>
            </div>
            {children}
         </div>
         </div>
        </>
    )
}