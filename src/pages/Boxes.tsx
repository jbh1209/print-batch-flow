
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Box, Plus, ArrowLeft } from "lucide-react";
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";

const Boxes = () => {
  const navigate = useNavigate();
  const config = productConfigs["Boxes"];
  const [activeTab, setActiveTab] = useState("overview");
  
  const { jobs, isLoading: jobsLoading } = useGenericJobs(config);
  
  // Calculate basic stats
  const pendingJobsCount = jobs.filter(job => job.status === "queued").length;
  const activeBatchesCount = jobs.filter(job => job.status === "batched").length;
  
  // Calculate capacity percentage (example logic - customize as needed)
  const capacityPercentage = activeBatchesCount > 0 
    ? Math.min(Math.round((activeBatchesCount / 5) * 100), 100) 
    : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Box className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{config.ui.title}</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage box batches and jobs</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={16} className="mr-1" />
            <span>Back to Dashboard</span>
          </Button>
          <Button onClick={() => navigate(config.routes.newJobPath)}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>
      
      <Tabs 
        defaultValue="overview" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Pending Jobs</h3>
              <div className="text-3xl font-bold">
                {jobsLoading ? (
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
                }}
              >
                View All Jobs
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Active Batches</h3>
              <div className="text-3xl font-bold">
                {jobsLoading ? (
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
                onClick={() => navigate("/batches/boxes/jobs/new")}
              >
                Add New Job
              </Button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Box Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Type Options</h4>
                <p>{config.availablePaperTypes?.join(", ")}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Lamination Options</h4>
                <p>{config.availableLaminationTypes?.map(l => l.replace("_", " ")).join(", ")}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Default Printer</h4>
                <p>HP Indigo 12000</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="jobs">
          <div className="flex items-center justify-center p-12 text-gray-500">
            <Button 
              onClick={() => navigate("/batches/boxes/jobs")}
              className="text-lg"
            >
              Go to Jobs Page
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="batches">
          <div className="flex items-center justify-center p-12 text-gray-500">
            <Button 
              onClick={() => navigate("/batches/boxes/batches")}
              className="text-lg"
            >
              Go to Batches Page
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Boxes;
