import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

const films = [
  {
    id: 'automation-demo',
    title: 'See Automation in Action',
    thumbnail: '/videos/film-automation-thumb.jpg',
    video: '/videos/film-automation.mp4',
  },
  {
    id: 'client-success',
    title: 'Client Success Stories',
    thumbnail: '/videos/film-success-thumb.jpg',
    video: '/videos/film-success.mp4',
  },
  {
    id: 'platform-tour',
    title: 'Platform Walkthrough',
    thumbnail: '/videos/film-tour-thumb.jpg',
    video: '/videos/film-tour.mp4',
  },
];

export function FilmShowcase() {
  return (
    <section className="py-24 px-6 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            Watch It In Action
          </h2>
          <p className="text-xl text-gray-400">
            See how Elite Automations transforms professional services
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {films.map((film, index) => (
            <motion.div
              key={film.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-gray-800"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
              
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white fill-white" />
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                <h3 className="text-xl font-bold text-white">{film.title}</h3>
              </div>

              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-cyan-600/20" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
