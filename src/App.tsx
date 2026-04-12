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
const UNITS = ["1R","1L","1RR","2R","2L","3R","3L","4R","4L"];
const HEARTBEAT_TIMEOUT = 5 * 60 * 1000;

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

function isExpired(session: any, now: number) {
  if (!session || session.status !== "ready") return false;
  const st = Number(session.startTime);
  if (!st || isNaN(st) || st < 1000000000000) return false;
  const readyAt = session.durationMs ? st + session.durationMs : st;
  return now - readyAt > 45 * 60 * 1000;
}

function isSensorDown(machineId: string, heartbeats: any, now: number) {
  const hb = heartbeats?.[machineId];
  if (!hb?.ts) return false;
  return now - Number(hb.ts) > HEARTBEAT_TIMEOUT;
}

function HowItWorks() {
  const steps = [
    { icon: "📡", title: "Fully automatic", body: "Each machine has a small sensor on it that detects when it's running. You don't need to press anything or sign in." },
    { icon: "🔄", title: "Running", body: "When a machine starts, the app updates automatically within seconds." },
    { icon: "🧺", title: "Ready to grab", body: "When a cycle finishes and the machine stops vibrating, it flips to \"Ready to grab\" after a few minutes." },
    { icon: "🅿️", title: "Optional: claim your load", body: "Tap the Claim tab when you start your laundry to attach your apartment number. This helps neighbors know whose clothes are in the machine." },
    { icon: "📱", title: "Add to your home screen", body: "On iPhone: tap the share button (□↑) then \"Add to Home Screen\". On Android: tap the menu then \"Add to Home Screen\". It'll work like an app!" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>No sign-in. No buttons.</div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          The laundry room runs itself. Just check the Status tab to see what's available.
        </div>
      </div>
      {steps.map((step, i) => (
        <div key={i} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{step.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{step.title}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{step.body}</div>
          </div>
        </div>
      ))}
      <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: "var(--border-radius-lg)", padding: "16px 20px" }}>
        <div style={{ fontSize: 13, color: "#085041", lineHeight: 1.6 }}>
          <strong>Questions?</strong> Knock on 1RR or text the building group chat.
        </div>
      </div>
    </div>
  );
}

