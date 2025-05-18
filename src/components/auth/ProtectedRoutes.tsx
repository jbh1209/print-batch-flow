
import React from "react";
import { Route, Navigate, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Layout from "@/components/Layout";
import NotFound from "@/pages/NotFound";

// Import the actual implemented generic pages
import FlyerJobsPage from "@/pages/generic/FlyerJobsPage";
import FlyerBatchDetailsPage from "@/pages/generic/FlyerBatchDetailsPage";
import FlyerJobNewPage from "@/pages/generic/FlyerJobNewPage";
import BusinessCardJobsPage from "@/pages/generic/BusinessCardJobsPage";
import BusinessCardBatchesPage from "@/pages/generic/BusinessCardBatchesPage";
import BusinessCardJobNewPage from "@/pages/generic/BusinessCardJobNewPage";
import BusinessCardJobEditPage from "@/pages/generic/BusinessCardJobEditPage";
import BusinessCardJobDetailsPage from "@/pages/generic/BusinessCardJobDetailsPage";
import PostcardJobsPage from "@/pages/generic/PostcardJobsPage";
import PostcardBatchesPage from "@/pages/generic/PostcardBatchesPage";
import PostcardJobNewPage from "@/pages/generic/PostcardJobNewPage";
import PostcardJobEditPage from "@/pages/generic/PostcardJobEditPage";
import PosterJobsPage from "@/pages/generic/PosterJobsPage";
import PosterBatchesPage from "@/pages/generic/PosterBatchesPage";
import PosterJobNewPage from "@/pages/generic/PosterJobNewPage";
import PosterJobEditPage from "@/pages/generic/PosterJobEditPage";
import CoverJobsPage from "@/pages/generic/CoverJobsPage";
import CoverBatchesPage from "@/pages/generic/CoverBatchesPage";
import CoverJobNewPage from "@/pages/generic/CoverJobNewPage";
import CoverJobEditPage from "@/pages/generic/CoverJobEditPage";
import StickerJobsPage from "@/pages/generic/StickerJobsPage";
import StickerBatchesPage from "@/pages/generic/StickerBatchesPage";
import StickerJobNewPage from "@/pages/generic/StickerJobNewPage";
import StickerJobEditPage from "@/pages/generic/StickerJobEditPage";
import SleeveJobsPage from "@/pages/generic/SleeveJobsPage";
import SleeveBatchesPage from "@/pages/generic/SleeveBatchesPage";
import SleeveJobNewPage from "@/pages/generic/SleeveJobNewPage";
import SleeveJobEditPage from "@/pages/generic/SleeveJobEditPage";
import BoxJobsPage from "@/pages/generic/BoxJobsPage";
import BoxBatchesPage from "@/pages/generic/BoxBatchesPage";
import BoxJobNewPage from "@/pages/generic/BoxJobNewPage";
import BoxJobEditPage from "@/pages/generic/BoxJobEditPage";

// Import the placeholder pages that will contain the overview
import Flyers from "@/pages/Flyers";
import FlyerJobs from "@/pages/FlyerJobs";
import FlyerBatches from "@/pages/FlyerBatches";
import FlyerJobNew from "@/pages/FlyerJobNew";
import FlyerJobEdit from "@/pages/FlyerJobEdit";
import FlyerJobDetail from "@/pages/FlyerJobDetail";
import BusinessCards from "@/pages/BusinessCards";
import BusinessCardJobs from "@/pages/BusinessCardJobs";
import BusinessCardBatches from "@/pages/BusinessCardBatches";
import BusinessCardJobNew from "@/pages/BusinessCardJobNew";
import BusinessCardJobEdit from "@/pages/BusinessCardJobEdit";
import BusinessCardJobDetail from "@/pages/BusinessCardJobDetail";
import Postcards from "@/pages/Postcards";
import Posters from "@/pages/Posters";
import Covers from "@/pages/Covers";
import Stickers from "@/pages/Stickers";
import Sleeves from "@/pages/Sleeves";
import Boxes from "@/pages/Boxes";
import Settings from "@/pages/Settings";
import AllBatches from "@/pages/AllBatches";
import AllJobsPage from "@/pages/AllJobsPage";
import Index from "@/pages/Index";

export const ProtectedRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />

      {/* Protected routes wrapped in Layout */}
      <Route element={user ? <Layout /> : <Navigate to="/auth" />}>
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Home page */}
        <Route path="/" element={<Index />} />
        
        {/* Administration */}
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        
        {/* All Jobs and Batches */}
        <Route path="/all-jobs" element={<AllJobsPage />} />
        <Route path="/batches" element={<AllBatches />} />
        
        {/* Product specific routes */}
        {/* Flyers */}
        <Route path="/batches/flyers" element={<Flyers />} />
        <Route path="/batches/flyers/jobs" element={<FlyerJobsPage />} />
        <Route path="/batches/flyers/batches" element={<FlyerBatches />} />
        <Route path="/batches/flyers/jobs/new" element={<FlyerJobNewPage />} />
        <Route path="/batches/flyers/jobs/:jobId" element={<FlyerJobDetail />} />
        <Route path="/batches/flyers/jobs/:jobId/edit" element={<FlyerJobEdit />} />
        
        {/* Business Cards */}
        <Route path="/batches/business-cards" element={<BusinessCards />} />
        <Route path="/batches/business-cards/jobs" element={<BusinessCardJobsPage />} />
        <Route path="/batches/business-cards/batches" element={<BusinessCardBatchesPage />} />
        <Route path="/batches/business-cards/jobs/new" element={<BusinessCardJobNewPage />} />
        <Route path="/batches/business-cards/jobs/:jobId" element={<BusinessCardJobDetailsPage />} />
        <Route path="/batches/business-cards/jobs/:jobId/edit" element={<BusinessCardJobEditPage />} />
        
        {/* Postcards */}
        <Route path="/batches/postcards" element={<Postcards />} />
        <Route path="/batches/postcards/jobs" element={<PostcardJobsPage />} />
        <Route path="/batches/postcards/batches" element={<PostcardBatchesPage />} />
        <Route path="/batches/postcards/jobs/new" element={<PostcardJobNewPage />} />
        <Route path="/batches/postcards/jobs/:jobId" element={<GenericJobDetailsPage productType="Postcards" />} />
        <Route path="/batches/postcards/jobs/:jobId/edit" element={<PostcardJobEditPage />} />
        
        {/* Posters */}
        <Route path="/batches/posters" element={<Posters />} />
        <Route path="/batches/posters/jobs" element={<PosterJobsPage />} />
        <Route path="/batches/posters/batches" element={<PosterBatchesPage />} />
        <Route path="/batches/posters/jobs/new" element={<PosterJobNewPage />} />
        <Route path="/batches/posters/jobs/:jobId" element={<GenericJobDetailsPage productType="Posters" />} />
        <Route path="/batches/posters/jobs/:jobId/edit" element={<PosterJobEditPage />} />
        
        {/* Covers */}
        <Route path="/batches/covers" element={<Covers />} />
        <Route path="/batches/covers/jobs" element={<CoverJobsPage />} />
        <Route path="/batches/covers/batches" element={<CoverBatchesPage />} />
        <Route path="/batches/covers/jobs/new" element={<CoverJobNewPage />} />
        <Route path="/batches/covers/jobs/:jobId" element={<GenericJobDetailsPage productType="Covers" />} />
        <Route path="/batches/covers/jobs/:jobId/edit" element={<CoverJobEditPage />} />
        
        {/* Stickers */}
        <Route path="/batches/stickers" element={<Stickers />} />
        <Route path="/batches/stickers/jobs" element={<StickerJobsPage />} />
        <Route path="/batches/stickers/batches" element={<StickerBatchesPage />} />
        <Route path="/batches/stickers/jobs/new" element={<StickerJobNewPage />} />
        <Route path="/batches/stickers/jobs/:jobId" element={<GenericJobDetailsPage productType="Stickers" />} />
        <Route path="/batches/stickers/jobs/:jobId/edit" element={<StickerJobEditPage />} />
        
        {/* Sleeves */}
        <Route path="/batches/sleeves" element={<Sleeves />} />
        <Route path="/batches/sleeves/jobs" element={<SleeveJobsPage />} />
        <Route path="/batches/sleeves/batches" element={<SleeveBatchesPage />} />
        <Route path="/batches/sleeves/jobs/new" element={<SleeveJobNewPage />} />
        <Route path="/batches/sleeves/jobs/:jobId" element={<GenericJobDetailsPage productType="Sleeves" />} />
        <Route path="/batches/sleeves/jobs/:jobId/edit" element={<SleeveJobEditPage />} />
        
        {/* Boxes */}
        <Route path="/batches/boxes" element={<Boxes />} />
        <Route path="/batches/boxes/jobs" element={<BoxJobsPage />} />
        <Route path="/batches/boxes/batches" element={<BoxBatchesPage />} />
        <Route path="/batches/boxes/jobs/new" element={<BoxJobNewPage />} />
        <Route path="/batches/boxes/jobs/:jobId" element={<GenericJobDetailsPage productType="Boxes" />} />
        <Route path="/batches/boxes/jobs/:jobId/edit" element={<BoxJobEditPage />} />
      </Route>
      
      {/* Catch all route - 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

