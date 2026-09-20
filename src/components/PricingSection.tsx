import { motion } from 'framer-motion';
import { Check, Phone } from 'lucide-react';
import { siteConfig } from '../data/site';

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6 bg-black">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-400">
            One-time setup, then affordable monthly automation
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-3xl p-12 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20"
        >
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="text-center">
              <div className="text-lg text-gray-400 mb-2">Setup Fee</div>
              <div className="text-6xl font-bold text-white mb-2">
                £{siteConfig.pricing.setup}
              </div>
              <div className="text-gray-400">One-time payment</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg text-gray-400 mb-2">Monthly</div>
              <div className="text-6xl font-bold text-cyan-400 mb-2">
                £{siteConfig.pricing.monthly}
              </div>
              <div className="text-gray-400">Per month, cancel anytime</div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 mb-8">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              What's Included
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                'AI-powered client communications',
                'Automated appointment scheduling',
                'Smart follow-up sequences',
                'CRM integration',
                'Real-time notifications',
                'Custom workflows',
                'Priority support',
                'Monthly performance reports',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-blue-500/50"
            >
              <Phone className="w-6 h-6" />
              Call {siteConfig.phone}
            </a>
            <p className="text-gray-400 mt-4">
              Speak to a specialist about your automation needs
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
