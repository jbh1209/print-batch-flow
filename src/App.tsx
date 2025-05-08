
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

// Create a client for React Query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserManagementProvider>
          <Router>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Index />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="settings" element={<Settings />} />
                <Route path="users" element={
                  <ProtectedRoute requireAdmin={true}>
                    <UsersPage />
                  </ProtectedRoute>
                } />
                {/* Add routes for batches */}
                <Route path="batches">
                  <Route path="all" element={<Dashboard />} />
                  <Route path=":productType">
                    <Route index element={<Dashboard />} />
                    <Route path="batches/:batchId" element={<Dashboard />} />
                    <Route path="jobs" element={<Dashboard />} />
                    <Route path="jobs/new" element={<Dashboard />} />
                    <Route path="jobs/:id" element={<Dashboard />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<Auth />} />
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
