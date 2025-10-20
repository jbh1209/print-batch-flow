import React from 'react';
import { Send, Clock } from 'lucide-react';
import { AutoApprovedJob } from '@/hooks/tracker/useAutoApprovedJobs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface AutoApprovedPrintQueueListProps {
  jobs: AutoApprovedJob[];
  onJobClick: (jobId: string) => void;
  onMarkFilesSent: (stageInstanceId: string) => Promise<boolean>;
}

export const AutoApprovedPrintQueueList: React.FC<AutoApprovedPrintQueueListProps> = ({
  jobs,
  onJobClick,
  onMarkFilesSent
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No auto-approved jobs pending</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="bg-background border border-border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500"
          onClick={() => onJobClick(job.job_id)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{job.wo_no}</h4>
              <p className="text-xs text-muted-foreground">{job.customer}</p>
              {job.client_name && (
                <p className="text-xs text-muted-foreground">Client: {job.client_name}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {job.stage_name}
            </Badge>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Clock className="h-3 w-3" />
            <span>
              Approved {formatDistanceToNow(new Date(job.proof_approved_manually_at), { addSuffix: true })}
            </span>
          </div>

          <Button
            size="sm"
            variant="default"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onMarkFilesSent(job.id);
            }}
          >
            <Send className="h-3 w-3 mr-1" />
            Files Sent to Printer
          </Button>
        </div>
      ))}
    </div>
  );
};
