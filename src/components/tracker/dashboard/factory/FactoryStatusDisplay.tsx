import React from "react";
import { Wifi, Clock, Calendar, Sun, Moon, Sunset } from "lucide-react";

interface FactoryStatusDisplayProps {
  lastFetchTime?: number;
}

export const FactoryStatusDisplay: React.FC<FactoryStatusDisplayProps> = ({ 
  lastFetchTime 
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const getTimeSinceLastUpdate = () => {
    if (!lastFetchTime) return 'Never';
    const now = new Date();
    const ms = now.getTime() - lastFetchTime;
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const getShiftInfo = () => {
    const hour = currentTime.getHours();
    if (hour >= 6 && hour < 14) {
      return { shift: 'Day Shift', icon: Sun, color: 'text-yellow-400' };
    } else if (hour >= 14 && hour < 22) {
      return { shift: 'Evening Shift', icon: Sunset, color: 'text-orange-400' };
    } else {
      return { shift: 'Night Shift', icon: Moon, color: 'text-blue-400' };
    }
  };

  const shiftInfo = getShiftInfo();
  const ShiftIcon = shiftInfo.icon;

  return (
    <div className="flex items-center gap-6 bg-gray-700 rounded-xl p-4">
      {/* Live Connection Status */}
      <div className="flex items-center gap-3">
        <Wifi className="h-6 w-6 text-green-400 animate-pulse" />
        <div>
          <div className="text-lg font-bold text-white">LIVE</div>
          <div className="text-sm text-gray-300">Connected</div>
        </div>
      </div>

      {/* Current Time */}
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-blue-400" />
        <div>
          <div className="text-2xl font-mono font-bold text-white">
            {currentTime.toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
          <div className="text-sm text-gray-300">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Shift Information */}
      <div className="flex items-center gap-3">
        <ShiftIcon className={`h-6 w-6 ${shiftInfo.color}`} />
        <div>
          <div className="text-lg font-bold text-white">{shiftInfo.shift}</div>
          <div className="text-sm text-gray-300">Active</div>
        </div>
      </div>

      {/* Last Update */}
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-purple-400" />
        <div>
          <div className="text-sm font-semibold text-white">Last Update</div>
          <div className="text-sm text-gray-300">{getTimeSinceLastUpdate()}</div>
        </div>
      </div>
    </div>
  );
};