import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import Settings from '@/pages/Settings';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UsersPage from '@/pages/UsersPage';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';
import PreviewSafeWrapper from '@/components/PreviewSafeWrapper';

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
import BoxJobEditPage from '@/pages/generic/BoxJobEditPage';
import PostcardBatchesPage from '@/pages/generic/PostcardBatchesPage';
import PostcardJobsPage from '@/pages/generic/PostcardJobsPage';
import PostcardJobNewPage from '@/pages/generic/PostcardJobNewPage';
import PostcardJobEditPage from '@/pages/generic/PostcardJobEditPage';
import SleeveBatchesPage from '@/pages/generic/SleeveBatchesPage';
import SleeveJobsPage from '@/pages/generic/SleeveJobsPage';
import SleeveJobNewPage from '@/pages/generic/SleeveJobNewPage';
import SleeveJobEditPage from '@/pages/generic/SleeveJobEditPage';
import StickerBatchesPage from '@/pages/generic/StickerBatchesPage';
import StickerJobsPage from '@/pages/generic/StickerJobsPage';
import StickerJobNewPage from '@/pages/generic/StickerJobNewPage';
import StickerJobEditPage from '@/pages/generic/StickerJobEditPage';
import CoverBatchesPage from '@/pages/generic/CoverBatchesPage';
import CoverJobsPage from '@/pages/generic/CoverJobsPage';
import CoverJobNewPage from '@/pages/generic/CoverJobNewPage';
import CoverJobEditPage from '@/pages/generic/CoverJobEditPage';
import PosterBatchesPage from '@/pages/generic/PosterBatchesPage';
import PosterJobsPage from '@/pages/generic/PosterJobsPage';
import PosterJobNewPage from '@/pages/generic/PosterJobNewPage';
import PosterJobEditPage from '@/pages/generic/PosterJobEditPage';
import FlyerBatchDetailsPage from '@/pages/generic/FlyerBatchDetailsPage';
import AllBatches from '@/pages/AllBatches';
import AllJobsPage from '@/pages/AllJobsPage';

// Import for generic batch detail pages
import GenericBatchDetailsPage from '@/pages/generic/GenericBatchDetailsPage';
import GenericJobDetailsPage from '@/pages/generic/GenericJobDetailsPage';
import { productConfigs } from '@/config/productTypes';
import BusinessCardJobDetail from '@/pages/BusinessCardJobDetail';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce stale time for preview mode to help with rendering issues
      staleTime: typeof window !== 'undefined' && 
        (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'))
        ? 0 
        : 5 * 60 * 1000, // 5 minutes for normal mode
      retry: 1, // Reduce retries in preview mode
      // Safe fallbacks for query failures using the meta approach in v5
      meta: {
        errorHandler: (error: Error) => {
          console.error('Query error:', error);
        }
      }
    },
  },
});

function App() {
  return (
    <PreviewSafeWrapper>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
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
                  <Route path="jobs/:id" element={<BusinessCardJobDetail />} />
                  <Route path="jobs/:id/edit" element={<BusinessCardJobEdit />} />
                </Route>
                
                {/* Flyers Routes */}
                <Route path="batches/flyers">
                  <Route index element={<FlyerBatches />} />
                  <Route path="batches/:batchId" element={<FlyerBatchDetailsPage />} />
                  <Route path="jobs" element={<FlyerJobs />} />
                  <Route path="jobs/new" element={<FlyerJobNew />} />
                  <Route path="jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="jobs/:jobId/edit" element={<FlyerJobEdit />} />
                </Route>
                
                {/* Postcards Routes */}
                <Route path="batches/postcards">
                  <Route index element={<PostcardBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Postcards"]} />
                  } />
                  <Route path="jobs" element={<PostcardJobsPage />} />
                  <Route path="jobs/new" element={<PostcardJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Postcards"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<PostcardJobEditPage />} />
                </Route>
                
                {/* Boxes Routes */}
                <Route path="batches/boxes">
                  <Route index element={<BoxBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Boxes"]} />
                  } />
                  <Route path="jobs" element={<BoxJobsPage />} />
                  <Route path="jobs/new" element={<BoxJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Boxes"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<BoxJobEditPage />} />
                </Route>
                
                {/* Sleeves Routes */}
                <Route path="batches/sleeves">
                  <Route index element={<SleeveBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Sleeves"]} />
                  } />
                  <Route path="jobs" element={<SleeveJobsPage />} />
                  <Route path="jobs/new" element={<SleeveJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Sleeves"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<SleeveJobEditPage />} />
                </Route>
                
                {/* Stickers Routes */}
                <Route path="batches/stickers">
                  <Route index element={<StickerBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Stickers"]} />
                  } />
                  <Route path="jobs" element={<StickerJobsPage />} />
                  <Route path="jobs/new" element={<StickerJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Stickers"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<StickerJobEditPage />} />
                </Route>
                
                {/* Covers Routes */}
                <Route path="batches/covers">
                  <Route index element={<CoverBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Covers"]} />
                  } />
                  <Route path="jobs" element={<CoverJobsPage />} />
                  <Route path="jobs/new" element={<CoverJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Covers"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<CoverJobEditPage />} />
                </Route>
                
                {/* Posters Routes */}
                <Route path="batches/posters">
                  <Route index element={<PosterBatchesPage />} />
                  <Route path="batches/:batchId" element={
                    <GenericBatchDetailsPage config={productConfigs["Posters"]} />
                  } />
                  <Route path="jobs" element={<PosterJobsPage />} />
                  <Route path="jobs/new" element={<PosterJobNewPage />} />
                  <Route path="jobs/:id" element={
                    <GenericJobDetailsPage config={productConfigs["Posters"]} />
                  } />
                  <Route path="jobs/:jobId/edit" element={<PosterJobEditPage />} />
                </Route>
                
                {/* Catch all other routes inside the layout */}
                <Route path="*" element={<NotFound />} />
              </Route>
              
              {/* Fallback route for anything else */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
          <SonnerToaster position="top-right" closeButton toastOptions={{ 
            duration: 3000, 
            className: "unique-toast-class"
          }} />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </PreviewSafeWrapper>
  );
}

export default App;
