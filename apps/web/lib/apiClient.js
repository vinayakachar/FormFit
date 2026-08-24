import axios from "axios";

const apiUrl = typeof process !== "undefined" && process.env
    ? process.env.NEXT_PUBLIC_API_URL
    : undefined;

const api = axios.create({
    baseURL: apiUrl || "http://localhost:4000/api/v1"
})

api.interceptors.request.use((config)=>{
    if (typeof window !== "undefined") {
        const token=localStorage.getItem("token");
        if(token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

export default api;