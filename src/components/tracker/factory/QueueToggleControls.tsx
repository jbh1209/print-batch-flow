
import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueueToggleControlsProps {
  onQueueFiltersChange: (filters: string[]) => void;
}

const PRINT_QUEUES = [
  { id: 'hp_12000', name: 'HP 12000', key: 'hp 12000' },
  { id: 'hp_7900', name: 'HP 7900', key: 'hp 7900' },
  { id: 'hp_t250', name: 'HP T250', key: 't250' }
];

export const QueueToggleControls: React.FC<QueueToggleControlsProps> = ({ 
  onQueueFiltersChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [enabledQueues, setEnabledQueues] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('operator-queue-preferences');
      return saved ? JSON.parse(saved) : {
        hp_12000: true,
        hp_7900: true,
        hp_t250: true
      };
    } catch {
      return {
        hp_12000: true,
        hp_7900: true,
        hp_t250: true
      };
    }
  });

  useEffect(() => {
    // Save to localStorage whenever preferences change
    localStorage.setItem('operator-queue-preferences', JSON.stringify(enabledQueues));
    
    // Notify parent of active queue filters
    const activeQueues = PRINT_QUEUES
      .filter(queue => enabledQueues[queue.id])
      .map(queue => queue.key);
    
    onQueueFiltersChange(activeQueues);
  }, [enabledQueues, onQueueFiltersChange]);

  const handleToggle = (queueId: string, enabled: boolean) => {
    setEnabledQueues(prev => ({
      ...prev,
      [queueId]: enabled
    }));
  };

  const enabledCount = Object.values(enabledQueues).filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Print Queues</span>
          <span className="sm:hidden">Queues</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            {enabledCount}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="absolute top-full right-0 z-50 mt-2">
        <Card className="w-64 shadow-lg border">
          <CardContent className="p-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Show Print Queues</h4>
              {PRINT_QUEUES.map(queue => (
                <div key={queue.id} className="flex items-center justify-between">
                  <Label 
                    htmlFor={queue.id} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {queue.name}
                  </Label>
                  <Switch
                    id={queue.id}
                    checked={enabledQueues[queue.id]}
                    onCheckedChange={(checked) => handleToggle(queue.id, checked)}
                  />
                </div>
              ))}
              <div className="pt-2 border-t text-xs text-gray-500">
                Turn off queues you're not working on today
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
