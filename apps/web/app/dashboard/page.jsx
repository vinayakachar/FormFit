"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Link from "next/link";
import "chart.js/auto";
import { Line, Bar,Doughnut } from "react-chartjs-2";
import { Activity, Clock, Dumbbell, Flame } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import useAuth from "@/hooks/useAuth";
import { useState, useEffect, useMemo } from "react";
import api from "@/lib/apiClient";
import Modal from "@/components/ui/Modal";
import ProfileCompletionPrompt from "@/components/ProfileCompletionPrompt";

export default function DashboardPage(){
  const { user, ready } = useAuth({ requireAuth: true });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    (async () => {
      try {
        const { data: response } = await api.get("/progress/dashboard");
        if (!active) return;
        const data = response?.data ?? response;

        // Check if we received the full stats object (with chart data)
        if (data.summary && data.weeklyReps) {
          setStats(data);
        } else {
          // Handle the "empty state" for new users
          setStats({
            summary: {
              caloriesWeek: 0,
              totalRepsWeek: data?.stats?.totalReps || 0,
              formAccuracy: 0,
              minutesTrained: data?.stats?.totalDuration || 0,
              deltas: {}, // No comparison data for new users
            },
            // Provide empty arrays for the charts to prevent crashes
            weeklyReps: Array(7).fill(0),
            monthlyCalories: [0, 0, 0, 0],
            accuracyHistory: [],
          });
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          return; // Handled by apiClient response interceptor
        }
        console.error("Failed to fetch stats:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => (active = false);
  }, [ready, user]);

  useEffect(()=>{
    if(!ready || !user) return;
    let active=true;
    (async()=>{
        try{
            const {data}=await api.get("/exercises",
                {params: {limit : 100}});
                if(!active)return;
                setExercises(data?.data || []);
        }catch(err){
             if (err?.response?.status !== 401) {
          console.error("Failed to fetch exercises:", err);
        }
        if (!active) return;
        setExercises([]);
        }finally{
            if (active) setExercisesLoading(false);
        }
    })();
    return ()=>(active=false);
  },[ready,user]);

   const bmi=useMemo(()=>{
        const h=parseFloat(user?.height);
        const w=parseFloat(user?.weight);
        if(!h || !w)return null;
        const m=h/100;
        return +(w/(m*m)).toFixed(1);
    },[user]);

  const grid = "rgba(255,255,255,0.06)";
  const labelColor = "#94A3B8";
  const green = "#22C55E";
  const blue = "#3B82F6";

  const weeklyData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Reps",
        data: stats?.weeklyReps ?? [],
        borderColor: green,
        backgroundColor: "rgba(34,197,94,0.2)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  };
  const weeklyOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: labelColor } }, tooltip: { intersect: false } },
    scales: {
      x: { grid: { color: grid }, ticks: { color: labelColor } },
      y: { grid: { color: grid }, ticks: { color: labelColor } },
    },
  };

   const monthlyData = {
    labels: ["W1", "W2", "W3", "W4"],
    datasets: [
      {
        label: "Calories",
        data: stats?.monthlyCalories ?? [],
        backgroundColor: blue,
        borderRadius: 10,
        barThickness: 26,
      },
    ],
  };
  const monthlyOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: labelColor } } },
    scales: {
      x: { grid: { color: grid }, ticks: { color: labelColor } },
      y: { grid: { color: grid }, ticks: { color: labelColor } },
    },
  };

   const accuracy = stats?.summary?.formAccuracy ?? 0;
  const ringData = {
    labels: ["Accuracy", "Remaining"],
    datasets: [
      {
        data: [accuracy, 100 - accuracy],
        backgroundColor: [green, "rgba(34,197,94,0.15)"],
        borderWidth: 0,
        cutout: "70%",
      },
    ],
  };
  const ringOpts = { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false };

  if (!ready || !user) return null;
  
    return(
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Hi{user?.name ? `, ${user.name}` : ""} 👋</h1> 
                    <p className="text-sm text-brand-muted">
                       Your AI Coach is ready. {bmi ? <>BMI: <span className="text-brand-text font-medium">{bmi}</span></> : null}
                    </p>
                </div>
            </div>

            <ProfileCompletionPrompt />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button as="a" href="/workout" variant="secondary" className="card-glass hover:bg-brand-primary-hover! p-4!">
                    <Dumbbell className="mr-2"/> Start Workout
                </Button>
                <Button as="a" href="/ai-workout-plan" variant="secondary" className="card-glass hover:bg-white/10! p-4! ">
                    <Activity className="mr-2"/> AI Workout Plan
                </Button>
                <Button as="a" href="/profile" variant="secondary" className="card-glass  hover:bg-white/10! p-4!">
                    <Clock className="mr-2"/> Update Profile
                </Button>
                <Button  as="a" href="/history" variant="secondary" className="card-glass  hover:bg-white/10! p-4!">
                    <Flame className="mr-2"/> View History
                </Button>
            </div>

            {!exercisesLoading && exercises.length>0 && (
            <div className="flex justify-center">
                <Button 
                onClick={()=> setShowExerciseModal(true)} 
                className="card-glass hover:bg-white/10! py-3! px-6!"
                variant="secondary">
                   <Dumbbell className="mr-2 h-5 w-5"/> Quick Start Exercise
                </Button>
            </div>
            )}

            <div className="grid md:grid-cols-4 grid-cols-2 gap-4">
                <StatCard 
                label="Calories (week)"
                value={stats?.summary?.caloriesWeek ?? "—"}
                delta={stats?.summary?.deltas?.calories ?? 0}
                icon={<Flame className="h-5 w-5 text-brand-primary" />}
                hint="vs last week"/>
                 <StatCard
                label="Total Reps"
                value={stats?.summary?.totalRepsWeek ?? "—"}
                delta={stats?.summary?.deltas?.reps ?? 0}
                icon={<Dumbbell className="h-5 w-5 text-brand-accent" />}
                hint="last 7 days"/>
                  <StatCard
          label="Form Accuracy"
          value={`${stats?.summary?.formAccuracy ?? 0}%`}
          delta={stats?.summary?.deltas?.accuracy ?? 0}
          icon={<Activity className="h-5 w-5 text-emerald-400" />}
          hint="model-guided"
        />
        <StatCard
          label="Minutes Trained"
          value={stats?.summary?.minutesTrained ?? "—"}
          delta={stats?.summary?.deltas?.minutes ?? 0}
          icon={<Clock className="h-5 w-5 text-blue-400" />}
          hint="weekly total"
        />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card title="Weekly Reps" className="lg:col-span-2">
                    <div className="h-80">
                        {!loading && <Line data={weeklyData} options={weeklyOpts} />}
                    </div>
                </Card>

                <Card title="Form Accuracy">
                    <div className="h-80 flex items-center justify-center">
            {!loading && (
              <div className="relative w-56 h-56">
                <Doughnut data={ringData} options={ringOpts} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-semibold">{accuracy}%</p>
                    <p className="text-xs text-brand-muted">last 4 weeks</p>
                  </div>
                </div>
              </div>
            )}
          </div>
                </Card>

            <Card title="Monthly Calories" className="lg:col-span-3">
          <div className="h-90">
            {!loading && <Bar data={monthlyData} options={monthlyOpts} />}
          </div>
        </Card>
            </div>

            <Modal
            isOpen={showExerciseModal}
                onClose={()=>setShowExerciseModal(false)}
                title="Select Quick Start Exercise">
                <div className="space-y-4 max-h-96 overflow-y-auto mb-3">
                    {exercises.slice(0, 12).map((exercise) => (
                        <Link key={exercise._id} href={`/workout?exercise=${encodeURIComponent(exercise.name)}`}>
                            <Button
                                onClick={() => setShowExerciseModal(false)}
                                className="card-glass p-3! justify-start text-start hover:scale-105 transition-transform w-full"
                                variant="secondary"
                             >
                <div className="flex items-center gap-3 ">
                  <Dumbbell className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium">{exercise.name}</span>
                    <span className="text-xs text-brand-muted opacity-75 ml-2">{exercise.difficulty}</span>
                  </div>
                </div>
              </Button>
            </Link>
          ))}
                </div>
                 {exercises.length > 12 && (
          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <Button
              as="a"
              href="/workout"
              variant="secondary"
              onClick={() => setShowExerciseModal(false)}
            >
              View All Exercises
            </Button>
          </div>
        )}
            </Modal>
        </div>
    )
}