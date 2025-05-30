
import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Eye, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  QrCode, 
  Settings, 
  Play,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  customer?: string | null;
  category?: string | null;
  category_id?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  rep?: string | null;
  reference?: string | null;
  highlighted?: boolean;
  qr_code_url?: string | null;
  has_workflow?: boolean;
  current_stage?: string | null;
}

interface EnhancedJobsTableProps {
  jobs: ProductionJob[];
  onJobUpdated: () => void;
  onJobDeleted: () => void;
  categories: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  isLoading?: boolean;
}

export const EnhancedJobsTable: React.FC<EnhancedJobsTableProps> = ({
  jobs,
  onJobUpdated,
  onJobDeleted,
  categories,
  isLoading = false
}) => {
  const [editingJob, setEditingJob] = useState<ProductionJob | null>(null);
  const [assigningCategory, setAssigningCategory] = useState<ProductionJob | null>(null);
  const [initializingWorkflow, setInitializingWorkflow] = useState<ProductionJob | null>(null);
  const [deletingJob, setDeletingJob] = useState<ProductionJob | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusColor = (status: string, hasWorkflow: boolean) => {
    if (!hasWorkflow) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    
    const colors = {
      "Pre-Press": "bg-blue-100 text-blue-800 border-blue-200",
      "Printing": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Finishing": "bg-purple-100 text-purple-800 border-purple-200", 
      "Packaging": "bg-orange-100 text-orange-800 border-orange-200",
      "Shipped": "bg-green-100 text-green-800 border-green-200",
      "Completed": "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const handleDeleteJob = async (job: ProductionJob) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', job.id);

      if (error) throw error;

      // Also delete any job stage instances
      await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', job.id)
        .eq('job_table_name', 'production_jobs');

      toast.success(`Job ${job.wo_no} deleted successfully`);
      onJobDeleted();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setIsProcessing(false);
      setDeletingJob(null);
    }
  };

  const handleInitializeWorkflow = async (job: ProductionJob, categoryId: string) => {
    setIsProcessing(true);
    try {
      // First update the job with the category
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: categoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Initialize the job stages using the RPC function
      const { data, error: initError } = await supabase.rpc('initialize_job_stages', {
        p_job_id: job.id,
        p_job_table_name: 'production_jobs',
        p_category_id: categoryId
      });

      if (initError) throw initError;

      toast.success(`Workflow initialized for job ${job.wo_no}`);
      onJobUpdated();
      setInitializingWorkflow(null);
    } catch (error) {
      console.error('Error initializing workflow:', error);
      toast.error('Failed to initialize workflow');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkCategoryAssign = async (categoryId: string) => {
    if (selectedJobs.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: categoryId,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedJobs);

      if (error) throw error;

      // Initialize workflows for all selected jobs
      for (const jobId of selectedJobs) {
        await supabase.rpc('initialize_job_stages', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_category_id: categoryId
        });
      }

      toast.success(`Workflow initialized for ${selectedJobs.length} jobs`);
      setSelectedJobs([]);
      onJobUpdated();
    } catch (error) {
      console.error('Error bulk assigning category:', error);
      toast.error('Failed to assign category to jobs');
    } finally {
      setIsProcessing(false);
    }
  };

  const jobsWithoutWorkflow = jobs.filter(job => !job.category_id);

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="font-medium">{selectedJobs.length} jobs selected</span>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Assign Category
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {categories.map(category => (
                    <DropdownMenuItem 
                      key={category.id}
                      onClick={() => handleBulkCategoryAssign(category.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedJobs([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Jobs Without Workflow Alert */}
      {jobsWithoutWorkflow.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              {jobsWithoutWorkflow.length} jobs need workflow initialization
            </span>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            These jobs don't have categories assigned and aren't in the workflow system yet.
          </p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              const ids = jobsWithoutWorkflow.map(job => job.id);
              setSelectedJobs(ids);
            }}
          >
            Select All Uninitialized Jobs
          </Button>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-white rounded-lg border shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedJobs.length === jobs.length && jobs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobs(jobs.map(job => job.id));
                      } else {
                        setSelectedJobs([]);
                      }
                    }}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>WO Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {isLoading ? "Loading jobs..." : "No jobs found"}
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow 
                    key={job.id} 
                    className={job.highlighted ? "bg-yellow-50" : ""}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedJobs([...selectedJobs, job.id]);
                          } else {
                            setSelectedJobs(selectedJobs.filter(id => id !== job.id));
                          }
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{job.wo_no}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(job.status, !!job.category_id)}>
                        {!job.category_id ? "Not in Workflow" : job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.category ? (
                        <span className="text-sm">{job.category}</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssigningCategory(job)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>{job.customer || "-"}</TableCell>
                    <TableCell>{job.qty || "-"}</TableCell>
                    <TableCell>{formatDate(job.due_date)}</TableCell>
                    <TableCell>
                      {job.current_stage ? (
                        <span className="text-sm font-medium">{job.current_stage}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not started</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingJob(job)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Job
                          </DropdownMenuItem>
                          
                          {!job.category_id ? (
                            <DropdownMenuItem onClick={() => setInitializingWorkflow(job)}>
                              <Play className="mr-2 h-4 w-4" />
                              Initialize Workflow
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setAssigningCategory(job)}>
                              <Settings className="mr-2 h-4 w-4" />
                              Change Category
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {job.qr_code_url && (
                            <DropdownMenuItem 
                              onClick={() => window.open(job.qr_code_url!, '_blank')}
                            >
                              <QrCode className="mr-2 h-4 w-4" />
                              View QR Code
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem 
                            onClick={() => setDeletingJob(job)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modals */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={onJobUpdated}
        />
      )}

      {assigningCategory && (
        <CategoryAssignModal
          job={assigningCategory}
          categories={categories}
          onClose={() => setAssigningCategory(null)}
          onAssign={onJobUpdated}
        />
      )}

      {initializingWorkflow && (
        <WorkflowInitModal
          job={initializingWorkflow}
          categories={categories}
          onClose={() => setInitializingWorkflow(null)}
          onInitialize={handleInitializeWorkflow}
          isProcessing={isProcessing}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingJob} onOpenChange={() => setDeletingJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete job {deletingJob?.wo_no}? This action cannot be undone and will also remove any workflow progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingJob && handleDeleteJob(deletingJob)}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
