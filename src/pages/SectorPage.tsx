import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, CheckCircle } from 'lucide-react';
import { siteConfig } from '../data/site';
import { AtmosphereVideo } from '../components/AtmosphereVideo';

export function SectorPage() {
  const { sectorId } = useParams<{ sectorId: string }>();
  const sector = siteConfig.sectors.find((s) => s.id === sectorId);

  if (!sector) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Sector Not Found</h1>
          <Link to="/" className="text-cyan-400 hover:underline">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <AtmosphereVideo />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6">
              Automation for
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                {sector.name}
              </span>
            </h1>
            
            <p className="text-2xl text-gray-300 mb-8">
              {sector.description}
            </p>

            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-semibold hover:scale-105 transition-transform shadow-lg shadow-blue-500/50"
            >
              <Phone className="w-5 h-5" />
              {siteConfig.phone}
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-12">Key Benefits</h2>
          
          <div className="grid md:grid-cols-1 gap-6">
            {sector.benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 bg-gray-800/50 rounded-xl p-6 border border-gray-700"
              >
                <CheckCircle className="w-8 h-8 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {benefit}
                  </h3>
                  <p className="text-gray-400">
                    Automated workflows designed specifically for {sector.name.toLowerCase()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-3xl font-bold text-white mb-6">
              Ready to Transform Your Practice?
            </h3>
            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-blue-500/50"
            >
              <Phone className="w-6 h-6" />
              Call {siteConfig.phone}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
