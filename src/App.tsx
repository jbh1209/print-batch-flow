
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TrackerErrorBoundary } from "@/components/tracker/TrackerErrorBoundary";
import RoleAwareLayout from "@/components/tracker/RoleAwareLayout";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import BusinessCardJobs from "@/pages/BusinessCardJobs";
import BusinessCardJobNew from "@/pages/BusinessCardJobNew";
import BusinessCardJobEdit from "@/pages/BusinessCardJobEdit";
import BusinessCardJobDetail from "@/pages/BusinessCardJobDetail";
import Users from "@/pages/Users";
import Dashboard from "@/pages/Dashboard";
import TrackerJobs from "@/pages/tracker/TrackerJobs";
import TrackerProduction from "@/pages/tracker/TrackerProduction";
import TrackerKanban from "@/pages/tracker/TrackerKanban";
import TrackerAdmin from "@/pages/tracker/TrackerAdmin";
import TrackerUsers from "@/pages/tracker/TrackerUsers";
import TrackerAnalytics from "@/pages/tracker/TrackerAnalytics";
import TrackerWorkSheets from "@/pages/tracker/TrackerWorkSheets";
import TrackerLabels from "@/pages/tracker/TrackerLabels";
import TrackerUpload from "@/pages/tracker/TrackerUpload";
import TrackerDTPWorkflow from "@/pages/tracker/TrackerDTPWorkflow";
import FactoryFloor from "@/pages/tracker/FactoryFloor";
import MobileFactory from "@/pages/tracker/MobileFactory";

// BatchFlow imports
import BatchFlowLayout from "@/components/BatchFlowLayout";
import BatchFlowHome from "@/pages/BatchFlowHome";
import AllBatches from "@/pages/AllBatches";
import AllJobsPage from "@/pages/AllJobsPage";
import BusinessCardBatches from "@/pages/BusinessCardBatches";
import BusinessCardBatchDetails from "@/pages/BusinessCardBatchDetails";
import Flyers from "@/pages/Flyers";
import FlyerBatchDetails from "@/pages/FlyerBatchDetails";
import PostcardBatchDetails from "@/pages/PostcardBatchDetails";
import BoxBatchDetails from "@/pages/BoxBatchDetails";
import SleeveBatchDetails from "@/pages/SleeveBatchDetails";
import CoverBatchDetails from "@/pages/CoverBatchDetails";
import PosterBatchDetails from "@/pages/PosterBatchDetails";
import StickerBatchDetails from "@/pages/StickerBatchDetails";
import Postcards from "@/pages/Postcards";
import Sleeves from "@/pages/Sleeves";
import Boxes from "@/pages/Boxes";
import Stickers from "@/pages/Stickers";
import Covers from "@/pages/Covers";
import Posters from "@/pages/Posters";
import Settings from "@/pages/Settings";

// Job page imports for all product types
import FlyerJobsPage from "@/pages/generic/FlyerJobsPage";
import FlyerJobNewPage from "@/pages/generic/FlyerJobNewPage";
import FlyerJobEditPage from "@/pages/generic/FlyerJobEditPage";
import PostcardJobsPage from "@/pages/generic/PostcardJobsPage";
import PostcardJobNewPage from "@/pages/generic/PostcardJobNewPage";
import PostcardJobEditPage from "@/pages/generic/PostcardJobEditPage";
import BoxJobsPage from "@/pages/generic/BoxJobsPage";
import BoxJobNewPage from "@/pages/generic/BoxJobNewPage";
import BoxJobEditPage from "@/pages/generic/BoxJobEditPage";
import SleeveJobsPage from "@/pages/generic/SleeveJobsPage";
import SleeveJobNewPage from "@/pages/generic/SleeveJobNewPage";
import SleeveJobEditPage from "@/pages/generic/SleeveJobEditPage";
import StickerJobsPage from "@/pages/generic/StickerJobsPage";
import StickerJobNewPage from "@/pages/generic/StickerJobNewPage";
import StickerJobEditPage from "@/pages/generic/StickerJobEditPage";
import CoverJobsPage from "@/pages/generic/CoverJobsPage";
import CoverJobNewPage from "@/pages/generic/CoverJobNewPage";
import CoverJobEditPage from "@/pages/generic/CoverJobEditPage";
import PosterJobsPage from "@/pages/generic/PosterJobsPage";
import PosterJobNewPage from "@/pages/generic/PosterJobNewPage";
import PosterJobEditPage from "@/pages/generic/PosterJobEditPage";
import FlyerJobDetail from "@/pages/FlyerJobDetail";
import GenericJobDetailsPage from "@/pages/generic/GenericJobDetailsPage";
import { productConfigs } from "@/config/productTypes";

