import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Bug, AlertTriangle, CheckCircle } from 'lucide-react';
import { debugService } from '@/services/DebugService';
import { specificationUnificationService } from '@/services/SpecificationUnificationService';

interface SystemStatusIndicatorProps {
  className?: string;
}

export const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const refreshLogs = () => {
    const recentLogs = debugService.getEntries().slice(0, 20);
    setLogs(recentLogs);
  };

  const clearCache = () => {
    specificationUnificationService.clearCache();
    debugService.clear();
    setLogs([]);
  };

  const getStatusBadge = () => {
    const recentErrors = debugService.getEntries().filter(
      entry => entry.action.includes('error') || entry.data?.error
    ).slice(0, 5);

    if (recentErrors.length > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Issues Detected
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        System OK
      </Badge>
    );
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Debug Panel
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="w-96 max-h-96 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                System Status
                {getStatusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={refreshLogs}>
                  Refresh Logs
                </Button>
                <Button size="sm" variant="outline" onClick={clearCache}>
                  Clear Cache
                </Button>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">No debug logs available. Click "Refresh Logs" to load recent activity.</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-50 rounded border">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {log.component}
                        </Badge>
                        <span className="text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">{log.action}:</span>
                        <div className="text-gray-600">
                          {typeof log.data === 'object' 
                            ? Object.entries(log.data).map(([key, value]) => (
                                <div key={key} className="ml-2">
                                  <span className="font-mono">{key}:</span> {String(value)}
                                </div>
                              ))
                            : String(log.data)
                          }
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};