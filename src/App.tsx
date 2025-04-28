
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { useAuth } from './hooks/useAuth';
import BusinessCardJobs from './pages/BusinessCardJobs';
import FlyerJobsPage from './pages/generic/FlyerJobsPage';
import PostcardJobsPage from './pages/generic/PostcardJobsPage';
import PosterJobsPage from './pages/generic/PosterJobsPage';
import SleeveJobsPage from './pages/generic/SleeveJobsPage';
import BoxJobsPage from './pages/generic/BoxJobsPage';
import CoverJobsPage from './pages/generic/CoverJobsPage';
import StickerJobsPage from './pages/generic/StickerJobsPage';
import BusinessCardBatches from './pages/BusinessCardBatches';
import FlyerBatches from './pages/FlyerBatches';
import AllJobsPage from './pages/AllJobsPage';

// Generic batch pages - using their generic implementations
import PostcardBatchesPage from './pages/generic/PostcardBatchesPage';
import PosterBatchesPage from './pages/generic/PosterBatchesPage';
import SleeveBatchesPage from './pages/generic/SleeveBatchesPage';
import BoxBatchesPage from './pages/generic/BoxBatchesPage';
import CoverBatchesPage from './pages/generic/CoverBatchesPage';
import StickerBatchesPage from './pages/generic/StickerBatchesPage';

// Job pages
import FlyerJobNewPage from './pages/generic/FlyerJobNewPage';
import PostcardJobNewPage from './pages/generic/PostcardJobNewPage';
import PosterJobNewPage from './pages/generic/PosterJobNewPage';
import SleeveJobNewPage from './pages/generic/SleeveJobNewPage';
import BoxJobNewPage from './pages/generic/BoxJobNewPage';
import CoverJobNewPage from './pages/generic/CoverJobNewPage';
import StickerJobNewPage from './pages/generic/StickerJobNewPage';

import Users from './pages/Users';
import Settings from './pages/Settings';

const App = () => {
  const { user, loading } = useAuth();

  // Show loading indicator while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  // Define a wrapper for protected routes
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return user ? <>{children}</> : <Navigate to="/auth" />;
  };
  
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          
          {/* All Jobs Page */}
          <Route path="/all-jobs" element={<AllJobsPage />} />
          
          {/* Business Cards Routes */}
          <Route path="/batches/business-cards/jobs" element={<BusinessCardJobs />} />
          <Route path="/batches/business-cards/batches" element={<BusinessCardBatches />} />
          
          {/* Flyers Routes */}
          <Route path="/batches/flyers/jobs" element={<FlyerJobsPage />} />
          <Route path="/batches/flyers/jobs/new" element={<FlyerJobNewPage />} />
          <Route path="/batches/flyers/batches" element={<FlyerBatches />} />
          
          {/* Postcards Routes */}
          <Route path="/batches/postcards/jobs" element={<PostcardJobsPage />} />
          <Route path="/batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
          <Route path="/batches/postcards/batches" element={<PostcardBatchesPage />} />
          
          {/* Posters Routes */}
          <Route path="/batches/posters/jobs" element={<PosterJobsPage />} />
          <Route path="/batches/posters/jobs/new" element={<PosterJobNewPage />} />
          <Route path="/batches/posters/batches" element={<PosterBatchesPage />} />
          
          {/* Sleeves Routes */}
          <Route path="/batches/sleeves/jobs" element={<SleeveJobsPage />} />
          <Route path="/batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
          <Route path="/batches/sleeves/batches" element={<SleeveBatchesPage />} />
          
          {/* Boxes Routes */}
          <Route path="/batches/boxes/jobs" element={<BoxJobsPage />} />
          <Route path="/batches/boxes/jobs/new" element={<BoxJobNewPage />} />
          <Route path="/batches/boxes/batches" element={<BoxBatchesPage />} />
          
          {/* Covers Routes */}
          <Route path="/batches/covers/jobs" element={<CoverJobsPage />} />
          <Route path="/batches/covers/jobs/new" element={<CoverJobNewPage />} />
          <Route path="/batches/covers/batches" element={<CoverBatchesPage />} />
          
          {/* Stickers Routes */}
          <Route path="/batches/stickers/jobs" element={<StickerJobsPage />} />
          <Route path="/batches/stickers/jobs/new" element={<StickerJobNewPage />} />
          <Route path="/batches/stickers/batches" element={<StickerBatchesPage />} />

          {/* Administration Routes */}
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
