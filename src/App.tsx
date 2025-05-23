
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from "@/components/theme-provider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BusinessCardJobs from './pages/BusinessCardJobs';
import BusinessCardJobNew from './pages/BusinessCardJobNew';
import BusinessCardJobEdit from './pages/BusinessCardJobEdit';
import BusinessCardBatches from './pages/BusinessCardBatches';
import BatchDetailsPage from './pages/BatchDetailsPage';
import AllBatches from './pages/AllBatches';
import FlyerBatches from './pages/FlyerBatches';
import FlyerBatchDetails from './pages/FlyerBatchDetails';
import { Toaster } from "@/components/ui/sonner"
import GenericBatchDetailsPage from './pages/generic/GenericBatchDetailsPage';
import BoxBatchesPage from './pages/generic/BoxBatchesPage';
import CoverBatchesPage from './pages/generic/CoverBatchesPage';
import PosterBatchesPage from './pages/generic/PosterBatchesPage';
import SleeveBatchesPage from './pages/generic/SleeveBatchesPage';
import StickerBatchesPage from './pages/generic/StickerBatchesPage';
import PostcardBatchesPage from './pages/generic/PostcardBatchesPage';
import { BatchOperationsProvider } from "./context/BatchOperationsContext";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <QueryClientProvider client={queryClient}>
          <Toaster />
          <BatchOperationsProvider>
            <Routes>
              <Route path="/" element={<AllBatches />} />
              <Route path="/batches" element={<AllBatches />} />
              
              {/* Business Card Routes */}
              <Route path="/batches/business-cards/jobs" element={<BusinessCardJobs />} />
              <Route path="/batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
              <Route path="/batches/business-cards/jobs/edit/:jobId" element={<BusinessCardJobEdit />} />
              <Route path="/batches/business-cards/batches" element={<BusinessCardBatches />} />
              <Route path="/batches/business-cards/batches/:batchId" element={<BatchDetailsPage productType="Business Cards" backUrl="/batches/business-cards/batches" />} />
              
              {/* Flyer Routes */}
              <Route path="/batches/flyers/batches" element={<FlyerBatches />} />
              <Route path="/batches/flyers/batches/:batchId" element={<FlyerBatchDetails />} />
            
              {/* Generic Batches Routes */}
              <Route path="/batches/boxes/batches" element={<BoxBatchesPage />} />
              <Route path="/batches/covers/batches" element={<CoverBatchesPage />} />
              <Route path="/batches/posters/batches" element={<PosterBatchesPage />} />
              <Route path="/batches/sleeves/batches" element={<SleeveBatchesPage />} />
              <Route path="/batches/stickers/batches" element={<StickerBatchesPage />} />
              <Route path="/batches/postcards/batches" element={<PostcardBatchesPage />} />
            </Routes>
          </BatchOperationsProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
