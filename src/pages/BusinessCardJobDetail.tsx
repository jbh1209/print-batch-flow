import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, ArrowLeft, Calendar, Download, Edit } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import JobStatusBadge from "@/components/JobStatusBadge";
import PdfViewer from "@/components/pdf/PdfViewer";

interface BusinessCardJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  due_date: string;
  batch_id?: string;
  pdf_url: string;
  file_name: string;
  status: string;
  created_at: string;
  double_sided: boolean;
  lamination_type?: string;
  paper_type?: string;
  user_id: string;
  updated_at: string;
  batch_ready: boolean;
  batch_allocated_at?: string;
  batch_allocated_by?: string;
}

const BusinessCardJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<BusinessCardJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from("business_card_jobs")
          .select("*")
          .eq("id", id)
          .maybeSingle();
          
        if (error) throw error;
        
        setJob(data as BusinessCardJob);
      } catch (err) {
        console.error("Error fetching business card job details:", err);
        setError("Failed to load job details");
        toast.error("Failed to load job details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobDetails();
  }, [id, user]);
  
  const handleDownloadPDF = () => {
    if (!job?.pdf_url) {
      toast.error("No PDF available to download");
      return;
    }
    
    window.open(job.pdf_url, "_blank");
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Job not found</h3>
        <p className="text-gray-500 mb-6">{error || "The requested job could not be found."}</p>
        <Button onClick={() => navigate("/printstream/batches/business-cards/jobs")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button 
            variant="outline" 
            className="mb-4"
            onClick={() => navigate("/printstream/batches/business-cards/jobs")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <h1 className="text-2xl font-bold">{job.name}</h1>
          <div className="flex items-center mt-2">
            <span className="text-gray-500 mr-2">Job #{job.job_number}</span>
            <JobStatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate(`/printstream/batches/business-cards/jobs/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Job
          </Button>
          <Button onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Job Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Client</h4>
              <p>{job.name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Job Number</h4>
              <p>{job.job_number}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Paper Type</h4>
              <p>{job.paper_type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Lamination</h4>
              <p>{job.lamination_type === 'none' ? 'No Lamination' : job.lamination_type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Sides</h4>
              <p>{job.double_sided ? 'Double Sided' : 'Single Sided'}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Quantity</h4>
              <p>{job.quantity}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
              <div className="flex items-center">
                <Calendar size={16} className="mr-1 text-gray-400" />
                <p>{format(new Date(job.due_date), "dd MMM yyyy")}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">File Name</h4>
              <p className="truncate max-w-xs">{job.file_name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Created At</h4>
              <p>{format(new Date(job.created_at), "dd MMM yyyy, HH:mm")}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Batch Information</h3>
          {job.batch_id ? (
            <div>
              <Badge className="mb-2">Batched</Badge>
              <p className="mb-4">This job has been added to a batch for processing.</p>
              <Button 
                variant="outline"
                onClick={() => navigate(`/printstream/batches/business-cards/batches/${job.batch_id}`)}
              >
                View Batch
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Badge variant="outline" className="mb-2">Not Batched</Badge>
              <p className="text-gray-500 mb-2">This job is waiting to be added to a batch.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">PDF Preview</h3>
        <PdfViewer 
          url={job?.pdf_url || null} 
          className="max-h-[600px] border rounded-lg"
        />
      </div>
    </div>
  );
};

export default BusinessCardJobDetail;