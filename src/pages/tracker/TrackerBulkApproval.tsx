import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ApprovalResult {
  woNo: string;
  success: boolean;
  error?: string;
}

interface BulkApprovalResponse {
  processed: number;
  failed: number;
  total: number;
  results: ApprovalResult[];
  message: string;
}

const TrackerBulkApproval = () => {
  const [startNum, setStartNum] = useState("");
  const [endNum, setEndNum] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState("");
  const [results, setResults] = useState<BulkApprovalResponse | null>(null);

  const handleBulkApproval = async () => {
    const start = parseInt(startNum);
    const end = parseInt(endNum);

    if (isNaN(start) || isNaN(end)) {
      toast.error("Please enter valid order numbers");
      return;
    }

    if (start > end) {
      toast.error("Start number must be less than or equal to end number");
      return;
    }

    const totalJobs = end - start + 1;
    if (totalJobs > 200) {
      toast.error("Maximum 200 jobs per batch. Please use a smaller range.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);
    setCurrentJob(`D${start}`);

    try {
      console.log("🚀 Starting bulk approval:", { start, end });
      
      const { data, error } = await supabase.functions.invoke('bulk-approve-jobs', {
        body: { 
          startOrderNum: start, 
          endOrderNum: end 
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error(`Failed to process jobs: ${error.message}`);
        return;
      }

      console.log("✅ Bulk approval response:", data);
      
      setResults(data as BulkApprovalResponse);
      setProgress(100);
      
      if (data.failed === 0) {
        toast.success(`Successfully processed all ${data.processed} jobs!`);
      } else {
        toast.warning(`Processed ${data.processed} jobs. ${data.failed} failed.`);
      }

    } catch (error) {
      console.error("Bulk approval error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsProcessing(false);
      setCurrentJob("");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Proof Approval</h1>
        <p className="text-muted-foreground mt-2">
          Approve multiple jobs at once by entering a range of order numbers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Range</CardTitle>
          <CardDescription>
            Enter the start and end order numbers (without the 'D' prefix)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Order Number</label>
              <Input
                type="number"
                placeholder="e.g., 428300"
                value={startNum}
                onChange={(e) => setStartNum(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Order Number</label>
              <Input
                type="number"
                placeholder="e.g., 428400"
                value={endNum}
                onChange={(e) => setEndNum(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Button
              onClick={handleBulkApproval}
              disabled={isProcessing || !startNum || !endNum}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start Bulk Approval"
              )}
            </Button>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing {currentJob}...</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This may take several minutes. Each job is processed with a 3-second delay.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>{results.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{results.processed}</p>
                    <p className="text-sm text-muted-foreground">Processed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{results.failed}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{results.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>

              {results.failed > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Failed Jobs:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {results.results
                      .filter((r) => !r.success)
                      .map((result) => (
                        <div
                          key={result.woNo}
                          className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm"
                        >
                          <span className="font-medium">{result.woNo}</span>
                          <span className="text-red-600 dark:text-red-400">
                            {result.error || "Unknown error"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {results.processed > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Successful Jobs:</h4>
                  <div className="max-h-60 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {results.results
                        .filter((r) => r.success)
                        .map((result) => (
                          <div
                            key={result.woNo}
                            className="px-2 py-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded text-sm"
                          >
                            {result.woNo}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrackerBulkApproval;
