import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ProofViewer from "./pages/ProofViewer";
import Batches from "./pages/Batches";
import ProductionJobs from "./pages/ProductionJobs";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import BatchDetails from "./pages/BatchDetails";
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import Factory from "./pages/Factory";
import JobDetails from "./pages/JobDetails";
import EditJob from "./pages/EditJob";
import CreateJob from "./pages/CreateJob";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import CreateCustomer from "./pages/CreateCustomer";
import EditCustomer from "./pages/EditCustomer";
import Estimates from "./pages/Estimates";
import EstimateDetails from "./pages/EstimateDetails";
import CreateEstimate from "./pages/CreateEstimate";
import EditEstimate from "./pages/EditEstimate";
import ViewPDF from "./pages/ViewPDF";
import ProductionJobDetails from "./pages/ProductionJobDetails";
import EditProductionJob from "./pages/EditProductionJob";
import CreateProductionJob from "./pages/CreateProductionJob";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import LegacyBatches from "./pages/LegacyBatches";
import LegacyBatchDetails from "./pages/LegacyBatchDetails";
import LegacyJobDetails from "./pages/LegacyJobDetails";
import EditLegacyJob from "./pages/EditLegacyJob";
import CreateLegacyJob from "./pages/CreateLegacyJob";
import CreateLegacyBatch from "./pages/CreateLegacyBatch";
import EditLegacyBatch from "./pages/EditLegacyBatch";

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

            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
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
            <Route path="/batches" element={
              <ProtectedRoute>
                <Batches />
              </ProtectedRoute>
            } />
            <Route path="/batches/:batchId" element={
              <ProtectedRoute>
                <BatchDetails />
              </ProtectedRoute>
            } />
            <Route path="/production-jobs" element={
              <ProtectedRoute>
                <ProductionJobs />
              </ProtectedRoute>
            } />
            <Route path="/production-jobs/:jobId" element={
              <ProtectedRoute>
                <ProductionJobDetails />
              </ProtectedRoute>
            } />
            <Route path="/production-jobs/:jobId/edit" element={
              <ProtectedRoute>
                <EditProductionJob />
              </ProtectedRoute>
            } />
            <Route path="/production-jobs/create" element={
              <ProtectedRoute>
                <CreateProductionJob />
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="/products/:productId" element={
              <ProtectedRoute>
                <ProductDetails />
              </ProtectedRoute>
            } />
            <Route path="/products/:productId/edit" element={
              <ProtectedRoute>
                <EditProduct />
              </ProtectedRoute>
            } />
            <Route path="/products/create" element={
              <ProtectedRoute>
                <CreateProduct />
              </ProtectedRoute>
            } />
            <Route path="/factory" element={
              <ProtectedRoute>
                <Factory />
              </ProtectedRoute>
            } />
            <Route path="/jobs/:jobId" element={
              <ProtectedRoute>
                <JobDetails />
              </ProtectedRoute>
            } />
            <Route path="/jobs/:jobId/edit" element={
              <ProtectedRoute>
                <EditJob />
              </ProtectedRoute>
            } />
            <Route path="/jobs/create" element={
              <ProtectedRoute>
                <CreateJob />
              </ProtectedRoute>
            } />
            <Route path="/customers" element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            } />
            <Route path="/customers/:customerId" element={
              <ProtectedRoute>
                <CustomerDetails />
              </ProtectedRoute>
            } />
            <Route path="/customers/:customerId/edit" element={
              <ProtectedRoute>
                <EditCustomer />
              </ProtectedRoute>
            } />
            <Route path="/customers/create" element={
              <ProtectedRoute>
                <CreateCustomer />
              </ProtectedRoute>
            } />
            <Route path="/estimates" element={
              <ProtectedRoute>
                <Estimates />
              </ProtectedRoute>
            } />
            <Route path="/estimates/:estimateId" element={
              <ProtectedRoute>
                <EstimateDetails />
              </ProtectedRoute>
            } />
            <Route path="/estimates/:estimateId/edit" element={
              <ProtectedRoute>
                <EditEstimate />
              </ProtectedRoute>
            } />
            <Route path="/estimates/create" element={
              <ProtectedRoute>
                <CreateEstimate />
              </ProtectedRoute>
            } />
            <Route path="/view-pdf" element={
              <ProtectedRoute>
                <ViewPDF />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            } />
             <Route path="/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/legacy-batches" element={
              <ProtectedRoute>
                <LegacyBatches />
              </ProtectedRoute>
            } />
             <Route path="/legacy-batches/create" element={
              <ProtectedRoute>
                <CreateLegacyBatch />
              </ProtectedRoute>
            } />
            <Route path="/legacy-batches/:batchId" element={
              <ProtectedRoute>
                <LegacyBatchDetails />
              </ProtectedRoute>
            } />
             <Route path="/legacy-batches/:batchId/edit" element={
              <ProtectedRoute>
                <EditLegacyBatch />
              </ProtectedRoute>
            } />
            <Route path="/legacy-jobs/:jobId" element={
              <ProtectedRoute>
                <LegacyJobDetails />
              </ProtectedRoute>
            } />
             <Route path="/legacy-jobs/:jobId/edit" element={
              <ProtectedRoute>
                <EditLegacyJob />
              </ProtectedRoute>
            } />
             <Route path="/legacy-jobs/create" element={
              <ProtectedRoute>
                <CreateLegacyJob />
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
