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
  const [isUniversalScheduling, setIsUniversalScheduling] = useState(false);

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
          
          const { data, error } = await supabase.functions.invoke("parallel-auto-scheduler", {
            body: {
              job_id: job.id,
              job_table_name: 'production_jobs'
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

  const runUniversalScheduler = async () => {
    try {
      setIsUniversalScheduling(true);
      console.log("🌐 Starting Universal Container Scheduler...");
      
      const { data, error } = await supabase.functions.invoke("universal-scheduler");
      
      if (error) {
        console.error("❌ Universal scheduler error:", error);
        throw error;
      }
      
      const results = data?.results;
      console.log("✅ Universal scheduling complete:", results);
      
      toast.success(
        `Universal scheduling complete: ${results?.total_jobs_scheduled || 0} jobs scheduled across ${results?.total_stages_processed || 0} stages (${results?.total_split_jobs || 0} split jobs)`
      );
    } catch (err: any) {
      console.error("💥 UNIVERSAL SCHEDULER FAILED:", err);
      toast.error(err?.message || "Failed to run universal scheduler");
    } finally {
      setIsUniversalScheduling(false);
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

      <div className="mb-4 flex justify-end gap-2">
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={runAutoScheduler} 
          disabled={isRunning || isUniversalScheduling} 
          aria-label="Run auto-scheduler"
        >
          {isRunning ? "Running..." : "Run auto-scheduler"}
        </Button>
        <Button 
          size="sm" 
          variant="default" 
          onClick={runUniversalScheduler} 
          disabled={isRunning || isUniversalScheduling} 
          aria-label="Schedule all jobs universally"
        >
          {isUniversalScheduling ? "Scheduling All..." : "Schedule All Jobs"}
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
