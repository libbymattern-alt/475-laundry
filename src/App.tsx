import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, remove } from "firebase/database";

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

function formatTime(ms: number) {
  if (ms <= 0) return "Done!";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const res = await fetch("/vapidPublicKey");
  const vapidKey = await res.text();
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });
}

function TimerRing({ progress, color, size = 80 }: any) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a2e" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

function MachineCard({ machine, session, onStart, onStop, now }: any) {
  const isInUse = !!session;
  const elapsed = isInUse ? now - session.startTime : 0;
  const remaining = isInUse ? Math.max(0, session.durationMs - elapsed) : 0;
  const progress = isInUse ? Math.min(1, elapsed / session.durationMs) : 0;
  const done = isInUse && remaining === 0;
  const isWasher = machine.type === "washer";
  const accent = isWasher ? "#4fd1c5" : "#f6ad55";
  const cycles = isWasher ? WASH_CYCLES : DRY_CYCLES;
  const [unit, setUnit] = useState(UNITS[0]);
  const [cycle, setCycle] = useState(cycles[1]);

  return (
    <div style={{
      background: isInUse ? (done ? "#1a2a1a" : "#0f1a2e") : "#12121f",
      border: `1px solid ${isInUse ? (done ? "#68d391" : accent) : "#2a2a3e"}`,
      borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 12,
      transition: "all 0.4s ease",
      boxShadow: isInUse ? `0 0 20px ${done ? "#68d39140" : accent + "30"}` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#666", letterSpacing: 2, textTransform: "uppercase" as const }}>{machine.type}</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "#e8e8f0", marginTop: 2 }}>{machine.label}</div>
        </div>
        <div style={{
          background: isInUse ? (done ? "#68d391" : accent) : "#2a2a3e",
          color: isInUse ? "#000" : "#555",
          borderRadius: 20, padding: "4px 12px", fontSize: 11,
          fontFamily: "'DM Mono', monospace", letterSpacing: 1, textTransform: "uppercase" as const,
        }}>
          {isInUse ? (done ? "✓ Done" : "In Use") : "Free"}
        </div>
      </div>

      {isInUse ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative" as const, flexShrink: 0 }}>
            <TimerRing progress={progress} color={done ? "#68d391" : accent} size={80} />
            <div style={{ position: "absolute" as const, inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 12, color: done ? "#68d391" : accent }}>
              {done ? "✓" : formatTime(remaining)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#888", fontSize: 12 }}>Unit</div>
            <div style={{ color: "#e8e8f0", fontSize: 16, fontFamily: "'Fraunces', serif" }}>{session.unit}</div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>{session.cycleName}</div>
            {done && <div style={{ color: "#68d391", fontSize: 12, marginTop: 4 }}>↑ Move your laundry!</div>}
          </div>
          <button onClick={() => onStop(machine.id)} style={{
            background: "transparent", border: "1px solid #ef4444", color: "#ef4444",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11,
          }}>Release</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#e8e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              {UNITS.map(u => <option key={u} value={u}>Unit {u}</option>)}
            </select>
            <select value={cycle.label} onChange={e => setCycle(cycles.find((c: any) => c.label === e.target.value) || cycles[1])} style={{ flex: 2, background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#e8e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              {cycles.map((c: any) => <option key={c.label} value={c.label}>{c.label} ({c.minutes}m)</option>)}
            </select>
          </div>
          <button onClick={() => onStart(machine.id, unit, cycle)} style={{
            background: accent, color: "#000", border: "none", borderRadius: 8, padding: "10px",
            cursor: "pointer", fontSize: 12, fontWeight: "bold", textTransform: "uppercase" as const,
          }}>Start {machine.type}</button>
        </div>
      )}
    </div>
  );
}

function StatusBoard({ machines, sessions, now }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "#0f0f1a", border: "1px solid #1a1a2e", borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 16 }}>Quick Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {machines.map((m: any) => {
            const session = sessions[m.id];
            const isInUse = !!session;
            const elapsed = isInUse ? now - session.startTime : 0;
            const remaining = isInUse ? Math.max(0, session.durationMs - elapsed) : 0;
            const done = isInUse && remaining === 0;
            const isWasher = m.type === "washer";
            const accent = isWasher ? "#4fd1c5" : "#f6ad55";
            return (
              <div key={m.id} style={{ background: isInUse ? (done ? "#1a2a1a" : "#0c1520") : "#12121f", border: `1px solid ${isInUse ? (done ? "#68d391" : accent + "60") : "#1e1e2e"}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: isInUse ? (done ? "#68d39120" : accent + "20") : "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {isWasher ? "🫧" : "🌀"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: "#e8e8f0" }}>{m.label}</div>
                  {isInUse ? (
                    <>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Unit {session.unit} · {session.cycleName}</div>
                      <div style={{ fontSize: 12, color: done ? "#68d391" : accent, marginTop: 3 }}>{done ? "↑ Ready to move!" : formatTime(remaining) + " left"}</div>
                    </>
                  ) : <div style={{ fontSize: 12, color: "#3a3a5e", marginTop: 2 }}>Available</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {Object.keys(sessions).length === 0 && (
        <div style={{ textAlign: "center" as const, padding: "48px 24px", color: "#333", fontFamily: "'Fraunces', serif", fontSize: 20 }}>All machines are free ✦</div>
      )}
      {Object.keys(sessions).length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 12 }}>Active Sessions</div>
          {Object.entries(sessions).map(([machineId, session]: any) => {
            const machine = machines.find((m: any) => m.id === machineId);
            const elapsed = now - session.startTime;
            const remaining = Math.max(0, session.durationMs - elapsed);
            const progress = Math.min(1, elapsed / session.durationMs);
            const done = remaining === 0;
            const accent = machine?.type === "washer" ? "#4fd1c5" : "#f6ad55";
            return (
              <div key={machineId} style={{ background: "#0f0f1a", border: `1px solid ${done ? "#68d39160" : "#1a1a2e"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontFamily: "'Fraunces', serif", color: "#e8e8f0" }}>{machine?.label}</span>
                    <span style={{ color: "#555", fontSize: 12, marginLeft: 8 }}>Unit {session.unit}</span>
                  </div>
                  <div style={{ fontSize: 13, color: done ? "#68d391" : accent }}>{done ? "Done!" : formatTime(remaining)}</div>
                </div>
                <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress * 100}%`, background: done ? "#68d391" : accent, transition: "width 1s linear" }} />
                </div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{session.cycleName}</span><span>{Math.round(progress * 100)}% complete</span>
                </div>
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
  const [pushSub, setPushSub] = useState<any>(null);

  useEffect(() => {
    const sessionsRef = ref(db, "sessions");
    const unsub = onValue(sessionsRef, (snapshot) => {
      setSessions(snapshot.val() || {});
      setConnected(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        console.log("SW registered", reg);
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Object.entries(sessions).forEach(([machineId, session]: any) => {
      if (!session) return;
      const remaining = session.durationMs - (now - session.startTime);
      if (remaining <= 0 && !notified[machineId]) {
        setNotified((prev: any) => ({ ...prev, [machineId]: true }));
        const machine = [...MACHINES.washers, ...MACHINES.dryers].find(m => m.id === machineId);
        const msg = machine?.type === "washer"
          ? `🧺 Unit ${session.unit} — Washer done! Time to move to dryer.`
          : `✅ Unit ${session.unit} — Dryer done! Pick up your laundry.`;
        setNotifications((prev: any) => [...prev, { id: Date.now(), msg }]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("475 Laundry", { body: msg });
        }
      }
    });
  }, [now, sessions, notified]);

  const handleStart = useCallback((machineId: string, unit: string, cycle: any) => {
    set(ref(db, `sessions/${machineId}`), {
      unit, cycleName: cycle.label,
      durationMs: cycle.minutes * 60 * 1000,
      startTime: Date.now(),
    });
    setNotified((prev: any) => ({ ...prev, [machineId]: false }));
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleStop = useCallback((machineId: string) => {
    remove(ref(db, `sessions/${machineId}`));
    setNotified((prev: any) => ({ ...prev, [machineId]: false }));
  }, []);

  const allMachines = [...MACHINES.washers, ...MACHINES.dryers];
  const inUseCount = Object.keys(sessions).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#e8e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select { appearance: none; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ borderBottom: "1px solid #1a1a2e", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 300 }}>475 Laundry</div>
          <div style={{ fontSize: 11, color: connected ? "#4fd1c5" : "#f6ad55", letterSpacing: 2, textTransform: "uppercase" as const, marginTop: 2 }}>
            {connected ? "● Live" : "○ Connecting..."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 22, fontFamily: "'Fraunces', serif", color: "#4fd1c5" }}>{4 - inUseCount}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" as const, letterSpacing: 1 }}>Free</div>
          </div>
          <div style={{ width: 1, height: 36, background: "#1a1a2e" }} />
          <div style={{ textAlign: "right" as const }}>
            <div style={{ fontSize: 22, fontFamily: "'Fraunces', serif", color: "#f6ad55" }}>{inUseCount}</div>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase" as const, letterSpacing: 1 }}>In Use</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #1a1a2e", padding: "0 24px" }}>
        {[{ id: "status", label: "Status Board" }, { id: "start", label: "Start Machine" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "14px 0", marginRight: 28,
            fontSize: 12, color: activeTab === tab.id ? "#e8e8f0" : "#555",
            borderBottom: `2px solid ${activeTab === tab.id ? "#4fd1c5" : "transparent"}`,
            letterSpacing: 1, textTransform: "uppercase" as const,
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: "24px" }}>
        {activeTab === "status" && <StatusBoard machines={allMachines} sessions={sessions} now={now} />}
        {activeTab === "start" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <div style={{ gridColumn: "1/-1", fontFamily: "'Fraunces', serif", fontSize: 16, color: "#4fd1c5" }}>Washers</div>
            {MACHINES.washers.map(m => <MachineCard key={m.id} machine={m} session={sessions[m.id]} onStart={handleStart} onStop={handleStop} now={now} />)}
            <div style={{ gridColumn: "1/-1", fontFamily: "'Fraunces', serif", fontSize: 16, color: "#f6ad55", marginTop: 8 }}>Dryers</div>
            {MACHINES.dryers.map(m => <MachineCard key={m.id} machine={m} session={sessions[m.id]} onStart={handleStart} onStop={handleStop} now={now} />)}
          </div>
        )}
      </div>

      {notifications.slice(-1).map((n: any) => (
        <div key={n.id} style={{ position: "fixed" as const, bottom: 24, right: 24, background: "#1a2a1a", border: "1px solid #68d391", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#68d391", animation: "slideUp 0.3s ease", maxWidth: 300, zIndex: 1000 }}>
          {n.msg}
        </div>
      ))}
    </div>
  );
}
