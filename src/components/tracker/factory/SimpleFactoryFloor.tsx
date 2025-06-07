
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
import { useSimpleFactoryJobs } from "@/hooks/tracker/useSimpleFactoryJobs";
import { useSimpleStageActions } from "@/hooks/tracker/useSimpleStageActions";
import { SimpleJobCard } from "./SimpleJobCard";
import ProofUploadDialog from "./ProofUploadDialog";

export const SimpleFactoryFloor = () => {
  const { jobs, isLoading, refreshJobs } = useSimpleFactoryJobs();
  const { startStage, completeStage, isProcessing } = useSimpleStageActions(refreshJobs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProofJob, setSelectedProofJob] = useState<string | null>(null);

  // Group jobs by stage
  const jobsByStage = useMemo(() => {
    const filtered = jobs.filter(job => 
      job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped: Record<string, typeof jobs> = {};
    filtered.forEach(job => {
      const key = `${job.stage_id}-${job.stage_name}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(job);
    });

    return grouped;
  }, [jobs, searchQuery]);

  const handleStartStage = async (stageInstanceId: string) => {
    await startStage(stageInstanceId);
  };

  const handleCompleteStage = async (stageInstanceId: string) => {
    await completeStage(stageInstanceId);
  };

  const handleSendProof = (stageInstanceId: string) => {
    setSelectedProofJob(stageInstanceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading jobs...</span>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Factory Floor</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button onClick={refreshJobs} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(jobsByStage).map(([stageKey, stageJobs]) => {
            const stageName = stageJobs[0]?.stage_name || 'Unknown Stage';
            const stageColor = stageJobs[0]?.stage_color || '#6B7280';
            
            return (
              <Card key={stageKey} className="h-fit">
                <CardHeader 
                  className="text-white"
                  style={{ backgroundColor: stageColor }}
                >
                  <CardTitle className="flex items-center justify-between">
                    <span>{stageName}</span>
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      {stageJobs.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {stageJobs.map(job => (
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
            );
          })}
        </div>
      </div>

      {/* Proof Upload Dialog */}
      {selectedProofJob && (
        <ProofUploadDialog
          isOpen={true}
          onClose={() => setSelectedProofJob(null)}
          stageInstanceId={selectedProofJob}
          onProofSent={() => {
            setSelectedProofJob(null);
            refreshJobs();
          }}
        />
      )}
    </div>
  );
};