// Admin imports
import AdminDashboard from "@/pages/admin";
import ExcelMapping from "@/pages/admin/ExcelMapping";
import AdminSchedulePage from "@/pages/admin/AdminSchedulePage";
import SchedulerTest from "@/pages/SchedulerTest";
import Layout from "@/components/Layout";
import Phase2TestTrigger from "@/components/scheduler/Phase2TestTrigger";
// Removed legacy test components
import CapacityDashboard from "@/components/scheduler/CapacityDashboard";
import WhyThisTimeExplainer from "@/components/scheduler/WhyThisTimeExplainer";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <TrackerErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/business-cards" element={
                  <ProtectedRoute>
                    <BusinessCardJobs />
                  </ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute>
                    <Users />
                  </ProtectedRoute>
                } />
                
                {/* BatchFlow routes with nested layout */}
                <Route path="/batchflow" element={
                  <ProtectedRoute>
                    <BatchFlowLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<BatchFlowHome />} />
                  <Route path="all-jobs" element={<AllJobsPage />} />
                  <Route path="batches" element={<AllBatches />} />
                  
                  {/* Business Cards routes */}
                  <Route path="batches/business-cards" element={<BusinessCardBatches />} />
                  <Route path="batches/business-cards/batches/:batchId" element={<BusinessCardBatchDetails />} />
                  <Route path="batches/business-cards/jobs" element={<BusinessCardJobs />} />
                  <Route path="batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
                  <Route path="batches/business-cards/jobs/:id" element={<BusinessCardJobDetail />} />
                  <Route path="batches/business-cards/jobs/:id/edit" element={<BusinessCardJobEdit />} />
                  
                  {/* Flyers routes */}
                  <Route path="batches/flyers" element={<Flyers />} />
                  <Route path="batches/flyers/batches/:batchId" element={<FlyerBatchDetails />} />
                  <Route path="batches/flyers/jobs" element={<FlyerJobsPage />} />
                  <Route path="batches/flyers/jobs/new" element={<FlyerJobNewPage />} />
                  <Route path="batches/flyers/jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="batches/flyers/jobs/:id/edit" element={<FlyerJobEditPage />} />
                  
                  {/* Postcards routes */}
                  <Route path="batches/postcards" element={<Postcards />} />
                  <Route path="batches/postcards/batches/:batchId" element={<PostcardBatchDetails />} />
                  <Route path="batches/postcards/jobs" element={<PostcardJobsPage />} />
                  <Route path="batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
                  <Route path="batches/postcards/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Postcards} />} />
                  <Route path="batches/postcards/jobs/:id/edit" element={<PostcardJobEditPage />} />
                  
                  {/* Sleeves routes */}
                  <Route path="batches/sleeves" element={<Sleeves />} />
                  <Route path="batches/sleeves/batches/:batchId" element={<SleeveBatchDetails />} />
                  <Route path="batches/sleeves/jobs" element={<SleeveJobsPage />} />
                  <Route path="batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
                  <Route path="batches/sleeves/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Sleeves} />} />
                  <Route path="batches/sleeves/jobs/:id/edit" element={<SleeveJobEditPage />} />
                  
                  {/* Boxes routes */}
                  <Route path="batches/boxes" element={<Boxes />} />
                  <Route path="batches/boxes/batches/:batchId" element={<BoxBatchDetails />} />
                  <Route path="batches/boxes/jobs" element={<BoxJobsPage />} />
                  <Route path="batches/boxes/jobs/new" element={<BoxJobNewPage />} />
                  <Route path="batches/boxes/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Boxes} />} />
                  <Route path="batches/boxes/jobs/:id/edit" element={<BoxJobEditPage />} />
                  
                  {/* Stickers routes */}
                  <Route path="batches/stickers" element={<Stickers />} />
                  <Route path="batches/stickers/batches/:batchId" element={<StickerBatchDetails />} />
                  <Route path="batches/stickers/jobs" element={<StickerJobsPage />} />
                  <Route path="batches/stickers/jobs/new" element={<StickerJobNewPage />} />
                  <Route path="batches/stickers/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Stickers} />} />
                  <Route path="batches/stickers/jobs/:id/edit" element={<StickerJobEditPage />} />
                  
                  {/* Covers routes */}
                  <Route path="batches/covers" element={<Covers />} />
                  <Route path="batches/covers/batches/:batchId" element={<CoverBatchDetails />} />
                  <Route path="batches/covers/jobs" element={<CoverJobsPage />} />
                  <Route path="batches/covers/jobs/new" element={<CoverJobNewPage />} />
                  <Route path="batches/covers/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Covers} />} />
                  <Route path="batches/covers/jobs/:id/edit" element={<CoverJobEditPage />} />
                  
                  {/* Posters routes */}
                  <Route path="batches/posters" element={<Posters />} />
                  <Route path="batches/posters/batches/:batchId" element={<PosterBatchDetails />} />
                  <Route path="batches/posters/jobs" element={<PosterJobsPage />} />
                  <Route path="batches/posters/jobs/new" element={<PosterJobNewPage />} />
                  <Route path="batches/posters/jobs/:id" element={<GenericJobDetailsPage config={productConfigs.Posters} />} />
                  <Route path="batches/posters/jobs/:id/edit" element={<PosterJobEditPage />} />
                  
                  <Route path="users" element={<Users />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                
                {/* Tracker routes with proper role-based layout */}
                <Route path="/tracker" element={
                  <ProtectedRoute>
                    <RoleAwareLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="jobs" element={<TrackerJobs />} />
                  <Route path="production" element={<TrackerProduction />} />
                  <Route path="kanban" element={<TrackerKanban />} />
                  <Route path="factory-floor" element={<FactoryFloor />} />
                  <Route path="dtp-workflow" element={<TrackerDTPWorkflow />} />
                  <Route path="analytics" element={<TrackerAnalytics />} />
                  <Route path="worksheets" element={<TrackerWorkSheets />} />
                  <Route path="admin" element={<TrackerAdmin />} />
                  <Route path="users" element={<TrackerUsers />} />
                  <Route path="labels" element={<TrackerLabels />} />
                  <Route path="upload" element={<TrackerUpload />} />
                  <Route path="mobile" element={<MobileFactory />} />
                </Route>
                
                {/* Admin routes without BatchFlow layout */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/schedule" element={
                  <ProtectedRoute>
                    <AdminSchedulePage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/excel-mapping" element={
                  <ProtectedRoute>
                    <ExcelMapping />
                  </ProtectedRoute>
                } />
                <Route path="/scheduler-test" element={
                  <ProtectedRoute>
                    <SchedulerTest />
                  </ProtectedRoute>
                } />
                <Route path="/phase2-test" element={
                  <ProtectedRoute>
                    <Phase2TestTrigger />
                  </ProtectedRoute>
                } />
                {/* Legacy test routes removed */}
                <Route path="/capacity-dashboard" element={
                  <ProtectedRoute>
                    <CapacityDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/why-this-time" element={
                  <ProtectedRoute>
                    <WhyThisTimeExplainer />
                  </ProtectedRoute>
                } />

              </Routes>
            </TrackerErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
