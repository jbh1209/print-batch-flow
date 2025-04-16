
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BusinessCardJobs from './pages/BusinessCardJobs';
import BusinessCardBatches from './pages/BusinessCardBatches';
import BatchDetailsPage from './pages/BatchDetailsPage';
import BusinessCardJobNew from './pages/BusinessCardJobNew';
import FlyerJobs from './pages/FlyerJobs';
import FlyerJobNew from './pages/FlyerJobNew';
import FlyerBatches from './pages/FlyerBatches';

const ProtectedRoute = ({ element, protected: isProtected }) => {
  const { user } = useAuth();

  if (isProtected && !user) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Protected routes inside Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<ProtectedRoute element={<Dashboard />} protected={true} />} />
          <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} protected={true} />} />
          <Route path="/batches/business-cards/jobs" element={<ProtectedRoute element={<BusinessCardJobs />} protected={true} />} />
          <Route path="/batches/business-cards/jobs/new" element={<ProtectedRoute element={<BusinessCardJobNew />} protected={true} />} />
          <Route path="/batches/business-cards/batches" element={<ProtectedRoute element={<BusinessCardBatches />} protected={true} />} />
          <Route 
            path="/batches/business-cards/batches/:batchId" 
            element={<ProtectedRoute element={<BatchDetailsPage productType="Business Cards" backUrl="/batches/business-cards/batches" />} protected={true} />} 
          />
          <Route path="/batches/flyers/jobs" element={<ProtectedRoute element={<FlyerJobs />} protected={true} />} />
          <Route path="/batches/flyers/jobs/new" element={<ProtectedRoute element={<FlyerJobNew />} protected={true} />} />
          <Route path="/batches/flyers/batches" element={<ProtectedRoute element={<FlyerBatches />} protected={true} />} />
          <Route 
            path="/batches/flyers/batches/:batchId" 
            element={<ProtectedRoute element={<BatchDetailsPage productType="Flyers" backUrl="/batches/flyers/batches" />} protected={true} />} 
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
