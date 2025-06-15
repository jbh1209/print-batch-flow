
import React from "react";
import { Timer } from "lucide-react";

const StageTimer: React.FC<{ startedAt?: string }> = ({ startedAt }) => {
  const [elapsed, setElapsed] = React.useState<number>(0);

  React.useEffect(() => {
    if (!startedAt) return;
    const updateElapsed = () => {
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      setElapsed(Math.floor((now - start) / 1000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-1 text-xs text-blue-600">
      <Timer className="h-3 w-3" />
      <span>{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
};
export default StageTimer;
