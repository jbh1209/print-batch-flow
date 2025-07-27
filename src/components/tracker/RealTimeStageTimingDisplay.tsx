import React, { useState, useEffect } from 'react';
import { calculateRealTimeStageTimingForDisplay, CalculatedStageTimingDisplay, createStoredTimingDisplay } from '@/utils/tracker/realTimeStageTimingCalculations';

interface RealTimeStageTimingDisplayProps {
  stageId: string;
  quantity: number | null | undefined;
  specificationId?: string | null;
  storedEstimate?: number | null; // Fallback to stored estimate if real-time fails
  className?: string;
  showSource?: boolean; // For debugging - shows calculation source
}

export const RealTimeStageTimingDisplay: React.FC<RealTimeStageTimingDisplayProps> = ({
  stageId,
  quantity,
  specificationId,
  storedEstimate,
  className = "",
  showSource = false
}) => {
  const [timingDisplay, setTimingDisplay] = useState<CalculatedStageTimingDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const calculateTiming = async () => {
      setIsLoading(true);
      
      // If no quantity available, fall back to stored estimate
      if (!quantity || quantity <= 0) {
        setTimingDisplay(createStoredTimingDisplay(storedEstimate));
        setIsLoading(false);
        return;
      }

      try {
        const realTimeTiming = await calculateRealTimeStageTimingForDisplay({
          stageId,
          quantity,
          specificationId
        });
        setTimingDisplay(realTimeTiming);
      } catch (error) {
        console.warn('Real-time timing calculation failed, using stored estimate:', error);
        setTimingDisplay(createStoredTimingDisplay(storedEstimate));
      } finally {
        setIsLoading(false);
      }
    };

    calculateTiming();
  }, [stageId, quantity, specificationId, storedEstimate]);

  if (isLoading) {
    return (
      <p className={`text-xs text-gray-400 ${className}`}>
        Calculating...
      </p>
    );
  }

  if (!timingDisplay) {
    return (
      <p className={`text-xs text-gray-400 ${className}`}>
        No timing data
      </p>
    );
  }

  const getTimingColor = () => {
    switch (timingDisplay.source) {
      case 'live_calculation':
        return 'text-blue-600'; // Fresh calculation
      case 'stored_estimate':
        return 'text-orange-600'; // May be outdated
      case 'fallback':
        return 'text-gray-500'; // Error fallback
      default:
        return 'text-gray-600';
    }
  };

  const getTimingIcon = () => {
    switch (timingDisplay.source) {
      case 'live_calculation':
        return '🔄'; // Fresh
      case 'stored_estimate':
        return '📊'; // Stored
      case 'fallback':
        return '⚠️'; // Warning
      default:
        return '';
    }
  };

  return (
    <p className={`text-xs font-medium ${getTimingColor()} ${className}`}>
      {showSource && <span className="mr-1">{getTimingIcon()}</span>}
      Est. {timingDisplay.displayText}
      {showSource && (
        <span className="ml-1 text-xs opacity-60">({timingDisplay.source})</span>
      )}
    </p>
  );
};