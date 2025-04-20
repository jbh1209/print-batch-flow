
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { format } from "date-fns";

interface TimelineCardProps {
  dueDate: string;
  batchId?: string;
  onViewPDF: () => void;
}

export const TimelineCard = ({
  dueDate,
  batchId,
  onViewPDF
}: TimelineCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <CardDescription>Due date and scheduling</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Due Date:</span>
            <span>{format(new Date(dueDate), 'PPP')}</span>
          </div>
          {batchId && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-500">Batch ID:</span>
              <span className="font-mono text-xs">{batchId}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={onViewPDF}
        >
          <FileText size={16} />
          <span>View PDF</span>
        </Button>
      </CardFooter>
    </Card>
  );
};
