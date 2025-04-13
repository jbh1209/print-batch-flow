
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

// Import our new components
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import LaminationFilter from "@/components/business-cards/LaminationFilter";
import JobsTable, { Job, JobStatus, LaminationType } from "@/components/business-cards/JobsTable";

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

  useEffect(() => {
    if (!user) return;
    
    const fetchJobs = async () => {
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
    
    fetchJobs();
  }, [user, filterView, laminationFilter, toast]);

  const handleViewJob = (jobId: string) => {
    // In a real app, this would navigate to a job detail page
    console.log("View job:", jobId);
    toast({
      title: "Feature not implemented",
      description: "Job details view is not yet implemented.",
    });
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
        <LaminationFilter 
          laminationFilter={laminationFilter} 
          setLaminationFilter={setLaminationFilter} 
        />
        
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
                handleViewJob={handleViewJob} 
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
