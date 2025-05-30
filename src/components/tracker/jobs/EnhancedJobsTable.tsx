import React, { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  QrCode, 
  Play,
  CheckCircle,
  Package,
  Sync,
  Smartphone
} from "lucide-react";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";
import { BulkJobOperations } from "./BulkJobOperations";
import { JobSyncDialog } from "./JobSyncDialog";
import { MobileJobActions } from "./MobileJobActions";
import { QRCodeManager } from "../QRCodeManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnhancedJobsTableProps {
  jobs: any[];
  categories: any[];
  onJobUpdated: () => void;
  onJobDeleted: () => void;
  isLoading: boolean;
}

export const EnhancedJobsTable: React.FC<EnhancedJobsTableProps> = ({
  jobs,
  categories,
  onJobUpdated,
  onJobDeleted,
  isLoading
}) => {
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);
  const [workflowInitJob, setWorkflowInitJob] = useState<any>(null);
  const [syncingJob, setSyncingJob] = useState<any>(null);
  const [showBulkOperations, setShowBulkOperations] = useState(false);

  const handleSelectJob = (job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      onJobDeleted();
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'in-progress') return 'bg-blue-100 text-blue-800';
    if (status === 'on-hold') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Selection Controls */}
        {selectedJobs.length > 0 && (
          <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {selectedJobs.length} jobs selected
            </span>
            <Button
              size="sm"
              onClick={() => setShowBulkOperations(true)}
              className="flex items-center gap-2"
            >
              <Package className="h-4 w-4" />
              Bulk Operations
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedJobs([])}
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* Enhanced Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedJobs.length === jobs.length && jobs.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>WO Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedJobs.some(j => j.id === job.id)}
                      onCheckedChange={(checked) => handleSelectJob(job, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{job.wo_no}</TableCell>
                  <TableCell>{job.customer || 'No customer'}</TableCell>
                  <TableCell>
                    {job.category ? (
                      <Badge variant="outline">{job.category}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCategoryAssignJob(job)}
                        className="text-xs"
                      >
                        Assign Category
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.current_stage ? (
                      <Badge variant="outline" className="text-xs">
                        {job.current_stage}
                      </Badge>
                    ) : job.has_workflow ? (
                      <span className="text-sm text-gray-500">No active stage</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setWorkflowInitJob(job)}
                        className="text-xs"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Init Workflow
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(job.due_date)}</TableCell>
                  <TableCell>
                    <QRCodeManager 
                      job={job} 
                      compact={true}
                      onQRCodeGenerated={onJobUpdated}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Mobile Actions (visible on mobile) */}
                      <div className="md:hidden">
                        <MobileJobActions
                          job={job}
                          onJobUpdate={onJobUpdated}
                          onEditJob={() => setEditingJob(job)}
                          onSyncJob={() => setSyncingJob(job)}
                        />
                      </div>

                      {/* Desktop Actions (hidden on mobile) */}
                      <div className="hidden md:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingJob(job)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Job
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSyncingJob(job)}>
                              <Sync className="h-4 w-4 mr-2" />
                              Sync Data
                            </DropdownMenuItem>
                            {!job.category_id && (
                              <DropdownMenuItem onClick={() => setCategoryAssignJob(job)}>
                                <Play className="h-4 w-4 mr-2" />
                                Assign Category
                              </DropdownMenuItem>
                            )}
                            {job.category_id && !job.has_workflow && (
                              <DropdownMenuItem onClick={() => setWorkflowInitJob(job)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Initialize Workflow
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteJob(job.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modals */}
      <JobEditModal
        isOpen={!!editingJob}
        onClose={() => setEditingJob(null)}
        job={editingJob}
        categories={categories}
        onJobUpdated={onJobUpdated}
      />

      <CategoryAssignModal
        isOpen={!!categoryAssignJob}
        onClose={() => setCategoryAssignJob(null)}
        job={categoryAssignJob}
        categories={categories}
        onJobUpdated={onJobUpdated}
      />

      <WorkflowInitModal
        isOpen={!!workflowInitJob}
        onClose={() => setWorkflowInitJob(null)}
        job={workflowInitJob}
        onWorkflowInitialized={onJobUpdated}
      />

      <BulkJobOperations
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
        selectedJobs={selectedJobs}
        categories={categories}
        onOperationComplete={() => {
          setSelectedJobs([]);
          onJobUpdated();
        }}
      />

      <JobSyncDialog
        isOpen={!!syncingJob}
        onClose={() => setSyncingJob(null)}
        job={syncingJob}
        onJobUpdated={onJobUpdated}
      />
    </>
  );
};
