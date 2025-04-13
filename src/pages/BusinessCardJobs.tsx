
import { useState } from "react";
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

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const [filterView, setFilterView] = useState<string>("all");
  
  // These would be fetched from Supabase in a real application
  const jobs: any[] = [];
  const filterCounts = {
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
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
          <Button className="flex items-center gap-1">
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
          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">All</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">Gloss</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">Matt</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">Soft Touch</Badge>
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
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell><input type="checkbox" /></TableCell>
                    <TableCell>{job.name}</TableCell>
                    <TableCell>{job.file_name}</TableCell>
                    <TableCell>{job.quantity}</TableCell>
                    <TableCell>{job.lamination_type}</TableCell>
                    <TableCell>{job.due_date}</TableCell>
                    <TableCell>{job.uploaded_at}</TableCell>
                    <TableCell><JobStatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">View</Button>
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
      </div>
    </div>
  );
};

export default BusinessCardJobs;
