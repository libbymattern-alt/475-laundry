import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, remove, runTransaction } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAX8f3ITqqM-ubR41aALbWyuHzKO0hWqv0",
  authDomain: "laundry-fd0a4.firebaseapp.com",
  databaseURL: "https://laundry-fd0a4-default-rtdb.firebaseio.com",
  projectId: "laundry-fd0a4",
  storageBucket: "laundry-fd0a4.firebasestorage.app",
  messagingSenderId: "859520322947",
  appId: "1:859520322947:web:7a835161605325122cfab6",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const MACHINES = {
  washers: [
    { id: "w1", label: "Washer 1", type: "washer" },
    { id: "w2", label: "Washer 2", type: "washer" },
  ],
  dryers: [
    { id: "d1", label: "Dryer 1", type: "dryer" },
    { id: "d2", label: "Dryer 2", type: "dryer" },
  ],
};

const ALL_MACHINES = [...MACHINES.washers, ...MACHINES.dryers];

const WASH_CYCLES = [
  { label: "Quick Wash", minutes: 30 },
  { label: "Normal", minutes: 55 },
  { label: "Heavy Duty", minutes: 60 },
  { label: "Delicates", minutes: 35 },
  { label: "Bulky Items", minutes: 70 },
];

const DRY_CYCLES = [
  { label: "Quick Dry", minutes: 30 },
  { label: "Normal", minutes: 55 },
  { label: "Heavy Duty", minutes: 70 },
  { label: "Low Heat", minutes: 60 },
];

const UNITS = ["1R","1L","1RR","2R","2L","3R","3L","4R","4L"];

async function getNextCycleNumber(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const counterRef = ref(db, `cycleCounter/${today}`);
  let cycleNum = 1;
  await runTransaction(counterRef, (current) => {
    cycleNum = (current || 0) + 1;
    return cycleNum;
  });
  return cycleNum;
}

function formatTime(ms: number) {
  if (ms <= 0) return "Done!";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRunning(startTime: any, now: number) {
  const st = Number(startTime);
  if (!st || isNaN(st) || st < 1000000000000) return "running";
  const mins = Math.floor((now - st) / 60000);
  if (mins < 1) return "just started";
  return `running ${mins} min`;
}

function getRemaining(session: any, now: number) {
  if (!session?.durationMs || !session?.startTime) return null;
  const st = Number(session.startTime);
  if (!st || isNaN(st) || st < 1000000000000) return null;
  return Math.max(0, session.durationMs - (now - st));
}

function getProgress(session: any, now: number) {
  if (!session?.durationMs || !session?.startTime) return null;
  const st = Number(session.startTime);
  if (!st || isNaN(st) || st < 1000000000000) return null;
  return Math.min(1, (now - st) / session.durationMs);
}

function isDone(session: any, now: number) {
  if (!session) return false;
  if (session.status === "ready") return true;
  const remaining = getRemaining(session, now);
  return remaining !== null && remaining <= 0;
}

function TimerRing({ progress, color, size = 80 }: any) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-background-secondary)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

function ClaimModal({ activeSessions, onClaim, onDismiss }: any) {
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [machineId, setMachineId] = useState(activeSessions[0]?.machineId || "");

  const handleClaim = () => {
    localStorage.setItem("laundry-unit", unit);
    onClaim(machineId, unit);
  };

  return (
    <div style={{
      position: "fixed" as const,
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        position: "relative" as const,
        zIndex: 10000,
        background: "#d1f5e8",
        borderRadius: "20px 20px 0 0",
        padding: "28px 20px 48px",
        width: "100%",
        maxHeight: "85vh",
        overflowY: "auto" as const,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
      }}>
        <div style={{ width: 40, height: 4, background: "#9FE1CB", borderRadius: 2, margin: "0 auto 24px" }} />

        <div style={{ fontSize: 24, fontWeight: 600, color: "#085041", marginBottom: 4 }}>
          Who's doing laundry?
        </div>
        <div style={{ fontSize: 14, color: "#0F6E56", marginBottom: 28 }}>
          A machine just started nearby.
        </div>

        {activeSessions.length > 1 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#0F6E56", textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 10 }}>
              Which machine?
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 24 }}>
              {activeSessions.map((s: any) => {
                const machine = ALL_MACHINES.find(m => m.id === s.machineId);
                const isWasher = machine?.type === "washer";
                const selected = machineId === s.machineId;
                return (
                  <button key={s.machineId} onClick={() => setMachineId(s.machineId)} style={{
                    background: selected ? "#1D9E75" : "#ffffff",
                    border: `2px solid ${selected ? "#1D9E75" : "#9FE1CB"}`,
                    borderRadius: 14, padding: "14px 16px",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", gap: 12,
                    textAlign: "left" as const, width: "100%",
                  }}>
                    <span style={{ fontSize: 26 }}>{isWasher ? "🫧" : "🌀"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: selected ? "#ffffff" : "#085041" }}>
                        {machine?.label}
                      </div>
                      {s.cycleNum && (
                        <div style={{ fontSize: 12, color: selected ? "#9FE1CB" : "#0F6E56" }}>
                          cycle {s.cycleNum}
                        </div>
                      )}
                    </div>
                    {
