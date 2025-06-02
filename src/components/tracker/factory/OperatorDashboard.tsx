
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { useAuth } from "@/hooks/useAuth";

export const OperatorDashboard = () => {
  const { user } = useAuth();
  const { accessibleStages, isLoading, canWorkWithStage } = useUserStagePermissions(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Add refresh logic here
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading operator dashboard...</span>
      </div>
    );
  }

  if (accessibleStages.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Stage Access</h2>
            <p className="text-gray-600 text-center">
              You don't have access to any production stages. Please contact your administrator to assign you to the appropriate user groups.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operator Dashboard</h1>
          <p className="text-gray-600">Manage your assigned production tasks</p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Accessible Stages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your Production Stages
            <Badge variant="outline">{accessibleStages.length} stages</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleStages.map((stage) => (
              <Card key={stage.stage_id} className="border-2 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.stage_color }}
                    />
                    <h3 className="font-medium">{stage.stage_name}</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {stage.can_view && (
                        <Badge variant="secondary" className="text-xs">View</Badge>
                      )}
                      {stage.can_edit && (
                        <Badge variant="secondary" className="text-xs">Edit</Badge>
                      )}
                      {stage.can_work && (
                        <Badge variant="default" className="text-xs">Work</Badge>
                      )}
                      {stage.can_manage && (
                        <Badge variant="destructive" className="text-xs">Manage</Badge>
                      )}
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        className="w-full"
                        disabled={!canWorkWithStage(stage.stage_id)}
                      >
                        View Jobs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending Jobs</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
