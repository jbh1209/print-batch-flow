import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, ArrowLeft } from "lucide-react";
import { useJobStats } from "@/hooks/dashboard/useJobStats";
import { useBatchStats } from "@/hooks/dashboard/useBatchStats";
import { useAuth } from "@/hooks/useAuth";

const BusinessCards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  const { pendingJobs, isLoading: jobsLoading, refresh: refreshJobs } = useJobStats();
  const { activeBatches, batchTypeStats, isLoading: batchesLoading, refresh: refreshBatches } = useBatchStats();
  
  // Calculate capacity percentage for business cards
  const businessCardStats = batchTypeStats.find(stat => stat.name === "Business Cards");
  const capacityPercentage = businessCardStats ? Math.round((businessCardStats.progress / businessCardStats.total) * 100) : 0;
  
  useEffect(() => {
    refreshJobs();
    refreshBatches();
  }, [refreshJobs, refreshBatches]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <CreditCard className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Business Cards</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Button>
          <Button onClick={() => navigate("/batches/business-cards/jobs/new")}>Add New Job</Button>
        </div>
      </div>
      
      <div className="text-gray-500 mb-6">
        Manage business card batches and jobs
      </div>
      
      <Tabs 
        defaultValue="overview" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs" onClick={() => navigate("/batches/business-cards/jobs")}>Jobs</TabsTrigger>
          <TabsTrigger value="batches" onClick={() => navigate("/batches/business-cards/batches")}>Batches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Pending Jobs</h3>
              <div className="text-3xl font-bold">
                {jobsLoading ? "..." : pendingJobs}
              </div>
              <p className="text-sm text-gray-500 mt-2">Unbatched jobs waiting for processing</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => {
                  setActiveTab("jobs");
                  navigate("/batches/business-cards/jobs");
                }}
              >
                View All Jobs
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Active Batches</h3>
              <div className="text-3xl font-bold">
                {batchesLoading ? "..." : activeBatches}
              </div>
              <p className="text-sm text-gray-500 mt-2">Batches currently in production</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate("/batches/business-cards/batches")}
              >
                View All Batches
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Capacity</h3>
              <div className="text-3xl font-bold">
                {batchesLoading ? "..." : `${capacityPercentage}%`}
              </div>
              <p className="text-sm text-gray-500 mt-2">Current batch bucket capacity</p>
              
              <Button 
                className="w-full mt-4"
                onClick={() => navigate("/batches/business-cards/jobs/new")}
              >
                Add New Job
              </Button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Business Card Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Sheet Dimensions</h4>
                <p>320mm × 455mm</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Card Dimensions</h4>
                <p>90mm × 50mm</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Layout</h4>
                <p>3 columns × 8 rows (24 cards per sheet)</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Weight</h4>
                <p>350gsm Matt</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Lamination Options</h4>
                <p>Gloss, Matt, Soft Touch</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Target Batch Size</h4>
                <p>250 sheets (6000 cards)</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Other tab contents will load their respective component pages */}
        <TabsContent value="jobs">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Jobs tab to view jobs
          </div>
        </TabsContent>
        
        <TabsContent value="batches">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Batches tab to view batches
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessCards;
