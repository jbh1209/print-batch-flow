
import React from "react";
import { Route, Navigate, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Layout from "@/components/Layout";
import NotFound from "@/pages/NotFound";
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
        <Route path="/batches/flyers/jobs" element={<FlyerJobs />} />
        <Route path="/batches/flyers/batches" element={<FlyerBatches />} />
        <Route path="/batches/flyers/jobs/new" element={<FlyerJobNew />} />
        <Route path="/batches/flyers/jobs/:jobId" element={<FlyerJobDetail />} />
        <Route path="/batches/flyers/jobs/:jobId/edit" element={<FlyerJobEdit />} />
        
        {/* Business Cards */}
        <Route path="/batches/business-cards" element={<BusinessCards />} />
        <Route path="/batches/business-cards/jobs" element={<BusinessCardJobs />} />
        <Route path="/batches/business-cards/batches" element={<BusinessCardBatches />} />
        <Route path="/batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
        <Route path="/batches/business-cards/jobs/:jobId" element={<BusinessCardJobDetail />} />
        <Route path="/batches/business-cards/jobs/:jobId/edit" element={<BusinessCardJobEdit />} />
        
        {/* Postcards */}
        <Route path="/batches/postcards" element={<Postcards />} />
        <Route path="/batches/postcards/jobs" element={<Postcards />} />
        <Route path="/batches/postcards/batches" element={<Postcards />} />
        <Route path="/batches/postcards/jobs/new" element={<Postcards />} />
        <Route path="/batches/postcards/jobs/:jobId" element={<Postcards />} />
        <Route path="/batches/postcards/jobs/:jobId/edit" element={<Postcards />} />
        
        {/* Posters */}
        <Route path="/batches/posters" element={<Posters />} />
        <Route path="/batches/posters/jobs" element={<Posters />} />
        <Route path="/batches/posters/batches" element={<Posters />} />
        <Route path="/batches/posters/jobs/new" element={<Posters />} />
        <Route path="/batches/posters/jobs/:jobId" element={<Posters />} />
        <Route path="/batches/posters/jobs/:jobId/edit" element={<Posters />} />
        
        {/* Covers */}
        <Route path="/batches/covers" element={<Covers />} />
        <Route path="/batches/covers/jobs" element={<Covers />} />
        <Route path="/batches/covers/batches" element={<Covers />} />
        <Route path="/batches/covers/jobs/new" element={<Covers />} />
        <Route path="/batches/covers/jobs/:jobId" element={<Covers />} />
        <Route path="/batches/covers/jobs/:jobId/edit" element={<Covers />} />
        
        {/* Stickers */}
        <Route path="/batches/stickers" element={<Stickers />} />
        <Route path="/batches/stickers/jobs" element={<Stickers />} />
        <Route path="/batches/stickers/batches" element={<Stickers />} />
        <Route path="/batches/stickers/jobs/new" element={<Stickers />} />
        <Route path="/batches/stickers/jobs/:jobId" element={<Stickers />} />
        <Route path="/batches/stickers/jobs/:jobId/edit" element={<Stickers />} />
        
        {/* Sleeves */}
        <Route path="/batches/sleeves" element={<Sleeves />} />
        <Route path="/batches/sleeves/jobs" element={<Sleeves />} />
        <Route path="/batches/sleeves/batches" element={<Sleeves />} />
        <Route path="/batches/sleeves/jobs/new" element={<Sleeves />} />
        <Route path="/batches/sleeves/jobs/:jobId" element={<Sleeves />} />
        <Route path="/batches/sleeves/jobs/:jobId/edit" element={<Sleeves />} />
        
        {/* Boxes */}
        <Route path="/batches/boxes" element={<Boxes />} />
        <Route path="/batches/boxes/jobs" element={<Boxes />} />
        <Route path="/batches/boxes/batches" element={<Boxes />} />
        <Route path="/batches/boxes/jobs/new" element={<Boxes />} />
        <Route path="/batches/boxes/jobs/:jobId" element={<Boxes />} />
        <Route path="/batches/boxes/jobs/:jobId/edit" element={<Boxes />} />
      </Route>
      
      {/* Catch all route - 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
