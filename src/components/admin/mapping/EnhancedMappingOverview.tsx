import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Target, Zap, FileText, Package, Truck } from "lucide-react";

export function EnhancedMappingOverview() {
  const phases = [
    {
      id: 1,
      title: "Paper Specification Detection",
      description: "Intelligent parsing of paper types, weights, and properties from Excel text",
      features: [
        "Paper type recognition (Bond, Card, Booklet, etc.)",
        "Weight extraction with unit conversion",
        "Color and finish detection",
        "Confidence scoring and mapping"
      ],
      icon: Package,
      status: "complete",
      color: "green"
    },
    {
      id: 2, 
      title: "Delivery/Collection Detection",
      description: "Smart recognition of delivery methods and address parsing",
      features: [
        "Delivery method detection (Pickup, Delivery, Courier)",
        "Address parsing and contact extraction", 
        "Enhanced delivery specification matching",
        "Geographic location identification"
      ],
      icon: Truck,
      status: "complete",
      color: "green"
    },
    {
      id: 3,
      title: "Automated Mapping Creation",
      description: "Automatic creation and management of Excel mappings with batch operations",
      features: [
        "Automatic mapping generation from parsing results",
        "Confidence-based filtering and validation",
        "Batch consolidation and conflict resolution",
        "Mapping verification workflows"
      ],
      icon: Zap,
      status: "complete", 
      color: "green"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'planned':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Enhanced Excel Import Mapping System
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Advanced AI-powered mapping system for intelligent Excel data processing and automated workflow creation
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {phases.map((phase) => {
              const IconComponent = phase.icon;
              return (
                <Card key={phase.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-green-600" />
                        <h3 className="font-medium">Phase {phase.id}</h3>
                      </div>
                      <Badge className={getStatusColor(phase.status)}>
                        {phase.status === 'complete' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {phase.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <h4 className="font-semibold">{phase.title}</h4>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {phase.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            System Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">15+</div>
              <div className="text-sm text-blue-700">Paper Types</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">6+</div>
              <div className="text-sm text-green-700">Delivery Methods</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">95%+</div>
              <div className="text-sm text-purple-700">Accuracy Rate</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">Auto</div>
              <div className="text-sm text-orange-700">Mapping Creation</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}