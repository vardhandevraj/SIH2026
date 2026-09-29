import { Suspense, lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { AppLayout } from "./AppLayout";
import { DemoProvider } from "./context/DemoContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteFallback } from "./components/State";
import { Landing } from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const WalletDetail = lazy(() => import("./pages/WalletDetail").then((m) => ({ default: m.WalletDetail })));
const InvestigationDetail = lazy(() => import("./pages/InvestigationDetail").then((m) => ({ default: m.InvestigationDetail })));
const GraphPage = lazy(() => import("./pages/GraphPage").then((m) => ({ default: m.GraphPage })));
const VaspsPage = lazy(() => import("./pages/VaspsPage").then((m) => ({ default: m.VaspsPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TimelinePage = lazy(() => import("./pages/TimelinePage").then((m) => ({ default: m.TimelinePage })));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage").then((m) => ({ default: m.WatchlistPage })));
const CasesPage = lazy(() => import("./pages/CasesPage").then((m) => ({ default: m.CasesPage })));
const BulkPage = lazy(() => import("./pages/BulkPage").then((m) => ({ default: m.BulkPage })));
const DiffPage = lazy(() => import("./pages/DiffPage").then((m) => ({ default: m.DiffPage })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <DemoProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Landing />} />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/wallet/:address"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <WalletDetail />
                  </Suspense>
                }
              />
              <Route
                path="/investigation/:id"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <InvestigationDetail />
                  </Suspense>
                }
              />
              <Route
                path="/graph/:address"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <GraphPage />
                  </Suspense>
                }
              />
              <Route
                path="/vasps"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <VaspsPage />
                  </Suspense>
                }
              />
              <Route
                path="/history"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <HistoryPage />
                  </Suspense>
                }
              />
              <Route
                path="/timeline/:address"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <TimelinePage />
                  </Suspense>
                }
              />
              <Route
                path="/watchlist"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <WatchlistPage />
                  </Suspense>
                }
              />
              <Route
                path="/cases"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <CasesPage />
                  </Suspense>
                }
              />
              <Route
                path="/bulk"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <BulkPage />
                  </Suspense>
                }
              />
              <Route
                path="/diff"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <DiffPage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<Landing />} />
            </Route>
          </Routes>
        </DemoProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
