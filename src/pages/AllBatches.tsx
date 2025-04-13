
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layers, Loader2, ArrowLeft, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
}

const AllBatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBatches();
    }
  }, [user]);

  const fetchBatches = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Determine product type from batch name
      const processedBatches = data?.map(batch => {
        const nameParts = batch.name.split('-');
        let productType = "Unknown";
        
        if (nameParts.length >= 2) {
          const code = nameParts[1];
          switch(code) {
            case "BC": productType = "Business Cards"; break;
            case "FLY": productType = "Flyers"; break;
            case "PC": productType = "Postcards"; break;
            case "PB": productType = "Product Boxes"; break;
            case "ZUND": productType = "Zund Stickers"; break;
            case "COV": productType = "Covers"; break;
            case "POST": productType = "Posters"; break;
          }
        }
        
        return {
          ...batch,
          product_type: productType
        };
      });
      
      setBatches(processedBatches || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast({
        title: "Error loading batches",
        description: "Failed to load batch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const getProductUrl = (productType: string) => {
    switch(productType) {
      case "Business Cards": return "/batches/business-cards/batches";
      case "Flyers": return "/batches/flyers/batches";
      case "Postcards": return "/batches/postcards/batches";
      case "Product Boxes": return "/batches/boxes/batches";
      case "Zund Stickers": return "/batches/stickers/batches";
      case "Covers": return "/batches/covers/batches";
      case "Posters": return "/batches/posters/batches";
      default: return "/batches/all";
    }
  };

  const getBatchUrl = (batch: BatchSummary) => {
    // Only navigate to known product-specific batch pages that are implemented
    // Currently, only business cards has a proper batches page
    if (batch.product_type === "Business Cards") {
      return "/batches/business-cards/batches";
    }
    
    // For now, if the specific batch page doesn't exist yet, redirect to the All Batches page
    // This prevents 404 errors
    return "/batches/all";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Layers className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">All Batches</h1>
          </div>
          <p className="text-gray-500 mt-1">View and manage all print batches across different product types</p>
        </div>
        <Button onClick={() => navigate("/")} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p>Loading batches...</p>
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No Active Batches</h2>
          <p className="text-gray-500 mb-4">There are currently no active batches in the system.</p>
          <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-lg shadow border p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-lg">{batch.name}</h3>
                  <p className="text-sm text-gray-500">{batch.product_type}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium 
                  ${batch.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  batch.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                  batch.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                  'bg-amber-100 text-amber-800'}`}
                >
                  {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-gray-500">Due Date:</div>
                <div>{formatDate(batch.due_date)}</div>
                <div className="text-gray-500">Sheets:</div>
                <div>{batch.sheets_required}</div>
              </div>
              
              <Button 
                className="w-full mt-4" 
                onClick={() => navigate(getBatchUrl(batch))}
              >
                View Batch Details
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllBatches;
