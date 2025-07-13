import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, Info, Sparkles, Factory } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export interface ExcelPreviewData {
  headers: string[];
  sampleRows: any[][];
  totalRows: number;
}

export interface ColumnMapping {
  [key: string]: number; // field name -> column index (-1 means unmapped)
  // Stage mappings: `stage_${stageId}` -> column index
  // Example: "stage_2bc1c3dc-9ec2-42ca-89a4-b40e557c6e9d" -> 5
}

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: ExcelPreviewData | null;
  autoDetectedMapping: ColumnMapping;
  onMappingConfirmed: (mapping: ColumnMapping) => void;
}

const FIELD_DEFINITIONS = [
  { key: 'woNo', label: 'Work Order Number', required: true, description: 'Unique identifier for the job' },
  { key: 'customer', label: 'Customer', required: true, description: 'Customer name' },
  { key: 'status', label: 'Status', required: false, description: 'Current job status' },
  { key: 'date', label: 'Date', required: false, description: 'Job creation date' },
  { key: 'rep', label: 'Representative', required: false, description: 'Sales representative' },
  { key: 'category', label: 'Category', required: false, description: 'Job category or type' },
  { key: 'reference', label: 'Reference', required: false, description: 'Job reference number' },
  { key: 'qty', label: 'Quantity', required: false, description: 'Number of items' },
  { key: 'dueDate', label: 'Due Date', required: false, description: 'Job due date' },
  { key: 'location', label: 'Location', required: false, description: 'Job location or department' },
  { key: 'estimatedHours', label: 'Estimated Hours', required: false, description: 'Estimated duration in hours' },
  { key: 'setupTime', label: 'Setup Time', required: false, description: 'Setup time in minutes' },
  { key: 'runningSpeed', label: 'Running Speed', required: false, description: 'Production speed' },
  { key: 'speedUnit', label: 'Speed Unit', required: false, description: 'Unit for speed measurement' },
  { key: 'specifications', label: 'Specifications', required: false, description: 'Job specifications' },
  { key: 'paperWeight', label: 'Paper Weight', required: false, description: 'Paper weight (GSM)' },
  { key: 'paperType', label: 'Paper Type', required: false, description: 'Type of paper/stock' },
  { key: 'lamination', label: 'Lamination', required: false, description: 'Lamination or finishing type' }
];

interface ProductionStage {
  id: string;
  name: string;
  color: string;
}

