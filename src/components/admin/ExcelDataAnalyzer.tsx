import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, MapPin, Database, Eye, Target, Package, Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExcelDataAnalyzerProps {
  data: {
    fileName: string;
    headers: string[];
    totalRows: number;
    jobs: any[];
    stats: any;
    mapping: any;
    debugLog: string[];
    isMatrixMode?: boolean;
    matrixData?: any;
    paperMappings?: any[];
    deliveryMappings?: any[];
    enhancedDeliveryMappings?: any[];
    unmappedPaperSpecs?: string[];
    unmappedDeliverySpecs?: string[];
  };
  onMappingCreated: () => void;
}

interface TextPattern {
  text: string;
  frequency: number;
  type: 'production_stage' | 'paper_specification' | 'delivery_specification';
}

interface MappingOption {
  id: string;
  name: string;
  display_name?: string;
  color?: string;
  category?: string;
}

interface MappingState {
  patterns: TextPattern[];
  mappedPatterns: Set<string>;
  isLoading: boolean;
  searchTerm: string;
  selectedType: 'all' | 'production_stage' | 'paper_specification' | 'delivery_specification';
  currentPage: number;
  patternsPerPage: number;
}

interface MappingOptions {
  productionStages: MappingOption[];
  stageSpecifications: MappingOption[];
  paperTypes: MappingOption[];
  paperWeights: MappingOption[];
  deliveryMethods: MappingOption[];
}

