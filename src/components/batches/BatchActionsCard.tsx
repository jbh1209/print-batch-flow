
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BatchDetailsType } from "./types/BatchTypes";

interface BatchActionsCardProps {
  batch: BatchDetailsType;
  handleViewPDF: (url: string | null) => void;
}

const BatchActionsCard = ({ batch, handleViewPDF }: BatchActionsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Actions</CardTitle>
        <CardDescription>Manage your batch</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {batch.status !== "completed" && (
          <Button 
            className="w-full flex items-center gap-2"
            variant={batch.status === "pending" ? "default" : "outline"}
            disabled={batch.status === "completed"}
          >
            <CheckCircle2 className="h-4 w-4" />
            {batch.status === "pending" ? "Mark as Processing" : "Mark as Completed"}
          </Button>
        )}
        
        {(batch.front_pdf_url || batch.back_pdf_url) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Download PDFs</p>
            <div className="flex flex-col gap-2">
              {batch.front_pdf_url && (
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPDF(batch.front_pdf_url)}
                  className="flex items-center justify-start gap-2"
                >
                  <Download className="h-4 w-4" />
                  Front PDF
                </Button>
              )}
              {batch.back_pdf_url && (
                <Button 
                  variant="outline" 
                  onClick={() => handleViewPDF(batch.back_pdf_url)}
                  className="flex items-center justify-start gap-2"
                >
                  <Download className="h-4 w-4" />
                  Back PDF
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BatchActionsCard;
