
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface JobHeaderProps {
  job: {
    id: string;
    name: string;
    job_number: string;
    pdf_url?: string;
  };
}

const JobHeader: React.FC<JobHeaderProps> = ({ job }) => {
  const navigate = useNavigate();

  const handleEditClick = () => {
    navigate(`/batches/business-cards/jobs/${job.id}/edit`);
  };

  const handleViewPDF = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    } else {
      toast.error('No PDF available for this job');
    }
  };

  return (
    <div className="mb-6 flex justify-between items-center">
      <div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/batches/business-cards/jobs')}
          className="mb-2 flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          <span>Back to Jobs</span>
        </Button>
        <div className="flex items-center">
          <FileText className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{job.name || 'Unnamed Job'}</h1>
        </div>
        <p className="text-gray-500 mt-1">
          Job #{job.job_number} • Business Cards
        </p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline"
          onClick={handleViewPDF}
          className="flex items-center gap-1"
          disabled={!job.pdf_url}
        >
          <Eye size={16} className="mr-1" />
          View PDF
        </Button>
        <Button 
          onClick={handleEditClick}
          className="flex items-center gap-1"
        >
          <Edit size={16} className="mr-1" />
          Edit Job
        </Button>
      </div>
    </div>
  );
};

export default JobHeader;
