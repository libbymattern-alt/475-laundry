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
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", padding: "24px", width: 300, border: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>Who's doing laundry?</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>A machine just started nearby.</div>

        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Which machine?</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
          {activeSessions.map((s: any) => {
            const machine = ALL_MACHINES.find(m => m.id === s.machineId);
            const isWasher = machine?.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            const selected = machineId === s.machineId;
            return (
              <button key={s.machineId} onClick={() => setMachineId(s.machineId)} style={{ background: selected ? accentLight : "var(--color-background-secondary)", border: `0.5px solid ${selected ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-md)", padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" as const }}>
                <span style={{ fontSize: 20 }}>{isWasher ? "🫧" : "🌀"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: selected ? accent : "var(--color-text-primary)" }}>{machine?.label}</div>
                  {s.cycleNum && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>cycle {s.cycleNum}</div>}
                </div>
                {selected && <div style={{ marginLeft: "auto", fontSize: 16, color: accent }}>✓</div>}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Your unit</div>
        <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: "100%", marginBottom: 16, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px", fontSize: 13 }}>
          {UNITS.map(u => <option key={u} value={u}>Unit {u}</option>)}
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={{ flex: 1, background: "transparent", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px", cursor: "pointer", fontSize: 13 }}>not me</button>
          <button onClick={handleClaim} disabled={!machineId} style={{ flex: 1, background: machineId ? "#1D9E75" : "var(--color-background-secondary)", border: "none", color: machineId ? "#fff" : "var(--color-text-tertiary)", borderRadius: "var(--border-radius-md)", padding: "8px", cursor: machineId ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 500 }}>that's me</button>
        </div>
      </div>
    </div>
  );
}

function MachineCard({ machine, session, onStart, onStop, now }: any) {
  const sensorDriven = session?.source === "sensor";
  const isInUse = !!session;
  const done = isDone(session, now);
  const remaining = getRemaining(session, now);
  const progress = getProgress(session, now);
  const isWasher = machine.type === "washer";
  const accent = isWasher ? "#1D9E75" : "#BA7517";
  const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
  const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
  const cycles = isWasher ? WASH_CYCLES : DRY_CYCLES;
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [cycle, setCycle] = useState(cycles[1]);
  const [customMinutes, setCustomMinutes] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const effectiveCycle = useCustom && customMinutes ? { label: `Custom (${customMinutes}m)`, minutes: parseInt(customMinutes) } : cycle;

  return (
    <div style={{ background: isInUse ? accentLight : "var(--color-background-primary)", border: `0.5px solid ${isInUse ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-lg)", padding: "20px", display: "flex", flexDirection: "column" as const, gap: 12, transition: "all 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: isInUse ? accent : "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const }}>{machine.type}</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>{machine.label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {session?.cycleNum && <div style={{ fontSize: 14, color: accent, fontWeight: 500 }}>#{session.cycleNum}</div>}
          <div style={{ background: isInUse ? accentBorder : "var(--color-background-secondary)", color: isInUse ? accent : "var(--color-text-tertiary)", borderRadius: 20, padding: "4px 12px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" as const }}>
            {done ? "Done" : isInUse ? (sensorDriven ? "Running" : "In Use") : "Free"}
          </div>
        </div>
      </div>

      {isInUse && (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {progress !== null ? (
            <div style={{ position: "relative" as const, flexShrink: 0 }}>
              <TimerRing progress={progress} color={accent} size={72} />
              <div style={{ position: "absolute" as const, inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: accent }}>
                {done ? "✓" : formatTime(remaining!)}
              </div>
            </div>
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: accentBorder, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 28 }}>
              {isWasher ? "🫧" : "🌀"}
            </div>
          )}
          <div style={{ flex: 1 }}>
            {session.unit && <><div style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>Unit</div><div style={{ color: "var(--color-text-primary)", fontSize: 15, fontWeight: 500 }}>{session.unit}</div></>}
            <div style={{ color: accent, fontSize: 12, marginTop: 4 }}>
              {done ? (isWasher ? "↑ Move to dryer!" : "Grab your laundry!") : progress !== null ? session.cycleName : formatRunning(session.startTime, now)}
            </div>
            {sensorDriven && !session.unit && !done && (
              <button onClick={() => onStart(machine.id, null, null, true)} style={{ marginTop: 8, background: "transparent", border: `0.5px solid ${accent}`, color: accent, borderRadius: "var(--border-radius-md)", padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>that's me</button>
            )}
          </div>
          {!sensorDriven && (
            <button onClick={() => onStop(machine.id)} style={{ background: "transparent", border: "0.5px solid var(--color-border-danger)", color: "var(--color-text-danger)", borderRadius: "var(--border-radius-md)", padding: "6px 12px", cursor: "pointer", fontSize: 11 }}>Release</button>
          )}
        </div>
      )}

      {!isInUse && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={unit} onChange={e => { setUnit(e.target.value); localStorage.setItem("laundry-unit", e.target.value); }} style={{ flex: 1, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px", fontSize: 12 }}>
              {UNITS.map(u => <option key={u} value={u}>Unit {u}</option>)}
            </select>
            <select value={useCustom ? "custom" : cycle.label} onChange={e => { if (e.target.value === "custom") setUseCustom(true); else { setUseCustom(false); setCycle(cycles.find((c: any) => c.label === e.target.value) || cycles[1]); }}} style={{ flex: 2, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px", fontSize: 12 }}>
              {cycles.map((c: any) => <option key={c.label} value={c.label}>{c.label} ({c.minutes}m)</option>)}
              <option value="custom">Custom time...</option>
            </select>
          </div>
          {useCustom && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="1" max="240" placeholder="Enter minutes" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} style={{ flex: 1, background: "var(--color-background-secondary)", border: `0.5px solid ${accent}`, color: "var(--color-text-primary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px", fontSize: 12, outline: "none" }} />
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>min</div>
            </div>
          )}
          <button onClick={() => onStart(machine.id, unit, effectiveCycle)} disabled={useCustom && !customMinutes} style={{ background: (useCustom && !customMinutes) ? "var(--color-background-secondary)" : accent, color: (useCustom && !customMinutes) ? "var(--color-text-tertiary)" : "#fff", border: "none", borderRadius: "var(--border-radius-md)", padding: "10px", cursor: (useCustom && !customMinutes) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: 1 }}>
            Start {machine.type}
          </button>
        </div>
      )}
    </div>
  );
}

function Notification({ note, onDismiss }: any) {
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: "fixed" as const, bottom: 24, right: 24, background: "var(--color-background-primary)", border: "0.5px solid #9FE1CB", borderRadius: "var(--border-radius-lg)", padding: "14px 18px", fontSize: 13, color: "#0F6E56", maxWidth: 300, zIndex: 1000 }}>
      {note}
    </div>
  );
}

function StatusBoard({ sessions, now }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
        <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 16 }}>Quick overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ALL_MACHINES.map((m: any) => {
            const session = sessions[m.id];
            const isInUse = !!session;
            const done = isDone(session, now);
            const remaining = getRemaining(session, now);
            const isWasher = m.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            return (
              <div key={m.id} style={{ background: isInUse ? accentLight : "var(--color-background-secondary)", border: `0.5px solid ${isInUse ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-md)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isInUse ? accentBorder : "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {isWasher ? "🫧" : "🌀"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{m.label}</div>
                  {isInUse ? (
                    <>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>
                        {session.unit ? `Unit ${session.unit}` : ""}
                        {session.cycleNum ? `${session.unit ? " · " : ""}cycle ${session.cycleNum}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: accent, marginTop: 3, fontWeight: 500 }}>
                        {done ? "↑ Ready!" : remaining !== null ? formatTime(remaining) + " left" : formatRunning(session.startTime, now)}
                      </div>
                    </>
                  ) : <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>Available</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(sessions).length === 0 && (
        <div style={{ textAlign: "center" as const, padding: "48px 24px", color: "var(--color-text-tertiary)", fontSize: 18 }}>All machines are free ✦</div>
      )}

      {Object.keys(sessions).length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 12 }}>Active sessions</div>
          {Object.entries(sessions).map(([machineId, session]: any) => {
            const machine = ALL_MACHINES.find(m => m.id === machineId);
            const done = isDone(session, now);
            const remaining = getRemaining(session, now);
            const progress = getProgress(session, now);
            const isWasher = machine?.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            return (
              <div key={machineId} style={{ background: "var(--color-background-primary)", border: `0.5px solid ${done ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-md)", padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: progress !== null ? 10 : 0 }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{machine?.label}</span>
                    {session.unit && <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 8 }}>Unit {session.unit}</span>}
                    {session.cycleNum && <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 4 }}>· #{session.cycleNum}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: accent, fontWeight: 500 }}>
                    {done ? "Done!" : remaining !== null ? formatTime(remaining) : formatRunning(session.startTime, now)}
                  </div>
                </div>
                {progress !== null && (
                  <>
                    <div style={{ height: 3, background: "var(--color-background-secondary)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress * 100}%`, background: accent, transition: "width 1s linear" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span>{session.cycleName}</span>
                      <span>{Math.round(progress * 100)}% complete</span>
                    </div>
                  </>
                )}
                {progress === null && (
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>sensor detected · auto</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LaundryApp() {
  const [sessions, setSessions] = useState<any>({});
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notified, setNotified] = useState<any>({});
  const [activeTab, setActiveTab] = useState("status");
  const [connected, setConnected] = useState(false);
  const [claimPrompt, setClaimPrompt] = useState(false);

  useEffect(() => {
    const sessionsRef = ref(db, "sessions");
    const unsub = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSessions((prev: any) => {
        const hasNewSensor = Object.entries(data).some(([machineId, session]: any) =>
          session?.source === "sensor" && session?.status === "running" && !prev[machineId]
        );
        if (hasNewSensor) setClaimPrompt(true);
        return data;
      });
      setConnected(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Object.entries(sessions).forEach(([machineId, session]: any) => {
      if (!session) return;
      const done = isDone(session, now);
      if (done && !notified[machineId]) {
        setNotified((prev: any) => ({ ...prev, [machineId]: true }));
        const machine = ALL_MACHINES.find(m => m.id === machineId);
        const unit = session.unit ? `Unit ${session.unit} — ` : "";
        const msg = machine?.type === "washer"
          ? `🧺 ${unit}Washer done! Time to move to dryer.`
          : `✅ ${unit}Dryer done! Grab your laundry.`;
        setNotifications((prev: any) => [...prev, { id: Date.now(), msg }]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("475 Laundry", { body: msg });
        }
      }
      if (!done && notified[machineId]) {
        setNotified((prev: any) => ({ ...prev, [machineId]: false }));
      }
    });
  }, [now, sessions, notified]);

  const handleStart = useCallback(async (machineId: string, unit: string | null, cycle: any, claimSensor = false) => {
    if (claimSensor) { setClaimPrompt(true); return; }
    const cycleNum = await getNextCycleNumber();
    set(ref(db, `sessions/${machineId}`), {
      unit, cycleName: cycle.label,
      durationMs: cycle.minutes * 60 * 1000,
      startTime: Date.now(),
      cycleNum, source: "manual",
    });
    setNotified((prev: any) => ({ ...prev, [machineId]: false }));
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  const handleStop = useCallback((machineId: string) => {
    remove(ref(db, `sessions/${machineId}`));
    setNotified((prev: any) => ({ ...prev, [machineId]: false }));
  }, []);

  const handleClaim = useCallback((machineId: string, unit: string) => {
    set(ref(db, `sessions/${machineId}/unit`), unit);
    setClaimPrompt(false);
  }, []);

  const inUseCount = Object.keys(sessions).length;
  const freeCount = 4 - inUseCount;
  const activeSensorSessions = Object.entries(sessions)
    .filter(([, s]: any) => s?.source === "sensor" && s?.status === "running")
    .map(([machineId, s]: any) => ({ machineId, ...s }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", color: "var(--color-text-primary)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@300;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select, input { appearance: none; }
      `}</style>

      <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "20px 24px", background: "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 300 }}>475 Laundry</div>
          <div style={{ fontSize: 11, color: connected ? "#1D9E75" : "#BA7517", marginTop: 2 }}>{connected ? "● live" : "○ connecting..."}</div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 22, fontFamily: "'Fraunces', serif", color: "#1D9E75" }}>{freeCount}</div>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1 }}>free</div>
          </div>
          <div style={{ width: 1, height: 32, background: "var(--color-border-tertiary)" }} />
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 22, fontFamily: "'Fraunces', serif", color: "#BA7517" }}>{inUseCount}</div>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1 }}>in use</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 24px", background: "var(--color-background-primary)" }}>
        {[{ id: "status", label: "Status board" }, { id: "start", label: "Start machine" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "14px 0", marginRight: 28, fontSize: 12, color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)", borderBottom: `2px solid ${activeTab === tab.id ? "#1D9E75" : "transparent"}`, letterSpacing: 1, textTransform: "uppercase" as const }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>
        {activeTab === "status" && <StatusBoard sessions={sessions} now={now} />}
        {activeTab === "start" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <div style={{ gridColumn: "1/-1", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>Washers</div>
            {MACHINES.washers.map(m => <MachineCard key={m.id} machine={m} session={sessions[m.id]} onStart={handleStart} onStop={handleStop} now={now} />)}
            <div style={{ gridColumn: "1/-1", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginTop: 8 }}>Dryers</div>
            {MACHINES.dryers.map(m => <MachineCard key={m.id} machine={m} session={sessions[m.id]} onStart={handleStart} onStop={handleStop} now={now} />)}
          </div>
        )}
      </div>

      {claimPrompt && activeSensorSessions.length > 0 && (
        <ClaimModal
          activeSessions={activeSensorSessions}
          onClaim={(machineId: string, unit: string) => handleClaim(machineId, unit)}
          onDismiss={() => setClaimPrompt(false)}
        />
      )}

      {notifications.slice(-1).map((n: any) => (
        <Notification key={n.id} note={n.msg} onDismiss={() => setNotifications((prev: any) => prev.filter((x: any) => x.id !== n.id))} />
      ))}
    </div>
  );
}
