import { ImageResponse } from "next/og";
export const alt = "SiteCraft AI — Big ideas. Beautiful websites.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
          height: "100%",
          background: "#f7f3eb",
          color: "#171d1b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>
          SiteCraft AI
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            letterSpacing: -4,
            fontWeight: 700,
          }}
        >
          <span>Big ideas.</span>
          <span>Beautiful websites.</span>
          <span style={{ color: "#d65339" }}>Just a prompt away.</span>
        </div>
        <div style={{ fontSize: 23 }}>
          Create · Customize · Understand · Export
        </div>
      </div>
    ),
    size,
  );
}
