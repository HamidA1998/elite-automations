import { Composition } from 'remotion';
import { AtmosphereComposition } from './compositions/AtmosphereComposition';
import { AutomationDemo } from './compositions/AutomationDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="atmosphere-tech"
        component={AtmosphereComposition}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="automation-demo"
        component={AutomationDemo}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
