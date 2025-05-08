
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import Settings from '@/pages/Settings';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserManagementProvider } from '@/contexts/UserManagementContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UsersPage from '@/pages/UsersPage';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';

// Import the product type specific pages
import BusinessCardBatches from '@/pages/BusinessCardBatches';
import FlyerBatches from '@/pages/FlyerBatches';
import BusinessCardJobs from '@/pages/BusinessCardJobs';
import BusinessCardJobNew from '@/pages/BusinessCardJobNew';
import BusinessCardJobEdit from '@/pages/BusinessCardJobEdit';
import FlyerJobs from '@/pages/FlyerJobs';
import FlyerJobNew from '@/pages/FlyerJobNew';
import FlyerJobDetail from '@/pages/FlyerJobDetail';
import FlyerJobEdit from '@/pages/FlyerJobEdit';
import BatchDetailsPage from '@/pages/BatchDetailsPage';

// Import generic product pages
import BoxBatchesPage from '@/pages/generic/BoxBatchesPage';
import BoxJobsPage from '@/pages/generic/BoxJobsPage';
import BoxJobNewPage from '@/pages/generic/BoxJobNewPage';
import PostcardBatchesPage from '@/pages/generic/PostcardBatchesPage';
import PostcardJobsPage from '@/pages/generic/PostcardJobsPage';
import PostcardJobNewPage from '@/pages/generic/PostcardJobNewPage';
import SleeveBatchesPage from '@/pages/generic/SleeveBatchesPage';
import SleeveJobsPage from '@/pages/generic/SleeveJobsPage';
import SleeveJobNewPage from '@/pages/generic/SleeveJobNewPage';
import StickerBatchesPage from '@/pages/generic/StickerBatchesPage';
import StickerJobsPage from '@/pages/generic/StickerJobsPage';
import StickerJobNewPage from '@/pages/generic/StickerJobNewPage';
import CoverBatchesPage from '@/pages/generic/CoverBatchesPage';
import CoverJobsPage from '@/pages/generic/CoverJobsPage';
import CoverJobNewPage from '@/pages/generic/CoverJobNewPage';
import PosterBatchesPage from '@/pages/generic/PosterBatchesPage';
import PosterJobsPage from '@/pages/generic/PosterJobsPage';
import PosterJobNewPage from '@/pages/generic/PosterJobNewPage';
import FlyerBatchDetailsPage from '@/pages/generic/FlyerBatchDetailsPage';
import AllBatches from '@/pages/AllBatches';
import AllJobsPage from '@/pages/AllJobsPage';

// Create a client for React Query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserManagementProvider>
          <Router>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<Auth />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Index />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="settings" element={<Settings />} />
                
                {/* Users admin page */}
                <Route path="users" element={
                  <ProtectedRoute requireAdmin={true}>
                    <UsersPage />
                  </ProtectedRoute>
                } />

                {/* All batches and jobs */}
                <Route path="batches" element={<AllBatches />} />
                <Route path="all-jobs" element={<AllJobsPage />} />
                
                {/* Business Cards Routes */}
                <Route path="batches/business-cards">
                  <Route index element={<BusinessCardBatches />} />
                  <Route path="batches/:batchId" element={
                    <BatchDetailsPage productType="Business Cards" backUrl="/batches/business-cards" />
                  } />
                  <Route path="jobs" element={<BusinessCardJobs />} />
                  <Route path="jobs/new" element={<BusinessCardJobNew />} />
                  <Route path="jobs/:id" element={<BusinessCardJobEdit />} />
                </Route>
                
                {/* Flyers Routes */}
                <Route path="batches/flyers">
                  <Route index element={<FlyerBatches />} />
                  <Route path="batches/:batchId" element={<FlyerBatchDetailsPage />} />
                  <Route path="jobs" element={<FlyerJobs />} />
                  <Route path="jobs/new" element={<FlyerJobNew />} />
                  <Route path="jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="jobs/:id/edit" element={<FlyerJobEdit />} />
                </Route>
                
                {/* Postcards Routes */}
                <Route path="batches/postcards">
                  <Route index element={<PostcardBatchesPage />} />
                  <Route path="jobs" element={<PostcardJobsPage />} />
                  <Route path="jobs/new" element={<PostcardJobNewPage />} />
                </Route>
                
                {/* Boxes Routes */}
                <Route path="batches/boxes">
                  <Route index element={<BoxBatchesPage />} />
                  <Route path="jobs" element={<BoxJobsPage />} />
                  <Route path="jobs/new" element={<BoxJobNewPage />} />
                </Route>
                
                {/* Sleeves Routes */}
                <Route path="batches/sleeves">
                  <Route index element={<SleeveBatchesPage />} />
                  <Route path="jobs" element={<SleeveJobsPage />} />
                  <Route path="jobs/new" element={<SleeveJobNewPage />} />
                </Route>
                
                {/* Stickers Routes */}
                <Route path="batches/stickers">
                  <Route index element={<StickerBatchesPage />} />
                  <Route path="jobs" element={<StickerJobsPage />} />
                  <Route path="jobs/new" element={<StickerJobNewPage />} />
                </Route>
                
                {/* Covers Routes */}
                <Route path="batches/covers">
                  <Route index element={<CoverBatchesPage />} />
                  <Route path="jobs" element={<CoverJobsPage />} />
                  <Route path="jobs/new" element={<CoverJobNewPage />} />
                </Route>
                
                {/* Posters Routes */}
                <Route path="batches/posters">
                  <Route index element={<PosterBatchesPage />} />
                  <Route path="jobs" element={<PosterJobsPage />} />
                  <Route path="jobs/new" element={<PosterJobNewPage />} />
                </Route>
                
                {/* Catch all other routes inside the layout */}
                <Route path="*" element={<NotFound />} />
              </Route>
              
              {/* Fallback route for anything else */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
          <SonnerToaster position="top-right" closeButton />
          <Toaster />
        </UserManagementProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
