import React from 'react';
import WeeklyScheduleBoard from '@/components/scheduling/WeeklyScheduleBoard';
import { DynamicHeader } from '@/components/tracker/DynamicHeader';
import { useOutletContext } from 'react-router-dom';

interface TrackerContext {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ScheduleBoardPage: React.FC = () => {
  const context = useOutletContext<TrackerContext>();
  
  return (
    <div className="flex flex-col h-full">
      <DynamicHeader 
        activeTab={context?.activeTab || 'schedule-board'} 
        onTabChange={context?.onTabChange || (() => {})} 
      />
      <div className="flex-1">
        <WeeklyScheduleBoard />
      </div>
    </div>
  );
};

export default ScheduleBoardPage;