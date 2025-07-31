
import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DynamicHeader } from "./tracker/DynamicHeader";
import { ContextSidebar } from "./tracker/ContextSidebar";
import { useAuth } from "@/hooks/useAuth";

const TrackerLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});
  const [productionSidebarData, setProductionSidebarData] = useState<any>({
    consolidatedStages: [],
    getJobCountForStage: () => 0,
    getJobCountByStatus: () => 0,
    totalActiveJobs: 0
  });

  const routeToTab = {
    '/tracker': 'dashboard',
    '/tracker/jobs': 'orders',
    '/tracker/production': 'production',
    '/tracker/kanban': 'kanban',
    '/tracker/worksheets': 'worksheets',
    '/tracker/admin': 'setup',
    '/tracker/users': 'setup',
    '/tracker/upload': 'setup',
    '/tracker/labels': 'setup',
    '/tracker/mobile': 'setup'
  };

  useEffect(() => {
    const currentTab = routeToTab[location.pathname] || 'dashboard';
    setActiveTab(currentTab);
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    const tabRoutes = {
      'dashboard': '/tracker',
      'orders': '/tracker/jobs',
      'production': '/tracker/production',
      'kanban': '/tracker/kanban',
      'worksheets': '/tracker/worksheets',
      'setup': '/tracker/admin'
    };
    
    const route = tabRoutes[tab] || '/tracker';
    navigate(route);
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleStageSelect = (stageId: string | null, stageName: string | null) => {
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
  };

  const setSidebarData = (data: any) => {
    setProductionSidebarData(data);
  };

  const isKanbanTab = activeTab === 'kanban';
  const isDashboardTab = activeTab === 'dashboard';
  const isOrdersTab = activeTab === 'orders';

  return (
    <div className="flex h-screen bg-gray-50 w-full">
      <div className="flex flex-col flex-1 overflow-hidden">
        <DynamicHeader 
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        
        <div className="flex flex-1 overflow-hidden">
          {!isKanbanTab && !isDashboardTab && !isOrdersTab && (
            <ContextSidebar 
              activeTab={activeTab}
              onFilterChange={handleFilterChange}
              productionSidebarData={activeTab === "production" ? productionSidebarData : undefined}
              onStageSelect={activeTab === "production" ? handleStageSelect : undefined}
              selectedStageId={activeTab === "production" ? selectedStageId : undefined}
              selectedStageName={activeTab === "production" ? selectedStageName : undefined}
            />
          )}
          
          <main className={`flex-1 overflow-auto ${activeTab === 'production' ? '' : 'p-6'}`}>
            <Outlet context={{ 
              activeTab, 
              filters,
              selectedStageId,
              selectedStageName,
              onStageSelect: handleStageSelect,
              onFilterChange: handleFilterChange,
              setSidebarData
            }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default TrackerLayout;
