import { ImageResponse } from "next/og";

export const alt = "Parcel Flow: from the office shelf to the final settlement";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const stats = [
  { label: "At office", value: "38" },
  { label: "On the way", value: "24" },
  { label: "COD pending", value: "1,284,000 MMK" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(135deg, #1b1938 0%, #0e0c1f 100%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1b1938",
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          P
        </div>
        <div style={{ fontSize: 34, fontWeight: 600 }}>Parcel Flow</div>
        <div
          style={{
            marginLeft: "auto",
            padding: "10px 24px",
            borderRadius: 999,
            background: "#c9b4fa",
            color: "#1b1938",
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          Live demo
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>
          From the office shelf to the final settlement.
        </div>
        <div style={{ fontSize: 30, color: "#bcbac9", lineHeight: 1.4 }}>
          Parcel delivery management for a small Yangon courier: riders, COD, settlements and
          payouts.
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "18px 28px",
              borderRadius: 18,
              border: "1px solid #3f3a52",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 22, color: "#9e9bb3" }}>{stat.label}</div>
            <div style={{ fontSize: 34, fontWeight: 600 }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
