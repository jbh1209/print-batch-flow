
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { DynamicHeader } from "./tracker/DynamicHeader";
import { ContextSidebar } from "./tracker/ContextSidebar";
import { useAuth } from "@/hooks/useAuth";

const TrackerLayout = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("orders");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // You can add navigation logic here if needed
    // For example, navigate to different routes based on tab
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
            onFilterChange={(filters) => {
              // Handle filter changes here
              console.log('Filters changed:', filters);
            }}
          />
          
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default TrackerLayout;
