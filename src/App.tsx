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
import BusinessCards from './pages/BusinessCards';
import Flyers from './pages/Flyers';
import Postcards from './pages/Postcards';
import Posters from './pages/Posters';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Stickers from './pages/Stickers';
import Sleeves from './pages/Sleeves';
import Boxes from './pages/Boxes';
import Covers from './pages/Covers';
import AllBatches from './pages/AllBatches';

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
          
          {/* All Batches route */}
          <Route path="/batches" element={<ProtectedRoute element={<AllBatches />} protected={true} />} />
          
          {/* Business Cards routes */}
          <Route path="/batches/business-cards" element={<ProtectedRoute element={<BusinessCards />} protected={true} />} />
          <Route path="/batches/business-cards/jobs" element={<ProtectedRoute element={<BusinessCardJobs />} protected={true} />} />
          <Route path="/batches/business-cards/jobs/new" element={<ProtectedRoute element={<BusinessCardJobNew />} protected={true} />} />
          <Route path="/batches/business-cards/batches" element={<ProtectedRoute element={<BusinessCardBatches />} protected={true} />} />
          <Route 
            path="/batches/business-cards/batches/:batchId" 
            element={<ProtectedRoute element={<BatchDetailsPage productType="Business Cards" backUrl="/batches/business-cards/batches" />} protected={true} />} 
          />
          
          {/* Flyers routes */}
          <Route path="/batches/flyers" element={<ProtectedRoute element={<Flyers />} protected={true} />} />
          <Route path="/batches/flyers/jobs" element={<ProtectedRoute element={<FlyerJobs />} protected={true} />} />
          <Route path="/batches/flyers/jobs/new" element={<ProtectedRoute element={<FlyerJobNew />} protected={true} />} />
          <Route path="/batches/flyers/batches" element={<ProtectedRoute element={<FlyerBatches />} protected={true} />} />
          <Route 
            path="/batches/flyers/batches/:batchId" 
            element={<ProtectedRoute element={<BatchDetailsPage productType="Flyers" backUrl="/batches/flyers/batches" />} protected={true} />} 
          />
          
          {/* Other product routes */}
          <Route path="/batches/postcards" element={<ProtectedRoute element={<Postcards />} protected={true} />} />
          <Route path="/batches/posters" element={<ProtectedRoute element={<Posters />} protected={true} />} />
          <Route path="/batches/stickers" element={<ProtectedRoute element={<Stickers />} protected={true} />} />
          <Route path="/batches/sleeves" element={<ProtectedRoute element={<Sleeves />} protected={true} />} />
          <Route path="/batches/boxes" element={<ProtectedRoute element={<Boxes />} protected={true} />} />
          <Route path="/batches/covers" element={<ProtectedRoute element={<Covers />} protected={true} />} />
          
          {/* Admin routes */}
          <Route path="/users" element={<ProtectedRoute element={<Users />} protected={true} />} />
          <Route path="/settings" element={<ProtectedRoute element={<Settings />} protected={true} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
