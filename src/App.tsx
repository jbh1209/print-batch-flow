
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import BusinessCards from "@/pages/BusinessCards";
import Postcards from "@/pages/Postcards";
import Flyers from "@/pages/Flyers";
import Stickers from "@/pages/Stickers";
import Posters from "@/pages/Posters";
import Sleeves from "@/pages/Sleeves";
import Covers from "@/pages/Covers";
import Boxes from "@/pages/Boxes";
import BusinessCardJobs from "@/pages/BusinessCardJobs";
import BusinessCardJobNew from "@/pages/BusinessCardJobNew";
import BusinessCardJobEdit from "@/pages/BusinessCardJobEdit";
import AllBatches from "@/pages/AllBatches";
import BusinessCardBatches from "@/pages/BusinessCardBatches";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<Users />} />
            
            {/* Add a redirect route for /batches to /batches/all */}
            <Route path="/batches" element={<Navigate to="/batches/all" replace />} />
            <Route path="/batches/all" element={<AllBatches />} />
            
            {/* Business Cards Routes */}
            <Route path="/batches/business-cards" element={<BusinessCards />} />
            <Route path="/batches/business-cards/jobs" element={<BusinessCardJobs />} />
            <Route path="/batches/business-cards/jobs/new" element={<BusinessCardJobNew />} />
            <Route path="/batches/business-cards/jobs/:id" element={<BusinessCardJobEdit />} />
            <Route path="/batches/business-cards/batches" element={<BusinessCardBatches />} />
            
            {/* Product Routes */}
            <Route path="/batches/postcards" element={<Postcards />} />
            <Route path="/batches/flyers" element={<Flyers />} />
            <Route path="/batches/stickers" element={<Stickers />} />
            <Route path="/batches/posters" element={<Posters />} />
            <Route path="/batches/sleeves" element={<Sleeves />} />
            <Route path="/batches/covers" element={<Covers />} />
            <Route path="/batches/boxes" element={<Boxes />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/auth" element={<Auth />} />
        </Routes>
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
