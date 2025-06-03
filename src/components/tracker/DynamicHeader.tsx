
import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, HelpCircle, LogOut, Home, Factory } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/tracker/useUserRole";

interface DynamicHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DynamicHeader: React.FC<DynamicHeaderProps> = ({
  activeTab,
  onTabChange
}) => {
  const { user, signOut } = useAuth();
  const { isManager, isAdmin } = useUserRole();

  const tabs = [
    { id: "dashboard", label: "DASHBOARD" },
    { id: "orders", label: "ORDERS" },
    { id: "production", label: "PRODUCTION" },
    { id: "kanban", label: "KANBAN" },
    { id: "worksheets", label: "WORKSHEETS" },
    { id: "setup", label: "SETUP" }
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLogoClick = () => {
    onTabChange("dashboard");
  };

  return (
    <header className="bg-white border-b flex items-center justify-between px-6 py-3 h-16">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <h1 
            className="text-xl font-bold text-green-600 cursor-pointer hover:text-green-700 transition-colors"
            onClick={handleLogoClick}
            title="Go to Dashboard"
          >
            Tracker
          </h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
          <TabsList className="grid grid-cols-6 w-auto bg-gray-100">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="text-sm font-medium px-6 py-2 data-[state=active]:bg-green-600 data-[state=active]:text-white cursor-pointer"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center space-x-4">
        {(isManager || isAdmin) && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker/factory-floor" className="flex items-center gap-2">
              <Factory size={16} />
              Factory Floor
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon">
          <Bell size={20} />
        </Button>
        <Button variant="ghost" size="icon">
          <HelpCircle size={20} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut size={20} />
        </Button>
        <Button 
          asChild 
          variant="ghost" 
          size="icon"
          title="Switch Apps"
        >
          <Link to="/">
            <Home size={20} />
          </Link>
        </Button>
        <div className="h-8 w-8 rounded-full bg-green-400 flex items-center justify-center text-white font-medium">
          {user?.email?.[0].toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
};
