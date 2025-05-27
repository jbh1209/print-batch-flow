import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import BusinessCards from './pages/BusinessCards';
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
import AllBatches from './pages/AllBatches';
import { productConfigs } from './config/productTypes';
import BatchDetailsPage from './pages/BatchDetailsPage';
import GenericJobDetailsPage from './pages/generic/GenericJobDetailsPage';

// Import product type overview pages
import Flyers from './pages/Flyers';
import Postcards from './pages/Postcards';
import Posters from './pages/Posters';
import Sleeves from './pages/Sleeves';
import Boxes from './pages/Boxes';
import Covers from './pages/Covers';
import Stickers from './pages/Stickers';

// Generic batch pages
import PostcardBatchesPage from './pages/generic/PostcardBatchesPage';
import PosterBatchesPage from './pages/generic/PosterBatchesPage';
import SleeveBatchesPage from './pages/generic/SleeveBatchesPage';
import BoxBatchesPage from './pages/generic/BoxBatchesPage';
import CoverBatchesPage from './pages/generic/CoverBatchesPage';
import StickerBatchesPage from './pages/generic/StickerBatchesPage';

// Job creation pages
import FlyerJobNewPage from './pages/generic/FlyerJobNewPage';
import PostcardJobNewPage from './pages/generic/PostcardJobNewPage';
import PosterJobNewPage from './pages/generic/PosterJobNewPage';
import SleeveJobNewPage from './pages/generic/SleeveJobNewPage';
import BoxJobNewPage from './pages/generic/BoxJobNewPage';
import CoverJobNewPage from './pages/generic/CoverJobNewPage';
import StickerJobNewPage from './pages/generic/StickerJobNewPage';

// Import individual batch detail pages
import GenericBatchDetailsPage from './pages/generic/GenericBatchDetailsPage';

// Import ALL job edit pages - ensuring all are available
import BusinessCardJobEdit from './pages/BusinessCardJobEdit';
import FlyerJobEdit from './pages/FlyerJobEdit';
import PostcardJobEdit from './pages/PostcardJobEdit';
import SleeveJobEdit from './pages/SleeveJobEdit';
import SleeveJobEditPage from './pages/generic/SleeveJobEditPage';
import GenericJobEdit from './pages/GenericJobEdit';

import Users from './pages/Users';
import Settings from './pages/Settings';
import AppSelector from './pages/AppSelector';
import BatchFlowHome from './pages/BatchFlowHome';
import TrackerDashboard from './pages/tracker/TrackerDashboard';
import NotFound from './pages/NotFound';
import BusinessCardJobNew from './pages/BusinessCardJobNew';

