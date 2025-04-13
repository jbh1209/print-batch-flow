
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AllBatches from "./pages/AllBatches";
import BusinessCards from "./pages/BusinessCards";
import BusinessCardJobs from "./pages/BusinessCardJobs";
import Flyers from "./pages/Flyers";
import Postcards from "./pages/Postcards";
import Sleeves from "./pages/Sleeves";
import Boxes from "./pages/Boxes";
import Stickers from "./pages/Stickers";
import Covers from "./pages/Covers";
import Posters from "./pages/Posters";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="batches" element={<AllBatches />} />
            <Route path="batches/business-cards" element={<BusinessCards />} />
            <Route path="batches/business-cards/jobs" element={<BusinessCardJobs />} />
            <Route path="batches/flyers" element={<Flyers />} />
            <Route path="batches/postcards" element={<Postcards />} />
            <Route path="batches/sleeves" element={<Sleeves />} />
            <Route path="batches/boxes" element={<Boxes />} />
            <Route path="batches/stickers" element={<Stickers />} />
            <Route path="batches/covers" element={<Covers />} />
            <Route path="batches/posters" element={<Posters />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
