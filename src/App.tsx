
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

// Admin pages
import AdminLayout from '@/pages/admin/AdminLayout';
import ProductsListPage from '@/pages/admin/ProductsListPage';
import CreateProductPage from '@/pages/admin/CreateProductPage';
import EditProductPage from '@/pages/admin/EditProductPage';

// Import only the business cards and flyer pages
import BusinessCardBatches from '@/pages/BusinessCardBatches';
import FlyerBatches from '@/pages/FlyerBatches';
import BusinessCardJobs from '@/pages/BusinessCardJobs';
import BusinessCardJobNew from '@/pages/BusinessCardJobNew';
import BusinessCardJobEdit from '@/pages/BusinessCardJobEdit';
import FlyerJobNew from '@/pages/FlyerJobNew';
import FlyerJobDetail from '@/pages/FlyerJobDetail';
import FlyerJobEdit from '@/pages/FlyerJobEdit';
import BatchDetailsPage from '@/pages/BatchDetailsPage';
import FlyerJobsPage from '@/pages/generic/FlyerJobsPage';
import FlyerBatchDetailsPage from '@/pages/generic/FlyerBatchDetailsPage';
import AllBatches from '@/pages/AllBatches';
import AllJobsPage from '@/pages/AllJobsPage';
import BusinessCardJobDetail from '@/pages/BusinessCardJobDetail';

// Add a version key for cache busting
const appVersion = Date.now().toString();

// Create a client for React Query with improved default settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 10, // 10 minutes (renamed from cacheTime)
      retry: 1, // Only retry once on failure
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    },
  },
});

function App() {
  console.log("App rendering with version", appVersion);
  
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

                {/* Admin Routes - Ensure they have a key for cache busting */}
                <Route path="admin" element={<AdminLayout key={`admin-${appVersion}`} />}>
                  <Route path="products" element={<ProductsListPage key={`products-${appVersion}`} />} />
                  <Route path="products/create" element={<CreateProductPage key={`create-product-${appVersion}`} />} />
                  <Route path="products/:id" element={<EditProductPage key={`edit-product-${appVersion}`} />} />
                </Route>

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
                  <Route path="jobs" element={<FlyerJobsPage key={`flyer-jobs-${appVersion}`} />} />
                  <Route path="jobs/new" element={<FlyerJobNew />} />
                  <Route path="jobs/:id" element={<FlyerJobDetail />} />
                  <Route path="jobs/:jobId/edit" element={<FlyerJobEdit />} />
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
        </UserManagementProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
