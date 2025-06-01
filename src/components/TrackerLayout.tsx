
import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { DynamicHeader } from "./tracker/DynamicHeader";
import { ContextSidebar } from "./tracker/ContextSidebar";
import { DynamicProductionSidebar } from "./tracker/production/DynamicProductionSidebar";
import { useAuth } from "@/hooks/useAuth";

const TrackerLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});

  // Map routes to tabs
  const routeToTab = {
    '/tracker': 'dashboard',
    '/tracker/jobs': 'orders',
    '/tracker/production': 'production',
    '/tracker/kanban': 'kanban',
    '/tracker/worksheets': 'worksheets',
    '/tracker/admin': 'setup',
    '/tracker/upload': 'setup',
    '/tracker/analytics': 'setup',
    '/tracker/labels': 'setup'
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
      'setup': '/tracker/upload'
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

  // Determine which sidebar to show
  const isProductionTab = activeTab === 'production';

  return (
    <div className="flex h-screen bg-gray-50 w-full">
      <div className="flex flex-col flex-1 overflow-hidden">
        <DynamicHeader 
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Conditional Sidebar */}
          {isProductionTab ? (
            <DynamicProductionSidebar
              selectedStageId={selectedStageId}
              onStageSelect={handleStageSelect}
              onFilterChange={handleFilterChange}
            />
          ) : (
            <ContextSidebar 
              activeTab={activeTab}
              onFilterChange={handleFilterChange}
            />
          )}
          
          <main className="flex-1 overflow-auto p-6">
            <Outlet context={{ 
              activeTab, 
              filters,
              selectedStageId,
              onStageSelect: handleStageSelect,
              onFilterChange: handleFilterChange
            }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default TrackerLayout;
