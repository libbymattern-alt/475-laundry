import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, remove, runTransaction, push } from "firebase/database";

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

const ALL_MACHINES = [
  { id: "w1", label: "Washer 1", type: "washer" },
  { id: "w2", label: "Washer 2", type: "washer" },
  { id: "d1", label: "Dryer 1",  type: "dryer"  },
  { id: "d2", label: "Dryer 2",  type: "dryer"  },
];
const UNITS = ["1R","1L","1RR","2R","2L","3R","3L","4R","4L"];
const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "55 min", value: 55 },
  { label: "1:20",   value: 80 },
];

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

function getRemaining(session: any, now: number): number | null {
  if (!session?.durationMs || !session?.startTime) return null;
  const st = Number(session.startTime);
  if (!st || isNaN(st) || st < 1000000000000) return null;
  return Math.max(0, session.durationMs - (now - st));
}

function getProgress(session: any, now: number): number | null {
  if (!session?.durationMs || !session?.startTime) return null;
  const st = Number(session.startTime);
  if (!st || isNaN(st) || st < 1000000000000) return null;
  return Math.min(1, (now - st) / session.durationMs);
}

function formatTime(ms: number) {
  if (ms <= 0) return "Done!";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRunning(session: any, now: number) {
  const st = Number(session?.startTime);
  if (st && !isNaN(st) && st > 1000000000000) {
    const mins = Math.floor((now - st) / 60000);
    if (mins < 1) return "just started";
    return `running ${mins} min`;
  }
  return "running";
}

function formatAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StartModal({ machine, onConfirm, onCancel }: any) {
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [durationMins, setDurationMins] = useState<number>(55);
  const [showCustom, setShowCustom] = useState(false);
  const [customDuration, setCustomDuration] = useState("");

  const effectiveDuration = showCustom ? (parseInt(customDuration) || 0) : durationMins;
  const isWasher = machine.type === "washer";
  const accent = isWasher ? "#1D9E75" : "#BA7517";

  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: 480 }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>{machine.label}</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>Pick your unit and how long you need the machine.</div>

        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 10 }}>Your apt</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          {UNITS.map(u => (
            <button key={u} onClick={() => setUnit(u)} style={{ background: unit === u ? accent : "var(--color-background-secondary)", border: `1.5px solid ${unit === u ? accent : "var(--color-border-secondary)"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", fontSize: 15, fontWeight: unit === u ? 600 : 400, color: unit === u ? "#fff" : "var(--color-text-primary)", textAlign: "center" as const }}>{u}</button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 10 }}>How long?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
          {DURATION_PRESETS.map(p => (
            <button key={p.value} onClick={() => { setDurationMins(p.value); setShowCustom(false); }} style={{ background: !showCustom && durationMins === p.value ? accent : "var(--color-background-secondary)", border: `1.5px solid ${!showCustom && durationMins === p.value ? accent : "var(--color-border-secondary)"}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", fontSize: 13, fontWeight: !showCustom && durationMins === p.value ? 600 : 400, color: !showCustom && durationMins === p.value ? "#fff" : "var(--color-text-primary)", textAlign: "center" as const }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setShowCustom(true)} style={{ background: showCustom ? accent : "var(--color-background-secondary)", border: `1.5px solid ${showCustom ? accent : "var(--color-border-secondary)"}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: showCustom ? 600 : 400, color: showCustom ? "#fff" : "var(--color-text-primary)", whiteSpace: "nowrap" as const }}>Custom</button>
          {showCustom && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <input type="number" min="1" max="240" value={customDuration} onChange={e => setCustomDuration(e.target.value)} placeholder="e.g. 70" style={{ flex: 1, background: "var(--color-background-secondary)", border: "1.5px solid var(--color-border-secondary)", borderRadius: 10, padding: "10px 12px", fontSize: 15, color: "var(--color-text-primary)", outline: "none" }} />
              <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>min</span>
            </div>
          )}
        </div>

        <button onClick={() => { localStorage.setItem("laundry-unit", unit); onConfirm(unit, effectiveDuration * 60 * 1000); }} disabled={effectiveDuration <= 0} style={{ width: "100%", background: effectiveDuration > 0 ? accent : "var(--color-background-secondary)", border: "none", color: effectiveDuration > 0 ? "#fff" : "var(--color-text-tertiary)", borderRadius: 12, padding: "15px", cursor: effectiveDuration > 0 ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
          {effectiveDuration > 0 ? `Start ${effectiveDuration} min cycle` : "Pick a duration"}
        </button>
        <button onClick={onCancel} style={{ width: "100%", background: "none", border: "none", color: "var(--color-text-tertiary)", padding: "10px", cursor: "pointer", fontSize: 14, borderRadius: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

function ClearModal({ machine, session, onConfirm, onCancel }: any) {
  const isWasher = machine.type === "washer";
  const accent = isWasher ? "#1D9E75" : "#BA7517";
  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: "20px 20px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: 480 }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>Clear {machine.label}?</div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 }}>{session?.unit ? `Unit ${session.unit}'s` : "This"} session will be cleared and the machine marked available.</div>
        <button onClick={onConfirm} style={{ width: "100%", background: "#E57373", border: "none", color: "#fff", borderRadius: 12, padding: "15px", cursor: "pointer", fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Yes, clear it</button>
        <button onClick={onCancel} style={{ width: "100%", background: "none", border: "none", color: "var(--color-text-tertiary)", padding: "10px", cursor: "pointer", fontSize: 14, borderRadius: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

function StatusBoard({ sessions, now, onStart, onClear }: any) {
  const activeSessions = ALL_MACHINES.filter(m => !!sessions[m.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: 20 }}>
        <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 16 }}>Quick overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ALL_MACHINES.map(m => {
            const session = sessions[m.id];
            const inUse = !!session;
            const isWasher = m.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentLight = isWasher ? "#E1F5EE" : "#FAEEDA";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            const remaining = getRemaining(session, now);
            const progress = getProgress(session, now);
            const done = remaining !== null && remaining <= 0;
            return (
              <div key={m.id} onClick={() => inUse ? onClear(m) : onStart(m)} style={{ background: inUse ? accentLight : "var(--color-background-secondary)", border: `0.5px solid ${inUse ? accentBorder : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-md)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", position: "relative" as const }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: inUse ? accentBorder : "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {isWasher ? "🫧" : "🌀"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>{m.label}</div>
                  {inUse ? (
                    <>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>
                        {session.unit ? `Unit ${session.unit}` : "unclaimed"}{session.cycleNum ? ` · #${session.cycleNum}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: done ? "#E57373" : accent, marginTop: 2, fontWeight: 500 }}>
                        {done ? "Done! Tap to clear" : remaining !== null ? formatTime(remaining) : formatRunning(session, now)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>Available - tap to claim</div>
                  )}
                </div>
                {inUse && progress !== null && (
                  <div style={{ position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 3, borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(1 - progress) * 100}%`, background: done ? "#E57373" : accent, transition: "width 1s linear" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeSessions.length === 0 && (
        <div style={{ textAlign: "center" as const, padding: "40px 24px", color: "var(--color-text-tertiary)", fontSize: 18 }}>All machines are free</div>
      )}

      {activeSessions.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: 2, textTransform: "uppercase" as const, marginBottom: 12 }}>Active sessions</div>
          {ALL_MACHINES.map(m => {
            const session = sessions[m.id];
            if (!session) return null;
            const isWasher = m.type === "washer";
            const accent = isWasher ? "#1D9E75" : "#BA7517";
            const accentBorder = isWasher ? "#9FE1CB" : "#FAC775";
            const remaining = getRemaining(session, now);
            const progress = getProgress(session, now);
            const done = remaining !== null && remaining <= 0;
            return (
              <div key={m.id} style={{ background: "var(--color-background-primary)", border: `0.5px solid ${accentBorder}`, borderRadius: "var(--border-radius-md)", padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: progress !== null ? 10 : 0 }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{m.label}</span>
                    {session.unit && <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 8 }}>Unit {session.unit}</span>}
                    {session.cycleNum && <span style={{ color: "var(--color-text-tertiary)", fontSize: 12, marginLeft: 4 }}>#{session.cycleNum}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: done ? "#E57373" : accent, fontWeight: 500 }}>
                    {done ? "Done!" : remaining !== null ? formatTime(remaining) : formatRunning(session, now)}
                  </div>
                </div>
                {progress !== null && (
                  <>
                    <div style={{ height: 3, background: "var(--color-background-secondary)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(1 - progress) * 100}%`, background: done ? "#E57373" : accent, transition: "width 1s linear" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 5, display: "flex", justifyContent: "space-between" }}>
                      <span>{formatRunning(session, now)}</span>
                      <span>{Math.round(progress * 100)}% complete</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageBoard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, "messages"), (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, msg]: any) => ({ id, ...msg })).sort((a, b) => b.ts - a.ts).slice(0, 20);
      setMessages(list);
    });
    return () => unsub();
  }, []);

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    localStorage.setItem("laundry-unit", unit);
    await push(ref(db, "messages"), { text: text.trim(), unit, ts: Date.now() });
    setText("");
    setPosting(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 14 }}>Post a message</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
          {UNITS.map(u => (
            <button key={u} onClick={() => { setUnit(u); localStorage.setItem("laundry-unit", u); }} style={{ background: unit === u ? "#1D9E75" : "var(--color-background-secondary)", border: `1.5px solid ${unit === u ? "#1D9E75" : "var(--color-border-secondary)"}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 13, fontWeight: unit === u ? 600 : 400, color: unit === u ? "#fff" : "var(--color-text-primary)", textAlign: "center" as const }}>{u}</button>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Leave a note for your neighbors..." maxLength={200} rows={3} style={{ width: "100%", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", resize: "none" as const, fontFamily: "inherit", marginBottom: 10 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{text.length}/200</div>
          <button onClick={handlePost} disabled={!text.trim() || posting} style={{ background: text.trim() ? "#1D9E75" : "var(--color-background-secondary)", border: "none", color: text.trim() ? "#fff" : "var(--color-text-tertiary)", borderRadius: 10, padding: "10px 20px", cursor: text.trim() ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600 }}>{posting ? "Posting..." : "Post"}</button>
        </div>
      </div>
      {messages.length === 0 && <div style={{ textAlign: "center" as const, padding: "32px 24px", color: "var(--color-text-tertiary)", fontSize: 14 }}>No messages yet. Be the first to post!</div>}
      {messages.map(msg => (
        <div key={msg.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#085041" }}>Unit {msg.unit}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{formatAgo(msg.ts)}</div>
          </div>
          <div style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{msg.text}</div>
        </div>
      ))}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: "🔧", title: "A note from Libby", body: "I gave up on the vibration sensors - too unreliable. But I have something new and cool cookin'. Stay tuned. In the meantime, enjoy this basic version." },
    { icon: "👆", title: "Tap to claim", body: "Tap any available machine on the Status tab, pick your unit number and how long you need it. The countdown starts immediately for everyone to see." },
    { icon: "⏱️", title: "Countdown", body: "The app counts down your cycle in real time. When it hits zero the machine shows as done." },
    { icon: "✅", title: "Clear when done", body: "Tap a running machine to clear it when your laundry is done. Anyone can clear - just be a good neighbor." },
    { icon: "💬", title: "Messages", body: "Leave notes for your neighbors in the Messages tab." },
    { icon: "📱", title: "Add to your home screen", body: "On iPhone: tap the share button then Add to Home Screen. On Android: tap the menu then Add to Home Screen." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px" }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 6 }}>No sign-in. No buttons.</div>
        <div style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>Just tap a machine to claim it and set a timer. That is it.</div>
      </div>
      {steps.map((step, i) => (
        <div key={i} style={{ background: i === 0 ? "#E1F5EE" : "var(--color-background-primary)", border: `0.5px solid ${i === 0 ? "#9FE1CB" : "var(--color-border-tertiary)"}`, borderRadius: "var(--border-radius-lg)", padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{step.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: i === 0 ? "#085041" : "var(--color-text-primary)", marginBottom: 4 }}>{step.title}</div>
            <div style={{ fontSize: 13, color: i === 0 ? "#0a6b52" : "var(--color-text-secondary)", lineHeight: 1.6 }}>{step.body}</div>
          </div>
        </div>
      ))}
      <div style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB", borderRadius: "var(--border-radius-lg)", padding: "16px 20px" }}>
        <div style={{ fontSize: 13, color: "#085041", lineHeight: 1.6 }}><strong>Questions?</strong> Knock on 1RR or text the building group chat.</div>
      </div>
    </div>
  );
}

function Notification({ note, onDismiss }: any) {
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div style={{ position: "fixed" as const, bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--color-background-primary)", border: "0.5px solid #9FE1CB", borderRadius: "var(--border-radius-lg)", padding: "14px 18px", fontSize: 13, color: "#0F6E56", maxWidth: 320, zIndex: 1000, textAlign: "center" as const }}>
      {note}
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
  const [startTarget, setStartTarget] = useState<any>(null);
  const [clearTarget, setClearTarget] = useState<any>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "sessions"), (snapshot) => {
      setSessions(snapshot.val() || {});
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
    ALL_MACHINES.forEach(m => {
      const s = sessions[m.id];
      if (!s?.durationMs || !s?.startTime) return;
      const st = Number(s.startTime);
      if (!st || isNaN(st) || st < 1000000000000) return;
      if (now - st > s.durationMs + 60000) {
        remove(ref(db, `sessions/${m.id}`));
      }
    });
  }, [now, sessions]);

  useEffect(() => {
    ALL_MACHINES.forEach(m => {
      const s = sessions[m.id];
      if (!s) return;
      const remaining = getRemaining(s, now);
      const done = remaining !== null && remaining <= 0;
      if (done && !notified[m.id]) {
        setNotified((prev: any) => ({ ...prev, [m.id]: true }));
        const unitStr = s.unit ? `Unit ${s.unit} - ` : "";
        const msg = m.type === "washer"
          ? `${unitStr}Washer done! Time to move to dryer.`
          : `${unitStr}Dryer done! Grab your laundry.`;
        setNotifications((prev: any) => [...prev, { id: Date.now(), msg }]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("475 Laundry", { body: msg });
        }
      }
      if (!done && notified[m.id]) {
        setNotified((prev: any) => ({ ...prev, [m.id]: false }));
      }
    });
  }, [now, sessions, notified]);

  const handleStart = useCallback(async (unit: string, durationMs: number) => {
    if (!startTarget) return;
    const cycleNum = await getNextCycleNumber();
    await set(ref(db, `sessions/${startTarget.id}`), { unit, startTime: Date.now(), durationMs, cycleNum });
    setStartTarget(null);
  }, [startTarget]);

  const handleClear = useCallback(async () => {
    if (!clearTarget) return;
    await remove(ref(db, `sessions/${clearTarget.id}`));
    setClearTarget(null);
  }, [clearTarget]);

  const inUseCount = ALL_MACHINES.filter(m => !!sessions[m.id]).length;
  const freeCount = 4 - inUseCount;

  const tabs = [
    { id: "status", label: "Status" },
    { id: "board", label: "Messages" },
    { id: "howto", label: "How it works" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", color: "var(--color-text-primary)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@300;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select, input, textarea { appearance: none; }
      `}</style>

      {startTarget && <StartModal machine={startTarget} onConfirm={handleStart} onCancel={() => setStartTarget(null)} />}
      {clearTarget && <ClearModal machine={clearTarget} session={sessions[clearTarget.id]} onConfirm={handleClear} onCancel={() => setClearTarget(null)} />}

      <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "20px 24px", background: "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 300 }}>475 Laundry</div>
          <div style={{ fontSize: 11, color: connected ? "#1D9E75" : "#BA7517", marginTop: 2 }}>{connected ? "live" : "connecting..."}</div>
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

      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 16px", background: "var(--color-background-primary)", overflowX: "auto" as const }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "14px 0", marginRight: 20, fontSize: 11, whiteSpace: "nowrap" as const, color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)", borderBottom: `2px solid ${activeTab === tab.id ? "#1D9E75" : "transparent"}`, letterSpacing: 1, textTransform: "uppercase" as const, fontWeight: 400 }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>
        {activeTab === "status" && <StatusBoard sessions={sessions} now={now} onStart={setStartTarget} onClear={setClearTarget} />}
        {activeTab === "board" && <MessageBoard />}
        {activeTab === "howto" && <HowItWorks />}
      </div>

      {notifications.slice(-1).map((n: any) => (
        <Notification key={n.id} note={n.msg} onDismiss={() => setNotifications(prev => prev.filter((x: any) => x.id !== n.id))} />
      ))}
    </div>
  );
}
