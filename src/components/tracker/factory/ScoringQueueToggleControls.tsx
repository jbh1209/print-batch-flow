import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Scissors, FoldVertical, Repeat, Maximize, PenTool, Zap } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ScoringQueueToggleControlsProps {
  onQueueFiltersChange: (filters: string[]) => void;
}

const SCORING_QUEUES = [
  { id: 'scoring', name: 'Scoring', key: 'Scoring', icon: <Scissors className="h-4 w-4" /> },
  { id: 'scoring_folding', name: 'Scoring & Folding', key: 'Scoring & Folding', icon: <FoldVertical className="h-4 w-4" /> },
  { id: 'perfing', name: 'Perfing', key: 'Perfing', icon: <Repeat className="h-4 w-4" /> },
  { id: 'creasing', name: 'Creasing', key: 'Creasing', icon: <Maximize className="h-4 w-4" /> },
  { id: 'manual_folding', name: 'Manual Folding', key: 'Manual Folding', icon: <PenTool className="h-4 w-4" /> },
  { id: 'auto_folding', name: 'Auto Folding', key: 'Auto Folding', icon: <Zap className="h-4 w-4" /> }
];

export const ScoringQueueToggleControls: React.FC<ScoringQueueToggleControlsProps> = ({
  onQueueFiltersChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Initialize from localStorage or default to all enabled
  const [enabledQueues, setEnabledQueues] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('scoring-queue-filters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse scoring queue filters:', e);
      }
    }
    // Default: all queues enabled
    return SCORING_QUEUES.reduce((acc, queue) => ({
      ...acc,
      [queue.id]: true
    }), {});
  });

  // Update parent and localStorage when filters change
  useEffect(() => {
    const enabledKeys = SCORING_QUEUES
      .filter(queue => enabledQueues[queue.id])
      .map(queue => queue.key);
    
    onQueueFiltersChange(enabledKeys);
    localStorage.setItem('scoring-queue-filters', JSON.stringify(enabledQueues));
  }, [enabledQueues, onQueueFiltersChange]);

  const handleToggle = (queueId: string) => {
    setEnabledQueues(prev => ({
      ...prev,
      [queueId]: !prev[queueId]
    }));
  };

  const enabledCount = Object.values(enabledQueues).filter(Boolean).length;
  const allEnabled = enabledCount === SCORING_QUEUES.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Queues {!allEnabled && `(${enabledCount}/${SCORING_QUEUES.length})`}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="absolute z-50 mt-2 right-4">
        <Card className="w-80 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Select Scoring Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SCORING_QUEUES.map(queue => (
              <div key={queue.id} className="flex items-center justify-between space-x-2">
                <div className="flex items-center gap-2">
                  {queue.icon}
                  <Label htmlFor={`queue-${queue.id}`} className="text-sm font-normal cursor-pointer">
                    {queue.name}
                  </Label>
                </div>
                <Switch
                  id={`queue-${queue.id}`}
                  checked={enabledQueues[queue.id]}
                  onCheckedChange={() => handleToggle(queue.id)}
                />
              </div>
            ))}
            
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allOn = SCORING_QUEUES.reduce((acc, queue) => ({
                    ...acc,
                    [queue.id]: true
                  }), {});
                  setEnabledQueues(allOn);
                }}
                className="w-full"
              >
                Enable All
              </Button>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
