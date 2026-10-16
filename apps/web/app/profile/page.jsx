"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import useAuth from "@/hooks/useAuth";
import api from "@/lib/apiClient";
import { motion } from "framer-motion";
import {Mail, Ruler, Target, User, Weight} from "lucide-react";
import { useState,useMemo, useEffect, act } from "react";
import Alert from "@/components/ui/Alert";

const fade=(d=0)=>({
    initial : {opacity : 0, y:10},
    animate : {opacity : 1, y:0 , transition :{ duration:0.45 ,delay:d}}
})
export default function ProfilePage(){

    const {user: sessionUser,ready} =useAuth({requireAuth:true});
    const [form,setForm]=useState({
        name:"",
        email:"",
        age:"",
        height:"",
        weight:"",
        fitnessGoals:"",
        dietaryPref:"",
    });

    const [original, setOriginal] = useState(null);
    const [loading, setLoading] =useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success,setSuccess]=useState("");

    useEffect(() => {
        if (!ready) return;
        let active=true;

        (async()=>{
            try{
                const resp = await api.get("/users/me");
                const u = (resp && (resp.data?.data ?? resp.data)) || sessionUser || {};
                if (!active) return;
                    const initial = {
                        name: u.name || "",
                        email: u.email || "",
                        age: u.age ?? "",
                        height: u.height ?? "",
                        weight: u.weight ?? "",
                        fitnessGoals: u.fitnessGoals || "",
                        dietaryPref:u.dietaryPref||"nonveg"
        };
        setForm(initial);
        setOriginal(initial);
        }catch{
                 // Fall back to session if API not ready
        const u = sessionUser || {};
        const initial = {
          name: u.name || "",
          email: u.email || "",
          age: u.age ?? "",
          height: u.height ?? "",
          weight: u.weight ?? "",
          fitnessGoals: u.fitnessGoals || "",
          dietaryPref:u.dietaryPref||"nonveg"
        };
        setForm(initial);
        setOriginal(initial);
        }finally{
            setLoading(false);
        }
        })();
        return () =>{
            active=false;
        };
    }, [ready, sessionUser]);

    const onChange=(e) =>setForm((s)=>({...s,[e.target.name]:e.target.value}));


    const bmi = useMemo(() => {
    const h = parseFloat(form.height);
    const w = parseFloat(form.weight);
    if (!h || !w) return null;
    const m = h / 100;
    return +(w / (m * m)).toFixed(1);
  }, [form.height, form.weight]);


  const onSave=async(e)=>{
        e.preventDefault();
        setSaving(true);
        setSuccess("");
        setError("");

        try{
            const payload={
                name: form.name,
                age: form.age ? Number(form.age) : undefined,
                height: form.height ? Number(form.height) :undefined,
                weight: form.weight ? Number(form.weight) :undefined,
                fitnessGoals: form.fitnessGoals,
                dietaryPref:form.dietaryPref,
            }
            const resp= await api.put("/users/me", payload);
            const updateFromPut=(resp && (resp.data?.data?? resp.data)) || {};

            let updated=updateFromPut;

            try{
                const check=await api.get("/users/me");
                updated=(check && (check.data?.data?? check.data)) || updateFromPut;
            }catch{}
            if(typeof window !=="undefined"){
                const prev= JSON.parse(localStorage.getItem("user")||"{}");
                localStorage.setItem("user",JSON.stringify({...prev, ...updated}))
            }
             const next = {
        name: updated.name ?? form.name,
        email: updated.email ?? form.email,
        age: updated.age ?? form.age,
        height: updated.height ?? form.height,
        weight: updated.weight ?? form.weight,
        fitnessGoals: updated.fitnessGoals ?? form.fitnessGoals,
        dietaryPref: updated.dietaryPref ?? form.dietaryPref
      };
      setForm(next);
      setOriginal(next);
      setSuccess("Profile updated successfully.")
        }catch(err){
            setError(err?.response?.data?.message || "Failed to save profile.");
        }finally{
            setSaving(false);
        }
  }

   if (!ready || !sessionUser || loading) return null;

    return(
        <div className="space-y-8">
            <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-semibold">Profile</h1>
                <p className="text-sm text-brand-muted">Manage your personal info & training preferences.</p>
            </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <motion.div {...fade(0)} className="lg:col-span-1">
                    <Card className="p-6" title="Your Overview">
                        <div className="flex items-center gap-4">
                            <div className="size-14 border border-white/10 rounded-full bg-white/5 flex items-center justify-center">
                                <User className="h-6 w-6 text-brand-accent"/>
                            </div>
                            <div>
                                <p className="font-medium">{form.name || "-"}</p>
                                <p className="text-sm text-brand-muted">{form.email || "-"}</p>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-3 gap-3">
                            <div className="card-glass p-3 text-center">
                                <p className="text-xs text-brand-muted">Height</p>
                                <p className="font-semibold">{form.height ? `${form.height} cm`: "-"}</p>
                            </div>
                            <div className="card-glass p-3 text-center">
                                <p className="text-xs text-brand-muted">Weight</p>
                                <p className="font-semibold">{form.weight ? `${form.weight}kg` : "-"}</p>
                            </div>
                            <div className="card-glass p-3 text-center">
                                <p className="text-xs text-brand-muted">BMI</p>
                                <p className="font-semibold">{bmi ? bmi : "-"}</p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm text-brand-muted">Goals</p>
                            <p className="mt-1 text-sm">{form.fitnessGoals || "Add your goals to personalize coaching."}</p>
                        </div>
                    </Card>
                </motion.div>

                <motion.div {...fade(0.05)} className="lg:col-span-2">
                    <Card title="Edit Profile" subtitle="Keep your details up to date" className="p-6">
                        <form onSubmit={onSave} className="space-y-4">
                            {error && <Alert>{error}</Alert>}
                            {success && <Alert kind="success">{success}</Alert>}


                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-1">
                                <label className="mb-1 block text-sm font-medium">Name</label>
                                <div className="relative">
                                   <span className="pointer-events-none absolute left-3 top-2.5 text-brand-muted"> <User className="h-4 w-4"></User></span>
                                    <Input
                                    name="name"
                                    value={form.name}
                                    onChange={onChange}
                                    placeholder="Your full name"
                                    className="pl-10"/>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Email</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-2.5 text-brand-muted"><Mail className="h-4 w-4"/></span>
                                    <Input
                                    value={form.email}
                                    readOnly
                                    className="pl-10 opacity-70 cursor-not-allowed"/>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Age</label>
                                <Input type="number" value={form.age} name="age" onChange={onChange} placeholder="e.g., 27" className="pl-10"/>
                            </div>
                            
                            <div >
                                <label className="mb-1 text-sm font-medium">Height (cm)</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-2.5 text-brand-muted"><Ruler className="h-4 w-4"/></span>
                                    <Input 
                                    type="number" 
                                    name="height"
                                    value={form.height}
                                    onChange={onChange}
                                    placeholder="e.g., 175"
                                    className="pl-10"/>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 text-sm font-medium">Weight (kg)</label>
                                <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-2.5 text-brand-muted"><Weight className="h-4 w-4"/></span>
                                <Input
                                type="number"
                                name="weight"
                                value={form.weight}
                                onChange={onChange}
                                placeholder="e.g., 75"
                                className="pl-10"/>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Dietary Preference</label>
                                <select
                                name="dietaryPref"
                                value={form.dietaryPref}
                                onChange={onChange}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:outline-none">
                                    <option value="nonveg" className="bg-gray-900 text-white">Non-veg</option>
                                    <option value="veg" className="bg-gray-900 text-white">Veg</option>
                                    <option value="vegan" className="bg-gray-900 text-white">Vegan</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium">Fitness Goals</label>
                                <textarea 
                                name="fitnessGoals"
                                value={form.fitnessGoals}
                                onChange={onChange}
                                placeholder="e.g., Lose 5kg in 8 weeks. Improve squat depth. 4 sessions/week."
                                rows={4}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-brand-muted focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/40 outline-none"/>

                                <div className="mt-1 text-xs flex items-center gap-2 text-brand-muted">
                                    <Target className="h-3.5 w-3.5  "/>
                                    Tip:Be specific & measurable for better recommendations.
                                </div>
                            </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button 
                                type="button"
                                variant="secondary"
                                onClick={()=>{
                                    if(original) setForm(original);
                                }}>
                                    Reset
                                </Button>

                                <Button
                                type="submit" loading={saving}>
                                    Save Changes
                                </Button>
                            </div>
                        </form>

                    </Card>
                </motion.div>
            </div>
        </div>
    )
}