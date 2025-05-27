
import { Outlet } from "react-router-dom";
import TrackerSidebar from "./TrackerSidebar";
import SearchBar from "./SearchBar";
import { Bell, HelpCircle, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";

const TrackerLayout = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-batchflow-background">
      <TrackerSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white border-b flex items-center justify-between px-6 py-3 h-16">
          <SearchBar />
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell size={20} />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut size={20} />
            </Button>
            <div className="h-8 w-8 rounded-full bg-green-400 flex items-center justify-center text-white font-medium">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TrackerLayout;
