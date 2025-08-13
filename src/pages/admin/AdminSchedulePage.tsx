import React, { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { ProductionPlanningCalendar } from "@/components/production/ProductionPlanningCalendar";
import { StageWeeklyScheduler } from "@/components/production/StageWeeklyScheduler";
import { WorkingHoursManager } from "@/components/admin/WorkingHoursManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminHeader from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const AdminSchedulePage: React.FC = () => {
  const { isAdmin, isLoading } = useAdminAuth();

  useEffect(() => {
    document.title = "Admin Schedule Board | Weekly Production";
  }, []);

  const [isRunning, setIsRunning] = useState(false);
  const runAutoScheduler = async () => {
    try {
      setIsRunning(true);
      
      // Get all jobs that need scheduling
      const { data: jobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, status')
        .in('status', ['pending', 'Pre-Press', 'Ready for Batch']);
      
      if (jobsError) throw jobsError;
      
      let scheduledCount = 0;
      let checkedCount = jobs?.length || 0;
      
      console.log(`Found ${checkedCount} jobs to schedule:`, jobs);
      
      // Schedule each job using the new scheduler
      for (const job of jobs || []) {
        try {
          const { data, error } = await supabase.functions.invoke("auto-scheduler", {
            body: {
              job_id: job.id,
              job_table_name: 'production_jobs',
              trigger_reason: 'admin_expedite'
            }
          });
          
          if (!error && data?.success) {
            scheduledCount++;
          }
        } catch (jobError) {
          console.warn(`Failed to schedule job ${job.id}:`, jobError);
        }
      }
      
      toast.success(`Auto-scheduler complete: checked ${checkedCount}, scheduled ${scheduledCount}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to run auto-scheduler");
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <AccessRestrictedMessage />
      </div>
    );
  }

  return (
    <div className="p-6">
      <AdminHeader
        title="Weekly Schedule Board"
        subtitle="Stage-centric planner showing active stages for the selected week."
      />

      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="secondary" onClick={runAutoScheduler} disabled={isRunning} aria-label="Run auto-scheduler">
          {isRunning ? "Running..." : "Run auto-scheduler"}
        </Button>
      </div>

      <main>
        <Tabs defaultValue="stages">
          <TabsList>
            <TabsTrigger value="stages">Stage Planner</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          </TabsList>
          <TabsContent value="stages">
            <StageWeeklyScheduler />
          </TabsContent>
          <TabsContent value="calendar">
            <ProductionPlanningCalendar />
          </TabsContent>
          <TabsContent value="working-hours">
            <WorkingHoursManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminSchedulePage;
