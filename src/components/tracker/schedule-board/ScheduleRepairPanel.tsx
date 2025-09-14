/**
 * Emergency schedule repair panel
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wrench, RefreshCw, CheckCircle, Search } from "lucide-react";
import { useScheduleRepair } from "@/hooks/useScheduleRepair";
import { format } from "date-fns";

export function ScheduleRepairPanel() {
  const { isLoading, violations, findViolations, repairViolations, fullRepairAndReschedule } = useScheduleRepair();
  const [showViolations, setShowViolations] = useState(false);

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Schedule Repair Center
        </CardTitle>
        <CardDescription>
          Emergency tools to detect and fix scheduling precedence violations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={findViolations}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Check for Violations
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={repairViolations}
            disabled={isLoading || violations.length === 0}
            className="flex items-center gap-2"
          >
            <Wrench className="h-4 w-4" />
            Repair Violations ({violations.length})
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={fullRepairAndReschedule}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Emergency: Repair & Reschedule All
          </Button>
        </div>

        {/* Violations Summary */}
        {violations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {violations.length} Violations Found
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowViolations(!showViolations)}
              >
                {showViolations ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>

            {showViolations && (
              <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-muted rounded-md">
                {violations.map((violation, index) => (
                  <div key={index} className="text-sm space-y-1 p-2 bg-background rounded border">
                    <div className="font-medium">
                      Job: {violation.job_id.slice(0, 8)}...
                    </div>
                    <div className="text-muted-foreground">
                      Stage {violation.stage_order} starts at{' '}
                      {format(new Date(violation.slot_start_time), 'MMM dd, HH:mm')}
                    </div>
                    <div className="text-destructive text-xs">
                      But predecessor (stage {violation.predecessor_stage_order}) doesn't finish until{' '}
                      {format(new Date(violation.predecessor_end_time), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {violations.length === 0 && !isLoading && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">No precedence violations detected</span>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
          <strong>How to use:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li><strong>Check for Violations:</strong> Scan for stages scheduled before their predecessors</li>
            <li><strong>Repair Violations:</strong> Clear bad time slots and reset affected stages to unscheduled</li>
            <li><strong>Emergency Repair & Reschedule:</strong> Full repair + complete reschedule (recommended)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}