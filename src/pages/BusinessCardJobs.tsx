
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
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowLeft, Plus, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import JobStatusBadge from "@/components/JobStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: string;
  due_date: string;
  uploaded_at: string;
  status: string;
}

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [filterView, setFilterView] = useState<string>("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });
  const [laminationFilter, setLaminationFilter] = useState<string | null>(null);

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
          query = query.eq('lamination_type', laminationFilter === 'none' ? 'none' : laminationFilter);
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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <CreditCard className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">All Business Card Jobs</h1>
          </div>
          <div className="text-gray-500 mt-1">
            View and manage all business card jobs
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/business-cards")}
          >
            <ArrowLeft size={16} />
            <span>Back to Business Cards</span>
          </Button>
          <Button className="flex items-center gap-1" onClick={() => navigate("/batches/business-cards/jobs/new")}>
            <Plus size={16} />
            <span>Add New Job</span>
          </Button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border shadow mb-8">
        {/* Tabs */}
        <div className="flex border-b">
          <button 
            className={`px-6 py-3 text-sm font-medium ${filterView === 'all' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('all')}
          >
            All ({filterCounts.all})
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium ${filterView === 'queued' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('queued')}
          >
            Queued ({filterCounts.queued})
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium ${filterView === 'batched' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('batched')}
          >
            Batched ({filterCounts.batched})
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium ${filterView === 'completed' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setFilterView('completed')}
          >
            Completed ({filterCounts.completed})
          </button>
        </div>
        
        {/* Filter Bar */}
        <div className="flex border-b p-4 bg-gray-50 gap-2">
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-gray-100 ${!laminationFilter ? 'bg-gray-200 border-gray-300' : ''}`}
            onClick={() => setLaminationFilter(null)}
          >
            All
          </Badge>
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'gloss' ? 'bg-gray-200 border-gray-300' : ''}`}
            onClick={() => setLaminationFilter('gloss')}
          >
            Gloss
          </Badge>
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'matt' ? 'bg-gray-200 border-gray-300' : ''}`}
            onClick={() => setLaminationFilter('matt')}
          >
            Matt
          </Badge>
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'soft_touch' ? 'bg-gray-200 border-gray-300' : ''}`}
            onClick={() => setLaminationFilter('soft_touch')}
          >
            Soft Touch
          </Badge>
          <Badge 
            variant="outline" 
            className={`cursor-pointer hover:bg-gray-100 ${laminationFilter === 'none' ? 'bg-gray-200 border-gray-300' : ''}`}
            onClick={() => setLaminationFilter('none')}
          >
            None
          </Badge>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                      <span className="ml-2">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : jobs.length > 0 ? (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell><input type="checkbox" className="rounded border-gray-300" /></TableCell>
                    <TableCell>{job.name}</TableCell>
                    <TableCell>
                      <span className="text-blue-600 hover:underline cursor-pointer" 
                            onClick={() => window.open(job.pdf_url, '_blank')}>
                        {job.file_name}
                      </span>
                    </TableCell>
                    <TableCell>{job.quantity}</TableCell>
                    <TableCell>
                      {job.lamination_type === 'none' ? 'None' : 
                       job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}
                    </TableCell>
                    <TableCell>{formatDate(job.due_date)}</TableCell>
                    <TableCell>{formatDate(job.uploaded_at)}</TableCell>
                    <TableCell><JobStatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewJob(job.id)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="bg-gray-100 rounded-full p-3 mb-3">
                        <UploadCloud size={24} />
                      </div>
                      <h3 className="font-medium mb-1">No jobs found</h3>
                      <p className="text-sm mb-4">There are no business card jobs available.</p>
                      <p className="text-sm text-gray-400 max-w-lg">
                        You can add a new job using the "Add New Job" button. 
                        If you're experiencing issues, please check if storage and 
                        database permissions are set up correctly.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination - This would be implemented for a real app with many records */}
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
