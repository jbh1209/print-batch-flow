/**
 * ValidationResults Component
 * Displays scheduling validation violations with per-job drill-down
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";
import { SchedulerValidation } from "@/types/scheduler";

interface ValidationResultsProps {
  violations: SchedulerValidation[];
}

export function ValidationResults({ violations }: ValidationResultsProps) {
  if (violations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            All Validations Passed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No precedence violations detected in the schedule.</p>
        </CardContent>
      </Card>
    );
  }

  // Group violations by job_id
  const violationsByJob = violations.reduce((acc, v) => {
    if (!acc[v.job_id]) acc[v.job_id] = [];
    acc[v.job_id].push(v);
    return acc;
  }, {} as Record<string, SchedulerValidation[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Validation Notes ({violations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          These are informational notes, often normal for parallel processing (cover/text stages).
        </p>
        
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(violationsByJob).map(([jobId, jobViolations]) => (
            <AccordionItem key={jobId} value={jobId}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{jobId.slice(0, 8)}...</span>
                  <Badge variant="outline">{jobViolations.length} notes</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {jobViolations.map((v, idx) => (
                    <div key={idx} className="border-l-2 border-warning/50 pl-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">{v.violation_type}</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Stage {v.stage1_order}:</span>
                          <span className="font-medium">{v.stage1_name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Stage {v.stage2_order}:</span>
                          <span className="font-medium">{v.stage2_name}</span>
                        </div>
                        {v.violation_details && (
                          <p className="text-muted-foreground text-xs mt-2">{v.violation_details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
