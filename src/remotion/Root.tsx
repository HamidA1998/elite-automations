import React from "react";
import {Composition} from "remotion";

import {LeadPreviewVideo, type LeadVideoProps} from "./LeadPreviewVideo";

export const RemotionRoot: React.FC = () => {
  const defaultProps: LeadVideoProps = {
    businessName: "Elite Demo",
    area: "Greater Manchester",
    topProblems: ["Weak first impression", "Unclear CTA", "Thin trust signals"],
    heroImagePath: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1080&q=80",
    brandName: "Hamid Enterprise",
    domain: "eliteautomations.co.uk",
    phoneNumber: "Contact via email",
  };

  return <Composition id="lead-preview" component={LeadPreviewVideo} durationInFrames={900} fps={30} width={1080} height={1920} defaultProps={defaultProps} />;
};
