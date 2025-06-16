
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { supabase } from "./integrations/supabase/client";
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import TrackerUpload from "./pages/tracker/TrackerUpload";
import TrackerProduction from "./pages/tracker/TrackerProduction";
import TrackerKanban from "./pages/tracker/TrackerKanban";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";
import RoleAwareLayout from "./components/tracker/RoleAwareLayout";
import { AuthProvider } from "./hooks/useAuth";
import { Toaster } from "sonner";
import TrackerMobileScanner from "./pages/tracker/TrackerMobileScanner";
import FactoryFloor from "./pages/tracker/FactoryFloor";
import Auth from "./pages/Auth";
import AppSelector from "./pages/AppSelector";
import TrackerUsers from "./pages/tracker/TrackerUsers";
import BatchFlowLayout from "./components/BatchFlowLayout";
import ProofViewer from "./pages/ProofViewer";

// BatchFlow page imports
import BatchFlowHome from "./pages/BatchFlowHome";
import AllJobsPage from "./pages/AllJobsPage";
import AllBatches from "./pages/AllBatches";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import BusinessCards from "./pages/BusinessCards";
import BusinessCardJobs from "./pages/BusinessCardJobs";
import BusinessCardJobNew from "./pages/BusinessCardJobNew";
import BusinessCardJobEdit from "./pages/BusinessCardJobEdit";
import BusinessCardBatches from "./pages/BusinessCardBatches";
import Flyers from "./pages/Flyers";
import FlyerJobs from "./pages/FlyerJobs";
import FlyerJobNew from "./pages/FlyerJobNew";
import FlyerJobEdit from "./pages/FlyerJobEdit";
import FlyerBatches from "./pages/FlyerBatches";
import FlyerBatchDetails from "./pages/FlyerBatchDetails";
import Postcards from "./pages/Postcards";
import PostcardJobEdit from "./pages/PostcardJobEdit";
import Boxes from "./pages/Boxes";
import Covers from "./pages/Covers";
import Sleeves from "./pages/Sleeves";
import SleeveJobEdit from "./pages/SleeveJobEdit";
import Stickers from "./pages/Stickers";
import Posters from "./pages/Posters";

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!session) {
      return <Navigate to="/auth" />;
    }

    return <>{children}</>;
  };

  return (
    <AuthProvider>
      <div className="h-screen overflow-hidden">
        <Toaster richColors />
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            {/* Public proof viewer route - no authentication required */}
            <Route path="/proof/:token" element={<ProofViewer />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppSelector />
                </ProtectedRoute>
              }
            />
            
            {/* BatchFlow routes with nested structure */}
            <Route
              path="/batchflow"
              element={
                <ProtectedRoute>
                  <BatchFlowLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BatchFlowHome />} />
              <Route path="all-jobs" element={<AllJobsPage />} />
              <Route path="batches" element={<AllBatches />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              
              {/* Business Cards */}
              <Route path="batches/business-cards" element={<BusinessCards />} />
              <Route path="batches/business-cards/jobs" element={<BusinessCardJobs />} />
              <Route path="batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
              <Route path="batches/business-cards/jobs/:id/edit" element={<BusinessCardJobEdit />} />
              <Route path="batches/business-cards/batches" element={<BusinessCardBatches />} />
              
              {/* Flyers */}
              <Route path="batches/flyers" element={<Flyers />} />
              <Route path="batches/flyers/jobs" element={<FlyerJobs />} />
              <Route path="batches/flyers/jobs/new" element={<FlyerJobNew />} />
              <Route path="batches/flyers/jobs/:id/edit" element={<FlyerJobEdit />} />
              <Route path="batches/flyers/batches" element={<FlyerBatches />} />
              <Route path="batches/flyers/batches/:batchId" element={<FlyerBatchDetails />} />
              
              {/* Postcards */}
              <Route path="batches/postcards" element={<Postcards />} />
              <Route path="batches/postcards/jobs/:id/edit" element={<PostcardJobEdit />} />
              
              {/* Other Products */}
              <Route path="batches/boxes" element={<Boxes />} />
              <Route path="batches/covers" element={<Covers />} />
              <Route path="batches/sleeves" element={<Sleeves />} />
              <Route path="batches/sleeves/jobs/:id/edit" element={<SleeveJobEdit />} />
              <Route path="batches/stickers" element={<Stickers />} />
              <Route path="batches/posters" element={<Posters />} />
            </Route>
            
            {/* Tracker routes with role-aware layout */}
            <Route
              path="/tracker"
              element={
                <ProtectedRoute>
                  <RoleAwareLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TrackerDashboard />} />
              <Route path="jobs" element={<TrackerJobs />} />
              <Route path="production" element={<TrackerProduction />} />
              <Route path="kanban" element={<TrackerKanban />} />
              <Route path="worksheets" element={<TrackerWorkSheets />} />
              <Route path="admin" element={<TrackerAdmin />} />
              <Route path="users" element={<TrackerUsers />} />
              <Route path="labels" element={<TrackerLabels />} />
              <Route path="upload" element={<TrackerUpload />} />
              <Route path="mobile" element={<TrackerMobileScanner />} />
              <Route path="factory-floor" element={<FactoryFloor />} />
            </Route>
          </Routes>
        </Router>
      </div>
    </AuthProvider>
  );
};

export default App;
