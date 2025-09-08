import React from "react";
import { Monitor, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroStatsGrid } from "./HeroStatsGrid";
import { LiveProductionFlow } from "./LiveProductionFlow";
import { FactoryAlertBanner } from "./FactoryAlertBanner";
import { FactoryStatusDisplay } from "./FactoryStatusDisplay";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";

interface FactoryFloorDashboardProps {
  stats: any;
  onBack: () => void;
}

export const FactoryFloorDashboard: React.FC<FactoryFloorDashboardProps> = ({ 
  stats, 
  onBack 
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const { refreshJobs, lastFetchTime } = useAccessibleJobs({
    permissionType: 'manage'
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-refresh every 15 seconds in factory mode
  React.useEffect(() => {
    const interval = setInterval(refreshJobs, 15000);
    return () => clearInterval(interval);
  }, [refreshJobs]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 space-y-6">
      {/* Factory Header */}
      <div className="flex items-center justify-between bg-gray-800 p-6 rounded-2xl border border-gray-700">
        <div className="flex items-center gap-4">
          <Monitor className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-4xl font-bold text-white">Factory Floor Display</h1>
            <p className="text-gray-400 text-lg">Real-time production monitoring • Live updates</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <FactoryStatusDisplay lastFetchTime={lastFetchTime} />
          
          <Button
            variant="outline"
            size="lg"
            onClick={toggleFullscreen}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-5 w-5 mr-2" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-5 w-5 mr-2" />
                Fullscreen
              </>
            )}
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={onBack}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      <FactoryAlertBanner stats={stats} />

      {/* Hero Stats Grid */}
      <HeroStatsGrid stats={stats} />

      {/* Live Production Flow */}
      <LiveProductionFlow stats={stats} />
    </div>
  );
};