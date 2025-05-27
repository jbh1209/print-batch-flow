
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, QrCode } from "lucide-react";
import { format } from "date-fns";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  customer?: string | null;
  category?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  rep?: string | null;
  reference?: string | null;
  highlighted?: boolean;
  qr_code_url?: string | null;
}

interface JobsTableViewProps {
  jobs: ProductionJob[];
}

export const JobsTableView = ({ jobs }: JobsTableViewProps) => {
  const getStatusColor = (status: string) => {
    const colors = {
      "Pre-Press": "bg-blue-100 text-blue-800",
      "Printing": "bg-yellow-100 text-yellow-800",
      "Finishing": "bg-purple-100 text-purple-800", 
      "Packaging": "bg-orange-100 text-orange-800",
      "Shipped": "bg-green-100 text-green-800",
      "Completed": "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>WO Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rep</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                  <p>No jobs match your search criteria</p>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id} className={job.highlighted ? "bg-yellow-50" : ""}>
                  <TableCell className="font-medium">{job.wo_no}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.customer || "-"}</TableCell>
                  <TableCell>{job.category || "-"}</TableCell>
                  <TableCell>{job.qty || "-"}</TableCell>
                  <TableCell>{formatDate(job.due_date)}</TableCell>
                  <TableCell>{job.location || "-"}</TableCell>
                  <TableCell>{job.rep || "-"}</TableCell>
                  <TableCell>{job.reference || "-"}</TableCell>
                  <TableCell>
                    {job.qr_code_url ? (
                      <QrCode className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.qr_code_url && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(job.qr_code_url!, '_blank')}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
