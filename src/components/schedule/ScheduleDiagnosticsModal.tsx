import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ScheduleDiagnostics } from "@/hooks/useScheduleDiagnostics";

interface ScheduleDiagnosticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: ScheduleDiagnostics;
  isLoading: boolean;
}

export function ScheduleDiagnosticsModal({
  open,
  onOpenChange,
  diagnostics,
  isLoading
}: ScheduleDiagnosticsModalProps) {
  const hasIssues = diagnostics.missing.length > 0 || diagnostics.extra.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Diagnostics</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Eligible Jobs</div>
                <div className="text-2xl font-bold">{diagnostics.eligible.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Approved & incomplete
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Scheduled Jobs</div>
                <div className="text-2xl font-bold">{diagnostics.scheduled.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Currently on board
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="p-4 border rounded-lg">
              {!hasIssues ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Perfect match! All eligible jobs are scheduled.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    Schedule mismatch detected: {diagnostics.missing.length} missing, {diagnostics.extra.length} extra
                  </span>
                </div>
              )}
            </div>

            {/* Missing Jobs */}
            {diagnostics.missing.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold">Missing from Schedule ({diagnostics.missing.length})</h3>
                </div>
                <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                  <p className="text-sm text-muted-foreground mb-2">
                    These jobs are proof-approved and incomplete but NOT scheduled:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {diagnostics.missing.map(job => (
                      <Badge key={job.id} variant="destructive">
                        {job.wo_no}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Extra Jobs */}
            {diagnostics.extra.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold">Extra on Schedule ({diagnostics.extra.length})</h3>
                </div>
                <div className="p-3 border border-amber-200 rounded-lg bg-amber-50">
                  <p className="text-sm text-muted-foreground mb-2">
                    These jobs are scheduled but should NOT be (unapproved or completed):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {diagnostics.extra.map(job => (
                      <Badge key={job.id} variant="outline" className="border-amber-500">
                        {job.wo_no}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* All Eligible (for reference) */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">
                All Eligible Jobs (FIFO order)
              </h3>
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {diagnostics.eligible.map(job => (
                    <Badge key={job.id} variant="secondary">
                      {job.wo_no}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
