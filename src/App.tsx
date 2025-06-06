
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import BatchFlowLayout from "@/components/BatchFlowLayout";
import TrackerLayout from "@/components/TrackerLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ProofViewer from "./pages/ProofViewer";
import AllJobsPage from "./pages/AllJobsPage";

// Tracker pages
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerKanban from "./pages/tracker/TrackerKanban";
import TrackerProduction from "./pages/tracker/TrackerProduction";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";
import TrackerUpload from "./pages/tracker/TrackerUpload";
import TrackerUsers from "./pages/tracker/TrackerUsers";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerAnalytics from "./pages/tracker/TrackerAnalytics";
import FactoryFloor from "./pages/tracker/FactoryFloor";
import MobileFactory from "./pages/tracker/MobileFactory";
import TrackerMobileScanner from "./pages/tracker/TrackerMobileScanner";

// BatchFlow pages
import BatchFlowHome from "./pages/BatchFlowHome";
import BusinessCards from "./pages/BusinessCards";
import BusinessCardJobs from "./pages/BusinessCardJobs";
import BusinessCardJobNew from "./pages/BusinessCardJobNew";
import BusinessCardJobEdit from "./pages/BusinessCardJobEdit";
import BusinessCardBatches from "./pages/BusinessCardBatches";
import Flyers from "./pages/Flyers";
import FlyerJobs from "./pages/FlyerJobs";
import FlyerJobNew from "./pages/FlyerJobNew";
import FlyerJobEdit from "./pages/FlyerJobEdit";
import FlyerJobDetail from "./pages/FlyerJobDetail";
import FlyerBatches from "./pages/FlyerBatches";
import FlyerBatchDetails from "./pages/FlyerBatchDetails";
import FlyerBatchDetailsWrapper from "./pages/FlyerBatchDetailsWrapper";
import Postcards from "./pages/Postcards";
import PostcardJobEdit from "./pages/PostcardJobEdit";
import Sleeves from "./pages/Sleeves";
import SleeveJobEdit from "./pages/SleeveJobEdit";
import Posters from "./pages/Posters";
import Stickers from "./pages/Stickers";
import Covers from "./pages/Covers";
import Boxes from "./pages/Boxes";
import AllBatches from "./pages/AllBatches";
import BatchDetailsPage from "./pages/BatchDetailsPage";
import GenericJobEdit from "./pages/GenericJobEdit";

// Generic pages
import BoxJobsPage from "./pages/generic/BoxJobsPage";
import BoxJobNewPage from "./pages/generic/BoxJobNewPage";
import BoxBatchesPage from "./pages/generic/BoxBatchesPage";
import CoverJobsPage from "./pages/generic/CoverJobsPage";
import CoverJobNewPage from "./pages/generic/CoverJobNewPage";
import CoverBatchesPage from "./pages/generic/CoverBatchesPage";
import FlyerJobsPage from "./pages/generic/FlyerJobsPage";
import FlyerJobNewPage from "./pages/generic/FlyerJobNewPage";
import FlyerBatchDetailsPage from "./pages/generic/FlyerBatchDetailsPage";
import GenericBatchDetailsPage from "./pages/generic/GenericBatchDetailsPage";
import GenericJobDetailsPage from "./pages/generic/GenericJobDetailsPage";
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
import StickerJobsPage from "./pages/generic/StickerJobsPage";
import StickerJobNewPage from "./pages/generic/StickerJobNewPage";
import StickerBatchesPage from "./pages/generic/StickerBatchesPage";

