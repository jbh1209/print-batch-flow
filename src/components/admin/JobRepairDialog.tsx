import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobRepairUtility, type JobRepairResult } from "@/utils/jobRepairUtility";
import { toast } from "sonner";
import { Wrench, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export const JobRepairDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<JobRepairResult | null>(null);
  const [suspiciousJobs, setSuspiciousJobs] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRepairStageSpecs = async () => {
    setIsRepairing(true);
    try {
      const result = await JobRepairUtility.repairMissingStageSpecifications();
      setRepairResult(result);
      
      if (result.success) {
        toast.success(`Repaired ${result.repairedJobs} job stage specifications`);
      } else {
        toast.error(`Repair completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      console.error('Repair failed:', error);
      toast.error('Repair operation failed');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleAnalyzeTiming = async () => {
    setIsAnalyzing(true);
    try {
      const suspicious = await JobRepairUtility.findJobsWithSuspiciousTiming();
      setSuspiciousJobs(suspicious);
      
      if (suspicious.length > 0) {
        toast.warning(`Found ${suspicious.length} jobs with suspicious timing estimates`);
      } else {
        toast.success('No suspicious timing estimates found');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Timing analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wrench className="h-4 w-4" />
          Job Repair Tools
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Job Repair & Analysis Tools
          </DialogTitle>
          <DialogDescription>
            Tools to fix timing calculation issues and analyze job data integrity.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Repair Missing Stage Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Fix Stage Specifications
              </CardTitle>
              <CardDescription>
                Repair job stage instances with missing stage_specification_id links that cause incorrect timing calculations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleRepairStageSpecs}
                disabled={isRepairing}
                className="w-full"
              >
                {isRepairing ? 'Repairing...' : 'Repair Missing Specifications'}
              </Button>
              
              {repairResult && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Processed:</span>
                    <Badge variant="secondary">{repairResult.totalProcessed}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Successfully Repaired:</span>
                    <Badge variant="default">{repairResult.repairedJobs}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Failed:</span>
                    <Badge variant="destructive">{repairResult.failedJobs}</Badge>
                  </div>
                  
                  {repairResult.errors.length > 0 && (
                    <ScrollArea className="h-24 border rounded p-2">
                      {repairResult.errors.map((error, idx) => (
                        <div key={idx} className="text-xs text-red-600">{error}</div>
                      ))}
                    </ScrollArea>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analyze Suspicious Timing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Analyze Timing Issues
              </CardTitle>
              <CardDescription>
                Find jobs with suspicious timing estimates that may be using default speeds instead of actual specifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleAnalyzeTiming}
                disabled={isAnalyzing}
                variant="outline"
                className="w-full"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Timing Estimates'}
              </Button>
              
              {suspiciousJobs.length > 0 && (
                <ScrollArea className="h-48 border rounded">
                  <div className="p-2 space-y-2">
                    {suspiciousJobs.map((job, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 bg-yellow-50 rounded">
                        <div>
                          <div className="font-medium">{job.woNo} - {job.stageName}</div>
                          <div className="text-gray-600">
                            {job.quantity} sheets → {job.estimatedMinutes} min
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          ~{job.calculatedSheetsPerHour} sheets/hr
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Repair Results */}
        {repairResult && repairResult.details.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detailed Repair Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {repairResult.details.map((detail, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-2 border rounded">
                      <div>
                        <div className="font-medium">{detail.woNo} - {detail.stageName}</div>
                        {detail.error && (
                          <div className="text-red-600 text-xs">{detail.error}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {detail.specificationFound ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        {detail.timingRecalculated ? (
                          <Clock className="h-4 w-4 text-blue-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};