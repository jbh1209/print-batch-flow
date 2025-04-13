
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BatchesTable from "./BatchesTable";
import { LaminationType } from "@/components/business-cards/JobsTable";

interface Batch {
  id: string;
  name: string;
  lamination_type: LaminationType;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: "pending" | "processing" | "completed" | "cancelled";
}

interface BatchesWrapperProps {
  batches: Batch[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewPDF: (url: string | null) => void;
  onDeleteBatch: (batchId: string) => void;
}

const BatchesWrapper = ({
  batches,
  isLoading,
  onRefresh,
  onViewPDF,
  onDeleteBatch
}: BatchesWrapperProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="bg-white rounded-lg border shadow mb-8">
      <div className="border-b p-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {batches.length} {batches.length === 1 ? 'batch' : 'batches'} found
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">Refresh</Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lamination</TableHead>
              <TableHead>Sheets</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <BatchesTable
              batches={batches}
              isLoading={isLoading}
              onViewPDF={onViewPDF}
              onDeleteBatch={onDeleteBatch}
            />
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BatchesWrapper;
