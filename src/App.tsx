
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BusinessCards from "./pages/BusinessCards";
import Flyers from "./pages/Flyers";
import BusinessCardJobs from "./pages/BusinessCardJobs";
import BusinessCardJobNew from "./pages/BusinessCardJobNew";
import BusinessCardJobEdit from "./pages/BusinessCardJobEdit";
import FlyerJobs from "./pages/FlyerJobs";
import FlyerJobNew from "./pages/generic/FlyerJobNewPage";
import FlyerJobEdit from "./pages/FlyerJobEdit";
import FlyerJobDetail from "./pages/FlyerJobDetail";
import FlyerBatches from "./pages/FlyerBatches";
import FlyerBatchDetails from "./pages/FlyerBatchDetails";
import BusinessCardBatches from "./pages/BusinessCardBatches";
import BatchDetailsPage from "./pages/BatchDetailsPage";
import AllBatches from "./pages/AllBatches";
import AllJobsPage from "./pages/AllJobsPage";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import AppSelector from "./pages/AppSelector";
import BatchFlowHome from "./pages/BatchFlowHome";
import NotFound from "./pages/NotFound";

// Generic pages
import PostcardJobsPage from "./pages/generic/PostcardJobsPage";
import PostcardJobNewPage from "./pages/generic/PostcardJobNewPage";
import PostcardBatchesPage from "./pages/generic/PostcardBatchesPage";
import PosterJobsPage from "./pages/generic/PosterJobsPage";
import PosterJobNewPage from "./pages/generic/PosterJobNewPage";
import PosterBatchesPage from "./pages/generic/PosterBatchesPage";
import SleeveJobsPage from "./pages/generic/SleeveJobsPage";
import SleeveJobNewPage from "./pages/generic/SleeveJobNewPage";
import SleeveJobEditPage from "./pages/generic/SleeveJobEditPage";
import SleeveBatchesPage from "./pages/generic/SleeveBatchesPage";
import BoxJobsPage from "./pages/generic/BoxJobsPage";
import BoxJobNewPage from "./pages/generic/BoxJobNewPage";
import BoxBatchesPage from "./pages/generic/BoxBatchesPage";
import CoverJobsPage from "./pages/generic/CoverJobsPage";
import CoverJobNewPage from "./pages/generic/CoverJobNewPage";
import CoverBatchesPage from "./pages/generic/CoverBatchesPage";
import StickerJobsPage from "./pages/generic/StickerJobsPage";
import StickerJobNewPage from "./pages/generic/StickerJobNewPage";
import StickerBatchesPage from "./pages/generic/StickerBatchesPage";
import GenericBatchDetailsPage from "./pages/generic/GenericBatchDetailsPage";
import GenericJobDetailsPage from "./pages/generic/GenericJobDetailsPage";
import GenericJobEdit from "./pages/GenericJobEdit";
import PostcardJobEdit from "./pages/PostcardJobEdit";

// Tracker pages
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerUpload from "./pages/tracker/TrackerUpload";
import TrackerKanban from "./pages/tracker/TrackerKanban";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";

import { ProtectedRoute } from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import BatchFlowLayout from "./components/BatchFlowLayout";
import TrackerLayout from "./components/TrackerLayout";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app-selector" element={<AppSelector />} />

              {/* BatchFlow routes */}
              <Route path="/batchflow" element={
                <ProtectedRoute>
                  <BatchFlowLayout />
                </ProtectedRoute>
              }>
                <Route index element={<BatchFlowHome />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="business-cards" element={<BusinessCards />} />
                <Route path="flyers" element={<Flyers />} />
                <Route path="postcards" element={<PostcardJobsPage />} />
                <Route path="postcards/new" element={<PostcardJobNewPage />} />
                <Route path="postcards/edit/:id" element={<PostcardJobEdit />} />
                <Route path="postcards/batches" element={<PostcardBatchesPage />} />
                <Route path="posters" element={<PosterJobsPage />} />
                <Route path="posters/new" element={<PosterJobNewPage />} />
                <Route path="posters/batches" element={<PosterBatchesPage />} />
                <Route path="sleeves" element={<SleeveJobsPage />} />
                <Route path="sleeves/new" element={<SleeveJobNewPage />} />
                <Route path="sleeves/edit/:id" element={<SleeveJobEditPage />} />
                <Route path="sleeves/batches" element={<SleeveBatchesPage />} />
                <Route path="boxes" element={<BoxJobsPage />} />
                <Route path="boxes/new" element={<BoxJobNewPage />} />
                <Route path="boxes/batches" element={<BoxBatchesPage />} />
                <Route path="covers" element={<CoverJobsPage />} />
                <Route path="covers/new" element={<CoverJobNewPage />} />
                <Route path="covers/batches" element={<CoverBatchesPage />} />
                <Route path="stickers" element={<StickerJobsPage />} />
                <Route path="stickers/new" element={<StickerJobNewPage />} />
                <Route path="stickers/batches" element={<StickerBatchesPage />} />
                <Route path="business-card-jobs" element={<BusinessCardJobs />} />
                <Route path="business-card-jobs/new" element={<BusinessCardJobNew />} />
                <Route path="business-card-jobs/edit/:id" element={<BusinessCardJobEdit />} />
                <Route path="flyer-jobs" element={<FlyerJobs />} />
                <Route path="flyer-jobs/new" element={<FlyerJobNew />} />
                <Route path="flyer-jobs/edit/:id" element={<FlyerJobEdit />} />
                <Route path="flyer-jobs/:id" element={<FlyerJobDetail />} />
                <Route path="business-card-batches" element={<BusinessCardBatches />} />
                <Route path="flyer-batches" element={<FlyerBatches />} />
                <Route path="flyer-batches/:id" element={<FlyerBatchDetails />} />
                <Route path="batch/:id" element={<BatchDetailsPage />} />
                <Route path="batches" element={<AllBatches />} />
                <Route path="jobs" element={<AllJobsPage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="users" element={<Users />} />
                <Route path=":productType/batches/:batchId" element={<GenericBatchDetailsPage />} />
                <Route path=":productType/jobs/:jobId" element={<GenericJobDetailsPage />} />
                <Route path=":productType/jobs/edit/:jobId" element={<GenericJobEdit />} />
              </Route>

              {/* Tracker routes */}
              <Route path="/tracker" element={
                <ProtectedRoute>
                  <TrackerLayout />
                </ProtectedRoute>
              }>
                <Route index element={<TrackerDashboard />} />
                <Route path="upload" element={<TrackerUpload />} />
                <Route path="kanban" element={<TrackerKanban />} />
                <Route path="jobs" element={<TrackerJobs />} />
                <Route path="worksheets" element={<TrackerWorkSheets />} />
                <Route path="labels" element={<TrackerLabels />} />
                <Route path="admin" element={<TrackerAdmin />} />
              </Route>

              {/* Legacy routes that redirect to BatchFlow */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