// Import product configs for the routes that need them
import { productConfigs } from "@/config/productTypes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/proof/:token" element={<ProofViewer />} />

            {/* Protected BatchFlow Routes */}
            <Route path="/batchflow" element={
              <ProtectedRoute>
                <BatchFlowLayout />
              </ProtectedRoute>
            }>
              <Route index element={<BatchFlowHome />} />
              <Route path="business-cards" element={<BusinessCards />} />
              <Route path="business-cards/jobs" element={<BusinessCardJobs />} />
              <Route path="business-cards/jobs/new" element={<BusinessCardJobNew />} />
              <Route path="business-cards/jobs/:id/edit" element={<BusinessCardJobEdit />} />
              <Route path="business-cards/batches" element={<BusinessCardBatches />} />
              <Route path="flyers" element={<Flyers />} />
              <Route path="flyers/jobs" element={<FlyerJobs />} />
              <Route path="flyers/jobs/new" element={<FlyerJobNew />} />
              <Route path="flyers/jobs/:id/edit" element={<FlyerJobEdit />} />
              <Route path="flyers/jobs/:id" element={<FlyerJobDetail />} />
              <Route path="flyers/batches" element={<FlyerBatches />} />
              <Route path="flyers/batches/:id" element={<FlyerBatchDetails />} />
              <Route path="flyers/batch/:id" element={<FlyerBatchDetailsWrapper />} />
              <Route path="postcards" element={<Postcards />} />
              <Route path="postcards/jobs/:id/edit" element={<PostcardJobEdit />} />
              <Route path="sleeves" element={<Sleeves />} />
              <Route path="sleeves/jobs/:id/edit" element={<SleeveJobEdit />} />
              <Route path="posters" element={<Posters />} />
              <Route path="stickers" element={<Stickers />} />
              <Route path="covers" element={<Covers />} />
              <Route path="boxes" element={<Boxes />} />
              <Route path="all-batches" element={<AllBatches />} />
              <Route path="batch/:id" element={<BatchDetailsPage productType="Generic" backUrl="/batchflow/all-batches" />} />
              <Route path="jobs/:id/edit" element={<GenericJobEdit config={productConfigs["Flyers"]} />} />
              
              {/* Generic routes */}
              <Route path="boxes/jobs" element={<BoxJobsPage />} />
              <Route path="boxes/jobs/new" element={<BoxJobNewPage />} />
              <Route path="boxes/batches" element={<BoxBatchesPage />} />
              <Route path="covers/jobs" element={<CoverJobsPage />} />
              <Route path="covers/jobs/new" element={<CoverJobNewPage />} />
              <Route path="covers/batches" element={<CoverBatchesPage />} />
              <Route path="flyers-generic/jobs" element={<FlyerJobsPage />} />
              <Route path="flyers-generic/jobs/new" element={<FlyerJobNewPage />} />
              <Route path="flyers-generic/batches/:id" element={<FlyerBatchDetailsPage />} />
              <Route path="generic/batch/:id" element={<GenericBatchDetailsPage config={productConfigs["Flyers"]} />} />
              <Route path="generic/jobs/:id" element={<GenericJobDetailsPage config={productConfigs["Flyers"]} />} />
              <Route path="postcards-generic/jobs" element={<PostcardJobsPage />} />
              <Route path="postcards-generic/jobs/new" element={<PostcardJobNewPage />} />
              <Route path="postcards-generic/batches" element={<PostcardBatchesPage />} />
              <Route path="posters/jobs" element={<PosterJobsPage />} />
              <Route path="posters/jobs/new" element={<PosterJobNewPage />} />
              <Route path="posters/batches" element={<PosterBatchesPage />} />
              <Route path="sleeves-generic/jobs" element={<SleeveJobsPage />} />
              <Route path="sleeves-generic/jobs/new" element={<SleeveJobNewPage />} />
              <Route path="sleeves-generic/jobs/:id/edit" element={<SleeveJobEditPage />} />
              <Route path="sleeves-generic/batches" element={<SleeveBatchesPage />} />
              <Route path="stickers/jobs" element={<StickerJobsPage />} />
              <Route path="stickers/jobs/new" element={<StickerJobNewPage />} />
              <Route path="stickers/batches" element={<StickerBatchesPage />} />
            </Route>

            {/* Protected Tracker Routes */}
            <Route path="/tracker" element={
              <ProtectedRoute>
                <TrackerLayout />
              </ProtectedRoute>
            }>
              <Route index element={<TrackerDashboard />} />
              <Route path="jobs" element={<TrackerJobs />} />
              <Route path="kanban" element={<TrackerKanban />} />
              <Route path="production" element={<TrackerProduction />} />
              <Route path="admin" element={<TrackerAdmin />} />
              <Route path="upload" element={<TrackerUpload />} />
              <Route path="users" element={<TrackerUsers />} />
              <Route path="labels" element={<TrackerLabels />} />
              <Route path="worksheets" element={<TrackerWorkSheets />} />
              <Route path="analytics" element={<TrackerAnalytics />} />
              <Route path="factory" element={<FactoryFloor />} />
              <Route path="mobile-factory" element={<MobileFactory />} />
              <Route path="mobile-scanner" element={<TrackerMobileScanner />} />
            </Route>

            {/* Protected Legacy Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
            </Route>

            <Route path="/users" element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/all-jobs" element={
              <ProtectedRoute>
                <AllJobsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
