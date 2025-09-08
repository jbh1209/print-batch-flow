
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowAnalyticsDashboard } from "@/components/tracker/analytics/WorkflowAnalyticsDashboard";
import { SupervisorPerformanceDashboard } from "@/components/tracker/analytics/SupervisorPerformanceDashboard";

const TrackerAnalytics = () => {
  return (
    <div className="p-6">
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="workflow">Workflow Analytics</TabsTrigger>
          <TabsTrigger value="performance">Performance Tracking</TabsTrigger>
        </TabsList>
        
        <TabsContent value="workflow" className="space-y-4">
          <WorkflowAnalyticsDashboard />
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <SupervisorPerformanceDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerAnalytics;
