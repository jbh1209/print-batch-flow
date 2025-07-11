import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Package, Truck, ArrowRight } from "lucide-react";
import { usePrintSpecifications } from "@/hooks/usePrintSpecifications";

interface PaperMapping {
  woNo: string;
  originalText: string;
  mapping: {
    paperType: string;
    paperWeight: string;
    confidence: number;
    excelText: string;
  };
  confidence: number;
}

interface DeliveryMapping {
  woNo: string;
  originalText: string;
  mapping: {
    method: 'delivery' | 'collection';
    confidence: number;
  };
  confidence: number;
}

interface PaperSpecificationMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperMappings: PaperMapping[];
  deliveryMappings: DeliveryMapping[];
  unmappedPaperSpecs: string[];
  unmappedDeliverySpecs: string[];
  onConfirm: () => void;
}

export const PaperSpecificationMappingDialog: React.FC<PaperSpecificationMappingDialogProps> = ({
  open,
  onOpenChange,
  paperMappings,
  deliveryMappings,
  unmappedPaperSpecs,
  unmappedDeliverySpecs,
  onConfirm
}) => {
  const { specifications } = usePrintSpecifications();
  const [selectedTab, setSelectedTab] = useState<'paper' | 'delivery' | 'unmapped'>('paper');

  const paperTypeSpecs = specifications.filter(spec => spec.category === 'paper_type');
  const paperWeightSpecs = specifications.filter(spec => spec.category === 'paper_weight');

  const averageConfidence = paperMappings.length > 0 
    ? paperMappings.reduce((sum, m) => sum + m.confidence, 0) / paperMappings.length 
    : 0;

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (confidence >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Enhanced Specification Mapping Results
          </DialogTitle>
          <DialogDescription>
            Review the automatically detected paper types, weights, and delivery methods from your Excel data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Mapping Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium">Paper Specifications</div>
                  <div className="text-2xl font-bold text-blue-600">{paperMappings.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Delivery Methods</div>
                  <div className="text-2xl font-bold text-green-600">{deliveryMappings.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Average Confidence</div>
                  <div className="text-2xl font-bold">{Math.round(averageConfidence)}%</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Unmapped Items</div>
                  <div className="text-2xl font-bold text-amber-600">
                    {unmappedPaperSpecs.length + unmappedDeliverySpecs.length}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Overall Mapping Confidence</div>
                <Progress value={averageConfidence} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setSelectedTab('paper')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'paper' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Paper Specifications ({paperMappings.length})
            </button>
            <button
              onClick={() => setSelectedTab('delivery')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'delivery' 
                  ? 'bg-white text-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Delivery Methods ({deliveryMappings.length})
            </button>
            <button
              onClick={() => setSelectedTab('unmapped')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === 'unmapped' 
                  ? 'bg-white text-amber-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Unmapped Items ({unmappedPaperSpecs.length + unmappedDeliverySpecs.length})
            </button>
          </div>

          {/* Paper Specifications Tab */}
          {selectedTab === 'paper' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Paper Type & Weight Mappings
                </CardTitle>
                <CardDescription>
                  Automatically detected paper specifications from Excel text
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Original Text</TableHead>
                        <TableHead>Paper Type</TableHead>
                        <TableHead>Paper Weight</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paperMappings.map((mapping, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{mapping.woNo}</TableCell>
                          <TableCell className="max-w-xs truncate" title={mapping.originalText}>
                            {mapping.originalText}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{mapping.mapping.paperType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{mapping.mapping.paperWeight}</Badge>
                          </TableCell>
                          <TableCell>
                            {getConfidenceBadge(mapping.confidence)}
                            <span className="ml-2 text-sm text-gray-500">
                              {Math.round(mapping.confidence)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delivery Methods Tab */}
          {selectedTab === 'delivery' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Method Detection
                </CardTitle>
                <CardDescription>
                  Automatically detected delivery preferences from Excel text
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Work Order</TableHead>
                        <TableHead>Original Text</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryMappings.map((mapping, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{mapping.woNo}</TableCell>
                          <TableCell className="max-w-xs truncate" title={mapping.originalText}>
                            {mapping.originalText}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={mapping.mapping.method === 'delivery' ? 'default' : 'secondary'}
                              className="flex items-center gap-1 w-fit"
                            >
                              {mapping.mapping.method === 'delivery' ? (
                                <Truck className="h-3 w-3" />
                              ) : (
                                <Package className="h-3 w-3" />
                              )}
                              {mapping.mapping.method === 'delivery' ? 'Delivery' : 'Collection'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getConfidenceBadge(mapping.confidence)}
                            <span className="ml-2 text-sm text-gray-500">
                              {Math.round(mapping.confidence)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unmapped Items Tab */}
          {selectedTab === 'unmapped' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Unmapped Specifications
                </CardTitle>
                <CardDescription>
                  Items that could not be automatically mapped and may need manual review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unmappedPaperSpecs.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Unmapped Paper Specifications</h4>
                      <div className="space-y-2">
                        {unmappedPaperSpecs.map((spec, index) => (
                          <div key={index} className="p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                            {spec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {unmappedDeliverySpecs.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Unmapped Delivery Specifications</h4>
                      <div className="space-y-2">
                        {unmappedDeliverySpecs.map((spec, index) => (
                          <div key={index} className="p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                            {spec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {unmappedPaperSpecs.length === 0 && unmappedDeliverySpecs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      All specifications were successfully mapped!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              This enhanced mapping will help organize production by paper type and delivery method
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={onConfirm}
                className="flex items-center gap-2"
              >
                Accept Mappings
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};