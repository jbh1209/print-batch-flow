import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Truck, Package, MapPin, Clock, CheckCircle2 } from "lucide-react";

interface DeliveryMapping {
  woNo: string;
  originalText: string;
  mapping: {
    method: string;
    specificationId: string;
    specificationName: string;
    confidence: number;
    detectedFeatures: string[];
  };
  confidence: number;
}

interface DeliverySpecificationMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryMappings: DeliveryMapping[];
  stats: {
    enhancedDeliveryMapped: number;
    totalJobs: number;
  };
}

export const DeliverySpecificationMappingDialog: React.FC<DeliverySpecificationMappingDialogProps> = ({
  open,
  onOpenChange,
  deliveryMappings,
  stats,
}) => {
  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'collection':
        return <Package className="h-4 w-4" />;
      case 'urgent_delivery':
        return <Clock className="h-4 w-4" />;
      case 'local_delivery':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Truck className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const groupedMappings = deliveryMappings.reduce((groups, mapping) => {
    const method = mapping.mapping.method;
    if (!groups[method]) {
      groups[method] = [];
    }
    groups[method].push(mapping);
    return groups;
  }, {} as Record<string, DeliveryMapping[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Enhanced Delivery Method Mapping Results
          </DialogTitle>
          <DialogDescription>
            Successfully mapped {stats.enhancedDeliveryMapped} delivery methods from {stats.totalJobs} jobs using intelligent detection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mapping Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.enhancedDeliveryMapped}</div>
                  <div className="text-sm text-muted-foreground">Jobs Mapped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{Object.keys(groupedMappings).length}</div>
                  <div className="text-sm text-muted-foreground">Delivery Methods</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round((stats.enhancedDeliveryMapped / stats.totalJobs) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mapped Results by Method */}
          {Object.entries(groupedMappings).map(([method, mappings]) => (
            <Card key={method}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getMethodIcon(method)}
                  {mappings[0].mapping.specificationName}
                  <Badge variant="secondary">{mappings.length} jobs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mappings.slice(0, 5).map((mapping, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">WO: {mapping.woNo}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            "{mapping.originalText}"
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${getConfidenceColor(mapping.confidence)}`}
                            title={`${mapping.confidence}% confidence`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {mapping.confidence}%
                          </span>
                        </div>
                      </div>
                      
                      {mapping.mapping.detectedFeatures.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mapping.mapping.detectedFeatures.map((feature, featureIndex) => (
                            <Badge key={featureIndex} variant="outline" className="text-xs">
                              {feature.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {mappings.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground border-t pt-2">
                      ... and {mappings.length - 5} more jobs
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {deliveryMappings.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No delivery methods were detected in the uploaded data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};