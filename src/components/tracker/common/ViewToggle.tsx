
import React from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: 'card' | 'list';
  onViewChange: (view: 'card' | 'list') => void;
  className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({
  view,
  onViewChange,
  className
}) => {
  return (
    <div className={cn("flex border rounded-md", className)}>
      <Button
        variant={view === 'card' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('card')}
        className="rounded-r-none h-7 px-2"
      >
        <LayoutGrid className="h-3 w-3" />
      </Button>
      <Button
        variant={view === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="rounded-l-none h-7 px-2"
      >
        <LayoutList className="h-3 w-3" />
      </Button>
    </div>
  );
};
