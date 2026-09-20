# Elite Automations Marketing Website

AI-powered automation platform for professional services (dentists, estate agents, solicitors, accountants).

## Features

- **Conversion Hero** with atmospheric tech video background
- **Sector Pages** for Dentists, Estate Agents, Solicitors, Accountants
- **Film Showcase** with Remotion-generated demo videos
- **Pricing Section** - £499 setup + £49/month
- **Contact** - 07347 507295

## Tech Stack

- **Vite** - Fast build tool
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Framer Motion** - Animations
- **Remotion** - Video generation
- **React Router** - Client-side routing

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── src/
│   ├── components/     # React components
│   │   ├── AtmosphereVideo.tsx
│   │   ├── ConversionHero.tsx
│   │   ├── SectorsSection.tsx
│   │   ├── PricingSection.tsx
│   │   └── FilmShowcase.tsx
│   ├── pages/         # Route pages
│   │   ├── HomePage.tsx
│   │   └── SectorPage.tsx
│   ├── data/          # Site configuration
│   │   └── site.ts
│   ├── App.tsx        # App router
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
├── public/
│   ├── videos/        # Background & film videos
│   └── favicon.svg
├── remotion/          # Remotion compositions
└── api/               # API routes (if needed)
```

## Deployment

This site is deployed on Vercel as `elite-online-store`.

```bash
# Deploy to Vercel
vercel --prod
```

## Contact

Phone: 07347 507295  
Website: https://elite-online-store.vercel.app
