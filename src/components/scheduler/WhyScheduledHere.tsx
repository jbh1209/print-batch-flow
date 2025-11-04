/**
 * WhyScheduledHere Component
 * Explainer popover showing why a stage was scheduled at a specific time
 */

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, Clock, Calendar, Activity } from "lucide-react";

interface SchedulingFactors {
  predecessorFinish?: string;
  resourceAvailable?: string;
  alignmentDate?: string;
  gapFilled?: boolean;
  daysSaved?: number;
  windowId?: string;
}

interface WhyScheduledHereProps {
  stageId: string;
  stageName: string;
  scheduledStart: string;
  factors: SchedulingFactors;
}

export function WhyScheduledHere({ stageId, stageName, scheduledStart, factors }: WhyScheduledHereProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold mb-1">Why scheduled here?</h4>
            <p className="text-sm text-muted-foreground font-mono">{stageName}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Scheduled Start</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(scheduledStart).toLocaleString()}
                </p>
              </div>
            </div>

            {factors.predecessorFinish && (
              <div className="flex items-start gap-2">
                <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">After Predecessor</p>
                  <p className="text-xs text-muted-foreground">
                    Previous stage completes: {new Date(factors.predecessorFinish).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {factors.resourceAvailable && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Resource Available</p>
                  <p className="text-xs text-muted-foreground">
                    Machine free from: {new Date(factors.resourceAvailable).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {factors.gapFilled && factors.daysSaved && (
              <div className="flex items-start gap-2">
                <Badge variant="default" className="mt-0.5">Gap Fill</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Optimized Placement</p>
                  <p className="text-xs text-muted-foreground">
                    Moved earlier, saved {factors.daysSaved.toFixed(1)} days
                  </p>
                  {factors.windowId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Window: {factors.windowId.slice(0, 8)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {factors.alignmentDate && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Alignment Constraint</p>
                  <p className="text-xs text-muted-foreground">
                    Cannot start before: {new Date(factors.alignmentDate).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Scheduling considers FIFO order, dependencies, resource availability, and gap-filling opportunities.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
