import React, { useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { LoadingState } from '@/components/users/LoadingState';
import { AccessRestrictedMessage } from '@/components/users/AccessRestrictedMessage';
import { WeeklyScheduleBoard } from '@/components/scheduling/WeeklyScheduleBoard';
import AdminHeader from '@/components/admin/AdminHeader';

const ScheduleBoardPage: React.FC = () => {
  const { isAdmin, isLoading } = useAdminAuth();

  useEffect(() => {
    document.title = "Weekly Schedule Board | Production Planning";
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
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <AdminHeader
          title="Weekly Schedule Board"
          subtitle="Plan and organize production jobs across Monday to Friday shifts"
        />
        
        <main className="mt-6">
          <WeeklyScheduleBoard />
        </main>
      </div>
    </div>
  );
};

export default ScheduleBoardPage;