export const ColumnMappingDialog: React.FC<ColumnMappingDialogProps> = ({
  open,
  onOpenChange,
  previewData,
  autoDetectedMapping,
  onMappingConfirmed
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [showPreview, setShowPreview] = useState(false);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [activeTab, setActiveTab] = useState("basic");

  // Load production stages
  useEffect(() => {
    const loadProductionStages = async () => {
      const { data, error } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index');
      
      if (!error && data) {
        setProductionStages(data);
      }
    };

    if (open) {
      loadProductionStages();
    }
  }, [open]);

  useEffect(() => {
    if (autoDetectedMapping) {
      setMapping(autoDetectedMapping);
    }
  }, [autoDetectedMapping]);

  const handleMappingChange = (fieldKey: string, columnIndex: string) => {
    const index = columnIndex === 'unmapped' ? -1 : parseInt(columnIndex);
    setMapping(prev => ({
      ...prev,
      [fieldKey]: index
    }));
  };

  const applyAutoMapping = () => {
    setMapping(autoDetectedMapping);
  };

  const clearAllMappings = () => {
    const clearedMapping: ColumnMapping = {};
    FIELD_DEFINITIONS.forEach(field => {
      clearedMapping[field.key] = -1;
    });
    // Clear stage mappings too
    productionStages.forEach(stage => {
      clearedMapping[`stage_${stage.id}`] = -1;
    });
    setMapping(clearedMapping);
  };

  const getValidationStatus = () => {
    const requiredFields = FIELD_DEFINITIONS.filter(f => f.required);
    const missingRequired = requiredFields.filter(field => mapping[field.key] === -1 || mapping[field.key] === undefined);
    const basicMappedCount = Object.entries(mapping).filter(([key, index]) => !key.startsWith('stage_') && index !== -1).length;
    const stageMappedCount = Object.entries(mapping).filter(([key, index]) => key.startsWith('stage_') && index !== -1).length;
    const totalMappedCount = basicMappedCount + stageMappedCount;
    
    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      mappedCount: totalMappedCount,
      basicMappedCount,
      stageMappedCount,
      totalFields: FIELD_DEFINITIONS.length + productionStages.length
    };
  };

  const handleConfirm = () => {
    onMappingConfirmed(mapping);
    onOpenChange(false);
  };

  const validation = getValidationStatus();

  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Map Excel Columns to Fields
          </DialogTitle>
          <DialogDescription>
            Map your Excel columns to the corresponding database fields. Required fields must be mapped to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">File Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{previewData.totalRows}</div>
                <div className="text-sm text-muted-foreground">data rows</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Columns Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{previewData.headers.length}</div>
                <div className="text-sm text-muted-foreground">columns detected</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Basic Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{validation.basicMappedCount}</div>
                <div className="text-sm text-muted-foreground">of {FIELD_DEFINITIONS.length} mapped</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1">
                  <Factory className="h-3 w-3" />
                  Stages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{validation.stageMappedCount}</div>
                <div className="text-sm text-muted-foreground">of {productionStages.length} mapped</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={applyAutoMapping}>
              <Sparkles className="h-4 w-4 mr-2" />
              Apply Auto-Detection
            </Button>
            <Button variant="outline" size="sm" onClick={clearAllMappings}>
              Clear All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Hide' : 'Show'} Data Preview
            </Button>
          </div>

          {/* Validation Status */}
          {!validation.isValid && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Missing Required Fields</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    The following required fields must be mapped: {validation.missingRequired.map(f => f.label).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tabbed Mapping Interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Job Fields</TabsTrigger>
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Factory className="h-4 w-4" />
                Production Stages
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Job Field Mapping</CardTitle>
                  <CardDescription>
                    Map basic job information fields to Excel columns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Excel Column</TableHead>
                        <TableHead>Sample Data</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FIELD_DEFINITIONS.map((field) => {
                        const columnIndex = mapping[field.key];
                        const sampleValue = columnIndex !== -1 && columnIndex !== undefined && previewData.sampleRows[0] 
                          ? previewData.sampleRows[0][columnIndex] 
                          : null;
                        
                        return (
                          <TableRow key={field.key}>
                            <TableCell>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{field.label}</span>
                                  {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">{field.description}</div>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <Select
                                value={columnIndex === -1 || columnIndex === undefined ? 'unmapped' : columnIndex.toString()}
                                onValueChange={(value) => handleMappingChange(field.key, value)}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unmapped">
                                    <span className="text-muted-foreground">Not mapped</span>
                                  </SelectItem>
                                  {previewData.headers.map((header, index) => (
                                    <SelectItem key={index} value={index.toString()}>
                                      {header || `Column ${index + 1}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            
                            <TableCell>
                              {sampleValue ? (
                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                  {String(sampleValue).substring(0, 30)}{String(sampleValue).length > 30 ? '...' : ''}
                                </code>
                              ) : (
                                <span className="text-muted-foreground text-sm">No data</span>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {columnIndex !== -1 && columnIndex !== undefined ? (
                                <Badge variant="default" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Mapped
                                </Badge>
                              ) : field.required ? (
                                <Badge variant="destructive">Required</Badge>
                              ) : (
                                <Badge variant="outline">Optional</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="stages" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    Production Stage Mapping
                  </CardTitle>
                  <CardDescription>
                    Map Excel columns to production stages. This will create stage instances for each mapped stage when jobs are created.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Production Stage</TableHead>
                        <TableHead>Excel Column</TableHead>
                        <TableHead>Sample Data</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionStages.map((stage) => {
                        const stageKey = `stage_${stage.id}`;
                        const columnIndex = mapping[stageKey];
                        const sampleValue = columnIndex !== -1 && columnIndex !== undefined && previewData.sampleRows[0] 
                          ? previewData.sampleRows[0][columnIndex] 
                          : null;
                        
                        return (
                          <TableRow key={stage.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: stage.color }}
                                />
                                <span className="font-medium">{stage.name}</span>
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <Select
                                value={columnIndex === -1 || columnIndex === undefined ? 'unmapped' : columnIndex.toString()}
                                onValueChange={(value) => handleMappingChange(stageKey, value)}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select column..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unmapped">
                                    <span className="text-muted-foreground">Not mapped</span>
                                  </SelectItem>
                                  {previewData.headers.map((header, index) => (
                                    <SelectItem key={index} value={index.toString()}>
                                      {header || `Column ${index + 1}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            
                            <TableCell>
                              {sampleValue ? (
                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                  {String(sampleValue).substring(0, 30)}{String(sampleValue).length > 30 ? '...' : ''}
                                </code>
                              ) : (
                                <span className="text-muted-foreground text-sm">No data</span>
                              )}
                            </TableCell>
                            
                            <TableCell>
                              {columnIndex !== -1 && columnIndex !== undefined ? (
                                <Badge variant="default" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Mapped
                                </Badge>
                              ) : (
                                <Badge variant="outline">Optional</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Data Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Data Preview
                </CardTitle>
                <CardDescription>
                  First few rows from your Excel file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.headers.map((header, index) => (
                          <TableHead key={index} className="min-w-24">
                            {header || `Column ${index + 1}`}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.sampleRows.slice(0, 5).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} className="max-w-32 truncate">
                              {cell || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!validation.isValid}
              className="min-w-32"
            >
              {validation.isValid ? 'Confirm Mapping' : 'Fix Required Fields'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};