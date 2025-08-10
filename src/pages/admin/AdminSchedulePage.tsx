import React, { useEffect } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { ProductionPlanningCalendar } from "@/components/production/ProductionPlanningCalendar";
import { StageWeeklyScheduler } from "@/components/production/StageWeeklyScheduler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminSchedulePage: React.FC = () => {
  const { isAdmin, isLoading } = useAdminAuth();

  useEffect(() => {
    document.title = "Admin Schedule Board | Weekly Production";
  }, []);

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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Weekly Schedule Board</h1>
        <p className="text-muted-foreground text-sm">
          Stage-centric planner (by day) with drag-and-drop rescheduling. Toggle to calendar if needed.
        </p>
      </header>
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
