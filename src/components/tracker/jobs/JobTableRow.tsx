
import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, QrCode } from "lucide-react";
import { QRCodeManager } from "../QRCodeManager";
import { JobTableActions } from "./JobTableActions";

interface JobTableRowProps {
  job: any;
  isSelected: boolean;
  onSelectJob: (job: any, selected: boolean) => void;
  onJobUpdate: () => void;
  onEditJob: (job: any) => void;
  onSyncJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onWorkflowInit: (job: any) => void;
  onDeleteJob: (jobId: string) => void;
}

export const JobTableRow: React.FC<JobTableRowProps> = ({
  job,
  isSelected,
  onSelectJob,
  onJobUpdate,
  onEditJob,
  onSyncJob,
  onCategoryAssign,
  onWorkflowInit,
  onDeleteJob
}) => {
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

  return (
    <TableRow key={job.id}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectJob(job, checked as boolean)}
        />
      </TableCell>
      <TableCell className="font-medium">{job.wo_no}</TableCell>
      <TableCell>{job.customer || 'No customer'}</TableCell>
      <TableCell>{job.reference || '-'}</TableCell>
      <TableCell>{job.qty || '-'}</TableCell>
      <TableCell>
        {job.category ? (
          <Badge variant="outline">{job.category}</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCategoryAssign(job)}
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
            onClick={() => onWorkflowInit(job)}
            className="text-xs"
          >
            <Play className="h-3 w-3 mr-1" />
            Init Workflow
          </Button>
        )}
      </TableCell>
      <TableCell>{formatDate(job.due_date)}</TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          className="p-1"
          title="QR Code"
        >
          <QRCodeManager 
            job={job} 
            compact={true}
            onQRCodeGenerated={onJobUpdate}
          />
        </Button>
      </TableCell>
      <TableCell>
        <JobTableActions
          job={job}
          onJobUpdate={onJobUpdate}
          onEditJob={onEditJob}
          onSyncJob={onSyncJob}
          onCategoryAssign={onCategoryAssign}
          onWorkflowInit={onWorkflowInit}
          onDeleteJob={onDeleteJob}
        />
      </TableCell>
    </TableRow>
  );
};
