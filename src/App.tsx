
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
import BatchFlowHome from "@/pages/BatchFlowHome";
import AllBatches from "@/pages/AllBatches";
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
                
                {/* BatchFlow routes */}
                <Route path="/batchflow" element={
                  <ProtectedRoute>
                    <BatchFlowHome />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches" element={
                  <ProtectedRoute>
                    <AllBatches />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/business-cards" element={
                  <ProtectedRoute>
                    <BusinessCardBatches />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/business-cards/batches/:batchId" element={
                  <ProtectedRoute>
                    <BusinessCardBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/flyers" element={
                  <ProtectedRoute>
                    <FlyerBatches />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/flyers/batches/:batchId" element={
                  <ProtectedRoute>
                    <FlyerBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/postcards/batches/:batchId" element={
                  <ProtectedRoute>
                    <PostcardBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/boxes/batches/:batchId" element={
                  <ProtectedRoute>
                    <BoxBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/sleeves/batches/:batchId" element={
                  <ProtectedRoute>
                    <SleeveBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/covers/batches/:batchId" element={
                  <ProtectedRoute>
                    <CoverBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/posters/batches/:batchId" element={
                  <ProtectedRoute>
                    <PosterBatchDetails />
                  </ProtectedRoute>
                } />
                <Route path="/batchflow/batches/stickers/batches/:batchId" element={
                  <ProtectedRoute>
                    <StickerBatchDetails />
                  </ProtectedRoute>
                } />
                
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
