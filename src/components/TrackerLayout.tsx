
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
  const [filters, setFilters] = useState<any>({});
  // Store dynamic data for production sidebar
  const [productionSidebarData, setProductionSidebarData] = useState<any>({
    consolidatedStages: [],
    activeJobs: []
  });

  // Map routes to tabs - updated with all routes including users
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

  // Update active tab based on current route
  useEffect(() => {
    const currentTab = routeToTab[location.pathname] || 'dashboard';
    setActiveTab(currentTab);
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Navigate to appropriate route based on tab
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
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
  };

  const handleStageSelect = (stageId: string | null) => {
    setSelectedStageId(stageId);
  };

  // Helper to let production page set sidebar data
  const setSidebarData = (data: { consolidatedStages: any[]; activeJobs: any[] }) => {
    setProductionSidebarData(data);
  };

  // --- Sidebar logic now allows production ---
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
          {/* Show ContextSidebar for all tabs except dashboard, kanban, orders */}
          {!isKanbanTab && !isDashboardTab && !isOrdersTab && (
            <ContextSidebar 
              activeTab={activeTab}
              onFilterChange={handleFilterChange}
              // Pass additional production props if on production tab
              productionSidebarData={activeTab === "production" ? productionSidebarData : undefined}
              onStageSelect={activeTab === "production" ? handleStageSelect : undefined}
              selectedStageId={activeTab === "production" ? selectedStageId : undefined}
            />
          )}
          
          <main className={`flex-1 overflow-auto ${activeTab === 'production' ? '' : 'p-6'}`}>
            <Outlet context={{ 
              activeTab, 
              filters,
              selectedStageId,
              onStageSelect: handleStageSelect,
              onFilterChange: handleFilterChange,
              setSidebarData // Pass this so TrackerProduction can update sidebar
            }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default TrackerLayout;
