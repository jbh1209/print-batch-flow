
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BaseJob, ProductConfig } from "@/config/productTypes";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/utils/dateUtils";
import { Edit, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { canModifyRecord } from "@/utils/permissionUtils";

interface GenericJobTableRowProps {
  job: BaseJob;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
  config: ProductConfig;
  isSelectable: boolean;
  onViewJob?: (id: string) => void;
}

const GenericJobTableRow: React.FC<GenericJobTableRowProps> = ({
  job,
  isSelected,
  onSelect,
  onDelete,
  config,
  isSelectable,
  onViewJob,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canModify = canModifyRecord(job.user_id, user?.id);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete job ${job.name}?`)) {
      await onDelete(job.id);
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewJob) {
      onViewJob(job.id);
    } else if (config.routes.jobDetailPath) {
      const path = config.routes.jobDetailPath(job.id);
      navigate(path);
    }
  };

  // Determine status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "bg-blue-100 text-blue-800";
      case "batched":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <TableRow
      className="hover:bg-slate-50 cursor-pointer"
      onClick={handleView}
      data-job-id={job.id}
    >
      {isSelectable && (
        <TableCell className="w-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(job.id, !!checked)}
            onClick={(e) => e.stopPropagation()}
            disabled={job.status !== "queued" || !canModify}
          />
        </TableCell>
      )}
      <TableCell>
        <div className="font-medium">{job.name}</div>
        <div className="text-sm text-gray-500">{job.job_number}</div>
        {!canModify && (
          <Badge variant="outline" className="mt-1 text-xs">
            Read-only
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
            job.status
          )}`}
        >
          {job.status}
        </span>
      </TableCell>
      <TableCell>{job.quantity}</TableCell>
      <TableCell>{formatDate(job.due_date)}</TableCell>
      <TableCell>
        {formatDate(job.created_at, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleView}
            className="h-8 w-8"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canModify && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default GenericJobTableRow;
