
import React, { useState, useRef } from "react";
import { MobileJobCard } from "./MobileJobCard";
import { cn } from "@/lib/utils";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface SwipeableJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold: (jobId: string, reason: string) => Promise<boolean>;
  onSelect: (jobId: string, selected: boolean) => void;
  isSelected: boolean;
  onClick: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const SwipeableJobCard: React.FC<SwipeableJobCardProps> = ({
  onSwipeLeft,
  onSwipeRight,
  ...props
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [transform, setTransform] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    setCurrentX(e.touches[0].clientX);
    const deltaX = e.touches[0].clientX - startX;
    setTransform(deltaX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const deltaX = currentX - startX;
    const threshold = 100;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    // Reset transform
    setTransform(0);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative transition-transform duration-200",
        isDragging ? "transition-none" : ""
      )}
      style={{
        transform: `translateX(${transform}px)`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe action indicators */}
      {transform > 50 && (
        <div className="absolute inset-y-0 left-0 flex items-center justify-center w-16 bg-green-500 text-white rounded-l-lg">
          <span className="text-xs font-bold">START</span>
        </div>
      )}
      {transform < -50 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-center w-16 bg-blue-500 text-white rounded-r-lg">
          <span className="text-xs font-bold">DONE</span>
        </div>
      )}

      <MobileJobCard {...props} />
    </div>
  );
};
