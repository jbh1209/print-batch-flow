import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, Users, ArrowRight, Settings } from 'lucide-react';

export const PrintstreamIntegrationSummary: React.FC = () => {
  const integrationFeatures = [
    {
      title: 'Enhanced Batch-to-Tracker Handoff',
      status: 'complete',
      description: 'Batches automatically create master jobs with proper printing stage detection',
      items: [
        'Auto-detects printing stages from constituent job categories',
        'Creates master jobs with BATCH- prefix',
        'Updates constituent jobs to "In Batch Processing" status',
        'Initializes master job workflow starting from printing stage'
      ]
    },
    {
      title: 'Batch Processing Workflow Management',
      status: 'complete',
      description: 'Master jobs flow through production stages while constituent jobs are hidden',
      items: [
        'Master jobs visible in MultiStageKanban',
        'Constituent jobs hidden from normal workflow',
        'Batch context displayed in job cards and search',
        'Full traceability of batch processing status'
      ]
    },
    {
      title: 'Automatic Job Splitting at Packaging',
      status: 'complete',
      description: 'Jobs automatically split back to individual workflow at packaging stage',
      items: [
        'Trigger detects when master job reaches packaging',
        'Automatically reactivates constituent jobs',
        'Initializes individual jobs at packaging stage',
        'Completes and archives master job'
      ]
    },
    {
      title: 'Enhanced Search and Traceability',
      status: 'complete',
      description: 'Complete visibility of batch context in job search and display',
      items: [
        'Batch-aware job search component',
        'Batch context display in job cards',
        'Master job vs constituent job indicators',
        'Current batch name shown for jobs in processing'
      ]
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Printstream-Tracker Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {integrationFeatures.map((feature, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{feature.title}</h3>
                  {getStatusBadge(feature.status)}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {feature.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Package className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Batch sent to print in Printstream creates master job in Tracker</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Master job flows through printing and finishing stages</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Individual jobs automatically split out at packaging stage</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Jobs continue individual workflow through packaging and completion</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800">Integration Complete</h3>
              <p className="text-sm text-green-700">
                Printstream and Tracker are now fully integrated with automatic workflow management
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};