/**
 * Job Diagnostics Modal - "Why is this job scheduled here?"
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Target, Users, ArrowRight } from "lucide-react";
import type { JobDiagnostics } from "@/hooks/useJobDiagnostics";

interface JobDiagnosticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: JobDiagnostics | null;
  isLoading: boolean;
}

export function JobDiagnosticsModal({
  open,
  onOpenChange,
  diagnostics,
  isLoading
}: JobDiagnosticsModalProps) {
  if (!diagnostics && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Job Scheduling Diagnostics
          </DialogTitle>
          <DialogDescription>
            Understanding why this job is scheduled at this time
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : diagnostics ? (
          <div className="space-y-6">
            {/* Job Overview */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{diagnostics.woNo}</h3>
                <Badge variant="outline">
                  {diagnostics.stageName}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Stage Order:</span> #{diagnostics.stageOrder}
                </div>
                <div>
                  <span className="font-medium">Part:</span> {diagnostics.partAssignment || 'All'}
                </div>
                <div>
                  <span className="font-medium">Duration:</span> {diagnostics.estimatedDuration}min
                </div>
                <div>
                  <span className="font-medium">FIFO Position:</span> #{diagnostics.fifoPosition}
                </div>
              </div>
            </div>

            {/* Timing Analysis */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timing Analysis
              </h4>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Scheduled Start:</span>
                  <Badge variant="secondary">
                    {new Date(diagnostics.scheduledStart).toLocaleString()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Scheduled End:</span>
                  <Badge variant="secondary">
                    {new Date(diagnostics.scheduledEnd).toLocaleString()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Working Hours Context:</span>
                  <Badge variant={diagnostics.workingHoursContext.includes('Normal') ? 'default' : 'outline'}>
                    {diagnostics.workingHoursContext}
                  </Badge>
                </div>
                {diagnostics.isHoliday && (
                  <div className="flex justify-between items-center">
                    <span>Holiday/Weekend:</span>
                    <Badge variant="destructive">Yes</Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Barrier Analysis */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduling Barriers
              </h4>
              <div className="space-y-2 text-sm">
                {diagnostics.jobBarrier && (
                  <div className="flex justify-between items-center">
                    <span>Job Approved At:</span>
                    <Badge variant="outline">
                      {new Date(diagnostics.jobBarrier).toLocaleString()}
                    </Badge>
                  </div>
                )}
                {diagnostics.eligibleTime && (
                  <div className="flex justify-between items-center">
                    <span>Eligible Time:</span>
                    <Badge variant="outline">
                      {new Date(diagnostics.eligibleTime).toLocaleString()}
                    </Badge>
                  </div>
                )}
                {diagnostics.resourceAvailableTime && (
                  <div className="flex justify-between items-center">
                    <span>Resource Available:</span>
                    <Badge variant="outline">
                      {new Date(diagnostics.resourceAvailableTime).toLocaleString()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Dependencies */}
            {diagnostics.upstreamDependencies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Upstream Dependencies
                </h4>
                <div className="space-y-1">
                  {diagnostics.upstreamDependencies.map((dep, index) => (
                    <div key={index} className="text-sm p-2 bg-muted/30 rounded">
                      {dep}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competing Jobs */}
            {diagnostics.competingJobs.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Competing Jobs (Same Stage, Same Day)
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {diagnostics.competingJobs.map((job, index) => (
                    <div key={index} className="text-sm p-2 bg-muted/30 rounded">
                      {job}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No diagnostics data available
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}