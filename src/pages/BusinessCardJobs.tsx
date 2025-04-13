import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// Import our components
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import LaminationFilter from "@/components/business-cards/LaminationFilter";
import JobsTable, { Job, JobStatus, LaminationType } from "@/components/business-cards/JobsTable";
import BatchControls from "@/components/business-cards/BatchControls";

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [filterView, setFilterView] = useState<JobStatus | "all">("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });
  const [laminationFilter, setLaminationFilter] = useState<LaminationType | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  // Fetch jobs function that can be called to refresh the data
  const fetchJobs = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('business_card_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Apply status filter
      if (filterView !== 'all') {
        query = query.eq('status', filterView);
      }
      
      // Apply lamination filter
      if (laminationFilter) {
        query = query.eq('lamination_type', laminationFilter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setJobs(data || []);
      
      // Count jobs for each status
      const { data: allJobs, error: countError } = await supabase
        .from('business_card_jobs')
        .select('status')
        .eq('user_id', user.id);
      
      if (countError) {
        throw countError;
      }
      
      const counts = {
        all: allJobs?.length || 0,
        queued: allJobs?.filter(job => job.status === 'queued').length || 0,
        batched: allJobs?.filter(job => job.status === 'batched').length || 0,
        completed: allJobs?.filter(job => job.status === 'completed').length || 0
      };
      
      setFilterCounts(counts);
      
      // Clear selected jobs when filters change
      setSelectedJobs([]);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error fetching jobs",
        description: "There was a problem loading your jobs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user, filterView, laminationFilter, toast]);
  
  // Handle job selection
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs([...selectedJobs, jobId]);
    } else {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    }
  };
  
  // Handle select all jobs
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      // Only select jobs that are in "queued" status
      const selectableJobIds = jobs
        .filter(job => job.status === "queued")
        .map(job => job.id);
      setSelectedJobs(selectableJobIds);
    } else {
      setSelectedJobs([]);
    }
  };
  
  // Handle batch completion
  const handleBatchComplete = () => {
    fetchJobs(); // Refresh the jobs list
    setSelectedJobs([]); // Clear selection
  };
  
  // Get selected job objects
  const getSelectedJobObjects = () => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  };

  return (
    <div>
      <JobsHeader 
        title="All Business Card Jobs" 
        subtitle="View and manage all business card jobs" 
      />
      
      <div className="bg-white rounded-lg border shadow mb-8">
        {/* Tabs */}
        <StatusFilterTabs 
          filterView={filterView} 
          filterCounts={filterCounts} 
          setFilterView={setFilterView} 
        />
        
        {/* Filter Bar */}
        <div className="border-b border-t p-4 flex justify-between items-center flex-wrap gap-4">
          <LaminationFilter 
            laminationFilter={laminationFilter} 
            setLaminationFilter={setLaminationFilter} 
          />
          
          {/* Batch Controls */}
          <BatchControls 
            selectedJobs={getSelectedJobObjects()}
            allAvailableJobs={jobs}
            onBatchComplete={handleBatchComplete}
            onSelectJob={handleSelectJob}
          />
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Lamination</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <JobsTable 
                jobs={jobs} 
                isLoading={isLoading}
                onRefresh={fetchJobs}
                selectedJobs={selectedJobs}
                onSelectJob={handleSelectJob}
                onSelectAllJobs={handleSelectAllJobs}
              />
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        {jobs.length > 0 && (
          <div className="p-4 border-t">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessCardJobs;
