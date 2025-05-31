
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

  // Map routes to tabs
  const routeToTab = {
    '/tracker': 'orders',
    '/tracker/jobs': 'orders',
    '/tracker/production': 'production',
    '/tracker/kanban': 'kanban',
    '/tracker/worksheets': 'worksheets',
    '/tracker/admin': 'setup',
    '/tracker/upload': 'setup',
    '/tracker/analytics': 'setup'
  };

  // Update active tab based on current route
  useEffect(() => {
    const currentTab = routeToTab[location.pathname] || 'orders';
    setActiveTab(currentTab);
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Navigate to appropriate route based on tab
    const tabRoutes = {
      'orders': '/tracker/jobs',
      'production': '/tracker/production',
      'kanban': '/tracker/kanban',
      'worksheets': '/tracker/worksheets',
      'setup': '/tracker/admin'
    };
    
    const route = tabRoutes[tab] || '/tracker';
    navigate(route);
  };

  const handleFilterChange = (filters: any) => {
    console.log('Filters changed:', filters);
    // This will be used to filter content in child components
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        <DynamicHeader 
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        
        <div className="flex flex-1 overflow-hidden">
          <ContextSidebar 
            activeTab={activeTab}
            onFilterChange={handleFilterChange}
          />
          
          <main className="flex-1 overflow-auto p-6">
            <Outlet context={{ activeTab, filters: {} }} />
          </main>
        </div>
      </div>
    </div>
  );
};

export default TrackerLayout;
