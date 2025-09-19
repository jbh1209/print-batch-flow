
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface JobNotesCardProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const JobNotesCard: React.FC<JobNotesCardProps> = ({ 
  notes, 
  onNotesChange 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add notes about your work on this job..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[100px]"
          autoFocus={false}
          onFocus={(e) => {
            // Only focus if user explicitly clicked on the textarea
            if (e.target !== document.activeElement) {
              e.target.blur();
            }
          }}
        />
      </CardContent>
    </Card>
  );
};
