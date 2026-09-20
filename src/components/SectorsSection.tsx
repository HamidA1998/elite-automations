import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { siteConfig } from '../data/site';

export function SectorsSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            Built For Your Industry
          </h2>
          <p className="text-xl text-gray-400">
            Tailored automation solutions for professional services
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {siteConfig.sectors.map((sector, index) => (
            <motion.div
              key={sector.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-cyan-500/50 transition-colors"
            >
              <h3 className="text-3xl font-bold text-white mb-3">
                {sector.name}
              </h3>
              <p className="text-gray-400 mb-6">{sector.description}</p>
              
              <ul className="space-y-3">
                {sector.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
