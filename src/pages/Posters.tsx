
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Image, Plus, ArrowLeft } from "lucide-react";
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";
import GenericJobsTable from "@/components/generic/GenericJobsTable";
import { GenericBatchesList } from "@/components/generic/GenericBatchesList";
import { GenericBatchCreateDialog } from '@/components/generic/GenericBatchCreateDialog';

const Posters = () => {
  const navigate = useNavigate();
  const config = productConfigs["Posters"];
  const [activeTab, setActiveTab] = useState("overview");
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  
  const { 
    jobs, 
    isLoading: jobsLoading, 
    deleteJob, 
    createBatch, 
    isCreatingBatch,
    fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs
  } = useGenericJobs(config);

  const { 
    batches, 
    isLoading: batchesLoading, 
    handleDeleteBatch, 
    handleViewPDF, 
    handleViewBatchDetails,
    setBatchToDelete,
    batchToDelete,
    isDeleting
  } = useGenericBatches(config);
  
  // Calculate basic stats
  const pendingJobsCount = jobs.filter(job => job.status === "queued").length;
  const activeBatchesCount = jobs.filter(job => job.status === "batched").length;
  
  // Calculate capacity percentage (example logic - customize as needed)
  const capacityPercentage = activeBatchesCount > 0 
    ? Math.min(Math.round((activeBatchesCount / 5) * 100), 100) 
    : 0;

  const handleViewJob = (jobId: string) => {
    if (config.routes.jobDetailPath) {
      navigate(config.routes.jobDetailPath(jobId));
    }
  };

  const handleCreateBatch = (jobs: any[]) => {
    setSelectedJobs(jobs);
    setIsBatchDialogOpen(true);
  };

  const handleBatchCreated = () => {
    setIsBatchDialogOpen(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Image className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Posters</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage poster batches and jobs</p>
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
                onClick={() => navigate("/batches/posters/jobs/new")}
              >
                Add New Job
              </Button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Poster Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Available Sizes</h4>
                <p>{config.availableSizes?.join(", ")}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Paper Types</h4>
                <p>{config.availablePaperTypes?.join(", ")}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500">Sides Options</h4>
                <p>{config.availableSidesTypes?.map(side => 
                  side === "single" ? "Single Sided" : "Double Sided").join(", ")}</p>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="jobs">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Poster Jobs</h2>
              <div className="flex space-x-2">
                <Button onClick={() => handleCreateBatch(jobs.filter(job => job.status === 'queued'))}>
                  <Image className="mr-2 h-4 w-4" />
                  Batch Jobs
                </Button>
                <Button onClick={() => navigate(config.routes.newJobPath)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Job
                </Button>
              </div>
            </div>

            <GenericJobsTable
              jobs={jobs}
              isLoading={jobsLoading}
              error={null}
              deleteJob={deleteJob}
              fetchJobs={async () => {}}
              createBatch={createBatch}
              isCreatingBatch={isCreatingBatch}
              fixBatchedJobsWithoutBatch={async () => { 
                await fixBatchedJobsWithoutBatch();
              }}
              isFixingBatchedJobs={isFixingBatchedJobs}
              config={config}
              onViewJob={handleViewJob}
            />

            <GenericBatchCreateDialog
              config={config}
              isOpen={isBatchDialogOpen}
              onClose={() => setIsBatchDialogOpen(false)}
              onSuccess={handleBatchCreated}
              preSelectedJobs={selectedJobs}
              createBatch={createBatch}
              isCreatingBatch={isCreatingBatch}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="batches">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Poster Batches</h2>
              <Button onClick={() => navigate(config.routes.newJobPath)}>
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </div>

            <GenericBatchesList
              batches={batches}
              isLoading={batchesLoading}
              config={config}
              onViewPDF={handleViewPDF}
              onDeleteBatch={handleDeleteBatch}
              onViewBatchDetails={handleViewBatchDetails}
              setBatchToDelete={setBatchToDelete}
              batchToDelete={batchToDelete}
              isDeleting={isDeleting}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Posters;