// Tracker pages
import TrackerUpload from './pages/tracker/TrackerUpload';
import TrackerKanban from './pages/tracker/TrackerKanban';
import TrackerJobs from './pages/tracker/TrackerJobs';
import TrackerWorkSheets from './pages/tracker/TrackerWorkSheets';
import TrackerLayout from './components/TrackerLayout';
import BatchFlowLayout from './components/BatchFlowLayout';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          {/* App Selector - Main Entry Point */}
          <Route path="/" element={
            <ProtectedRoute>
              <AppSelector />
            </ProtectedRoute>
          } />

          {/* Tracker Routes */}
          <Route path="/tracker" element={
            <ProtectedRoute>
              <TrackerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<TrackerDashboard />} />
            <Route path="upload" element={<TrackerUpload />} />
            <Route path="kanban" element={<TrackerKanban />} />
            <Route path="jobs" element={<TrackerJobs />} />
            <Route path="worksheets" element={<TrackerWorkSheets />} />
          </Route>

          {/* BatchFlow Routes */}
          <Route path="/batchflow" element={
            <ProtectedRoute>
              <BatchFlowLayout />
            </ProtectedRoute>
          }>
            <Route index element={<BatchFlowHome />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* All Jobs Page */}
            <Route path="all-jobs" element={<AllJobsPage />} />
            
            {/* All Batches Page */}
            <Route path="batches" element={<AllBatches />} />
            <Route path="batches/all" element={<Navigate to="/batchflow/batches" replace />} />
            
            {/* Business Cards Routes - Fixed with proper edit route */}
            <Route path="batches/business-cards" element={<BusinessCards />} />
            <Route path="batches/business-cards/jobs" element={<BusinessCardJobs />} />
            <Route path="batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
            <Route path="batches/business-cards/jobs/edit/:id" element={<BusinessCardJobEdit />} />
            <Route path="batches/business-cards/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["BusinessCards"]} />} />
            <Route path="batches/business-cards/batches" element={<BusinessCardBatches />} />
            <Route path="batches/business-cards/batches/:batchId" element={<BatchDetailsPage productType="Business Cards" backUrl="/batchflow/batches/business-cards/batches" />} />
            
            {/* Flyers Routes */}
            <Route path="batches/flyers" element={<Flyers />} />
            <Route path="batches/flyers/jobs" element={<FlyerJobsPage />} />
            <Route path="batches/flyers/jobs/new" element={<FlyerJobNewPage />} />
            <Route path="batches/flyers/jobs/edit/:jobId" element={<FlyerJobEdit />} />
            <Route path="batches/flyers/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Flyers"]} />} />
            <Route path="batches/flyers/batches" element={<FlyerBatches />} />
            <Route path="batches/flyers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Flyers"]} />} />
            
            {/* Postcards Routes */}
            <Route path="batches/postcards" element={<Postcards />} />
            <Route path="batches/postcards/jobs" element={<PostcardJobsPage />} />
            <Route path="batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
            <Route path="batches/postcards/jobs/edit/:jobId" element={<PostcardJobEdit />} />
            <Route path="batches/postcards/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Postcards"]} />} />
            <Route path="batches/postcards/batches" element={<PostcardBatchesPage />} />
            <Route path="batches/postcards/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Postcards"]} />} />
            
            {/* Posters Routes */}
            <Route path="batches/posters" element={<Posters />} />
            <Route path="batches/posters/jobs" element={<PosterJobsPage />} />
            <Route path="batches/posters/jobs/new" element={<PosterJobNewPage />} />
            <Route path="batches/posters/jobs/edit/:jobId" element={<GenericJobEdit config={productConfigs["Posters"]} />} />
            <Route path="batches/posters/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Posters"]} />} />
            <Route path="batches/posters/batches" element={<PosterBatchesPage />} />
            <Route path="batches/posters/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Posters"]} />} />
            
            {/* Sleeves Routes - Standardized edit route */}
            <Route path="batches/sleeves" element={<Sleeves />} />
            <Route path="batches/sleeves/jobs" element={<SleeveJobsPage />} />
            <Route path="batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
            <Route path="batches/sleeves/jobs/edit/:jobId" element={<SleeveJobEdit />} />
            <Route path="batches/sleeves/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Sleeves"]} />} />
            <Route path="batches/sleeves/batches" element={<SleeveBatchesPage />} />
            <Route path="batches/sleeves/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Sleeves"]} />} />
            
            {/* Boxes Routes */}
            <Route path="batches/boxes" element={<Boxes />} />
            <Route path="batches/boxes/jobs" element={<BoxJobsPage />} />
            <Route path="batches/boxes/jobs/new" element={<BoxJobNewPage />} />
            <Route path="batches/boxes/jobs/edit/:jobId" element={<GenericJobEdit config={productConfigs["Boxes"]} />} />
            <Route path="batches/boxes/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Boxes"]} />} />
            <Route path="batches/boxes/batches" element={<BoxBatchesPage />} />
            <Route path="batches/boxes/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Boxes"]} />} />
            
            {/* Covers Routes */}
            <Route path="batches/covers" element={<Covers />} />
            <Route path="batches/covers/jobs" element={<CoverJobsPage />} />
            <Route path="batches/covers/jobs/new" element={<CoverJobNewPage />} />
            <Route path="batches/covers/jobs/edit/:jobId" element={<GenericJobEdit config={productConfigs["Covers"]} />} />
            <Route path="batches/covers/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Covers"]} />} />
            <Route path="batches/covers/batches" element={<CoverBatchesPage />} />
            <Route path="batches/covers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Covers"]} />} />
            
            {/* Stickers Routes */}
            <Route path="batches/stickers" element={<Stickers />} />
            <Route path="batches/stickers/jobs" element={<StickerJobsPage />} />
            <Route path="batches/stickers/jobs/new" element={<StickerJobNewPage />} />
            <Route path="batches/stickers/jobs/edit/:jobId" element={<GenericJobEdit config={productConfigs["Stickers"]} />} />
            <Route path="batches/stickers/jobs/:jobId" element={<GenericJobDetailsPage config={productConfigs["Stickers"]} />} />
            <Route path="batches/stickers/batches" element={<StickerBatchesPage />} />
            <Route path="batches/stickers/batches/:batchId" element={<GenericBatchDetailsPage config={productConfigs["Stickers"]} />} />

            {/* Administration Routes */}
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          {/* Handle 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
