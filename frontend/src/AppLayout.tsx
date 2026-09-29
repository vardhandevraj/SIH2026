import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { DemoBanner } from "./components/DemoBanner";

export function AppLayout() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (isLanding) return <Outlet />;
  return (
    <div className="flex h-screen w-full overflow-hidden bg-base-950 text-slate-200">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <main className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
