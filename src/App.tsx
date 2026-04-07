function ClaimModal({ activeSessions, onClaim, onDismiss }: any) {
  const [unit, setUnit] = useState(() => localStorage.getItem("laundry-unit") || UNITS[0]);
  const [machineId, setMachineId] = useState(activeSessions[0]?.machineId || "");

  const handleClaim = () => {
    localStorage.setItem("laundry-unit", unit);
    onClaim(machineId, unit);
  };

  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#E1F5EE", borderRadius: "16px 16px 0 0", padding: "28px 24px", width: "100%", maxHeight: "80vh", overflowY: "auto" as const, border: "0.5px solid #9FE1CB" }}>

        <div style={{ fontSize: 22, fontWeight: 500, color: "#085041", marginBottom: 6 }}>Who's doing laundry?</div>
        <div style={{ fontSize: 14, color: "#0F6E56", marginBottom: 24 }}>A machine just started nearby.</div>

        {activeSessions.length > 1 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#085041", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>Which machine?</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 24 }}>
              {activeSessions.map((s: any) => {
                const machine = ALL_MACHINES.find(m => m.id === s.machineId);
                const isWasher = machine?.type === "washer";
                const selected = machineId === s.machineId;
                return (
                  <button key={s.machineId} onClick={() => setMachineId(s.machineId)} style={{
                    background: selected ? "#1D9E75" : "#fff",
                    border: `2px solid ${selected ? "#1D9E75" : "#9FE1CB"}`,
                    borderRadius: 12, padding: "12px 16px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left" as const,
                  }}>
                    <span style={{ fontSize: 24 }}>{isWasher ? "🫧" : "🌀"}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: selected ? "#fff" : "#085041" }}>{machine?.label}</div>
                      {s.cycleNum && <div style={{ fontSize: 12, color: selected ? "#9FE1CB" : "#0F6E56" }}>cycle {s.cycleNum}</div>}
                    </div>
                    {selected && <div style={{ marginLeft: "auto", fontSize: 18, color: "#fff" }}>✓</div>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ fontSize: 12, fontWeight: 500, color: "#085041", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 12 }}>Select your apt number</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
          {UNITS.map(u => {
            const selected = unit === u;
            return (
              <button key={u} onClick={() => setUnit(u)} style={{
                background: selected ? "#1D9E75" : "#fff",
                border: `2px solid ${selected ? "#1D9E75" : "#9FE1CB"}`,
                borderRadius: 12, padding: "14px 8px", cursor: "pointer",
                fontSize: 16, fontWeight: selected ? 600 : 400,
                color: selected ? "#fff" : "#085041",
                textAlign: "center" as const, transition: "all 0.15s",
              }}>
                {u}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDismiss} style={{
            flex: 1, background: "#fff", border: "2px solid #9FE1CB",
            color: "#085041", borderRadius: 12, padding: "14px",
            cursor: "pointer", fontSize: 15, fontWeight: 500,
          }}>
            Not me
          </button>
          <button onClick={handleClaim} disabled={!machineId} style={{
            flex: 2, background: machineId ? "#1D9E75" : "#9FE1CB",
            border: "none", color: "#fff", borderRadius: 12, padding: "14px",
            cursor: machineId ? "pointer" : "not-allowed",
            fontSize: 15, fontWeight: 600,
          }}>
            That's me →
          </button>
        </div>

      </div>
    </div>
  );
}
