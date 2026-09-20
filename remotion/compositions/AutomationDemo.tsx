import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export const AutomationDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070607',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: 'center',
          padding: '40px',
        }}
      >
        <h1
          style={{
            fontSize: 80,
            color: '#f5f1e8',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          Automation in Action
        </h1>
        <p
          style={{
            fontSize: 40,
            color: '#76d6ce',
          }}
        >
          Save 10+ hours per week
        </p>
      </div>
    </AbsoluteFill>
  );
};
