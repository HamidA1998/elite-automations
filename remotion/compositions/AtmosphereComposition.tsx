import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const AtmosphereComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 120,
          color: '#76d6ce',
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        Elite Automations
      </div>
    </AbsoluteFill>
  );
};