export const ExcelDataAnalyzer: React.FC<ExcelDataAnalyzerProps> = ({ data, onMappingCreated }) => {
  // Consolidated state management
  const [mappingState, setMappingState] = useState<MappingState>({
    patterns: [],
    mappedPatterns: new Set(),
    isLoading: true,
    searchTerm: "",
    selectedType: 'all',
    currentPage: 1,
    patternsPerPage: 50,
  });

  const [mappingOptions, setMappingOptions] = useState<MappingOptions>({
    productionStages: [],
    stageSpecifications: [],
    paperTypes: [],
    paperWeights: [],
    deliveryMethods: [],
  });

  const [selectedMappings, setSelectedMappings] = useState({
    productionStage: "",
    stageSpecification: "",
    paperType: "",
    paperWeight: "",
    deliveryMethod: "",
    addressPattern: "",
    isCollection: false,
  });

  const [activeMappingPattern, setActiveMappingPattern] = useState<string>("");
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);

  const { toast } = useToast();

  // Single data loading function
  const loadAllData = useCallback(async () => {
    setMappingState(prev => ({ ...prev, isLoading: true }));

    try {
      // Load all options in parallel
      const [
        productionStagesResult,
        printSpecsResult,
        existingMappingsResult
      ] = await Promise.all([
        supabase
          .from('production_stages')
          .select('id, name, color')
          .eq('is_active', true)
          .order('order_index'),
        
        supabase
          .from('print_specifications')
          .select('id, name, display_name, category')
          .eq('is_active', true)
          .order('category, sort_order, name'),
        
        supabase
          .from('excel_import_mappings')
          .select('excel_text')
          .eq('is_verified', true)
      ]);

      if (productionStagesResult.error) throw productionStagesResult.error;
      if (printSpecsResult.error) throw printSpecsResult.error;
      if (existingMappingsResult.error) throw existingMappingsResult.error;

      // Process specifications by category
      const specs = printSpecsResult.data || [];
      const paperTypes = specs.filter(s => s.category === 'paper_type');
      const paperWeights = specs.filter(s => s.category === 'paper_weight');
      const deliveryMethods = specs.filter(s => s.category === 'delivery_method');

      setMappingOptions({
        productionStages: productionStagesResult.data || [],
        stageSpecifications: [], // Will be loaded when production stage is selected
        paperTypes,
        paperWeights,
        deliveryMethods,
      });

      // Get existing mappings
      const mappedTexts = new Set(existingMappingsResult.data?.map(m => m.excel_text) || []);

      // Extract and categorize patterns
      const patterns = extractPatternsFromData(data);
      const unmappedPatterns = patterns.filter(p => !mappedTexts.has(p.text));

      setMappingState(prev => ({
        ...prev,
        patterns: unmappedPatterns,
        mappedPatterns: mappedTexts,
        isLoading: false,
      }));

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load mapping data",
        variant: "destructive",
      });
      setMappingState(prev => ({ ...prev, isLoading: false }));
    }
  }, [data, toast]);

  // Extract patterns from Excel data
  const extractPatternsFromData = (data: any): TextPattern[] => {
    const patternFrequency = new Map<string, { frequency: number; type: TextPattern['type'] }>();
    
    data.jobs.forEach((job: any) => {
      const patterns: Array<{ text: string; type: TextPattern['type'] }> = [];
      
      // Basic fields - assume production stage
      if (job.category) patterns.push({ text: job.category, type: 'production_stage' });
      if (job.specification) patterns.push({ text: job.specification, type: 'production_stage' });
      if (job.reference) patterns.push({ text: job.reference, type: 'production_stage' });
      if (job.location) patterns.push({ text: job.location, type: 'delivery_specification' });
      
      // Matrix mode - analyze specification groups
      if (data.isMatrixMode) {
        const specGroups = {
          'paper_specifications': 'paper_specification' as const,
          'printing_specifications': 'production_stage' as const,
          'finishing_specifications': 'production_stage' as const,
          'prepress_specifications': 'production_stage' as const,
          'delivery_specifications': 'delivery_specification' as const,
        };
        
        Object.entries(specGroups).forEach(([groupKey, type]) => {
          if (job[groupKey] && typeof job[groupKey] === 'object') {
            Object.values(job[groupKey]).forEach((spec: any) => {
              if (spec?.specifications) patterns.push({ text: spec.specifications, type });
              if (spec?.description) patterns.push({ text: spec.description, type });
            });
          }
        });
      }
      
      // Update frequency map
      patterns.forEach(({ text, type }) => {
        if (text && text.trim().length > 0) {
          const trimmedText = text.trim();
          const existing = patternFrequency.get(trimmedText);
          if (existing) {
            existing.frequency++;
          } else {
            patternFrequency.set(trimmedText, { frequency: 1, type });
          }
        }
      });
    });
    
    return Array.from(patternFrequency.entries()).map(([text, { frequency, type }]) => ({
      text,
      frequency,
      type
    }));
  };

  // Load stage specifications when production stage changes
  const loadStageSpecifications = useCallback(async (stageId: string) => {
    if (!stageId) {
      setMappingOptions(prev => ({ ...prev, stageSpecifications: [] }));
      return;
    }

    try {
      const { data: specs, error } = await supabase
        .from('stage_specifications')
        .select('id, name, production_stage_id')
        .eq('production_stage_id', stageId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMappingOptions(prev => ({ ...prev, stageSpecifications: specs || [] }));
    } catch (error) {
      console.error('Error loading stage specifications:', error);
    }
  }, []);

  // Filtered patterns with memoization
  const filteredPatterns = useMemo(() => {
    let filtered = mappingState.patterns;

    // Filter by search term
    if (mappingState.searchTerm.trim()) {
      const searchTerm = mappingState.searchTerm.toLowerCase();
      filtered = filtered.filter(pattern => 
        pattern.text.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by type
    if (mappingState.selectedType !== 'all') {
      filtered = filtered.filter(pattern => pattern.type === mappingState.selectedType);
    }

    // Sort by frequency (descending)
    return filtered.sort((a, b) => b.frequency - a.frequency);
  }, [mappingState.patterns, mappingState.searchTerm, mappingState.selectedType]);

  // Paginated patterns
  const paginatedPatterns = useMemo(() => {
    const start = (mappingState.currentPage - 1) * mappingState.patternsPerPage;
    const end = start + mappingState.patternsPerPage;
    return filteredPatterns.slice(start, end);
  }, [filteredPatterns, mappingState.currentPage, mappingState.patternsPerPage]);

  const totalPages = Math.ceil(filteredPatterns.length / mappingState.patternsPerPage);

  // Create mapping function
  const createMapping = async (pattern: TextPattern) => {
    if (isCreatingMapping) return;

    setActiveMappingPattern(pattern.text);
    setIsCreatingMapping(true);

    try {
      let result;

      switch (pattern.type) {
        case 'production_stage':
          if (!selectedMappings.productionStage) {
            throw new Error("Please select a production stage");
          }
          
          // Validate UUID format
          if (!selectedMappings.productionStage.match(/^[0-9a-f-]{36}$/i)) {
            throw new Error("Invalid production stage selection");
          }
          
          result = await supabase.rpc('upsert_excel_mapping', {
            p_excel_text: pattern.text,
            p_production_stage_id: selectedMappings.productionStage,
            p_stage_specification_id: selectedMappings.stageSpecification || null,
            p_confidence_score: 100
          });
          break;

        case 'paper_specification':
          if (!selectedMappings.paperType || !selectedMappings.paperWeight) {
            throw new Error("Please select both paper type and weight");
          }
          
          // Validate UUID formats
          if (!selectedMappings.paperType.match(/^[0-9a-f-]{36}$/i) || !selectedMappings.paperWeight.match(/^[0-9a-f-]{36}$/i)) {
            throw new Error("Invalid paper specification selection");
          }
          
          result = await supabase.rpc('upsert_paper_specification_mapping', {
            p_excel_text: pattern.text,
            p_paper_type_id: selectedMappings.paperType,
            p_paper_weight_id: selectedMappings.paperWeight,
            p_confidence_score: 100
          });
          break;

        case 'delivery_specification':
          if (!selectedMappings.isCollection && !selectedMappings.deliveryMethod) {
            throw new Error("Please select a delivery method or mark as collection");
          }
          
          // Validate UUID format if delivery method is selected
          if (selectedMappings.deliveryMethod && !selectedMappings.deliveryMethod.match(/^[0-9a-f-]{36}$/i)) {
            throw new Error("Invalid delivery method selection");
          }
          
          result = await supabase.rpc('upsert_delivery_specification_mapping', {
            p_excel_text: pattern.text,
            p_delivery_method_id: selectedMappings.isCollection ? null : selectedMappings.deliveryMethod,
            p_address_pattern: selectedMappings.addressPattern || null,
            p_is_collection: selectedMappings.isCollection,
            p_confidence_score: 100
          });
          break;

        default:
          throw new Error("Invalid mapping type");
      }

      if (result.error) {
        console.error('Supabase RPC Error:', result.error);
        throw new Error(result.error.message || "Database operation failed");
      }

      // Check if we got data back from the RPC function
      if (!result.data || result.data.length === 0) {
        throw new Error("No response from mapping function");
      }

      const mappingResult = result.data[0];
      console.log('Mapping result:', mappingResult);

      // Only update UI state if database operation was successful
      setMappingState(prev => ({
        ...prev,
        patterns: prev.patterns.filter(p => p.text !== pattern.text),
        mappedPatterns: new Set([...prev.mappedPatterns, pattern.text]),
      }));

      toast({
        title: "Mapping Created",
        description: `Successfully ${mappingResult.action_taken} mapping for "${pattern.text}"`,
      });

      if (onMappingCreated) onMappingCreated();

    } catch (error: any) {
      console.error('Error creating mapping:', error);
      toast({
        title: "Mapping Failed",
        description: error.message || "Failed to create mapping. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingMapping(false);
      setActiveMappingPattern("");
    }
  };

  // Bulk mapping function
  const createBulkMappings = async (patterns: TextPattern[], mappingConfig: any) => {
    if (isCreatingMapping) return;
    setIsCreatingMapping(true);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const pattern of patterns) {
        try {
          let result;
          
          switch (pattern.type) {
            case 'production_stage':
              result = await supabase.rpc('upsert_excel_mapping', {
                p_excel_text: pattern.text,
                p_production_stage_id: mappingConfig.productionStage,
                p_stage_specification_id: mappingConfig.stageSpecification || null,
                p_confidence_score: 100
              });
              break;
            // Add other cases as needed
          }

          if (result?.error) throw result.error;
          successCount++;
          
          // Remove from patterns immediately
          setMappingState(prev => ({
            ...prev,
            patterns: prev.patterns.filter(p => p.text !== pattern.text),
            mappedPatterns: new Set([...prev.mappedPatterns, pattern.text]),
          }));

        } catch (error) {
          console.error(`Error mapping "${pattern.text}":`, error);
          errorCount++;
        }
      }

      toast({
        title: "Bulk Mapping Complete",
        description: `Created ${successCount} mappings${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
      });

      if (onMappingCreated) onMappingCreated();

    } finally {
      setIsCreatingMapping(false);
    }
  };

  // Initialize data loading
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Load stage specifications when production stage changes
  useEffect(() => {
    if (selectedMappings.productionStage) {
      loadStageSpecifications(selectedMappings.productionStage);
    }
  }, [selectedMappings.productionStage, loadStageSpecifications]);

  if (mappingState.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading mapping data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Patterns</p>
                <p className="text-2xl font-bold">{mappingState.patterns.length}</p>
              </div>
              <Database className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Already Mapped</p>
                <p className="text-2xl font-bold text-green-600">{mappingState.mappedPatterns.size}</p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Mapping</p>
                <p className="text-2xl font-bold text-orange-600">{filteredPatterns.length}</p>
              </div>
              <MapPin className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patterns..."
                  value={mappingState.searchTerm}
                  onChange={(e) => setMappingState(prev => ({ 
                    ...prev, 
                    searchTerm: e.target.value,
                    currentPage: 1 
                  }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select
              value={mappingState.selectedType}
              onValueChange={(value: any) => setMappingState(prev => ({ 
                ...prev, 
                selectedType: value,
                currentPage: 1 
              }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="production_stage">Production Stage</SelectItem>
                <SelectItem value="paper_specification">Paper Specification</SelectItem>
                <SelectItem value="delivery_specification">Delivery Specification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mapping Configuration Tabs */}
          <Tabs defaultValue="production_stage" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="production_stage" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Production Stage
              </TabsTrigger>
              <TabsTrigger value="paper_specification" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Paper Specification
              </TabsTrigger>
              <TabsTrigger value="delivery_specification" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Delivery Specification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="production_stage" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Production Stage</label>
                  <Select
                    value={selectedMappings.productionStage}
                    onValueChange={(value) => setSelectedMappings(prev => ({ 
                      ...prev, 
                      productionStage: value,
                      stageSpecification: "" 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select production stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingOptions.productionStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            {stage.color && (
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                            )}
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mappingOptions.stageSpecifications.length > 0 && (
                  <div>
                    <label className="text-sm font-medium">Stage Specification (Optional)</label>
                    <Select
                      value={selectedMappings.stageSpecification}
                      onValueChange={(value) => setSelectedMappings(prev => ({ 
                        ...prev, 
                        stageSpecification: value 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select specification" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappingOptions.stageSpecifications.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="paper_specification" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Paper Type</label>
                  <Select
                    value={selectedMappings.paperType}
                    onValueChange={(value) => setSelectedMappings(prev => ({ 
                      ...prev, 
                      paperType: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper type" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingOptions.paperTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.display_name || type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Paper Weight</label>
                  <Select
                    value={selectedMappings.paperWeight}
                    onValueChange={(value) => setSelectedMappings(prev => ({ 
                      ...prev, 
                      paperWeight: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select paper weight" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingOptions.paperWeights.map((weight) => (
                        <SelectItem key={weight.id} value={weight.id}>
                          {weight.display_name || weight.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="delivery_specification" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Delivery Method</label>
                  <Select
                    value={selectedMappings.deliveryMethod}
                    onValueChange={(value) => setSelectedMappings(prev => ({ 
                      ...prev, 
                      deliveryMethod: value,
                      isCollection: false 
                    }))}
                    disabled={selectedMappings.isCollection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery method" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingOptions.deliveryMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.display_name || method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Collection Option</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isCollection"
                      checked={selectedMappings.isCollection}
                      onChange={(e) => setSelectedMappings(prev => ({ 
                        ...prev, 
                        isCollection: e.target.checked,
                        deliveryMethod: e.target.checked ? "" : prev.deliveryMethod
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="isCollection" className="text-sm">
                      Mark as Collection
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Address Pattern (Optional)</label>
                <Input
                  placeholder="e.g., regex pattern for address extraction"
                  value={selectedMappings.addressPattern}
                  onChange={(e) => setSelectedMappings(prev => ({ 
                    ...prev, 
                    addressPattern: e.target.value 
                  }))}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Pattern Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern Text</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPatterns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {filteredPatterns.length === 0 ? "No patterns found" : "No patterns match your filter"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPatterns.map((pattern) => (
                    <TableRow key={pattern.text}>
                      <TableCell className="font-mono text-sm max-w-md">
                        <div className="truncate" title={pattern.text}>
                          {pattern.text}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {pattern.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {pattern.frequency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => createMapping(pattern)}
                          disabled={isCreatingMapping}
                        >
                          {isCreatingMapping && activeMappingPattern === pattern.text ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Map"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((mappingState.currentPage - 1) * mappingState.patternsPerPage) + 1} to{' '}
                {Math.min(mappingState.currentPage * mappingState.patternsPerPage, filteredPatterns.length)} of{' '}
                {filteredPatterns.length} patterns
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMappingState(prev => ({ 
                    ...prev, 
                    currentPage: Math.max(1, prev.currentPage - 1) 
                  }))}
                  disabled={mappingState.currentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="text-sm">
                  Page {mappingState.currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMappingState(prev => ({ 
                    ...prev, 
                    currentPage: Math.min(totalPages, prev.currentPage + 1) 
                  }))}
                  disabled={mappingState.currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};