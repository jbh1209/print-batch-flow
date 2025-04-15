
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ArrowLeft, Plus } from "lucide-react";

const Flyers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <FileText className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Flyers</h1>
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
          <Button onClick={() => navigate("/batches/flyers/jobs/new")}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>
      
      <div className="text-gray-500 mb-6">
        Manage flyer batches and jobs
      </div>
      
      <Tabs 
        defaultValue="overview" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs" onClick={() => navigate("/batches/flyers/jobs")}>Jobs</TabsTrigger>
          <TabsTrigger value="batches" onClick={() => navigate("/batches/flyers/batches")}>Batches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Pending Jobs</h3>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-500 mt-2">Unbatched jobs waiting for processing</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => {
                  setActiveTab("jobs");
                  navigate("/batches/flyers/jobs");
                }}
              >
                View All Jobs
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Active Batches</h3>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-500 mt-2">Batches currently in production</p>
              
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setActiveTab("batches")}
              >
                View All Batches
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold mb-2">Capacity</h3>
              <div className="text-3xl font-bold">0%</div>
              <p className="text-sm text-gray-500 mt-2">Current batch bucket capacity</p>
              
              <Button 
                className="w-full mt-4"
                onClick={() => navigate("/batches/flyers/jobs/new")}
              >
                Add New Job
              </Button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Flyer Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Available Sizes</h4>
                <p>A5, A4, DL, A3</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Weight Options</h4>
                <p>115gsm, 130gsm, 170gsm, 200gsm, 250gsm</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Type Options</h4>
                <p>Matt, Gloss</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Default Printer</h4>
                <p>HP 12000</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Default Sheet Size</h4>
                <p>530x750mm</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Batching Strategy</h4>
                <p>Grouped by paper weight, type, and size</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="jobs">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Jobs tab to view flyer jobs
          </div>
        </TabsContent>
        
        <TabsContent value="batches">
          <div className="flex items-center justify-center p-12 text-gray-500">
            Navigate to the Batches tab to view flyer batches
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Flyers;
