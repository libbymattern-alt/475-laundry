function ClaimModal({ activeSessions, onClaim, onDismiss }: any) {
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [machineId, setMachineId] = useState(activeSessions[0]?.machineId || "");

  const handleClaim = () => {
    localStorage.setItem("laundry-unit", unit);
    onClaim(machineId, unit);
  };

  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#d1f5e8", borderRadius: "20px 20px 0 0", padding: "28px 20px 40px", width: "100%", maxHeight: "85vh", overflowY: "auto" as const }}>

        <div style={{ width: 40, height: 4, background: "#9FE1CB", borderRadius: 2, margin: "0 auto 20px" }} />

        <div style={{ fontSize: 24, fontWeight: 600, color: "#085041", marginBottom: 4 }}>Who's doing laundry?</div>
        <div style={{ fontSize: 14, color: "#0F6E56", marginBottom: 24 }}>A machine just started nearby.</div>

        {activeSessions.length > 1 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#0F6E56", textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 10 }}>Which machine?</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 24 }}>
              {activeSessions.map((s: any) => {
                const machine = ALL_MACHINES.find(m => m.id === s.machineId);
                const isWasher = machine?.type === "washer";
                const selected = machineId === s.machineId;
                return (
                  <button key={s.machineId} onClick={() => setMachineId(s.machineId)} style={{
                    background: selected ? "#1D9E75" : "#fff",
                    border: `2px solid ${selected ? "#1D9E75" : "#9FE1CB"}`,
                    borderRadius: 14, padding: "14px 16px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    textAlign: "left" as const, width: "100%",
                  }}>
                    <span style={{ fontSize: 26 }}>{isWasher ? "🫧" : "🌀"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: selected ? "#fff" : "#085041" }}>{machine?.label}</div>
                      {s.cycleNum && <div style={{ fontSize: 12, color: selected ? "#9FE1CB" : "#0F6E56" }}>cycle {s.cycleNum}</div>}
                    </div>
                    {selected && <span style={{ fontSize: 20, color: "#fff" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: "#0F6E56", textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 12 }}>Select your apt number</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
          {UNITS.map(u => {
            const selected = unit === u;
            return (
              <button key={u} onClick={() => setUnit(u)} style={{
                background: selected ? "#1D9E75" : "#fff",
                border: `2px solid ${selected ? "#1D9E75" : "#9FE1CB"}`,
                borderRadius: 14, padding: "16px 8px",
                cursor: "pointer", fontSize: 17,
                fontWeight: selected ? 700 : 400,
                color: selected ? "#fff" : "#085041",
                textAlign: "center" as const,
              }}>
                {u}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onDismiss} style={{
            flex: 1, background: "#fff",
            border: "2px solid #9FE1CB",
            color: "#085041", borderRadius: 14, padding: "16px",
            cursor: "pointer", fontSize: 15, fontWeight: 600,
          }}>
            Not me
          </button>
          <button onClick={handleClaim} disabled={!machineId} style={{
            flex: 2, background: "#1D9E75",
            border: "none", color: "#fff",
            borderRadius: 14, padding: "16px",
            cursor: "pointer", fontSize: 16, fontWeight: 700,
            opacity: machineId ? 1 : 0.5,
          }}>
            That's me →
          </button>
        </div>

      </div>
    </div>
  );
}
