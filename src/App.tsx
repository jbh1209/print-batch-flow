import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
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
import PostcardBatches from './pages/PostcardBatches';
import PosterBatches from './pages/PosterBatches';
import SleeveBatches from './pages/SleeveBatches';
import BoxBatches from './pages/BoxBatches';
import CoverBatches from './pages/CoverBatches';
import StickerBatches from './pages/StickerBatches';
import BusinessCardJobNewPage from './pages/BusinessCardJobNewPage';
import FlyerJobNewPage from './pages/generic/FlyerJobNewPage';
import PostcardJobNewPage from './pages/generic/PostcardJobNewPage';
import PosterJobNewPage from './pages/generic/PosterJobNewPage';
import SleeveJobNewPage from './pages/generic/SleeveJobNewPage';
import BoxJobNewPage from './pages/generic/BoxJobNewPage';
import CoverJobNewPage from './pages/generic/CoverJobNewPage';
import StickerJobNewPage from './pages/generic/StickerJobNewPage';
import BusinessCardJobDetailPage from './pages/BusinessCardJobDetailPage';
import FlyerJobDetailPage from './pages/generic/FlyerJobDetailPage';
import PostcardJobDetailPage from './pages/generic/PostcardJobDetailPage';
import PosterJobDetailPage from './pages/generic/PosterJobDetailPage';
import SleeveJobDetailPage from './pages/generic/SleeveJobDetailPage';
import BoxJobDetailPage from './pages/generic/BoxJobDetailPage';
import CoverJobDetailPage from './pages/generic/CoverJobDetailPage';
import StickerJobDetailPage from './pages/generic/StickerJobDetailPage';
import BusinessCardJobEditPage from './pages/BusinessCardJobEditPage';
import FlyerJobEditPage from './pages/generic/FlyerJobEditPage';
import PostcardJobEditPage from './pages/generic/PostcardJobEditPage';
import PosterJobEditPage from './pages/generic/PosterJobEditPage';
import SleeveJobEditPage from './pages/generic/SleeveJobEditPage';
import BoxJobEditPage from './pages/generic/BoxJobEditPage';
import CoverJobEditPage from './pages/generic/CoverJobEditPage';
import StickerJobEditPage from './pages/generic/StickerJobEditPage';
import Users from './pages/Users';
import Settings from './pages/Settings';

// Import the new AllJobsPage
import AllJobsPage from "./pages/AllJobsPage";

const App = () => {
  const { isLoggedIn, isLoading } = useAuth();

  // Show loading indicator while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Define a wrapper for protected routes
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return isLoggedIn ? <>{children}</> : <Navigate to="/auth" />;
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
          <Route path="/batches/business-cards/jobs/new" element={<BusinessCardJobNewPage />} />
          <Route path="/batches/business-cards/jobs/:id" element={<BusinessCardJobDetailPage />} />
          <Route path="/batches/business-cards/jobs/:id/edit" element={<BusinessCardJobEditPage />} />
          <Route path="/batches/business-cards/batches" element={<BusinessCardBatches />} />
          
          {/* Flyers Routes */}
          <Route path="/batches/flyers/jobs" element={<FlyerJobsPage />} />
          <Route path="/batches/flyers/jobs/new" element={<FlyerJobNewPage />} />
          <Route path="/batches/flyers/jobs/:id" element={<FlyerJobDetailPage />} />
          <Route path="/batches/flyers/jobs/:id/edit" element={<FlyerJobEditPage />} />
          <Route path="/batches/flyers/batches" element={<FlyerBatches />} />
          
          {/* Postcards Routes */}
          <Route path="/batches/postcards/jobs" element={<PostcardJobsPage />} />
          <Route path="/batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
          <Route path="/batches/postcards/jobs/:id" element={<PostcardJobDetailPage />} />
          <Route path="/batches/postcards/jobs/:id/edit" element={<PostcardJobEditPage />} />
          <Route path="/batches/postcards/batches" element={<PostcardBatches />} />
          
          {/* Posters Routes */}
          <Route path="/batches/posters/jobs" element={<PosterJobsPage />} />
          <Route path="/batches/posters/jobs/new" element={<PosterJobNewPage />} />
          <Route path="/batches/posters/jobs/:id" element={<PosterJobDetailPage />} />
          <Route path="/batches/posters/jobs/:id/edit" element={<PosterJobEditPage />} />
          <Route path="/batches/posters/batches" element={<PosterBatches />} />
          
          {/* Sleeves Routes */}
          <Route path="/batches/sleeves/jobs" element={<SleeveJobsPage />} />
          <Route path="/batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
          <Route path="/batches/sleeves/jobs/:id" element={<SleeveJobDetailPage />} />
          <Route path="/batches/sleeves/jobs/:id/edit" element={<SleeveJobEditPage />} />
          <Route path="/batches/sleeves/batches" element={<SleeveBatches />} />
          
          {/* Boxes Routes */}
          <Route path="/batches/boxes/jobs" element={<BoxJobsPage />} />
          <Route path="/batches/boxes/jobs/new" element={<BoxJobNewPage />} />
          <Route path="/batches/boxes/jobs/:id" element={<BoxJobDetailPage />} />
          <Route path="/batches/boxes/jobs/:id/edit" element={<BoxJobEditPage />} />
          <Route path="/batches/boxes/batches" element={<BoxBatches />} />
          
          {/* Covers Routes */}
          <Route path="/batches/covers/jobs" element={<CoverJobsPage />} />
          <Route path="/batches/covers/jobs/new" element={<CoverJobNewPage />} />
          <Route path="/batches/covers/jobs/:id" element={<CoverJobDetailPage />} />
          <Route path="/batches/covers/jobs/:id/edit" element={<CoverJobEditPage />} />
          <Route path="/batches/covers/batches" element={<CoverBatches />} />
          
          {/* Stickers Routes */}
          <Route path="/batches/stickers/jobs" element={<StickerJobsPage />} />
          <Route path="/batches/stickers/jobs/new" element={<StickerJobNewPage />} />
          <Route path="/batches/stickers/jobs/:id" element={<StickerJobDetailPage />} />
          <Route path="/batches/stickers/jobs/:id/edit" element={<StickerJobEditPage />} />
          <Route path="/batches/stickers/batches" element={<StickerBatches />} />

          {/* Administration Routes */}
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
