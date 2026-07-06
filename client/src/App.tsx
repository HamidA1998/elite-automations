import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
import { Leads } from "./pages/Leads";
import { LeadDetail } from "./pages/LeadDetail";
import { Schedule } from "./pages/Schedule";
import { Analytics } from "./pages/Analytics";
import { Agents } from "./pages/Agents";
import { Settings } from "./pages/Settings";
import { useEffect } from "react";
import { useAppStore } from "./stores/appStore";
import { api } from "./services/api";

function DataLoader() {
  const { setState, setLoading, addLiveEvent } = useAppStore();

  useEffect(() => {
    // Initial data load
    setLoading(true);
    api.getState().then((s) => {
      setState(s);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Live event stream
    const es = new EventSource("/events");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        addLiveEvent(event);
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      // Silently reconnect — EventSource does this automatically
    };
    return () => es.close();
  }, [setState, setLoading, addLiveEvent]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <DataLoader />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
