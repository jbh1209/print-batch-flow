import React, { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { ProductionPlanningCalendar } from "@/components/production/ProductionPlanningCalendar";
import { StageWeeklyScheduler } from "@/components/production/StageWeeklyScheduler";
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
  const [isResetting, setIsResetting] = useState(false);
  const runAutoScheduler = async () => {
    try {
      setIsRunning(true);
      const { data, error } = await supabase.functions.invoke("auto-schedule-approved", { body: {} });
      if (error) throw error;
      const d = (data as any) || {};
      toast.success(`Auto-scheduler complete: checked ${d.checked ?? 0}, scheduled ${d.scheduled ?? 0}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to run auto-scheduler");
    } finally {
      setIsRunning(false);
    }
  };

  const resetCapacity = async () => {
    try {
      setIsResetting(true);
      const { data, error } = await supabase.functions.invoke("scheduler-maintenance", {
        body: { action: "reset_capacity", fromDate: new Date().toISOString().slice(0, 10) }
      });
      if (error || !(data as any)?.ok) throw new Error(error?.message || (data as any)?.error || "Reset failed");
      toast.success("Capacity reset from today");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset capacity");
    } finally {
      setIsResetting(false);
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
        <Button size="sm" variant="outline" onClick={resetCapacity} disabled={isResetting} aria-label="Reset capacity">
          {isResetting ? "Resetting..." : "Reset capacity (from today)"}
        </Button>
        <Button size="sm" variant="secondary" onClick={runAutoScheduler} disabled={isRunning} aria-label="Run auto-scheduler">
          {isRunning ? "Running..." : "Run auto-scheduler"}
        </Button>
      </div>

      <main>
        <Tabs defaultValue="stages">
          <TabsList>
            <TabsTrigger value="stages">Stage Planner</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="stages">
            <StageWeeklyScheduler />
          </TabsContent>
          <TabsContent value="calendar">
            <ProductionPlanningCalendar />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminSchedulePage;
