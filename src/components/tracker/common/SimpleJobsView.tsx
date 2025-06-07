
import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useSimpleJobAccess } from "@/hooks/tracker/useSimpleJobAccess";
import { useSimpleStageActions } from "@/hooks/tracker/useSimpleStageActions";
import { SimpleJobCard } from "@/components/tracker/factory/SimpleJobCard";

interface SimpleJobsViewProps {
  statusFilter?: string;
  stageFilter?: string;
  searchQuery?: string;
  title?: string;
  subtitle?: string;
  groupByStage?: boolean;
}

export const SimpleJobsView: React.FC<SimpleJobsViewProps> = ({
  statusFilter,
  stageFilter,
  searchQuery,
  title = "Jobs",
  subtitle = "Your accessible jobs",
  groupByStage = false
}) => {
  const { jobs, isLoading, error, refreshJobs } = useSimpleJobAccess({
    statusFilter,
    stageFilter,
    searchQuery
  });
  
  const { startStage, completeStage, isProcessing } = useSimpleStageActions(refreshJobs);

  // Fetch jobs on mount and when filters change
  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  // Group jobs by stage if needed
  const groupedJobs = useMemo(() => {
    if (!groupByStage) {
      return { 'All Jobs': jobs };
    }

    const grouped: Record<string, typeof jobs> = {};
    jobs.forEach(job => {
      const key = job.stage_name;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(job);
    });

    return grouped;
  }, [jobs, groupByStage]);

  const handleStartStage = async (stageInstanceId: string) => {
    await startStage(stageInstanceId);
  };

  const handleCompleteStage = async (stageInstanceId: string) => {
    await completeStage(stageInstanceId);
  };

  const handleSendProof = async (stageInstanceId: string) => {
    console.log('Send proof for stage instance:', stageInstanceId);
    // Proof functionality will be handled separately
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Jobs</h2>
          <p className="text-red-600 text-center mb-4">{error}</p>
          <Button onClick={refreshJobs} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
          <p className="text-sm text-gray-500 mt-1">
            Found {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Button onClick={refreshJobs} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs */}
      {jobs.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedJobs).map(([groupKey, groupJobs]) => (
            <div key={groupKey}>
              {groupByStage && groupJobs.length > 0 && (
                <Card className="mb-4">
                  <CardHeader 
                    className="text-white"
                    style={{ backgroundColor: groupJobs[0]?.stage_color || '#6B7280' }}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <span>{groupJobs[0]?.stage_name || 'Unknown Stage'}</span>
                      <Badge variant="secondary" className="bg-white/20 text-white">
                        {groupJobs.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupJobs.map(job => (
                        <SimpleJobCard
                          key={job.id}
                          job={job}
                          onStart={handleStartStage}
                          onComplete={handleCompleteStage}
                          onSendProof={handleSendProof}
                          isProcessing={isProcessing}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {!groupByStage && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupJobs.map(job => (
                    <SimpleJobCard
                      key={job.id}
                      job={job}
                      onStart={handleStartStage}
                      onComplete={handleCompleteStage}
                      onSendProof={handleSendProof}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Jobs Found</h3>
            <p className="text-gray-600 text-center">
              No jobs match your current filters or access permissions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
