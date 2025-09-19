
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Settings, CheckCircle } from 'lucide-react';
import { findLostJobs, recoverLostJob } from '@/utils/batch/batchIntegrationService';
import { toast } from 'sonner';

interface LostJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  batch_category?: string;
  batch_allocated_at?: string;
  updated_at: string;
}

export const LostJobRecovery: React.FC = () => {
  const [lostJobs, setLostJobs] = useState<LostJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState<string | null>(null);
  const [recoveredJobs, setRecoveredJobs] = useState<Set<string>>(new Set());

  const loadLostJobs = async () => {
    setIsLoading(true);
    try {
      const jobs = await findLostJobs();
      setLostJobs(jobs);
      console.log(`Found ${jobs.length} lost jobs`);
    } catch (error) {
      console.error('Error loading lost jobs:', error);
      toast.error('Failed to load lost jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverJob = async (jobId: string) => {
    setIsRecovering(jobId);
    try {
      const success = await recoverLostJob(jobId);
      if (success) {
        toast.success('Job recovered successfully');
        setRecoveredJobs(prev => new Set([...prev, jobId]));
        // Refresh the list
        loadLostJobs();
      } else {
        toast.error('Failed to recover job');
      }
    } catch (error) {
      console.error('Error recovering job:', error);
      toast.error('Error recovering job');
    } finally {
      setIsRecovering(null);
    }
  };

  const handleRecoverAll = async () => {
    const unrecoveredJobs = lostJobs.filter(job => !recoveredJobs.has(job.id));
    
    for (const job of unrecoveredJobs) {
      await handleRecoverJob(job.id);
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  useEffect(() => {
    loadLostJobs();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Lost Job Recovery
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Jobs that are stuck between Production Tracker and Printstream
          </p>
          <Button
            onClick={loadLostJobs}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lostJobs.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Lost Jobs Found</h3>
            <p className="text-gray-600">All jobs are properly tracked between systems</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="destructive">
                {lostJobs.length} Lost Job{lostJobs.length !== 1 ? 's' : ''}
              </Badge>
              <Button
                onClick={handleRecoverAll}
                disabled={isRecovering !== null}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Recover All
              </Button>
            </div>

            <div className="space-y-3">
              {lostJobs.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 border rounded-lg ${
                    recoveredJobs.has(job.id) 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{job.wo_no}</h4>
                        {recoveredJobs.has(job.id) && (
                          <Badge className="bg-green-100 text-green-800">
                            Recovered
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>Customer: {job.customer}</div>
                        <div>Status: {job.status}</div>
                        {job.batch_category && (
                          <div>Batch Category: {job.batch_category}</div>
                        )}
                        <div>
                          Lost Since: {new Date(job.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    {!recoveredJobs.has(job.id) && (
                      <Button
                        onClick={() => handleRecoverJob(job.id)}
                        disabled={isRecovering === job.id}
                        variant="outline"
                        size="sm"
                      >
                        {isRecovering === job.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
                        Recover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
