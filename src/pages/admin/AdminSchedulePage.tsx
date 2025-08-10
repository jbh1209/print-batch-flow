import React, { useEffect } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { ProductionPlanningCalendar } from "@/components/production/ProductionPlanningCalendar";

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
          Monday to Friday view of scheduled work orders with drag-and-drop rescheduling.
        </p>
      </header>
      <main>
        <ProductionPlanningCalendar />
      </main>
    </div>
  );
};

export default AdminSchedulePage;
