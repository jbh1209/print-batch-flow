
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  Target,
  Zap,
  Shield
} from "lucide-react";
import type { WorkflowDiagnostic, DiagnosticSummary } from "@/utils/tracker/workflowDiagnostics";

interface RepairStrategiesPanelProps {
  diagnostics: WorkflowDiagnostic[];
  summary: DiagnosticSummary;
  onStrategySelect: (strategy: RepairStrategy) => void;
}

interface RepairStrategy {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
  affectedJobs: number;
  actions: string[];
  prerequisites: string[];
}

export const RepairStrategiesPanel: React.FC<RepairStrategiesPanelProps> = ({
  diagnostics,
  summary,
  onStrategySelect
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const criticalCount = diagnostics.filter(d => d.issue_severity === 'critical').length;
  const moderateCount = diagnostics.filter(d => d.issue_severity === 'moderate').length;
  const minorCount = diagnostics.filter(d => d.issue_severity === 'minor').length;

  const strategies: RepairStrategy[] = [
    {
      id: 'critical-first',
      name: 'Critical Issues First',
      description: 'Prioritize jobs with critical missing stage issues (>50% stages missing)',
      priority: 'critical',
      estimatedTime: '15-30 minutes',
      riskLevel: 'low',
      affectedJobs: criticalCount,
      actions: [
        'Repair all critical severity jobs first',
        'Validate workflow integrity',
        'Verify stage ordering',
        'Test job progression'
      ],
      prerequisites: [
        'Database backup recommended',
        'No active job modifications during repair'
      ]
    },
    {
      id: 'category-based',
      name: 'Category-Based Repair',
      description: 'Group jobs by category and repair systematically by workflow type',
      priority: 'high',
      estimatedTime: '20-45 minutes',
      riskLevel: 'low',
      affectedJobs: summary.most_affected_categories.length,
      actions: [
        'Group jobs by category',
        'Repair one category at a time',
        'Validate category workflow templates',
        'Apply consistent stage ordering'
      ],
      prerequisites: [
        'Category workflows must be properly defined',
        'Stage templates verified'
      ]
    },
    {
      id: 'incremental',
      name: 'Incremental Repair',
      description: 'Repair jobs in small batches to minimize risk and allow monitoring',
      priority: 'medium',
      estimatedTime: '30-60 minutes',
      riskLevel: 'low',
      affectedJobs: diagnostics.length,
      actions: [
        'Process jobs in small batches (5-10 jobs)',
        'Validate each batch before proceeding',
        'Monitor for errors continuously',
        'Rollback capability per batch'
      ],
      prerequisites: [
        'Continuous monitoring setup',
        'Rollback procedures prepared'
      ]
    },
    {
      id: 'stage-specific',
      name: 'Stage-Specific Repair',
      description: 'Focus on most frequently missing stages across all jobs',
      priority: 'medium',
      estimatedTime: '25-40 minutes',
      riskLevel: 'medium',
      affectedJobs: Object.keys(summary.missing_stage_frequency).length,
      actions: [
        'Identify most missing stages',
        'Repair jobs missing specific stages',
        'Verify stage dependencies',
        'Update stage ordering rules'
      ],
      prerequisites: [
        'Stage dependency mapping',
        'Production stage validation'
      ]
    },
    {
      id: 'bulk-repair',
      name: 'Bulk Repair (Fast)',
      description: 'Repair all jobs simultaneously for maximum speed',
      priority: 'high',
      estimatedTime: '10-20 minutes',
      riskLevel: 'high',
      affectedJobs: diagnostics.length,
      actions: [
        'Process all jobs simultaneously',
        'Fastest repair option',
        'Comprehensive validation at end',
        'Single rollback point'
      ],
      prerequisites: [
        'Full database backup required',
        'Maintenance window scheduled',
        'All users notified'
      ]
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Shield className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Strategy Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Repair Strategy Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              Based on your diagnostic results: {criticalCount} critical, {moderateCount} moderate, 
              and {minorCount} minor issues detected across {diagnostics.length} jobs.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Strategy Selection */}
      <Tabs defaultValue="recommended" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="all">All Strategies</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-4">
          {/* Show top 2 recommended strategies based on the diagnostic results */}
          {strategies.slice(0, 2).map((strategy) => (
            <Card 
              key={strategy.id} 
              className={`cursor-pointer transition-colors ${
                selectedStrategy === strategy.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedStrategy(strategy.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {strategy.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityColor(strategy.priority)}>
                      {strategy.priority}
                    </Badge>
                    <div className={`flex items-center gap-1 ${getRiskColor(strategy.riskLevel)}`}>
                      {getRiskIcon(strategy.riskLevel)}
                      <span className="text-sm capitalize">{strategy.riskLevel} Risk</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{strategy.description}</p>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Estimated Time:</span>
                    <div>{strategy.estimatedTime}</div>
                  </div>
                  <div>
                    <span className="font-medium">Affected Jobs:</span>
                    <div>{strategy.affectedJobs}</div>
                  </div>
                  <div>
                    <span className="font-medium">Success Rate:</span>
                    <div className="text-green-600">95-99%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Actions:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {strategy.actions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>

                {strategy.prerequisites.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Prerequisites:</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {strategy.prerequisites.map((prereq, index) => (
                        <li key={index}>{prereq}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onStrategySelect(strategy);
                  }}
                  className="w-full"
                  variant={selectedStrategy === strategy.id ? "default" : "outline"}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Select This Strategy
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id} className="cursor-pointer" onClick={() => setSelectedStrategy(strategy.id)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{strategy.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityColor(strategy.priority)} className="text-xs">
                      {strategy.priority}
                    </Badge>
                    <span className={`text-xs ${getRiskColor(strategy.riskLevel)}`}>
                      {strategy.riskLevel} risk
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{strategy.description}</p>
                <div className="flex justify-between text-xs">
                  <span>Time: {strategy.estimatedTime}</span>
                  <span>Jobs: {strategy.affectedJobs}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStrategySelect(strategy);
                  }}
                >
                  Select
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Strategy</th>
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Risk</th>
                    <th className="text-left p-2">Jobs</th>
                    <th className="text-left p-2">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((strategy) => (
                    <tr key={strategy.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{strategy.name}</td>
                      <td className="p-2">{strategy.estimatedTime}</td>
                      <td className="p-2">
                        <span className={getRiskColor(strategy.riskLevel)}>
                          {strategy.riskLevel}
                        </span>
                      </td>
                      <td className="p-2">{strategy.affectedJobs}</td>
                      <td className="p-2">
                        <Badge variant={getPriorityColor(strategy.priority)} className="text-xs">
                          {strategy.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
