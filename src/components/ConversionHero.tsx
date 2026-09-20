import { motion } from 'framer-motion';
import { Phone, ArrowRight } from 'lucide-react';
import { AtmosphereVideo } from './AtmosphereVideo';
import { siteConfig } from '../data/site';

export function ConversionHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <AtmosphereVideo />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 leading-tight">
            Automate Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Professional Services
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            AI-powered automation that handles client communications, scheduling, and follow-ups.
            Save hours every week while never missing an opportunity.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-semibold hover:scale-105 transition-transform shadow-lg shadow-blue-500/50"
            >
              <Phone className="w-5 h-5" />
              {siteConfig.phone}
            </a>
            
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/20 text-white rounded-full font-semibold hover:bg-white/10 transition-colors"
            >
              View Pricing
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { label: 'Setup Fee', value: `£${siteConfig.pricing.setup}` },
              { label: 'Monthly', value: `£${siteConfig.pricing.monthly}` },
              { label: 'Time Saved', value: '10+ hrs/week' },
              { label: 'Response Time', value: '< 2 mins' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-cyan-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
