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
import { Target, Clock, Workflow, ListOrdered, AlertTriangle } from "lucide-react";
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Why Scheduled Here? 🎯
          </DialogTitle>
          <DialogDescription>
            Complete scheduling analysis for {diagnostics?.workOrder}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : diagnostics ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Why Scheduled Here? 🎯</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Work Order:</span>
                  <p className="font-medium">{diagnostics.workOrder}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stage:</span>
                  <p className="font-medium">{diagnostics.stageName} {diagnostics.partAssignment && `(${diagnostics.partAssignment})`}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">{diagnostics.duration} minutes</p>
                </div>
                <div>
                  <span className="text-muted-foreground">FIFO Position:</span>
                  <p className="font-medium">{diagnostics.fifoPosition.position} of {diagnostics.fifoPosition.totalInQueue}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-secondary flex items-center gap-2">
                <Clock className="h-4 w-4" />
                ⏰ The Math Behind This Time
              </h3>
              <div className="space-y-3 text-sm bg-muted/30 p-4 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Actual Start Time:</span>
                  <span className="text-lg font-bold text-primary">
                    {new Date(diagnostics.actualStartTime).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground border-t pt-2">
                  <p><strong>Formula:</strong> MAX(Part Ready Time, Machine Available Time)</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Part Ready Time:</span>
                  <span className="font-medium text-blue-600">
                    {new Date(diagnostics.eligibleTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Machine Available:</span>
                  <span className="font-medium text-green-600">
                    {new Date(diagnostics.resourceAvailableTime).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {diagnostics.partBarriers && Object.keys(diagnostics.partBarriers).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-orange-600 flex items-center gap-2">
                  <Workflow className="h-4 w-4" />
                  🔄 Part Barriers (Parallel Processing)
                </h3>
                <div className="space-y-2 text-sm">
                  {diagnostics.partBarriers.coverBarrier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cover Part Ready:</span>
                      <span className="font-medium text-orange-600">
                        {new Date(diagnostics.partBarriers.coverBarrier).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {diagnostics.partBarriers.textBarrier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Text Part Ready:</span>
                      <span className="font-medium text-purple-600">
                        {new Date(diagnostics.partBarriers.textBarrier).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {diagnostics.partBarriers.convergencePoint && (
                    <div className="flex justify-between bg-yellow-50 p-2 rounded">
                      <span className="text-muted-foreground">Convergence Point:</span>
                      <span className="font-bold text-yellow-700">
                        {new Date(diagnostics.partBarriers.convergencePoint).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <ListOrdered className="h-4 w-4" />
                📊 FIFO Queue Analysis
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job Approved:</span>
                  <span className="font-medium">
                    {new Date(diagnostics.fifoPosition.approvalTime).toLocaleString()}
                  </span>
                </div>
                {diagnostics.fifoPosition.queuedBehind.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Queued Behind:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {diagnostics.fifoPosition.queuedBehind.map((wo, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{wo}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {diagnostics.upstreamDependencies.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  ⬆️ What Was This Stage Waiting For?
                </h3>
                <div className="space-y-2">
                  {diagnostics.upstreamDependencies.map((dep, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded border ${
                      dep.isBlocking ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                    }`}>
                      <div>
                        <span className={`text-sm font-medium ${dep.isBlocking ? 'text-red-700' : 'text-green-700'}`}>
                          {dep.stageName} {dep.partAssignment && `(${dep.partAssignment})`}
                        </span>
                        <p className="text-xs text-muted-foreground">{dep.reason}</p>
                      </div>
                      <Badge variant={dep.isBlocking ? 'destructive' : 'default'} className="text-xs">
                        {dep.isBlocking ? 'BLOCKING' : 'READY'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diagnostics.competingJobs && diagnostics.competingJobs.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">🏁 Competing Jobs (Same Resource)</h3>
                <div className="space-y-2">
                  {diagnostics.competingJobs.map((job, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{job.workOrder} - {job.stageName}</span>
                      <span className="text-xs text-muted-foreground">{job.wouldHaveStarted}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded">
              <h4 className="font-medium text-blue-800 mb-2">💡 Understanding the Schedule</h4>
              <p className="text-sm text-blue-700">
                This job started at <strong>{new Date(diagnostics.actualStartTime).toLocaleString()}</strong> because:
                <br />• It was the earliest time when both the part was ready AND the machine was free
                <br />• Cover/text parts can run in parallel on different machines 
                <br />• Jobs are scheduled in FIFO order by approval time
                <br />• Working hours: {diagnostics.workingHoursContext.shiftStart}-{diagnostics.workingHoursContext.shiftEnd}
              </p>
            </div>
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