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
      
      // 🚨 EMERGENCY FIX: Enhanced logging to verify function calls
      console.log("🔧 ADMIN SCHEDULER: Starting parallel-auto-scheduler run...");
      
      // Get all jobs that need scheduling
      const { data: jobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, status')
        .in('status', ['pending', 'Pre-Press', 'Ready for Batch']);
      
      if (jobsError) {
        console.error("❌ Failed to fetch jobs:", jobsError);
        throw jobsError;
      }
      
      let scheduledCount = 0;
      let checkedCount = jobs?.length || 0;
      
      console.log(`📋 Found ${checkedCount} jobs to schedule:`, jobs?.map(j => `${j.wo_no} (${j.status})`));
      
      // Schedule each job using the NEW parallel scheduler
      for (const job of jobs || []) {
        try {
          console.log(`🎯 Invoking parallel-auto-scheduler for job ${job.wo_no} (${job.id})`);
          
          const { data, error } = await supabase.functions.invoke("scheduler", {
            body: {
              jobId: job.id,
              jobTableName: 'production_jobs'
            }
          });
          
          console.log(`📊 Scheduler response for ${job.wo_no}:`, { data, error });
          
          if (!error && data?.success) {
            scheduledCount++;
            console.log(`✅ Successfully scheduled job ${job.wo_no}`);
          } else {
            console.warn(`⚠️ Scheduler returned error for ${job.wo_no}:`, error || data);
          }
        } catch (jobError) {
          console.error(`❌ Exception scheduling job ${job.wo_no}:`, jobError);
        }
      }
      
      console.log(`🏁 SCHEDULER COMPLETE: checked ${checkedCount}, scheduled ${scheduledCount}`);
      toast.success(`Auto-scheduler complete: checked ${checkedCount}, scheduled ${scheduledCount}`);
    } catch (err: any) {
      console.error("💥 SCHEDULER FAILED:", err);
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
