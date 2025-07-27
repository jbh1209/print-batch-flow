import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { findDuplicateJobs, mergeDuplicateJobs, normalizeAllWONumbers, DuplicateJobInfo } from "@/utils/jobDeduplication";
import { toast } from "sonner";

export const DuplicateJobManager: React.FC = () => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateJobInfo[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

  const loadDuplicates = async () => {
    setIsLoading(true);
    const duplicates = await findDuplicateJobs();
    setDuplicateGroups(duplicates);
    setIsLoading(false);
  };

  const handleNormalizeWONumbers = async () => {
    setIsNormalizing(true);
    const success = await normalizeAllWONumbers();
    if (success) {
      await loadDuplicates();
    }
    setIsNormalizing(false);
  };

  const handleMergeDuplicates = async (group: DuplicateJobInfo[]) => {
    // Keep the oldest job (first in the sorted array)
    const jobToKeep = group[0];
    const jobsToRemove = group.slice(1).map(job => job.id);
    
    const success = await mergeDuplicateJobs([...jobsToRemove, jobToKeep.id], jobToKeep.id);
    if (success) {
      await loadDuplicates();
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Checking for duplicates...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Duplicate Job Manager
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleNormalizeWONumbers}
                disabled={isNormalizing}
              >
                {isNormalizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Normalizing...
                  </>
                ) : (
                  'Normalize WO Numbers'
                )}
              </Button>
              <Button variant="outline" onClick={loadDuplicates}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No duplicate jobs found! 🎉
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <Badge variant="destructive">
                  {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found
                </Badge>
              </div>
              
              {duplicateGroups.map((group, groupIndex) => (
                <Card key={groupIndex} className="border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        WO: {group[0].wo_no} ({group.length} duplicates)
                      </h4>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleMergeDuplicates(group)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Merge (Keep Oldest)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.map((job, jobIndex) => (
                        <div key={job.id} className={`flex items-center justify-between p-2 rounded ${jobIndex === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div>
                            <span className="font-medium">{job.wo_no}</span>
                            <span className="text-gray-600 ml-2">• {job.customer}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <Badge variant={jobIndex === 0 ? "default" : "secondary"}>
                            {jobIndex === 0 ? "Keep" : "Remove"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
