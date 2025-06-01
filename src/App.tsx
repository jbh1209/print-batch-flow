import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BusinessCards from "./pages/BusinessCards";
import Flyers from "./pages/Flyers";
import Postcards from "./pages/Postcards";
import Sleeves from "./pages/Sleeves";
import Boxes from "./pages/Boxes";
import Stickers from "./pages/Stickers";
import Covers from "./pages/Covers";
import Posters from "./pages/Posters";
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
import TrackerProduction from "./pages/tracker/TrackerProduction";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import BatchFlowLayout from "./components/BatchFlowLayout";
import TrackerLayout from "./components/TrackerLayout";
import { productConfigs } from "./config/productTypes";
import FlyerBatchDetailsWrapper from "./pages/FlyerBatchDetailsWrapper";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors duration={3000} />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/app-selector" element={<AppSelector />} />

                {/* BatchFlow routes with proper /batchflow prefix */}
                <Route path="/batchflow" element={
                  <ProtectedRoute>
                    <BatchFlowLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<BatchFlowHome />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  
                  {/* All Jobs and All Batches */}
                  <Route path="all-jobs" element={<AllJobsPage />} />
                  <Route path="batches" element={<AllBatches />} />
                  
                  {/* Business Cards routes - Updated paths */}
                  <Route path="batches/business-cards" element={<BusinessCards />} />
                  <Route path="batches/business-cards/jobs" element={<BusinessCardJobs />} />
                  <Route path="batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
                  <Route path="batches/business-cards/jobs/edit/:id" element={<BusinessCardJobEdit />} />
                  <Route path="batches/business-cards/batches" element={<BusinessCardBatches />} />
                  <Route path="batches/business-cards/batches/:batchId" element={<BatchDetailsPage productType="business-cards" backUrl="/batchflow/batches/business-cards/batches" />} />
                  
                  {/* Flyers routes - Updated paths */}
                  <Route path="batches/flyers" element={<Flyers />} />
                  <Route path="batches/flyers/jobs" element={<FlyerJobs />} />
                  <Route path="batches/flyers/jobs/new" element={<FlyerJobNew />} />
                  <Route path="batches/flyers/jobs/edit/:id" element={<FlyerJobEdit />} />
                  <Route path="batches/flyers/jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="batches/flyers/batches" element={<FlyerBatches />} />
                  <Route path="batches/flyers/batches/:batchId" element={<FlyerBatchDetailsWrapper />} />
                  
                  {/* Postcards routes - Fixed to use overview page */}
                  <Route path="batches/postcards" element={<Postcards />} />
                  <Route path="batches/postcards/jobs" element={<PostcardJobsPage />} />
                  <Route path="batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
                  <Route path="batches/postcards/jobs/edit/:id" element={<PostcardJobEdit />} />
                  <Route path="batches/postcards/batches" element={<PostcardBatchesPage />} />
                  <Route path="batches/postcards/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Postcards} />} />
                  
                  {/* Posters routes - Fixed to use overview page */}
                  <Route path="batches/posters" element={<Posters />} />
                  <Route path="batches/posters/jobs" element={<PosterJobsPage />} />
                  <Route path="batches/posters/jobs/new" element={<PosterJobNewPage />} />
                  <Route path="batches/posters/batches" element={<PosterBatchesPage />} />
                  <Route path="batches/posters/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Posters} />} />
                  
                  {/* Sleeves routes - Fixed to use overview page */}
                  <Route path="batches/sleeves" element={<Sleeves />} />
                  <Route path="batches/sleeves/jobs" element={<SleeveJobsPage />} />
                  <Route path="batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
                  <Route path="batches/sleeves/jobs/edit/:id" element={<SleeveJobEditPage />} />
                  <Route path="batches/sleeves/batches" element={<SleeveBatchesPage />} />
                  <Route path="batches/sleeves/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Sleeves} />} />
                  
                  {/* Boxes routes - Fixed to use overview page */}
                  <Route path="batches/boxes" element={<Boxes />} />
                  <Route path="batches/boxes/jobs" element={<BoxJobsPage />} />
                  <Route path="batches/boxes/jobs/new" element={<BoxJobNewPage />} />
                  <Route path="batches/boxes/batches" element={<BoxBatchesPage />} />
                  <Route path="batches/boxes/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Boxes} />} />
                  
                  {/* Covers routes - Fixed to use overview page */}
                  <Route path="batches/covers" element={<Covers />} />
                  <Route path="batches/covers/jobs" element={<CoverJobsPage />} />
                  <Route path="batches/covers/jobs/new" element={<CoverJobNewPage />} />
                  <Route path="batches/covers/batches" element={<CoverBatchesPage />} />
                  <Route path="batches/covers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Covers} />} />
                  
                  {/* Stickers routes - Fixed to use overview page */}
                  <Route path="batches/stickers" element={<Stickers />} />
                  <Route path="batches/stickers/jobs" element={<StickerJobsPage />} />
                  <Route path="batches/stickers/jobs/new" element={<StickerJobNewPage />} />
                  <Route path="batches/stickers/batches" element={<StickerBatchesPage />} />
                  <Route path="batches/stickers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Stickers} />} />
                  
                  {/* Generic job detail routes - Updated paths */}
                  <Route path="batches/:productType/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs.Postcards} />} />
                  <Route path="batches/:productType/jobs/edit/:jobId" element={<GenericJobEdit config={productConfigs.Postcards} />} />
                  
                  {/* Settings and Users */}
                  <Route path="settings" element={<Settings />} />
                  <Route path="users" element={<Users />} />
                </Route>

                {/* Legacy routes for backward compatibility - redirect to BatchFlow */}
                <Route path="/batches/*" element={
                  <ProtectedRoute>
                    <BatchFlowLayout />
                  </ProtectedRoute>
                }>
                  {/* Business Cards legacy routes */}
                  <Route path="business-cards" element={<BusinessCards />} />
                  <Route path="business-cards/jobs" element={<BusinessCardJobs />} />
                  <Route path="business-cards/jobs/new" element={<BusinessCardJobNew />} />
                  <Route path="business-cards/jobs/edit/:id" element={<BusinessCardJobEdit />} />
                  <Route path="business-cards/batches" element={<BusinessCardBatches />} />
                  <Route path="business-cards/batches/:batchId" element={<BatchDetailsPage productType="business-cards" backUrl="/batchflow/batches/business-cards/batches" />} />
                  
                  {/* Flyers legacy routes */}
                  <Route path="flyers" element={<Flyers />} />
                  <Route path="flyers/jobs" element={<FlyerJobs />} />
                  <Route path="flyers/jobs/new" element={<FlyerJobNew />} />
                  <Route path="flyers/jobs/edit/:id" element={<FlyerJobEdit />} />
                  <Route path="flyers/jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="flyers/batches" element={<FlyerBatches />} />
                  <Route path="flyers/batches/:batchId" element={<FlyerBatchDetailsWrapper />} />
                  
                  {/* Other generic product legacy routes - Fixed to use overview pages */}
                  <Route path="postcards" element={<Postcards />} />
                  <Route path="postcards/jobs" element={<PostcardJobsPage />} />
                  <Route path="postcards/jobs/new" element={<PostcardJobNewPage />} />
                  <Route path="postcards/jobs/edit/:id" element={<PostcardJobEdit />} />
                  <Route path="postcards/batches" element={<PostcardBatchesPage />} />
                  <Route path="postcards/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Postcards} />} />
                  
                  <Route path="posters" element={<Posters />} />
                  <Route path="posters/jobs" element={<PosterJobsPage />} />
                  <Route path="posters/jobs/new" element={<PosterJobNewPage />} />
                  <Route path="posters/batches" element={<PosterBatchesPage />} />
                  <Route path="posters/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Posters} />} />
                  
                  <Route path="sleeves" element={<Sleeves />} />
                  <Route path="sleeves/jobs" element={<SleeveJobsPage />} />
                  <Route path="sleeves/jobs/new" element={<SleeveJobNewPage />} />
                  <Route path="sleeves/jobs/edit/:id" element={<SleeveJobEditPage />} />
                  <Route path="sleeves/batches" element={<SleeveBatchesPage />} />
                  <Route path="sleeves/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Sleeves} />} />
                  
                  <Route path="boxes" element={<Boxes />} />
                  <Route path="boxes/jobs" element={<BoxJobsPage />} />
                  <Route path="boxes/jobs/new" element={<BoxJobNewPage />} />
                  <Route path="boxes/batches" element={<BoxBatchesPage />} />
                  <Route path="boxes/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Boxes} />} />
                  
                  <Route path="covers" element={<Covers />} />
                  <Route path="covers/jobs" element={<CoverJobsPage />} />
                  <Route path="covers/jobs/new" element={<CoverJobNewPage />} />
                  <Route path="covers/batches" element={<CoverBatchesPage />} />
                  <Route path="covers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Covers} />} />
                  
                  <Route path="stickers" element={<Stickers />} />
                  <Route path="stickers/jobs" element={<StickerJobsPage />} />
                  <Route path="stickers/jobs/new" element={<StickerJobNewPage />} />
                  <Route path="stickers/batches" element={<StickerBatchesPage />} />
                  <Route path="stickers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs.Stickers} />} />
                  
                  {/* Legacy catch-all for batches */}
                  <Route index element={<AllBatches />} />
                </Route>

                {/* Tracker routes */}
                <Route path="/tracker" element={
                  <ProtectedRoute>
                    <TrackerLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<TrackerDashboard />} />
                  <Route path="upload" element={<TrackerUpload />} />
                  <Route path="production" element={<TrackerProduction />} />
                  <Route path="kanban" element={<TrackerKanban />} />
                  <Route path="jobs" element={<TrackerJobs />} />
                  <Route path="worksheets" element={<TrackerWorkSheets />} />
                  <Route path="labels" element={<TrackerLabels />} />
                  <Route path="admin" element={<TrackerAdmin />} />
                </Route>

                {/* Legacy dashboard route */}
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
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
