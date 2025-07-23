
import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, RefreshCw, Plus, BarChart3, Settings } from "lucide-react";
import { ProductionManagerModals } from "./components/ProductionManagerModals";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { ResponsiveJobsTable } from "@/components/tracker/jobs/ResponsiveJobsTable";

const ProductionManagerView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] = useState("all");
  const [editingJob, setEditingJob] = useState<AccessibleJob | null>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);
  const [customWorkflowJob, setCustomWorkflowJob] = useState<AccessibleJob | null>(null);
  const [showBarcodeLabels, setShowBarcodeLabels] = useState(false);
  const [selectedJobsForBarcodes, setSelectedJobsForBarcodes] = useState<AccessibleJob[]>([]);
  const [partAssignmentJob, setPartAssignmentJob] = useState<AccessibleJob | null>(null);

  const { jobs, isLoading, refreshJobs } = useAccessibleJobs({
    permissionType: 'manage'
  });

  const { categories } = useCategories();

  const handlePartAssignment = useCallback((job: AccessibleJob) => {
    setPartAssignmentJob(job);
  }, []);

  const filteredJobs = jobs.filter(job => 
    job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getJobsByStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return filteredJobs.filter(job => job.status === 'pending');
      case 'active':
        return filteredJobs.filter(job => job.status === 'active');
      case 'completed':
        return filteredJobs.filter(job => job.status === 'completed');
      case 'on_hold':
        return filteredJobs.filter(job => job.status === 'on_hold');
      default:
        return filteredJobs;
    }
  };

  const viewJobs = getJobsByStatus(selectedView);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production Manager</h1>
          <p className="text-muted-foreground">
            Manage production jobs and workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refreshJobs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs by WO, customer, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Tabs value={selectedView} onValueChange={setSelectedView}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All Jobs
            <Badge variant="secondary" className="ml-2">
              {filteredJobs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <Badge variant="secondary" className="ml-2">
              {getJobsByStatus('pending').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">
              {getJobsByStatus('active').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <Badge variant="secondary" className="ml-2">
              {getJobsByStatus('completed').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="on_hold">
            On Hold
            <Badge variant="secondary" className="ml-2">
              {getJobsByStatus('on_hold').length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedView} className="space-y-4">
          <ResponsiveJobsTable 
            filters={{ search: searchQuery }}
            onPartAssignment={handlePartAssignment}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ProductionManagerModals
        editingJob={editingJob}
        setEditingJob={setEditingJob}
        categoryAssignJob={categoryAssignJob}
        setCategoryAssignJob={setCategoryAssignJob}
        showCustomWorkflow={showCustomWorkflow}
        setShowCustomWorkflow={setShowCustomWorkflow}
        customWorkflowJob={customWorkflowJob}
        setCustomWorkflowJob={setCustomWorkflowJob}
        showBarcodeLabels={showBarcodeLabels}
        setShowBarcodeLabels={setShowBarcodeLabels}
        selectedJobsForBarcodes={selectedJobsForBarcodes}
        setSelectedJobsForBarcodes={setSelectedJobsForBarcodes}
        partAssignmentJob={partAssignmentJob}
        setPartAssignmentJob={setPartAssignmentJob}
        categories={categories}
        onRefresh={refreshJobs}
      />
    </div>
  );
};

export default ProductionManagerView;
