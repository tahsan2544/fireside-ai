export function Hearth({ size = "lg" }: { size?: "sm" | "lg" }) {
  const scale = size === "sm" ? 0.4 : 1;
  return (
    <div className="hearth" style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
      <div className="hearth-frame">
        <div className="hearth-glow" />
        <div className="hearth-flame f1" />
        <div className="hearth-flame f2" />
        <div className="hearth-flame f3" />
        <div className="ember" />
        <div className="ember" />
        <div className="ember" />
        <div className="ember" />
        <div className="hearth-logs" />
      </div>
    </div>
  );
}
