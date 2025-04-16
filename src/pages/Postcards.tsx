
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, ArrowLeft, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePostcardStats } from "@/hooks/usePostcardStats";

const Postcards = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const { pendingJobsCount, activeBatchesCount, isLoading, error } = usePostcardStats();

  // Calculate capacity percentage (example logic - customize as needed)
  const capacityPercentage = activeBatchesCount > 0 
    ? Math.min(Math.round((activeBatchesCount / 5) * 100), 100) 
    : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Mail className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Postcards</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage postcard batches and jobs</p>
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
          <Button onClick={() => navigate("/batches/postcards/jobs/new")}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs 
        defaultValue="overview" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs" onClick={() => navigate("/batches/postcards/jobs")}>Jobs</TabsTrigger>
          <TabsTrigger value="batches" onClick={() => navigate("/batches/postcards/batches")}>Batches</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Pending Jobs</h3>
              <div className="text-3xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 rounded-full border-t-2 border-b-2 border-primary animate-spin"></div>
                ) : (
                  pendingJobsCount
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">Unbatched jobs waiting for processing</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => {
                  setActiveTab("jobs");
                  navigate("/batches/postcards/jobs");
                }}
              >
                View All Jobs
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Active Batches</h3>
              <div className="text-3xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-8 rounded-full border-t-2 border-b-2 border-primary animate-spin"></div>
                ) : (
                  activeBatchesCount
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">Batches currently in production</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => {
                  setActiveTab("batches");
                  navigate("/batches/postcards/batches");
                }}
              >
                View All Batches
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Capacity</h3>
              <div className="text-3xl font-bold">{capacityPercentage}%</div>
              <p className="text-sm text-gray-500 mt-2">Current batch bucket capacity</p>
              
              <Button 
                className="w-full mt-4"
                onClick={() => navigate("/batches/postcards/jobs/new")}
              >
                Add New Job
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Postcard Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Available Sizes</h4>
                <p>A6</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Options</h4>
                <p>350gsm Matt, 350gsm Gloss</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Lamination Options</h4>
                <p>Matt, Gloss, Soft Touch, None</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Jobs tab to view postcard jobs
          </div>
        </TabsContent>

        <TabsContent value="batches">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Batches tab to view postcard batches
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Postcards;