function ClaimTab({ sessions, now, onClaim }: any) {
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [selectedMachineId, setSelectedMachineId] = useState("");

  const unclaimedSessions = Object.entries(sessions)
    .filter(([, s]: any) => s?.source === "sensor" && s?.status === "running" && !s?.unit && !isExpired(s, now))
    .map(([machineId, s]: any) => ({ machineId, ...s }));

  const handleClaim = () => {
    localStorage.setItem("laundry-unit", unit);
    onClaim(selectedMachineId, unit);
    setSelectedMachineId("");
  };

  if (unclaimedSessions.length === 0) {
    return (
      <div style={{ textAlign: "center" as const, padding: "48px 24px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🫧</div>
        <div style={{ fontSize: 18, color: "var(--color-text-primary)", fontWeight: 500, marginBottom: 8 }}>Nothing to claim</div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          When a machine starts and nobody has claimed it, it'll show up here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
      <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Tap a machine to claim it as yours.</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
        {unclaimedSessions.map((s: any) => {
          const machine = ALL_MACHINES.find(m => m.id === s.machineId);
          const isWasher = machine?.type === "washer";
          const accent = isWasher ? "#1D9E75" : "#BA7517";
          const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
          const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
          const selected = selectedMachineId === s.machineId;
          return (
            <button key={s.machineId} onClick={() => setSelectedMachineId(selected ? "" : s.machineId)} style={{
              background: selected ? accentLight : "var(--color-background-primary)",
              border: `2px solid ${selected ? accent : accentBorder}`,
              borderRadius: "var(--border-radius-lg)", padding: "16px 20px",
              cursor: "pointer", display: "flex", alignItems: "center",
              gap: 14, textAlign: "left" as const, width: "100%",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: selected ? accentBorder : accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {isWasher ? "🫧" : "🌀"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)" }}>{machine?.label}</div>
                <div style={{ fontSize: 12, color: accent, marginTop: 2 }}>
                  {s.cycleNum ? `cycle ${s.cycleNum} · ` : ""}{formatRunning(s.startTime, now)}
                </div>
              </div>
              {selected && <span style={{ fontSize: 22, color: accent }}>✓</span>}
            </button>
          );
        })}
      </div>
      {selectedMachineId && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>Your apt number</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {UNITS.map(u => {
              const selected = unit === u;
              return (
                <button key={u} onClick={() => setUnit(u)} style={{
                  background: selected ? "#1D9E75" : "var(--color-background-secondary)",
                  border: `1.5px solid ${selected ? "#1D9E75" : "var(--color-border-secondary)"}`,
                  borderRadius: 10, padding: "12px 8px", cursor: "pointer", fontSize: 15,
                  fontWeight: selected ? 600 : 400,
                  color: selected ? "#fff" : "var(--color-text-primary)",
                  textAlign: "center" as const,
                }}>
                  {u}
                </button>
              );
            })}
          </div>
          <button onClick={handleClaim} style={{ width: "100%", background: "#1D9E75", border: "none", color: "#fff", borderRadius: 12, padding: "14px", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
            That's me →
          </button>
        </div>
      )}
    </div>
  );
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

function Notification({ note, onDismiss }: any) {
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: "fixed" as const, bottom: 24, right: 24, background: "var(--color-background-primary)", border: "0.5px solid #9FE1CB", borderRadius: "var(--border-radius-lg)", padding: "14px 18px", fontSize: 13, color: "#0F6E56", maxWidth: 300, zIndex: 1000 }}>
      {note}
    </div>
  );
}

function StatusBoard({ sessions, now, heartbeats }: any) {
  function handleSensorWarning(machineId: string) {
    const machine = ALL_MACHINES.find(m => m.id === machineId);
    alert(`⚠️ ${machine?.label} sensor is not responding.\n\nText Libby!`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
        <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 16 }}>Quick overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ALL_MACHINES.map((m: any) => {
            const session = sessions[m.id];
            const expired = isExpired(session, now);
            const isInUse = !!session && !expired;
            const done = isDone(session, now);
            const remaining = getRemaining(session, now);
            const isWasher = m.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            const sensorDown = isSensorDown(m.id, heartbeats, now);
            return (
              <div key={m.id} style={{ background: isInUse ? accentLight : "var(--color-background-secondary)", border: `0.5px solid ${isInUse ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-md)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "relative" as const }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isInUse ? accentBorder : "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {isWasher ? "🫧" : "🌀"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{m.label}</div>
                  {isInUse ? (
                    <>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>
                        {session.unit ? `Unit ${session.unit}` : "unclaimed"}
                        {session.cycleNum ? ` · cycle ${session.cycleNum}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: accent, marginTop: 3, fontWeight: 500 }}>
                        {done ? "↑ Ready!" : remaining !== null ? formatTime(remaining) + " left" : formatRunning(session.startTime, now)}
                      </div>
                    </>
                  ) : <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>Available</div>}
                </div>
                {sensorDown && (
                  <button onClick={() => handleSensorWarning(m.id)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, padding: 0, lineHeight: 1,
                    position: "absolute" as const, top: 8, right: 8,
                  }}>⚠️</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(sessions).filter(id => !isExpired(sessions[id], now)).length === 0 && (
        <div style={{ textAlign: "center" as const, padding: "48px 24px", color: "var(--color-text-tertiary)", fontSize: 18 }}>
          All machines are free ✦
        </div>
      )}

      {Object.keys(sessions).filter(id => !isExpired(sessions[id], now)).length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 12 }}>Active sessions</div>
          {Object.entries(sessions)
            .filter(([, session]: any) => !isExpired(session, now))
            .map(([machineId, session]: any) => {
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
                      {session.unit
                        ? <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 8 }}>Unit {session.unit}</span>
                        : <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 8 }}>unclaimed</span>
                      }
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
  const [heartbeats, setHeartbeats] = useState<any>({});
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notified, setNotified] = useState<any>({});
  const [activeTab, setActiveTab] = useState("status");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const sessionsRef = ref(db, "sessions");
    const unsub = onValue(sessionsRef, (snapshot) => {
      setSessions(snapshot.val() || {});
      setConnected(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const hbRef = ref(db, "heartbeat");
    const unsub = onValue(hbRef, (snapshot) => {
      setHeartbeats(snapshot.val() || {});
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
      if (!session || isExpired(session, now)) return;
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

  const handleClaim = useCallback((machineId: string, unit: string) => {
    set(ref(db, `sessions/${machineId}/unit`), unit);
  }, []);

  const activeSessions = Object.keys(sessions).filter(id => !isExpired(sessions[id], now));
  const inUseCount = activeSessions.length;
  const freeCount = 4 - inUseCount;
  const unclaimedCount = activeSessions.filter(id => {
    const s = sessions[id];
    return s?.source === "sensor" && s?.status === "running" && !s?.unit;
  }).length;

  const tabs = [
    { id: "status", label: "Status" },
    { id: "claim", label: unclaimedCount > 0 ? `Claim (${unclaimedCount})` : "Claim" },
    { id: "howto", label: "How it works" },
  ];

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
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "14px 0", marginRight: 24, fontSize: 12,
            color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            borderBottom: `2px solid ${activeTab === tab.id ? "#1D9E75" : "transparent"}`,
            letterSpacing: 1, textTransform: "uppercase" as const,
            fontWeight: tab.id === "claim" && unclaimedCount > 0 ? 600 : 400,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>
        {activeTab === "status" && <StatusBoard sessions={sessions} now={now} heartbeats={heartbeats} />}
        {activeTab === "claim" && <ClaimTab sessions={sessions} now={now} onClaim={handleClaim} />}
        {activeTab === "howto" && <HowItWorks />}
      </div>

      {notifications.slice(-1).map((n: any) => (
        <Notification key={n.id} note={n.msg} onDismiss={() => setNotifications((prev: any) => prev.filter((x: any) => x.id !== n.id))} />
      ))}
    </div>
  );
}
