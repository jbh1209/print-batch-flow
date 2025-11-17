import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

const FINISHING_QUEUES = [
  { id: 'handwork', name: 'Handwork', stageName: 'Handwork' },
  { id: 'padding', name: 'Padding', stageName: 'Padding' },
  { id: 'round_corners', name: 'Round Corners', stageName: 'Round Corners' },
  { id: 'box_gluing', name: 'Box Gluing', stageName: 'Box Gluing' },
  { id: 'gathering', name: 'Gathering', stageName: 'Gathering' },
  { id: 'wire_binding', name: 'Wire Binding', stageName: 'Wire Binding' }
];

const STORAGE_KEY = 'finishing-queue-preferences';

interface FinishingQueueToggleControlsProps {
  onQueueFiltersChange: (filters: string[]) => void;
}

export const FinishingQueueToggleControls: React.FC<FinishingQueueToggleControlsProps> = ({
  onQueueFiltersChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [enabledQueues, setEnabledQueues] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return FINISHING_QUEUES.reduce((acc, queue) => ({ ...acc, [queue.id]: true }), {});
      }
    }
    return FINISHING_QUEUES.reduce((acc, queue) => ({ ...acc, [queue.id]: true }), {});
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledQueues));
    const enabledStageNames = FINISHING_QUEUES
      .filter(queue => enabledQueues[queue.id])
      .map(queue => queue.stageName);
    onQueueFiltersChange(enabledStageNames);
  }, [enabledQueues, onQueueFiltersChange]);

  const handleToggle = (queueId: string) => {
    setEnabledQueues(prev => ({
      ...prev,
      [queueId]: !prev[queueId]
    }));
  };

  const enabledCount = Object.values(enabledQueues).filter(Boolean).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span>Queues</span>
          <Badge variant="secondary" className="ml-1">
            {enabledCount}/{FINISHING_QUEUES.length}
          </Badge>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute right-0 mt-2 z-50">
        <Card className="w-64 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Toggle Queue Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {FINISHING_QUEUES.map(queue => (
              <div key={queue.id} className="flex items-center justify-between">
                <Label htmlFor={queue.id} className="text-sm font-normal cursor-pointer">
                  {queue.name}
                </Label>
                <Switch
                  id={queue.id}
                  checked={enabledQueues[queue.id]}
                  onCheckedChange={() => handleToggle(queue.id)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
