
import { FileText, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JobStatusBadge from "@/components/JobStatusBadge";
import { Job } from "./types/BatchTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface RelatedJobsCardProps {
  jobs: Job[];
}

const RelatedJobsCard = ({ jobs }: RelatedJobsCardProps) => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Related Jobs</CardTitle>
        <CardDescription>Jobs included in this batch</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.name}</TableCell>
                <TableCell>{job.quantity}</TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell className="text-right">
                  {job.pdf_url && (
                    <div className="flex justify-end items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handlePdfAction(job.pdf_url, 'view')}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View PDF</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handlePdfAction(job.pdf_url, 'download', `${job.name}.pdf`)}
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Download PDF</span>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RelatedJobsCard;
