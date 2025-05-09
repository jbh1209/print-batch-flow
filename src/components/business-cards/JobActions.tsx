
import { Menu, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface JobActionsProps {
  jobId: string;
  pdfUrl: string;
  onJobDeleted: () => void;
}

const JobActions = ({ jobId, pdfUrl, onJobDeleted }: JobActionsProps) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleViewDetails = () => {
    navigate(`/batches/business-cards/jobs/${jobId}`);
  };

  const handleEditJob = () => {
    navigate(`/batches/business-cards/jobs/${jobId}/edit`);
  };

  const handleViewPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      toast.error('No PDF available for this job');
    }
  };

  const handleDeleteJob = async () => {
    const confirm = window.confirm('Are you sure you want to delete this job?');
    if (!confirm) return;
    
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);
        
      if (error) throw error;
      
      toast.success('Job deleted successfully');
      onJobDeleted();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleViewDetails}>
          <Eye size={16} className="mr-2" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEditJob}>
          <Pencil size={16} className="mr-2" />
          Edit Job
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewPDF} disabled={!pdfUrl}>
          <Eye size={16} className="mr-2" />
          View PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDeleteJob}
          disabled={isDeleting}
          className="text-red-600 focus:bg-red-50 focus:text-red-600"
        >
          <Trash2 size={16} className="mr-2" />
          Delete Job
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default JobActions;
