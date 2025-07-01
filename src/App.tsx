
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
import FlyerBatches from "@/pages/FlyerBatches";
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
                  <Route path="batches/business-cards" element={<BusinessCardBatches />} />
                  <Route path="batches/business-cards/batches/:batchId" element={<BusinessCardBatchDetails />} />
                  <Route path="batches/flyers" element={<FlyerBatches />} />
                  <Route path="batches/flyers/batches/:batchId" element={<FlyerBatchDetails />} />
                  <Route path="batches/postcards" element={<Postcards />} />
                  <Route path="batches/postcards/batches/:batchId" element={<PostcardBatchDetails />} />
                  <Route path="batches/sleeves" element={<Sleeves />} />
                  <Route path="batches/sleeves/batches/:batchId" element={<SleeveBatchDetails />} />
                  <Route path="batches/boxes" element={<Boxes />} />
                  <Route path="batches/boxes/batches/:batchId" element={<BoxBatchDetails />} />
                  <Route path="batches/stickers" element={<Stickers />} />
                  <Route path="batches/stickers/batches/:batchId" element={<StickerBatchDetails />} />
                  <Route path="batches/covers" element={<Covers />} />
                  <Route path="batches/covers/batches/:batchId" element={<CoverBatchDetails />} />
                  <Route path="batches/posters" element={<Posters />} />
                  <Route path="batches/posters/batches/:batchId" element={<PosterBatchDetails />} />
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
              </Routes>
            </TrackerErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
