import { ConversionHero } from '../components/ConversionHero';
import { SectorsSection } from '../components/SectorsSection';
import { PricingSection } from '../components/PricingSection';
import { FilmShowcase } from '../components/FilmShowcase';

export function HomePage() {
  return (
    <div className="bg-black min-h-screen">
      <ConversionHero />
      <SectorsSection />
      <FilmShowcase />
      <PricingSection />
    </div>
  );
}
