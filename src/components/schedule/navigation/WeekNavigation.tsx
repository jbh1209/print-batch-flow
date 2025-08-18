/**
 * Week navigation component for schedule board
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

interface WeekNavigationProps {
  currentWeek: Date;
  onWeekChange: (newWeek: Date) => void;
}

export function WeekNavigation({ currentWeek, onWeekChange }: WeekNavigationProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  
  const handlePreviousWeek = () => {
    onWeekChange(subWeeks(currentWeek, 1));
  };
  
  const handleNextWeek = () => {
    onWeekChange(addWeeks(currentWeek, 1));
  };
  
  const handleCurrentWeek = () => {
    onWeekChange(new Date());
  };
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreviousWeek}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleCurrentWeek}
        className="h-8 px-3 text-sm font-medium"
      >
        <Calendar className="h-4 w-4 mr-2" />
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleNextWeek}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}