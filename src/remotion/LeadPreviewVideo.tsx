import React from "react";
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

export type LeadVideoProps = {
  businessName: string;
  area: string;
  topProblems: string[];
  heroImagePath: string;
  brandName: string;
  domain: string;
  phoneNumber: string;
};

const sceneStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: 96,
  color: "white",
  fontFamily: "Arial, Helvetica, sans-serif",
};

export const LeadPreviewVideo: React.FC<LeadVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fade = spring({fps, frame, config: {damping: 14, stiffness: 90}});

  const problems = props.topProblems.slice(0, 3);

  return (
    <AbsoluteFill style={{backgroundColor: "#050d16"}}>
      <AbsoluteFill>
        <Img src={props.heroImagePath} style={{width: "100%", height: "100%", objectFit: "cover", opacity: 0.22}} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: "linear-gradient(180deg, rgba(5,13,22,.64), rgba(5,13,22,.92))"}} />

      {frame < 150 ? (
        <AbsoluteFill style={sceneStyle}>
          <div style={{fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: "#8ecae6"}}>Website audit</div>
          <div style={{fontSize: 86, fontWeight: 700, lineHeight: 1.02, maxWidth: 860, transform: `translateY(${interpolate(fade, [0, 1], [50, 0])}px)`}}>
            We looked at your website, {props.businessName}...
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 150 && frame < 360 ? (
        <AbsoluteFill style={sceneStyle}>
          <div style={{fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: "#8ecae6"}}>Top issues</div>
          <div style={{display: "grid", gap: 24, marginTop: 28}}>
            {problems.map((problem, index) => {
              const localFrame = frame - 150 - index * 28;
              return (
                <div
                  key={problem}
                  style={{
                    opacity: interpolate(localFrame, [0, 12], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
                    transform: `translateY(${interpolate(localFrame, [0, 14], [28, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`,
                    fontSize: 48,
                    lineHeight: 1.3,
                    background: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 28,
                    padding: "24px 28px",
                  }}
                >
                  {problem}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 360 && frame < 660 ? (
        <AbsoluteFill style={{...sceneStyle, justifyContent: "space-between"}}>
          <div>
            <div style={{fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: "#8ecae6"}}>Free demo concept</div>
            <div style={{fontSize: 78, fontWeight: 700, lineHeight: 1.03, maxWidth: 820, marginTop: 20}}>A sharper, more modern first impression for {props.area}.</div>
          </div>
          <div
            style={{
              width: 720,
              height: 1280,
              borderRadius: 56,
              border: "12px solid rgba(255,255,255,.18)",
              overflow: "hidden",
              background: "#0f1722",
              boxShadow: "0 40px 100px rgba(0,0,0,.35)",
              alignSelf: "center",
            }}
          >
            <div style={{height: 76, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", padding: "0 28px", fontSize: 28}}>
              {props.businessName}
            </div>
            <div style={{transform: `translateY(${interpolate(frame, [360, 660], [0, -420])}px)`}}>
              <Img src={props.heroImagePath} style={{width: "100%", height: 420, objectFit: "cover"}} />
              <div style={{padding: 28, display: "grid", gap: 18}}>
                {[props.businessName, "Services", "About", "Testimonials", "Contact"].map((label) => (
                  <div key={label} style={{background: "rgba(255,255,255,.06)", borderRadius: 24, minHeight: 140, padding: 24}}>
                    <div style={{fontSize: 32, fontWeight: 700}}>{label}</div>
                    <div style={{fontSize: 22, opacity: 0.72, marginTop: 12}}>Premium layout, clearer messaging, stronger trust cues.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 660 && frame < 840 ? (
        <AbsoluteFill style={sceneStyle}>
          <div style={{fontSize: 96, fontWeight: 700, lineHeight: 1.02, maxWidth: 860}}>We built this. For free. No obligation.</div>
        </AbsoluteFill>
      ) : null}

      {frame >= 840 ? (
        <AbsoluteFill style={sceneStyle}>
          <div style={{fontSize: 42, letterSpacing: 4, textTransform: "uppercase", color: "#8ecae6"}}>{props.brandName}</div>
          <div style={{fontSize: 98, fontWeight: 700, lineHeight: 1, marginTop: 16}}>{props.domain}</div>
          <div style={{fontSize: 42, marginTop: 20}}>{props.phoneNumber}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
