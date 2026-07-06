import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAutoTheme } from "@/hooks/useTime";
import { useAppStore } from "@/stores/appStore";

export function Shell() {
  const { manualTheme } = useAppStore();
  const activeTheme = useAutoTheme(manualTheme);

  // Apply theme to document root whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme);
  }, [activeTheme]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-[1720px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
