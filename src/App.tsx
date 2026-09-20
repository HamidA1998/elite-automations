import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SectorPage } from './pages/SectorPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sectors/:sectorId" element={<SectorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
