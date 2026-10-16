"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Dumbbell, Play, Square, Camera, Sparkles, Activity, Volume2, VolumeX, CheckCircle2, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { getSocket, disconnectSocket } from "@/lib/socket";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import api from "@/lib/apiClient";
// MediaPipe Tasks Vision will be dynamically imported when starting session

const fade = (d = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, delay: d } },
});

// Local date helpers
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Speech synthesis helpers (no beeps)
function warmupTTS() {
  try {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    // Touch voices list; some browsers lazy-load voices
    const _ = synth.getVoices();
    // Optional: enqueue a silent utterance to unlock on iOS without sound
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    try { synth.speak(u); } catch { }
  } catch { }
}

const EXERCISES = [
  "Squat",
  "Lunge",
  "Push-up",
  "Bicep Curl",
  "Shoulder Press",
  "Jumping Jack",
  "Tricep Dip",
  "Mountain Climber",
];

// Persisted session storage key
const SESSION_KEY = "workout_session_v1";

export default function WorkoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-brand-muted">Loading workout...</div>}>
      <WorkoutContent />
    </Suspense>
  );
}

function WorkoutContent() {
  const searchParams = useSearchParams();
  const { user, ready } = useAuth({ requireAuth: false });
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const [exercise, setExercise] = useState(EXERCISES[0]);
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Stand centered. Ensure good lighting.");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [workoutId, setWorkoutId] = useState(null);
  const [mirror, setMirror] = useState(true);
  const [calib, setCalib] = useState(null);
  const [plan, setPlan] = useState(null); // latest AI plan
  const [selectedDay, setSelectedDay] = useState(null); // label like Mon/Tue
  const [dayItems, setDayItems] = useState([]); // parsed exercises for selected day
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [repsBaseline, setRepsBaseline] = useState(0); // for multi-sets counting within one exercise
  const [resumePrompt, setResumePrompt] = useState(false);
  const [fullscreen, setFullscreen] = useState(null); // 'camera' | 'tutorial' | null
  const [feedbackSize, setFeedbackSize] = useState('md'); // 'sm' | 'md' | 'lg' | 'xl'
  const [dumbbellWeight, setDumbbellWeight] = useState(''); // weight in kg for Bicep Curl and Shoulder Press

  // Helper functions
  const calculateCalories = (weightKg, reps) => {
    if (!weightKg || !reps) return 0;
    return Math.round(parseFloat(weightKg * 2) * reps * 0.1);
  };

  const isDumbbellExercise = (exerciseName) => {
    const name = (exerciseName || '').toLowerCase();
    return name.includes('bicep') && name.includes('curl') || name.includes('shoulder') && name.includes('press');
  };

  // Reset dumbbell weight when exercise changes
  useEffect(() => {
    if (!isDumbbellExercise(exercise)) {
      setDumbbellWeight('');
    }
  }, [exercise]);

  // Voice cues state/refs
  const lastCueAtRef = useRef(0);
  const lastCueTextRef = useRef("");
  const prevRepRef = useRef(0);
  const speakingRef = useRef(false);
  const voiceRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const vfcRef = useRef(null); // requestVideoFrameCallback id
  const streamRef = useRef(null);
  const startedAtRef = useRef(null);
  const lastPoseRef = useRef(null); // when model added
  const landmarkerRef = useRef(null);
  const visionRef = useRef(null);
  const creatingLandmarkerRef = useRef(null); // guard against double-creation in Strict Mode
  const lastVideoTimeRef = useRef(-1);
  const [loadingModel, setLoadingModel] = useState(false);
  const [debug] = useState(process.env.NODE_ENV !== "production");
  const [fps, setFps] = useState(0);
  const framesSinceRef = useRef(0);
  const lastFpsAtRef = useRef(0);
  const firstDetectLoggedRef = useRef(false);
  const firstTickLoggedRef = useRef(false);
  const [example, setExample] = useState({ loading: false, url: null, name: null, source: null });
  const [exercisesList, setExercisesList] = useState([]);
  const selectedExercise = useMemo(() => exercisesList.find((x) => x.name === exercise) || null, [exercisesList, exercise]);

  // timer
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Load saved calibration on mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calibration") : null;
      if (raw) {
        const c = JSON.parse(raw);
        setCalib(c);
        if (typeof c.mirror === "boolean") setMirror(c.mirror);
      }
    } catch { }
  }, []);

  // Handle URL parameters for pre-selecting exercise
  useEffect(() => {
    const exerciseParam = searchParams.get("exercise");
    if (exerciseParam && exercisesList.length > 0 && !running) {
      const matchingExercise = exercisesList.find(ex => ex.name === exerciseParam);
      if (matchingExercise) {
        // Set the exercise from URL parameter, but don't clear plan state
        // This allows users to start a single exercise while still being able to switch to plan mode
        setExercise(matchingExercise.name);
        // Only clear plan-related state if we're not in a plan-based workout
        if (!plan || !dayItems.length) {
          setSelectedDay(null);
          setDayItems([]);
          setCurrentIndex(0);
        }
      }
    }
  }, [searchParams, exercisesList, plan, dayItems.length, running]);

  // Load voice cue preference
  useEffect(() => {
    try {
      const v = localStorage.getItem('voice_cues_enabled');
      if (v !== null) setMuted(v !== 'true');
    } catch { }
  }, []);

  // Persist voice cue preference
  useEffect(() => {
    try { localStorage.setItem('voice_cues_enabled', (!muted).toString()); } catch { }
  }, [muted]);

  // Stop voice immediately when muted
  useEffect(() => {
    if (muted && typeof window !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        speakingRef.current = false;
      } catch (err) {
        console.warn('Failed to cancel speech:', err);
      }
    }
  }, [muted]);

  // Load a calm voice for TTS cues
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const pick = () => {
      try {
        const voices = synth.getVoices() || [];
        // Prefer natural, neutral voices when available
        const prefer = [
          'Google US English', 'Samantha', 'Victoria', 'Daniel', 'Serena', 'Alex', 'Moira', 'Karen'
        ];
        const byName = (name) => voices.find(v => (v?.name || '').includes(name));
        for (const name of prefer) {
          const v = byName(name);
          if (v) { voiceRef.current = v; return; }
        }
        // Fallback to first English voice
        voiceRef.current = voices.find(v => (v?.lang || '').startsWith('en')) || null;
      } catch { }
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => synth.removeEventListener('voiceschanged', pick);
  }, []);

  // Load and persist feedback text size
  useEffect(() => {
    try {
      const s = localStorage.getItem('feedback_text_size');
      if (s) setFeedbackSize(s);
    } catch { }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('feedback_text_size', feedbackSize); } catch { }
  }, [feedbackSize]);

  // cleanup on unmount
  useEffect(() => () => stopEverything(), []);

  // Load latest saved AI plan for day selection
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/plans/latest");
        const p = data?.plan?.planObject || null;
        setPlan(p);
        const w = p?.weeklyPlan || [];
        // Default selected day: today if present else first
        const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const today = dayMap[new Date().getDay()];
        const match = w.find((d) => (d.day || "").toLowerCase().startsWith(today.toLowerCase()));
        if (match) setSelectedDay(match.day);
        else if (w.length) setSelectedDay(w[0].day);
      } catch { }
    })();
  }, []);

  // Parse exercises for the selected day
  useEffect(() => {
    if (!plan || !selectedDay) { setDayItems([]); return; }
    const day = (plan.weeklyPlan || []).find((d) => (d.day || "").toLowerCase() === (selectedDay || "").toLowerCase());
    if (!day) { setDayItems([]); return; }
    const defaultSets = parseInt((day.sets || "").toString().replace(/[^0-9]/g, "")) || 1;
    // Fix reps parsing to handle ranges like "10-12" correctly
    const defaultReps = (() => {
      const text = (day.reps || "").toString();
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        // Take the last number to handle ranges like "10-12" -> 12
        const lastNum = parseInt(numbers[numbers.length - 1]);
        return lastNum > 0 && lastNum < 1000 ? lastNum : 10;
      }
      return 10;
    })();
    const baseItems = (day.items || []).map((raw) => parseExerciseItem(raw, defaultSets, defaultReps));
    const progressed = applySavedDayProgress(selectedDay, todayIso, baseItems);
    setDayItems(progressed.items);
    setCurrentIndex(progressed.index);
    // Keep exercise UI in sync with first item for correct examples/labels
    if (progressed.items && progressed.items.length && !runningRef.current) {
      setExercise(progressed.items[progressed.index]?.name || progressed.items[0].name);
    }
  }, [plan, selectedDay]);

  // Keep exercise selection synced when switching currentIndex (before session starts)
  useEffect(() => {
    if (!running && dayItems && dayItems[currentIndex]) {
      setExercise(dayItems[currentIndex].name);
      // Provide contextual feedback for duration/manual items
      if (dayItems[currentIndex].manual || dayItems[currentIndex].isDuration) {
        setFeedback(buildCardioFeedback(dayItems[currentIndex].name));
      }
    }
  }, [currentIndex, dayItems, running]);

  // Restore persisted session if present
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || s.status !== 'in-progress') return;
      setWorkoutId(s.workoutId || null);
      setSelectedDay(s.selectedDay || null);
      setDayItems(s.dayItems || []);
      setCurrentIndex(s.currentIndex || 0);
      setExercise((s.dayItems?.[s.currentIndex]?.name) || s.exercise || EXERCISES[0]);
      setSeconds(Math.floor(((Date.now() - (s.startedAt || Date.now())) / 1000)));
      setRepsBaseline(s.repsBaseline || 0);
      setCompleted(false);
      setResumePrompt(true);
    } catch { }
  }, [ready]);

  // Fetch exercises from API; fallback to static list if unavailable
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/exercises", { params: { limit: 100 } });
        const items = Array.isArray(data?.data) ? data.data : [];
        if (!active) return;
        setExercisesList(items);
        if (items.length && !items.find((e) => e.name === exercise)) {
          setExercise(items[0].name);
        }
      } catch (e) {
        if (!active) return;
        setExercisesList([]);
      }
    })();
    return () => { active = false; };
  }, []);

  // Fetch example video for current exercise
  useEffect(() => {
    let active = true;
    (async () => {
      if (!ready || !exercise) return;
      // Skip example fetch for duration/manual cardio-like items or unknown exercises
      const norm = normalizeExerciseName(exercise);
      const isManual = norm.manual || (dayItems && dayItems[currentIndex] && (dayItems[currentIndex].manual || dayItems[currentIndex].isDuration));
      const inLibrary = exercisesList.some((x) => x.name === norm.canonical);
      if (isManual || !inLibrary) {
        if (!active) return;
        setExample({ loading: false, url: null, name: exercise, source: null });
        return;
      }
      try {
        setExample((e) => ({ ...e, loading: true }));
        const { data } = await api.get(`/exercises/example`, { params: { name: norm.canonical } });
        if (!active) return;
        const videoUrl = data?.videoUrl || null;
        setExample({ loading: false, url: videoUrl, name: data?.name || norm.canonical, source: data?.source || null });
      } catch (e) {
        if (!active) return;
        setExample({ loading: false, url: null, name: norm.canonical, source: null });
      }
    })();
    return () => { active = false; };
  }, [exercise, ready, dayItems, currentIndex, exercisesList]);

  // Optional: warm up the pose model to reduce start delay
  useEffect(() => {
    (async () => {
      try {
        setLoadingModel(true);
        await ensurePoseLandmarker();
      } catch (e) {
        // ignore prefetch errors; will retry on start
      } finally {
        setLoadingModel(false);
      }
    })();
  }, []);

  if (!ready) return null;

  async function startSession(opts = {}) {
    const ensureCreate = opts.ensureCreate !== false; // default true
    setError("");
    try {
      // If voice preference not set, default to enabled once the user interacts
      try {
        const stored = localStorage.getItem('voice_cues_enabled');
        if (stored === null) setMuted(false);
      } catch { }
      // 1) Ensure we have an active workoutId; optionally skip auto-create (plan/day flow)
      if (ensureCreate && !workoutId) {
        const { data } = await api.post("/workouts/start", {
          plannedExercises: [exercise],
        });

        const newWorkoutId = data.workoutId;
        if (!newWorkoutId) {
          throw new Error("API did not return a workout ID.");
        }
        setWorkoutId(newWorkoutId);
        persistSession({ workoutId: newWorkoutId });
      }

      // 2) Get camera access with constraints from calibration if available
      const c = calib || {};
      const constraints = {
        video: {
          deviceId: c.deviceId ? { ideal: c.deviceId } : undefined,
          facingMode: "user",
          width: c.width ? { ideal: c.width } : { ideal: 1280 },
          height: c.height ? { ideal: c.height } : { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to default if constraints fail
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      streamRef.current = stream;
      let video = videoRef.current;
      if (!video) {
        // Wait one frame to ensure ref is bound
        await new Promise((r) => requestAnimationFrame(r));
        video = videoRef.current;
        if (!video) throw new Error('Camera not ready – please try again.');
      }
      video.srcObject = stream;

      // Wait until we have data to render
      if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA
      } else {
        await new Promise((resolve) => {
          const onCanPlay = () => {
            video.removeEventListener("canplay", onCanPlay);
            resolve();
          };
          video.addEventListener("canplay", onCanPlay, { once: true });
        });
      }

      await video.play();

      // 3) Initialize canvas size to match displayed size
      const canvas = canvasRef.current;
      const cw = canvas.clientWidth || 1280;
      const ch = canvas.clientHeight || Math.round((cw * 9) / 16);
      canvas.width = cw;
      canvas.height = ch;
      if (debug) {
        console.info("camera ready", {
          hasVFC: typeof video.requestVideoFrameCallback === "function",
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        });
      }

      // 4) Socket setup
      const socket = getSocket();
      socket.off("feedback:new");
      socket.off("session:ready");
      socket.off("error");
      socket.on("feedback:new", (payload) => {
        if (debug) console.debug("socket feedback:new", payload);
        if (typeof payload?.repCount === "number") setReps(payload.repCount);
        if (payload?.feedback) setFeedback(payload.feedback);
        if (typeof payload?.score === "number") setScore(payload.score);
        try { maybeSpeakCue(payload); } catch { }
      });
      socket.on("session:ready", () => {
        if (debug) console.debug("socket session:ready");
        setFeedback("Session ready. Begin your movement.");
        try { speakIfAllowed("Session ready. Begin your movement.", { priority: true }); } catch { }
      });
      socket.on("error", (e) => {
        console.error("Socket error", e);
        setError(e?.message || "Real-time analysis error");
        // If current exercise is not supported or missing, fall back to manual mode
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('not available') || msg.includes('not found')) {
          try {
            setDayItems((list) => {
              if (!Array.isArray(list) || list.length === 0) return list;
              const updated = [...list];
              const idx = currentIndex;
              if (updated[idx]) updated[idx] = { ...updated[idx], manual: true };
              persistSession({ dayItems: updated });
              return updated;
            });
            // Set cardio-friendly feedback if looks like a duration activity
            setFeedback(buildCardioFeedback(exercise));
          } catch { }
        }
      });

      // Signal backend which exercise we are doing (normalize name; suppress for manual/cardio)
      const norm = normalizeExerciseName(exercise);
      const manualNow = norm.manual || (dayItems && dayItems[currentIndex] && (dayItems[currentIndex].manual || dayItems[currentIndex].isDuration));
      if (!manualNow) {
        if (debug) console.debug("socket emit session:start", { exercise: norm.canonical, userId: user?._id });
        socket.emit("session:start", { exercise: norm.canonical, userId: user?._id });
      }
      // Reset live counters for the new exercise session on client
      setRepsBaseline(0);
      setReps(0);
      setScore(0);

      // 5) Load MediaPipe Pose landmarker if not already
      await ensurePoseLandmarker();
      if (debug) console.info("pose landmarker ready");

      // 5b) Warm up TTS on user gesture (no beeps)
      warmupTTS();

      // 6) Start draw loop (prefer requestVideoFrameCallback when available)
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      setSeconds(0);
      setRunning(true);
      startDrawing();
      if (debug) console.info("drawing loop started");
      persistSession({ status: 'in-progress', exercise, selectedDay, dayItems, currentIndex, repsBaseline, startedAt: startedAtRef.current });
    } catch (e) {
      console.error(e);
      setError(e.message || "Could not start session. Check camera permissions.");
      stopEverything();
    }
  }

  // Voice cue helpers - accessible within component
  const speakIfAllowed = (text, opts = {}) => {
    // Always check current muted state to ensure real-time muting
    if (mutedRef.current) {
      return;
    }
    if (!text || typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      // No TTS available; skip audio (no beeps)
      return;
    }

    const now = Date.now();
    const minGap = opts.priority ? 900 : 1500; // slightly less chatty
    if (!opts.priority && now - lastCueAtRef.current < minGap) return;
    if (lastCueTextRef.current === text && now - lastCueAtRef.current < 4000) return; // lighter de-dupe

    // Only interrupt current speech for priority cues
    if (speakingRef.current && !opts.priority) return;
    if (opts.priority) {
      try {
        synth.cancel();
        speakingRef.current = false;
      } catch { }
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.voice = voiceRef.current || null;
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 0.85;
    speakingRef.current = true;
    u.onend = () => { speakingRef.current = false; };
    lastCueTextRef.current = text;
    lastCueAtRef.current = now;
    try {
      synth.speak(u);
    } catch (e) {
      // If TTS fails, do nothing (no beeps)
    }
  };

  function maybeSpeakCue(payload) {
    if (!payload) return;
    if (!runningRef.current) return;
    // Avoid generic cues for manual/duration (e.g., brisk walk); use contextual text instead
    try {
      if (dayItems && dayItems[currentIndex] && (dayItems[currentIndex].manual || dayItems[currentIndex].isDuration)) {
        return; // suppress rep/form cues for cardio
      }
    } catch { }
    const rc = typeof payload.repCount === 'number' ? payload.repCount : reps;
    const fb = (payload.feedback || '').trim();
    const sc = typeof payload.score === 'number' ? payload.score : score;
    // Positive cue on rep increment (reduce frequency)
    if (rc > (prevRepRef.current || 0)) {
      prevRepRef.current = rc;
      // Announce every 5 reps only to reduce chatter
      if (rc % 5 === 0) {
        speakIfAllowed(`${rc} reps`, { category: 'pos' });
        return;
      }
      return;
    }
    prevRepRef.current = rc;

    if (!fb) {
      // fallback by score thresholds
      if (sc >= 90) speakIfAllowed("Perfect posture", { category: 'pos' });
      else if (sc <= 60) { speakIfAllowed("Adjust your form", { category: 'error' }); }
      return;
    }
    // Normalize and gate repeated error cues
    const t = fb.toLowerCase();
    // Map certain keywords to concise cues
    const mappings = [
      { k: ['back', 'straight'], m: 'Keep your back straight' },
      { k: ['lower', 'depth'], m: 'Go lower' },
      { k: ['knees', 'inward', 'valgus'], m: 'Keep knees tracking over toes' },
      { k: ['core', 'brace'], m: 'Engage your core' },
      { k: ['hips', 'hinge'], m: 'Hinge at the hips' },
      { k: ['shoulders', 'retract'], m: 'Pull your shoulders back' },
      { k: ['elbows', 'tuck'], m: 'Tuck your elbows' },
      { k: ['pace', 'faster', 'slower'], m: 'Control the pace' },
    ];
    let cue = null;
    for (const map of mappings) {
      if (map.k.every((kw) => t.includes(kw))) { cue = map.m; break; }
    }
    if (!cue) {
      // If feedback looks positive, reflect it; else relay as-is briefly
      const pos = /(good|great|nice|perfect|excellent)/i.test(fb);
      cue = pos ? 'Great form' : fb;
    }
    // Gate error cues by type to once per 10s
    const key = cue.toLowerCase();
    if (!maybeSpeakCue._lastByKey) maybeSpeakCue._lastByKey = new Map();
    const lastAt = maybeSpeakCue._lastByKey.get(key) || 0;
    if (Date.now() - lastAt < 10000) return;
    maybeSpeakCue._lastByKey.set(key, Date.now());
    const prio = /keep|tuck|hinge|lower|core|straight/.test(key);
    speakIfAllowed(cue, { priority: prio, category: prio ? 'error' : 'info' });
  }

  function buildCardioFeedback(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('walk') || n.includes('jog') || n.includes('run')) return 'Maintain a brisk pace, relaxed shoulders, steady breathing.';
    if (n.includes('bike') || n.includes('cycle')) return 'Smooth cadence, light grip on bars, steady breathing.';
    if (n.includes('row')) return 'Drive with legs, upright torso, fluid strokes, breathe steadily.';
    if (n.includes('zone')) return 'Keep conversational pace in Zone 2, breathe through the nose if possible.';
    return 'Steady cadence and breathing. Keep posture tall and relaxed.';
  }

  // Begin workout for selected day: creates workout and starts tracking first exercise
  async function beginWorkoutForDay() {
    if (!dayItems || !dayItems.length) {
      return alert("No exercises found for the selected day.");
    }
    setError("");
    setCompleted(false);

    // Clear saved progress for this day to start fresh
    try {
      localStorage.removeItem(dayProgressKey(selectedDay, todayIso));
    } catch { }

    // Reset all exercises to start from set 1
    const resetItems = dayItems.map(item => ({
      ...item,
      completedSets: 0,
      totalReps: 0,
      formScores: []
    }));
    setDayItems(resetItems);

    const idx = 0; // Always start from first exercise
    setCurrentIndex(idx);
    const names = resetItems.map((x) => x.name);
    try {
      const { data } = await api.post("/workouts/start", { plannedExercises: names });
      const newWorkoutId = data.workoutId;
      if (!newWorkoutId) throw new Error("Failed to create workout");
      setWorkoutId(newWorkoutId);
      setExercise(resetItems[idx].name);
      setReps(0);
      setScore(0);
      setRepsBaseline(0);
      startedAtRef.current = Date.now();
      persistSession({
        status: 'in-progress', workoutId: newWorkoutId, selectedDay, dayItems: resetItems, currentIndex: idx, repsBaseline: 0, startedAt: startedAtRef.current
      });
      await startSession({ ensureCreate: false });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not start workout");
    }
  }

  async function endSession() {
    if (!workoutId) return; // Don't do anything if there's no active workout

    try {
      // Build exercises payload from sequence if available
      let payloadExercises = [];
      if (dayItems && dayItems.length) {
        // Merge current live progress into the active exercise before serializing
        try {
          const cur = dayItems[currentIndex];
          if (cur && !cur.manual) {
            const liveReps = Math.max(0, (reps || 0) - (repsBaseline || 0));
            if (liveReps > 0) {
              const updated = [...dayItems];
              const item = { ...updated[currentIndex] };
              item.totalReps = (item.totalReps || 0) + liveReps;
              item.formScores = Array.isArray(item.formScores) ? [...item.formScores, score || 0] : [score || 0];
              updated[currentIndex] = item;
              setDayItems(updated);
            }
          }
        } catch { }
        payloadExercises = dayItems.map((it) => ({
          name: it.name,
          reps: it.totalReps || 0,
          sets: it.completedSets || 0,
          formScore: Array.isArray(it.formScores) && it.formScores.length ? Math.round(it.formScores.reduce((a, b) => a + b, 0) / it.formScores.length) : undefined,
        }));
      } else {
        payloadExercises = [{ name: exercise, reps, sets: 1, formScore: score }];
      }

      // Call the API to finalize the workout with a summarized exercise log
      await api.post(`/workouts/${workoutId}/end`, { exercises: payloadExercises });
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      stopEverything();
      setWorkoutId(null); // Clean up the workout ID
      setCompleted(true);
      try { persistDayProgress(selectedDay, todayIso, dayItems); } catch { }
      clearPersistedSession();
    }
  }

  function stopEverything() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (vfcRef.current && videoRef.current && videoRef.current.cancelVideoFrameCallback) {
      try { videoRef.current.cancelVideoFrameCallback(vfcRef.current); } catch { }
    }
    // Close landmarker to free WebGL/wasm resources
    if (landmarkerRef.current && landmarkerRef.current.close) {
      try { landmarkerRef.current.close(); } catch { }
    }
    landmarkerRef.current = null;
    lastPoseRef.current = null;
    lastVideoTimeRef.current = -1;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // Persist/restore helpers
  function persistSession(partial = {}) {
    try {
      const snapshot = {
        status: 'in-progress',
        workoutId,
        selectedDay,
        dayItems,
        currentIndex,
        repsBaseline,
        startedAt: startedAtRef.current || Date.now(),
        exercise,
        ...partial,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    } catch { }
  }

  function clearPersistedSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { }
  }

  // --- Day progress persistence (survives endSession) ---
  function dayProgressKey(day, iso) {
    return `workout_day_progress_v1_${(day || '').toLowerCase()}_${iso}`;
  }

  function firstIncompleteIndex(items) {
    const idx = items.findIndex((it) => (it.completedSets || 0) < (it.sets || 1));
    return idx === -1 ? 0 : idx;
  }

  function applySavedDayProgress(day, iso, items) {
    try {
      const raw = localStorage.getItem(dayProgressKey(day, iso));
      if (!raw) return { items, index: 0 };
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved?.items)) return { items, index: 0 };
      // Match by index to avoid issues with duplicate exercise names
      const merged = items.map((it, index) => {
        const match = saved.items[index];
        return match ? { ...it, completedSets: match.completedSets || 0, totalReps: match.totalReps || 0, formScores: match.formScores || [], manual: it.manual || !!match.manual, isDuration: it.isDuration || !!match.isDuration } : it;
      });
      const index = firstIncompleteIndex(merged);
      return { items: merged, index };
    } catch { return { items, index: 0 }; }
  }

  function persistDayProgress(day, iso, items) {
    try {
      const compact = items.map(({ name, completedSets, totalReps, formScores, manual, isDuration, sets }) => ({ name, completedSets, totalReps, formScores, manual, isDuration, sets }));
      localStorage.setItem(dayProgressKey(day, iso), JSON.stringify({ items: compact, savedAt: Date.now() }));
    } catch { }
  }

  function startDrawing() {
    const video = videoRef.current;
    if (!video) return;
    const hasVFC = typeof video.requestVideoFrameCallback === "function";
    if (hasVFC) {
      const tick = (now /* DOMHighResTimeStamp */, metadata) => {
        // Always reschedule next frame to avoid race with setState
        vfcRef.current = video.requestVideoFrameCallback(tick);
        if (!runningRef.current) return;
        if (debug && !firstTickLoggedRef.current) {
          firstTickLoggedRef.current = true;
          console.info("VFC tick firing");
        }
        // Prefer mediaTime from VFC metadata for pose timestamp
        const ts = metadata && typeof metadata.mediaTime === 'number' ? metadata.mediaTime * 1000 : now;
        drawFrame(ts);
      };
      vfcRef.current = video.requestVideoFrameCallback(tick);
    } else {
      const tick = (now) => {
        rafRef.current = requestAnimationFrame(tick);
        if (!runningRef.current) return;
        if (debug && !firstTickLoggedRef.current) {
          firstTickLoggedRef.current = true;
          console.info("RAF tick firing");
        }
        drawFrame(now || performance.now());
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  // Draw only the overlay; video is rendered directly underneath
  function drawFrame(nowInMs) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    // Keep canvas resolution in sync with displayed size
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw && ch && (canvas.width !== cw || canvas.height !== ch)) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Run pose detection for current frame and emit landmarks
    tryDetectAndEmit(video, nowInMs);

    // 2) Draw overlay - grid + bounding training region
    drawOverlay(ctx, canvas);

    // 3) If you had model results, draw them:
    const pose = lastPoseRef.current;
    drawPose(ctx, pose, canvas);

    // FPS meter (debug)
    if (debug) {
      const now = performance.now();
      if (!lastFpsAtRef.current) lastFpsAtRef.current = now;
      framesSinceRef.current += 1;
      if (now - lastFpsAtRef.current >= 1000) {
        setFps(framesSinceRef.current);
        framesSinceRef.current = 0;
        lastFpsAtRef.current = now;
      }
    }
  }

  function emitPoseUpdate(poseLandmarks) {
    try {
      const socket = getSocket();
      socket.emit("pose:update", { userId: user?._id, exercise, poseLandmarks });
    } catch { }
  }

  async function ensurePoseLandmarker() {
    if (landmarkerRef.current) return;
    if (creatingLandmarkerRef.current) {
      // If another call is already creating the landmarker, await it
      await creatingLandmarkerRef.current;
      return;
    }

    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    // Load wasm files from CDN; model from CDN as well
    const wasmLoaderPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm";
    const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

    const create = async () => {
      // Initialize resolver once
      if (!visionRef.current) {
        visionRef.current = await FilesetResolver.forVisionTasks(wasmLoaderPath);
      }
      try {
        landmarkerRef.current = await PoseLandmarker.createFromOptions(visionRef.current, {
          baseOptions: { modelAssetPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPoseTrackingConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
        });
      } catch (e) {
        // Fallback to CPU if GPU delegate fails
        landmarkerRef.current = await PoseLandmarker.createFromOptions(visionRef.current, {
          baseOptions: { modelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPoseTrackingConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
        });
      }
    };

    creatingLandmarkerRef.current = create();
    try {
      await creatingLandmarkerRef.current;
    } finally {
      creatingLandmarkerRef.current = null;
    }
  }

  function tryDetectAndEmit(video, nowInMs) {
    const landmarker = landmarkerRef.current;
    if (!landmarker) return;
    // Ensure the video element is fully ready
    if (!video.videoWidth || !video.videoHeight) return;
    // Detect using given timestamp, avoiding duplicate detection on same mediaTime when available
    const t = video.currentTime;
    if (t === lastVideoTimeRef.current) {
      // still run detect to keep results fresh, but note that mediaTime hasn't advanced
    } else {
      lastVideoTimeRef.current = t;
    }
    // Use a monotonic timestamp; tasks-vision expects an increasing ms clock
    const timestampMs = typeof nowInMs === "number" ? nowInMs : performance.now();
    let res;
    try {
      res = landmarker.detectForVideo(video, timestampMs);
    } catch (err) {
      console.error("detectForVideo error", err);
      return;
    }
    const arr = (res && (res.landmarks || res.poseLandmarks)) || [];
    if (arr && arr.length > 0) {
      const lm = arr[0];
      lastPoseRef.current = lm;
      emitPoseUpdate(lm);
      if (debug && !firstDetectLoggedRef.current) {
        firstDetectLoggedRef.current = true;
        try {
          console.info("Pose detected:", { count: lm?.length, sample: lm?.slice(0, 2) });
        } catch { }
      }
    }
  }

  function drawPose(ctx, landmarks, canvas) {
    if (!landmarks || !landmarks.length) return;
    const w = canvas.width, h = canvas.height;
    // Account for object-cover scaling of the underlying video
    const video = videoRef.current;
    const vw = video?.videoWidth || w;
    const vh = video?.videoHeight || h;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    ctx.save();
    // draw connections (simple)
    const C = [
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 12],          // shoulders
      [23, 24],          // hips
      [11, 23], [12, 24], // torso
      [23, 25], [25, 27], // left leg
      [24, 26], [26, 28], // right leg
    ];
    ctx.strokeStyle = "rgba(59,130,246,0.9)"; // blue
    ctx.lineWidth = 2;
    for (const [a, b] of C) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(ox + pa.x * dw, oy + pa.y * dh);
      ctx.lineTo(ox + pb.x * dw, oy + pb.y * dh);
      ctx.stroke();
    }
    // draw keypoints
    ctx.fillStyle = "rgba(16,185,129,0.95)"; // emerald
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc(ox + p.x * dw, oy + p.y * dh, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOverlay(ctx, canvas) {
    const w = canvas.width, h = canvas.height;

    // subtle vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 4, w / 2, h / 2, Math.max(w, h) / 1.1);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // training region (center box)
    const boxW = Math.floor(w * 0.6);
    const boxH = Math.floor(h * 0.7);
    const x = Math.floor((w - boxW) / 2);
    const y = Math.floor((h - boxH) / 2);
    ctx.strokeStyle = "rgba(59,130,246,0.8)"; // blue
    ctx.lineWidth = 3;
    roundedRect(ctx, x, y, boxW, boxH, 16);
    ctx.stroke();

    // corner accents
    ctx.strokeStyle = "rgba(34,197,94,0.9)"; // green
    ctx.lineWidth = 5;
    const L = 26;
    // tl
    ctx.beginPath(); ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y); ctx.stroke();
    // tr
    ctx.beginPath(); ctx.moveTo(x + boxW - L, y); ctx.lineTo(x + boxW, y); ctx.lineTo(x + boxW, y + L); ctx.stroke();
    // bl
    ctx.beginPath(); ctx.moveTo(x, y + boxH - L); ctx.lineTo(x, y + boxH); ctx.lineTo(x + L, y + boxH); ctx.stroke();
    // br
    ctx.beginPath(); ctx.moveTo(x + boxW - L, y + boxH); ctx.lineTo(x + boxW, y + boxH); ctx.lineTo(x + boxW, y + boxH - L); ctx.stroke();
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workout Session</h1>
          <p className="text-sm text-brand-muted">Real-time coaching with computer vision.</p>
        </div>
      </div>

      {resumePrompt && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-brand-text font-medium">Resume session?</span>
            <span className="text-brand-muted ml-2">We found an in-progress workout. Continue where you left off.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { clearPersistedSession(); setResumePrompt(false); }}>Dismiss</Button>
            <Button onClick={() => { setResumePrompt(false); startSession(); }}><Play className="h-4 w-4 mr-2" />Resume</Button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Camera panel */}
        <motion.div {...fade(0)} className="lg:col-span-2">
          <Card title="Live Camera" className="p-3 md:p-4">
            <div className={`${fullscreen === 'camera' ? 'fixed inset-0 z-50 p-4 bg-black/90' : ''}`}>
              <div className={`${fullscreen === 'camera' ? 'relative w-full h-full' : 'relative aspect-video'} overflow-hidden rounded-2xl border border-white/10 bg-black`} style={fullscreen === 'camera' ? { minHeight: 'calc(100vh - 5rem)' } : undefined}>
                {/* Visible video background; canvas overlays for guides/HUD */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: mirror ? "scaleX(-1)" : "none" }}
                />

                {/* Canvas draws only overlay; mirrors with video */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full block pointer-events-none"
                  style={{ transform: mirror ? "scaleX(-1)" : "none" }}
                />

                {/* Session stats overlay */}
                {running && (
                  <div className="absolute top-3 left-3 bg-black/60 rounded-xl p-3 text-white text-sm space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>Time:</span>
                      <span className="font-mono">{formatTime(seconds)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Reps:</span>
                      <span className="font-mono">{reps}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Score:</span>
                      <span className="font-mono">{score}%</span>
                    </div>
                  </div>
                )}

                {/* Top-right HUD buttons */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMuted((m) => !m)}
                    title={muted ? "Unmute cues" : "Mute cues"}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Button as="a" href="/ai-workout-plan" variant="secondary" size="sm" title="Open AI plan">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="sm" title="Fullscreen Video" onClick={() => {
                    const videoContainer = videoRef.current?.parentElement;
                    if (videoContainer && videoContainer.requestFullscreen) {
                      videoContainer.requestFullscreen().then(() => {
                      }).catch(err => {
                        console.log('Failed to enter fullscreen:', err);
                      });
                    }
                  }}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Center watermark */}
                {!running && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="flex items-center gap-2 text-brand-muted">
                      <Sparkles className="h-5 w-5" />
                      <span>Click Start to begin</span>
                    </div>
                  </div>
                )}

                {/* Prominent feedback text overlay */}
                {feedback && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10 max-w-[88%] pointer-events-none">
                    <div className={`px-4 py-2 rounded-2xl bg-black/60 text-white font-bold text-center shadow-lg ${feedbackTextSizeClass(feedbackSize)}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
                      {feedback}
                    </div>
                  </div>
                )}

                {/* Debug HUD */}
                {debug && (
                  <div className="absolute bottom-3 right-3 text-xs bg-black/60 rounded-md px-2 py-1 text-emerald-200">
                    <span>FPS: {fps}</span>
                    {lastPoseRef.current ? <span className="ml-2">LM: ✓</span> : <span className="ml-2">LM: …</span>}
                  </div>
                )}
              </div>
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            </div>
          </Card>
        </motion.div>

        {/* Controls / session info */}
        <motion.div {...fade(0.05)} className="lg:col-span-1">
          <Card title="Controls" subtitle="Choose day or single exercise" className="p-6 space-y-4">
            {/* Session metrics displayed above controls when running */}
            {running && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="card-glass p-3 text-center">
                  <p className="text-xs text-brand-muted">Time</p>
                  <p className="text-lg font-semibold">{formatTime(seconds)}</p>
                </div>
                <div className="card-glass p-3 text-center">
                  <p className="text-xs text-brand-muted">Reps</p>
                  <p className="text-lg font-semibold">{reps}</p>
                </div>
                <div className="card-glass p-3 text-center">
                  <p className="text-xs text-brand-muted">Score</p>
                  <p className="text-lg font-semibold">{score}</p>
                </div>
              </div>
            )}

            {/* Settings: feedback text size */}
            <div className="grid grid-cols-2 gap-2 items-center">
              <label className="text-sm font-medium">Feedback text size</label>
              <select
                className="w-full rounded-2xl border border-white/10 bg-white/10 hover:bg-white/20 text-white placeholder:text-gray-300 px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-white/30"
                value={feedbackSize}
                onChange={(e) => setFeedbackSize(e.target.value)}
                disabled={running}
              >
                <option
                  value="sm"
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  style={{ backgroundColor: "#1f2937", color: "#fff" }}
                >
                  Small
                </option>
                <option
                  value="md"
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  style={{ backgroundColor: "#1f2937", color: "#fff" }}
                >
                  Medium
                </option>
                <option
                  value="lg"
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  style={{ backgroundColor: "#1f2937", color: "#fff" }}
                >
                  Large
                </option>
                <option
                  value="xl"
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  style={{ backgroundColor: "#1f2937", color: "#fff" }}
                >
                  Huge
                </option>
              </select>
            </div>

            {/* Day selector if plan available; fallback to single exercise select */}
            {plan?.weeklyPlan?.length ? (
              <div>
                <label className="text-sm font-medium">Plan Day</label>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/10 hover:bg-white/20 text-white placeholder:text-gray-300 px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-white/30"
                  value={selectedDay || ""}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  disabled={running}
                >
                  {(plan.weeklyPlan || []).map((d, i) => (
                    <option
                      key={i}
                      value={d.day}
                      className="bg-gray-900 text-white hover:bg-gray-800"
                      style={{
                        backgroundColor: "#1f2937",
                        color: "#fff",
                      }}
                    >
                      {d.day} · {d.focus}
                    </option>
                  ))}
                </select>

                {dayItems?.length ? (
                  <motion.div
                    key={`progress-${currentIndex}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    {/* Simple Exercise Display */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-brand-text font-medium">{dayItems[currentIndex]?.name}</span>
                        <span className="text-brand-muted">Set {Math.min((dayItems[currentIndex]?.completedSets || 0) + 1, dayItems[currentIndex]?.sets || 1)} of {dayItems[currentIndex]?.sets || 1}</span>
                      </div>
                      {/* Skip Exercise Button */}
                      <div className="mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            // Skip current exercise - move to next and reset its progress to start from set 1
                            const nextIndex = currentIndex + 1;
                            if (nextIndex < dayItems.length) {
                              const updated = [...dayItems];
                              const nextItem = { ...updated[nextIndex] };
                              nextItem.completedSets = 0;
                              nextItem.totalReps = 0;
                              nextItem.formScores = [];
                              updated[nextIndex] = nextItem;
                              setDayItems(updated);

                              const nextName = dayItems[nextIndex].name;
                              setCurrentIndex(nextIndex);
                              setExercise(nextName);
                              setRepsBaseline(0);
                              setReps(0);
                              setScore(0);

                              try {
                                const norm = normalizeExerciseName(nextName);
                                if (!(norm.manual)) getSocket().emit('session:start', { exercise: norm.canonical, userId: user?._id });
                              } catch { }
                              try { speakIfAllowed(`Next: ${nextName}`); } catch { }

                              persistSession({ currentIndex: nextIndex, exercise: nextName, repsBaseline: 0 });
                            } else {
                              endSession();
                            }
                          }}
                          className="text-xs"
                        >
                          Skip Exercise
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-brand-muted mb-1">
                        <span>Workout Progress</span>
                        <span>{Math.round(((currentIndex + (dayItems[currentIndex]?.completedSets || 0) / (dayItems[currentIndex]?.sets || 1)) / dayItems.length) * 100)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <motion.div
                          className="bg-emerald-400 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${((currentIndex + (dayItems[currentIndex]?.completedSets || 0) / (dayItems[currentIndex]?.sets || 1)) / dayItems.length) * 100}%`
                          }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {/* Full Exercise List (Always Visible) */}
                    <div className="text-xs mt-2 space-y-1">
                      {dayItems.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            {idx < currentIndex ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ) : idx === currentIndex ? (
                              <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse"></div>
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-white/20"></div>
                            )}
                            <span
                              className={
                                idx < currentIndex
                                  ? "text-emerald-400"
                                  : idx === currentIndex
                                    ? "text-brand-text font-medium"
                                    : "text-brand-muted"
                              }
                            >
                              {it.name}
                            </span>
                          </div>
                          <div className="text-brand-muted">
                            {it.completedSets || 0}/{it.sets} sets
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Exercise</label>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                  disabled={running}
                >
                  {(exercisesList.length ? exercisesList.map((x) => x.name) : EXERCISES).map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedExercise && (
              <div className="mt-2 text-xs text-brand-muted">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    <span className="opacity-70">Difficulty:</span>
                    <span className="ml-1 text-brand-text">{selectedExercise.difficulty || "—"}</span>
                  </span>
                  {Array.isArray(selectedExercise.musclesTargeted) && selectedExercise.musclesTargeted.slice(0, 2).map((m) => (
                    <span key={m} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-brand-text">{m}</span>
                  ))}
                  {Array.isArray(selectedExercise.musclesTargeted) && selectedExercise.musclesTargeted.length > 2 && (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5">+{selectedExercise.musclesTargeted.length - 2} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Dumbbell weight input for Bicep Curl and Shoulder Press */}
            {isDumbbellExercise(exercise) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-emerald-400" />
                  <label className="text-sm font-medium">Enter Dumbbell Weight (kg)</label>
                </div>
                <Input
                  type="number"
                  placeholder="e.g. 5"
                  value={dumbbellWeight}
                  onChange={(e) => setDumbbellWeight(e.target.value)}
                  min="0"
                  step="0.5"
                  className="w-full"
                />
                {dumbbellWeight && reps > 0 && (
                  <div className="text-sm text-brand-text font-medium">
                    Calories Burned: {calculateCalories(dumbbellWeight, reps)}
                  </div>
                )}
              </div>
            )}

            {/* Inline example video for current exercise */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-brand-muted mb-2 flex items-center justify-between">
                <span>Example: <span className="text-brand-text">{example.name || exercise}</span></span>
                <Button variant="secondary" size="sm" onClick={() => setFullscreen(fs => fs === 'tutorial' ? null : 'tutorial')}>
                  {fullscreen === 'tutorial' ? <><Minimize2 className="h-4 w-4 mr-1" />Exit Fullscreen</> : <><Maximize2 className="h-4 w-4 mr-1" />Fullscreen</>}
                </Button>
              </p>
              {example.loading ? (
                <p className="text-xs text-brand-muted">Loading example…</p>
              ) : example.url ? (
                <div>
                  {renderEmbeddedVideo(example.url)}
                  {example.source && <p className="mt-2 text-[11px] text-brand-muted">Source: {example.source}</p>}
                </div>
              ) : (
                <p className="text-xs text-brand-muted">No example found. Check Tutorials.</p>
              )}
              {/* Cardio/duration fallback note */}
              {dayItems?.length > 0 && dayItems[currentIndex] && (dayItems[currentIndex].manual || dayItems[currentIndex].isDuration) && (
                <p className="text-[11px] text-amber-300 mt-2">Duration-only exercise detected — using default target of {dayItems[currentIndex].reps} reps for completion.</p>
              )}
            </div>

            {/* Start/Advance/End */}
            <div className="flex gap-3 pt-2 items-center">
              {!running ? (
                dayItems?.length ? (
                  <>
                    {workoutId ? (
                      <Button onClick={() => startSession({ ensureCreate: false })} className="flex-1"><Play className="mr-2 h-4 w-4" /> Resume</Button>
                    ) : (
                      <Button onClick={beginWorkoutForDay} className="flex-1"><Play className="mr-2 h-4 w-4" /> Start Workout</Button>
                    )}
                  </>
                ) : (
                  <Button onClick={() => startSession()} className="flex-1"><Play className="mr-2 h-4 w-4" /> Start (Single)</Button>
                )
              ) : (
                <>
                  {dayItems?.length ? (
                    <DayAdvanceControls
                      exercise={exercise}
                      reps={reps}
                      score={score}
                      dayItems={dayItems}
                      currentIndex={currentIndex}
                      repsBaseline={repsBaseline}
                      currentSetReps={Math.max(0, (reps || 0) - (repsBaseline || 0))}
                      setDayItems={setDayItems}
                      setCurrentIndex={setCurrentIndex}
                      setRepsBaseline={setRepsBaseline}
                      setExercise={setExercise}
                      setReps={setReps}
                      setScore={setScore}
                      userId={user?._id}
                      persistSession={persistSession}
                      onProgressChange={(updated) => persistDayProgress(selectedDay, todayIso, updated)}
                      onFinish={endSession}
                      speakIfAllowed={speakIfAllowed}
                    />
                  ) : null}
                  <Button variant="danger" onClick={endSession} className="flex-1">
                    <Square className="mr-2 h-4 w-4" /> End
                  </Button>
                </>
              )}
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-emerald-400" />
                Stand ~2–3m from camera, full body visible, good lighting.
              </div>
            </div>
          </Card>

          {completed && (
            <Card className="p-4 mt-2" title="Workout Complete" subtitle="Great job! Your session has been saved.">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-brand-text">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Session finished and saved.
                </div>

                {/* Workout Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card-glass p-3 text-center">
                    <p className="text-xs text-brand-muted">Total Time</p>
                    <p className="text-lg font-semibold">{formatTime(seconds)}</p>
                  </div>
                  <div className="card-glass p-3 text-center">
                    <p className="text-xs text-brand-muted">Exercises</p>
                    <p className="text-lg font-semibold">{dayItems?.length || 1}</p>
                  </div>
                  <div className="card-glass p-3 text-center">
                    <p className="text-xs text-brand-muted">Total Sets</p>
                    <p className="text-lg font-semibold">
                      {dayItems?.reduce((sum, item) => sum + (item.completedSets || 0), 0) || 1}
                    </p>
                  </div>
                  <div className="card-glass p-3 text-center">
                    <p className="text-xs text-brand-muted">Total Reps</p>
                    <p className="text-lg font-semibold">
                      {dayItems?.reduce((sum, item) => sum + (item.totalReps || 0), 0) || reps}
                    </p>
                  </div>
                </div>

                {/* Average Form Score */}
                {dayItems?.length > 0 && (
                  <div className="card-glass p-3 text-center">
                    <p className="text-xs text-brand-muted">Average Form Score</p>
                    <p className="text-xl font-semibold">
                      {(() => {
                        const allScores = dayItems.flatMap(item => item.formScores || []);
                        if (allScores.length === 0) return score || 0;
                        const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                        return Math.round(avg);
                      })()}%
                    </p>
                  </div>
                )}

                {/* Exercise Breakdown */}
                {dayItems?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-brand-text mb-2">Exercise Summary</h4>
                    <div className="space-y-2">
                      {dayItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm text-brand-text">{item.name}</span>
                          </div>
                          <div className="text-xs text-brand-muted">
                            {item.completedSets || 0} sets × {item.totalReps || 0} reps
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="mt-4">
            <Card title="How it works" className="p-4">
              <ol className="list-decimal pl-5 space-y-2 text-sm text-brand-muted">
                <li>Click <span className="text-brand-text font-medium">Start</span> to enable your camera.</li>
                <li>We’ll run a pose model on-device and emit <code className="text-brand-text">pose:update</code> to the server.</li>
                <li>Server validates reps & sends <code className="text-brand-text">feedback</code> and <code className="text-brand-text">score</code>.</li>
              </ol>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Fullscreen tutorial overlay */}
      {fullscreen === 'tutorial' && example?.url && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4">
          <div className="flex justify-end mb-3">
            <Button variant="secondary" size="sm" onClick={() => setFullscreen(null)}><Minimize2 className="h-4 w-4 mr-1" />Exit Fullscreen</Button>
          </div>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-w-5xl">
              {renderEmbeddedVideo(example.url)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function feedbackTextSizeClass(size) {
  switch (size) {
    case 'sm': return 'text-lg md:text-xl lg:text-2xl';
    case 'md': return 'text-xl md:text-2xl lg:text-3xl';
    case 'xl': return 'text-3xl md:text-4xl lg:text-5xl';
    case 'lg':
    default: return 'text-2xl md:text-3xl lg:text-4xl';
  }
}

// Advance controls for day-based flow (sets/reps + continue)
function DayAdvanceControls({ exercise, reps, score, dayItems, currentIndex, repsBaseline, currentSetReps, setDayItems, setCurrentIndex, setRepsBaseline, setExercise, setReps, setScore, userId, persistSession, onProgressChange, onFinish, speakIfAllowed }) {
  const current = dayItems[currentIndex];
  const manualMode = !!current?.manual || !!current?.isDuration;
  const canComplete = manualMode ? true : currentSetReps >= (current?.reps || 0);
  const setsDone = current?.completedSets || 0;
  const setsTotal = current?.sets || 1;
  const allSetsDone = setsDone >= setsTotal;

  const handleCompleteSet = () => {
    if (!current) return;
    const updated = [...dayItems];
    const item = { ...updated[currentIndex] };
    item.completedSets = (item.completedSets || 0) + 1;
    item.totalReps = (item.totalReps || 0) + currentSetReps;
    item.formScores = Array.isArray(item.formScores) ? [...item.formScores, score || 0] : [score || 0];
    updated[currentIndex] = item;
    setDayItems(updated);
    setRepsBaseline(reps); // next set counts from new baseline
    persistSession({ dayItems: updated, repsBaseline: reps });
    try { if (typeof speakIfAllowed === 'function') speakIfAllowed(`Set ${item.completedSets}/${item.sets || 1} complete`, { priority: true, category: 'info' }); } catch { }
    try { if (typeof onProgressChange === 'function') onProgressChange(updated); } catch { }
  };

  const handleContinue = () => {
    // Move to next exercise or finish
    const nextIndex = currentIndex + 1;
    if (nextIndex < dayItems.length) {
      const nextName = dayItems[nextIndex].name;
      setCurrentIndex(nextIndex);
      setExercise(nextName);
      setRepsBaseline(0);
      // Tell backend about new exercise
      try {
        const norm = normalizeExerciseName(nextName);
        if (!(norm.manual)) getSocket().emit('session:start', { exercise: norm.canonical, userId });
      } catch { }
      try { if (typeof speakIfAllowed === 'function') speakIfAllowed(`Next: ${nextName}`); } catch { }
      // Reset live counters when moving to next exercise
      setReps(0);
      setScore(0);
      persistSession({ currentIndex: nextIndex, exercise: nextName, repsBaseline: 0 });
      try { if (typeof onProgressChange === 'function') onProgressChange(dayItems); } catch { }
    } else {
      // All done: finish workout
      if (typeof onFinish === 'function') onFinish();
    }
  };

  // Auto-complete a set when target reps reached (for non-manual exercises)
  const autoRef = useRef({ completedAt: 0 });
  useEffect(() => {
    if (!current || manualMode) return;
    if (!canComplete || allSetsDone) return;
    const now = Date.now();
    // Debounce to avoid multiple triggers within 1s
    if (now - (autoRef.current.completedAt || 0) < 1000) return;
    const t = setTimeout(() => {
      autoRef.current.completedAt = Date.now();
      try { handleCompleteSet(); } catch { }
    }, 600);
    return () => clearTimeout(t);
  }, [canComplete, manualMode, allSetsDone, current]);

  // Auto-continue when all sets are done
  useEffect(() => {
    if (!current || !allSetsDone) return;
    const t = setTimeout(() => { try { handleContinue(); } catch { } }, 700);
    return () => clearTimeout(t);
  }, [allSetsDone, current]);

  if (!current) return null;

  return (
    <div className="flex gap-3 flex-1">
      {!allSetsDone ? (
        <Button onClick={handleCompleteSet} disabled={!canComplete} className="flex-1">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {manualMode ? 'Mark Set Done' : `Complete Set (${setsDone + 1}/${setsTotal})`}
        </Button>
      ) : (
        <Button onClick={handleContinue} className="flex-1">
          <ChevronRight className="mr-2 h-4 w-4" /> {currentIndex + 1 < dayItems.length ? 'Continue' : 'Finish Workout'}
        </Button>
      )}
    </div>
  );
}

// Parse a freeform item string like "Push-ups 3x10" into { name, sets, reps }
function parseExerciseItem(raw, defaultSets = 1, defaultReps = 10) {
  const base = { sets: defaultSets, reps: defaultReps, completedSets: 0, totalReps: 0, formScores: [], isDuration: false, manual: false };
  if (!raw || typeof raw !== 'string') return { name: String(raw || 'Exercise'), ...base };
  const text = raw.trim();
  const m = text.match(/^(.*?)(\s+(\d+)x(\d+))?$/i);
  let name = (m && m[1] ? m[1] : text).trim();
  let sets = m && m[3] ? parseInt(m[3]) : defaultSets;
  let reps = m && m[4] ? parseInt(m[4]) : defaultReps;
  // Detect duration/cardio style items and set sensible defaults
  const t = text.toLowerCase();
  const durationHints = /(\bmin\b|\bmins\b|\bminutes\b|\bsec\b|\bsecs\b|\bseconds\b|\bzone\s*2\b|walk|jog|run|bike|cycling|cardio|hiit|row)/i.test(t);
  if (durationHints && !(m && m[3] && m[4])) {
    // Use a default target reps for completion to allow flow to progress
    sets = 1;
    reps = 30; // default target reps for duration-only items
    base.isDuration = true;
    base.manual = true; // enable manual completion
  }
  return { name, sets, reps, ...base };
}

// Normalize plan/freeform names to library canonicals + manual flag for cardio/duration
function normalizeExerciseName(name) {
  const n = String(name || '').trim();
  const lower = n.toLowerCase();
  const duration = /(\bmin\b|\bmins\b|\bminutes\b|\bsec\b|\bsecs\b|\bseconds\b|\bzone\s*2\b|walk|jog|run|bike|cycling|cardio|row)/i.test(lower);
  // Common plural/synonym mappings
  const map = new Map([
    ['push-ups', 'Push-up'],
    ['push up', 'Push-up'],
    ['pushups', 'Push-up'],
    ['squats', 'Squat'],
    ['lunges', 'Lunge'],
    ['bicep curls', 'Bicep Curl'],
    ['tricep dips', 'Tricep Dip'],
    ['mountain climbers', 'Mountain Climber'],
    ['jumping jacks', 'Jumping Jack'],
    ['jumping jack', 'Jumping Jack'],
    ['shoulder press', 'Shoulder Press'],
  ]);
  const canonical = map.get(lower) || n;
  return { canonical, manual: duration };
}

function toYouTubeEmbed(url) {
  try {
    const u = new URL(url);
    const embed = (id) => {
      const embedUrl = new URL(`/embed/${encodeURIComponent(id)}`, "https://www.youtube.com");
      embedUrl.searchParams.set("autoplay", "1");
      embedUrl.searchParams.set("mute", "1");
      embedUrl.searchParams.set("playsinline", "1");
      return embedUrl.toString();
    };

    if (u.hostname.includes('youtu.be')) {
      return embed(u.pathname.slice(1));
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return embed(id);
      // handle shorts or embed forms
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) return embed(parts[1]);
      if (parts[0] === 'embed' && parts[1]) return embed(parts[1]);
    }
    return url;
  } catch {
    return url;
  }
}

function toVimeoEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts.find((p) => /^\d+$/.test(p));
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

function isDirectVideo(url) {
  return /(\.mp4|\.webm|\.ogg)(\?.*)?$/i.test(url);
}

function renderEmbeddedVideo(url) {
  if (/youtube\.com|youtu\.be/.test(url)) {
    const src = toYouTubeEmbed(url);
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
        <iframe
          src={src}
          title="Exercise Example"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  const vimeo = toVimeoEmbed(url);
  if (vimeo) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
        <iframe
          src={vimeo}
          title="Exercise Example"
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (/drive\.google\.com/.test(url)) {
    const previewUrl = url.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
        <iframe
          src={previewUrl}
          title="Exercise Example"
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }
  if (isDirectVideo(url)) {
    return (
      <video src={url} controls className="w-full rounded-2xl border border-white/10" preload="metadata" />
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
      <iframe
        src={url}
        title="Exercise Example"
        className="w-full h-full"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}