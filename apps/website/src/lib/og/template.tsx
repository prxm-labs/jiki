/** @jsxImportSource react */
import type { ReactElement } from "react";

export type OGKind =
  | "home"
  | "docs"
  | "example"
  | "changelog"
  | "roadmap"
  | "page";

export interface OGProps {
  title: string;
  description?: string;
  eyebrow?: string;
  route?: string;
  kind: OGKind;
}

const COLORS = {
  bg: "#09090b",
  fg: "#fafafa",
  muted: "#d4d4d8",
  dim: "#a1a1aa",
  accent: "#10b981",
  accentLight: "#34d399",
  accentDark: "#059669",
  purple: "#a78bfa",
  border: "#27272a",
};

function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 22) return 104;
  if (len <= 36) return 88;
  if (len <= 56) return 72;
  if (len <= 80) return 60;
  return 52;
}

function JikiLogo({ height = 64 }: { height?: number }): ReactElement {
  const width = (719 / 877) * height;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 719 877"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M705.395 318.352V679.124H636.016V318.352H705.395ZM670.706 104.818C684.068 104.818 695.374 109.701 704.624 119.465C713.875 128.716 718.5 140.022 718.5 153.384C718.5 166.232 713.875 177.281 704.624 186.532C695.374 195.782 684.068 200.408 670.706 200.408C657.344 200.408 646.038 195.782 636.787 186.532C627.536 177.281 622.911 166.232 622.911 153.384C622.911 140.022 627.536 128.716 636.787 119.465C646.038 109.701 657.344 104.818 670.706 104.818Z"
        fill={COLORS.fg}
      />
      <path
        d="M377.067 0V444.027L512.742 308.352H604.476L450.3 457.903L619.894 669.124H529.701L400.964 504.926L377.067 528.824V669.124H307.688V0H377.067Z"
        fill={COLORS.fg}
      />
      <path
        d="M230.672 308.352V669.124H161.292V308.352H230.672ZM195.982 94.8184C209.344 94.8184 220.65 99.7006 229.901 109.465C239.151 118.716 243.777 130.022 243.777 143.384C243.777 156.232 239.151 167.281 229.901 176.532C220.65 185.782 209.344 190.408 195.982 190.408C182.62 190.408 171.314 185.782 162.063 176.532C152.813 167.281 148.188 156.232 148.188 143.384C148.188 130.022 152.813 118.716 162.063 109.465C171.314 99.7006 182.62 94.8184 195.982 94.8184Z"
        fill={COLORS.fg}
      />
      <path d="M705 876.379H162V807H705V876.379Z" fill={COLORS.fg} />
      <path d="M705 771.379H162V702H705V771.379Z" fill={COLORS.fg} />
      <path
        d="M82.4842 308.534V875.902H13.105V308.534H82.4842ZM47.7946 95C61.1565 95 72.4627 99.8823 81.7133 109.647C90.9638 118.897 95.5891 130.204 95.5891 143.565C95.5891 156.413 90.9638 167.463 81.7133 176.713C72.4627 185.964 61.1565 190.589 47.7946 190.589C34.4326 190.589 23.1264 185.964 13.8758 176.713C4.62528 167.463 0 156.413 0 143.565C0 130.204 4.62528 118.897 13.8758 109.647C23.1264 99.8823 34.4326 95 47.7946 95Z"
        fill={COLORS.fg}
      />
    </svg>
  );
}

export function renderOG(props: OGProps): ReactElement {
  const { title, description, eyebrow, route, kind } = props;
  const titleSize = titleFontSize(title);

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.bg,
        position: "relative",
        fontFamily: "Inter",
        color: COLORS.fg,
      }}
    >
      {/* Radial emerald glow (top-left) */}
      <div
        style={{
          position: "absolute",
          top: -260,
          left: -200,
          width: 760,
          height: 760,
          borderRadius: 9999,
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.32), rgba(16,185,129,0.06) 55%, rgba(9,9,11,0) 75%)",
          display: "flex",
        }}
      />
      {/* Purple accent glow (bottom-right) */}
      <div
        style={{
          position: "absolute",
          bottom: -240,
          right: -180,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.18), rgba(167,139,250,0.04) 55%, rgba(9,9,11,0) 75%)",
          display: "flex",
        }}
      />

      {/* Left edge accent gradient bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: `linear-gradient(180deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%)`,
          display: "flex",
        }}
      />

      {/* Top row: logo + eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 72px 0 80px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <JikiLogo height={56} />
        </div>
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: "rgba(16,185,129,0.08)",
              color: COLORS.accentLight,
              fontFamily: "JetBrains Mono",
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: COLORS.accent,
                display: "flex",
              }}
            />
            {eyebrow}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>

      {/* Center block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 80px",
          marginTop: 64,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Instrument Serif",
            fontStyle: "italic",
            fontSize: titleSize,
            lineHeight: 1.06,
            letterSpacing: "-0.015em",
            color: COLORS.fg,
            maxWidth: 1040,
            // satori uses -webkit-line-clamp
            // @ts-ignore
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              marginTop: 28,
              fontFamily: "Inter",
              fontSize: 28,
              lineHeight: 1.4,
              color: COLORS.muted,
              maxWidth: 980,
              // @ts-ignore
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      {/* Bottom strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px 52px 80px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "JetBrains Mono",
            fontSize: 22,
            color: COLORS.dim,
          }}
        >
          <span style={{ color: COLORS.accent }}>$</span>
          <span>jiki.sh</span>
        </div>
        {route ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: "rgba(39,39,42,0.6)",
              fontFamily: "JetBrains Mono",
              fontSize: 20,
              color: COLORS.muted,
              maxWidth: 720,
              overflow: "hidden",
            }}
          >
            <span style={{ color: COLORS.purple, marginRight: 8 }}>→</span>
            {route}
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
      </div>
    </div>
  );
}
