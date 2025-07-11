import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, MapPin, Database, Eye, Target, Package, Truck, Sparkles, Settings, FileText, Wand2, Plus, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaperSpecificationMappingDialog } from "@/components/admin/mapping/PaperSpecificationMappingDialog";
import { DeliverySpecificationMappingDialog } from "@/components/admin/mapping/DeliverySpecificationMappingDialog";
import { AutoMappingResultsDialog } from "@/components/admin/mapping/AutoMappingResultsDialog";
import { AutomaticMappingCreator, type AutoMappingResult } from "@/utils/excel/automaticMappingCreator";
import { EnhancedMappingProcessor } from "@/utils/excel/enhancedMappingProcessor";

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

interface ProductionStage {
  id: string;
  name: string;
  color?: string;
}

interface StageSpecification {
  id: string;
  name: string;
  production_stage_id: string;
}

interface PrintSpecification {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description?: string;
}

export const ExcelDataAnalyzer: React.FC<ExcelDataAnalyzerProps> = ({ data, onMappingCreated }) => {
  const [filteredJobs, setFilteredJobs] = useState(data.jobs);
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [mappedRows, setMappedRows] = useState<Set<number>>(new Set());
  const [hideMappedRows, setHideMappedRows] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [stageSpecifications, setStageSpecifications] = useState<StageSpecification[]>([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedSpecification, setSelectedSpecification] = useState("");
  
  // Paper specification mapping state
  const [paperTypes, setPaperTypes] = useState<PrintSpecification[]>([]);
  const [paperWeights, setPaperWeights] = useState<PrintSpecification[]>([]);
  const [selectedPaperType, setSelectedPaperType] = useState("");
  const [selectedPaperWeight, setSelectedPaperWeight] = useState("");
  
  // Delivery specification mapping state
  const [deliveryMethods, setDeliveryMethods] = useState<PrintSpecification[]>([]);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState("");
  const [addressPattern, setAddressPattern] = useState("");
  const [isCollection, setIsCollection] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);
  const [currentExcelText, setCurrentExcelText] = useState("");
  
  // Enhanced pattern management state
  const [patternSearchTerm, setPatternSearchTerm] = useState("");
  const [patternSortBy, setPatternSortBy] = useState<'frequency' | 'alphabetical' | 'length'>('frequency');
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());
  const [patternFilter, setPatternFilter] = useState<'all' | 'gsm' | 'delivery' | 'paper' | 'print'>('all');
  const [patternsPerPage, setPatternsPerPage] = useState(100);
  const [currentPatternPage, setCurrentPatternPage] = useState(1);
  const [showPatternPreview, setShowPatternPreview] = useState("");
  
  const { toast } = useToast();
  
  // Extract enhanced mapping data
  const paperMappings = data.paperMappings || [];
  const deliveryMappings = data.deliveryMappings || [];
  const enhancedDeliveryMappings = data.enhancedDeliveryMappings || [];
  const unmappedPaperSpecs = data.unmappedPaperSpecs || [];
  const unmappedDeliverySpecs = data.unmappedDeliverySpecs || [];
  
  // Analyze paper specifications
  const paperTypesFromData = [...new Set(data.jobs.map((job: any) => job.paper_specifications?.parsed_paper?.type).filter(Boolean))];
  const paperWeightsFromData = [...new Set(data.jobs.map((job: any) => job.paper_specifications?.parsed_paper?.weight).filter(Boolean))];
  const deliveryMethodsFromData = [...new Set(data.jobs.map((job: any) => job.delivery_specifications?.parsed_delivery?.method).filter(Boolean))];

  const itemsPerPage = 50;
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  useEffect(() => {
    loadProductionStages();
    loadPrintSpecifications();
  }, []);

  useEffect(() => {
    if (selectedStage) {
      loadStageSpecifications(selectedStage);
    } else {
      setStageSpecifications([]);
      setSelectedSpecification("");
    }
  }, [selectedStage]);

  useEffect(() => {
    filterJobs();
  }, [searchTerm, filterField, selectedGroup, selectedItemType, hideMappedRows, mappedRows, data.jobs]);

  useEffect(() => {
    // Reset item type when group changes
    setSelectedItemType("all");
  }, [selectedGroup]);

  const loadProductionStages = async () => {
    try {
      const { data: stages, error } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      setProductionStages(stages || []);
    } catch (error: any) {
      console.error('Error loading production stages:', error);
    }
  };

  const loadStageSpecifications = async (stageId: string) => {
    try {
      const { data: specs, error } = await supabase
        .from('stage_specifications')
        .select('id, name, production_stage_id')
        .eq('production_stage_id', stageId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStageSpecifications(specs || []);
    } catch (error: any) {
      console.error('Error loading stage specifications:', error);
    }
  };

  const loadPrintSpecifications = async () => {
    try {
      const { data: specs, error } = await supabase
        .from('print_specifications')
        .select('id, name, display_name, category, description')
        .eq('is_active', true)
        .order('category, sort_order, name');

      if (error) throw error;
      
      const paperTypeSpecs = specs?.filter(s => s.category === 'paper_type') || [];
      const paperWeightSpecs = specs?.filter(s => s.category === 'paper_weight') || [];
      const deliveryMethodSpecs = specs?.filter(s => s.category === 'delivery_method') || [];
      
      setPaperTypes(paperTypeSpecs);
      setPaperWeights(paperWeightSpecs);
      setDeliveryMethods(deliveryMethodSpecs);
    } catch (error: any) {
      console.error('Error loading print specifications:', error);
    }
  };

  const filterJobs = () => {
    let filtered = data.jobs;

    // Hide mapped rows filter
    if (hideMappedRows) {
      filtered = filtered.filter((job, index) => !mappedRows.has(index));
    }

    // Enhanced text search
    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      filtered = filtered.filter(job => {
        // Build comprehensive searchable text
        const searchableFields = [];
        
        // Basic job fields
        if (job.wo_no) searchableFields.push(job.wo_no.toString());
        if (job.customer) searchableFields.push(job.customer.toString());
        if (job.category) searchableFields.push(job.category.toString());
        if (job.specification) searchableFields.push(job.specification.toString());
        if (job.reference) searchableFields.push(job.reference.toString());
        if (job.location) searchableFields.push(job.location.toString());
        
        // Matrix mode - search within specifications
        if (data.isMatrixMode) {
          const specGroups = ['paper_specifications', 'printing_specifications', 'finishing_specifications', 'prepress_specifications', 'delivery_specifications'];
          
          specGroups.forEach(groupKey => {
            if (job[groupKey] && typeof job[groupKey] === 'object') {
              Object.values(job[groupKey]).forEach((spec: any) => {
                if (spec?.description) searchableFields.push(spec.description.toString());
                if (spec?.specifications) searchableFields.push(spec.specifications.toString());
                if (spec?.qty) searchableFields.push(spec.qty.toString());
              });
            }
          });
        }
        
        // Join all searchable text
        const searchableText = searchableFields.join(' ').toLowerCase();
        
        // All search terms must be found (AND logic)
        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    // Field filter
    if (filterField !== "all") {
      filtered = filtered.filter(job => {
        const fieldValue = job[filterField];
        return fieldValue && fieldValue.toString().trim() !== "";
      });
    }

    // Group filter (for matrix mode)
    if (data.isMatrixMode && selectedGroup !== "all") {
      filtered = filtered.filter(job => {
        const groupKey = `${selectedGroup.toLowerCase()}_specifications`;
        return job[groupKey] && Object.keys(job[groupKey]).length > 0;
      });
    }

    // Item type filter (for matrix mode)
    if (data.isMatrixMode && selectedGroup !== "all" && selectedItemType !== "all") {
      filtered = filtered.filter(job => {
        const groupKey = `${selectedGroup.toLowerCase()}_specifications`;
        const specifications = job[groupKey];
        return specifications && specifications[selectedItemType];
      });
    }

    setFilteredJobs(filtered);
    setCurrentPage(1);
    setSelectedJobs(new Set());
  };

  const getUniqueTextPatterns = () => {
    const patternFrequency = new Map<string, number>();
    
    data.jobs.forEach(job => {
      const patterns = [];
      
      if (job.category) patterns.push(job.category);
      if (job.specification) patterns.push(job.specification);
      if (job.reference) patterns.push(job.reference);
      if (job.location) patterns.push(job.location);
      
      if (data.isMatrixMode) {
        const specGroups = ['paper_specifications', 'printing_specifications', 'finishing_specifications', 'prepress_specifications', 'delivery_specifications'];
        
        specGroups.forEach(groupKey => {
          if (job[groupKey] && typeof job[groupKey] === 'object') {
            Object.values(job[groupKey]).forEach((spec: any) => {
              if (spec?.specifications) patterns.push(spec.specifications);
              if (spec?.description) patterns.push(spec.description);
            });
          }
        });
      }
      
      patterns.forEach(pattern => {
        if (pattern && pattern.trim().length > 0) {
          const text = pattern.trim();
          patternFrequency.set(text, (patternFrequency.get(text) || 0) + 1);
        }
      });
    });
    
    return Array.from(patternFrequency.entries()).map(([text, frequency]) => ({
      text,
      frequency
    }));
  };

  const createMapping = async (excelText: string, type: 'production_stage' | 'paper_specification' | 'delivery_specification') => {
    if (!excelText.trim()) return;

    setCurrentExcelText(excelText);
    setIsCreatingMapping(true);

    try {
      if (type === 'production_stage') {
        await createProductionStageMapping(excelText);
      } else if (type === 'paper_specification') {
        await createPaperSpecificationMapping(excelText);
      } else {
        await createDeliverySpecificationMapping(excelText);
      }
    } catch (error: any) {
      console.error('Error creating mapping:', error);
      toast({
        title: "Error",
        description: "Failed to create mapping",
        variant: "destructive",
      });
    } finally {
      setIsCreatingMapping(false);
      setCurrentExcelText("");
    }
  };

  const createProductionStageMapping = async (excelText: string) => {
    if (!selectedStage) {
      toast({
        title: "Error",
        description: "Please select a production stage",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc('upsert_excel_mapping', {
      p_excel_text: excelText,
      p_production_stage_id: selectedStage,
      p_stage_specification_id: selectedSpecification || null,
      p_confidence_score: 100
    });

    if (error) throw error;

    toast({
      title: "Production Stage Mapping Created",
      description: `Mapped "${excelText}" to production stage`,
    });

    if (onMappingCreated) onMappingCreated();
  };

  const createPaperSpecificationMapping = async (excelText: string) => {
    if (!selectedPaperType || !selectedPaperWeight) {
      toast({
        title: "Error",
        description: "Please select both paper type and weight",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc('upsert_paper_specification_mapping', {
      p_excel_text: excelText,
      p_paper_type_id: selectedPaperType,
      p_paper_weight_id: selectedPaperWeight,
      p_confidence_score: 100
    });

    if (error) throw error;

    toast({
      title: "Paper Mapping Created",
      description: `Mapped "${excelText}" to paper specifications`,
    });

    if (onMappingCreated) onMappingCreated();
  };

  const createDeliverySpecificationMapping = async (excelText: string) => {
    if (!isCollection && !selectedDeliveryMethod) {
      toast({
        title: "Error",
        description: "Please select a delivery method or mark as collection",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc('upsert_delivery_specification_mapping', {
      p_excel_text: excelText,
      p_delivery_method_id: isCollection ? null : selectedDeliveryMethod,
      p_address_pattern: addressPattern || null,
      p_is_collection: isCollection,
      p_confidence_score: 100
    });

    if (error) throw error;

    toast({
      title: "Delivery Mapping Created",
      description: `Mapped "${excelText}" to delivery specifications`,
    });

    if (onMappingCreated) onMappingCreated();
  };

  // Enhanced pattern filtering and sorting
  const getFilteredAndSortedPatterns = () => {
    let patterns = getUniqueTextPatterns();
    
    // Apply search filter
    if (patternSearchTerm.trim()) {
      const searchTerm = patternSearchTerm.toLowerCase();
      patterns = patterns.filter(pattern => 
        pattern.text.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply category filter
    if (patternFilter !== 'all') {
      patterns = patterns.filter(pattern => {
        const text = pattern.text.toLowerCase();
        switch (patternFilter) {
          case 'gsm':
            return text.includes('gsm') || text.includes('g/m') || /\d+\s*g[^a-z]/i.test(text);
          case 'delivery':
            return text.includes('delivery') || text.includes('collection') || text.includes('post') || text.includes('courier');
          case 'paper':
            return text.includes('paper') || text.includes('card') || text.includes('board') || text.includes('stock');
          case 'print':
            return text.includes('print') || text.includes('litho') || text.includes('digital') || text.includes('offset');
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    patterns.sort((a, b) => {
      switch (patternSortBy) {
        case 'frequency':
          return b.frequency - a.frequency;
        case 'alphabetical':
          return a.text.localeCompare(b.text);
        case 'length':
          return b.text.length - a.text.length;
        default:
          return 0;
      }
    });
    
    return patterns;
  };

  const getPatternPreviewJobs = (pattern: string) => {
    return data.jobs.filter(job => {
      const searchText = [
        job.category,
        job.specification,
        job.reference,
        job.location
      ].join(' ').toLowerCase();
      
      if (data.isMatrixMode) {
        const specGroups = ['paper_specifications', 'printing_specifications', 'finishing_specifications', 'prepress_specifications', 'delivery_specifications'];
        
        specGroups.forEach(groupKey => {
          if (job[groupKey] && typeof job[groupKey] === 'object') {
            Object.values(job[groupKey]).forEach((spec: any) => {
              if (spec?.specifications) searchText.concat(' ', spec.specifications.toLowerCase());
              if (spec?.description) searchText.concat(' ', spec.description.toLowerCase());
            });
          }
        });
      }
      
      return searchText.includes(pattern.toLowerCase());
    }).slice(0, 5); // Show first 5 examples
  };

  const handleBulkPatternMapping = (mappingType: 'production_stage' | 'paper_specification' | 'delivery_specification') => {
    if (selectedPatterns.size === 0) {
      toast({
        title: "No Patterns Selected",
        description: "Please select patterns to map",
        variant: "destructive",
      });
      return;
    }

    // Process each selected pattern
    Array.from(selectedPatterns).forEach(pattern => {
      createMapping(pattern, mappingType);
    });
    
    setSelectedPatterns(new Set());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Excel Data Analysis & Mapping</CardTitle>
          <p className="text-sm text-muted-foreground">
            Analyze your Excel data and create intelligent mappings for production stages, paper types, and delivery methods
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="production-stages" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="production-stages" className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Production Stages
              </TabsTrigger>
              <TabsTrigger value="paper-specs" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Paper Specifications
              </TabsTrigger>
              <TabsTrigger value="delivery-collection" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Delivery & Collection
              </TabsTrigger>
              <TabsTrigger value="statistics" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Statistics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="production-stages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Production Stage Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Map Excel text patterns to production stages in your workflow
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Production Stage</label>
                      <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select production stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {productionStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Stage Specification (optional)</label>
                      <Select value={selectedSpecification} onValueChange={setSelectedSpecification}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specification" />
                        </SelectTrigger>
                        <SelectContent>
                          {stageSpecifications.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id}>
                              {spec.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Pattern Controls */}
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1">
                        <Input
                          placeholder="Search patterns..."
                          value={patternSearchTerm}
                          onChange={(e) => setPatternSearchTerm(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Select value={patternFilter} onValueChange={(value: any) => setPatternFilter(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="gsm">GSM/Weight</SelectItem>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="paper">Paper</SelectItem>
                            <SelectItem value="print">Print</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={patternSortBy} onValueChange={(value: any) => setPatternSortBy(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="frequency">Frequency</SelectItem>
                            <SelectItem value="alphabetical">A-Z</SelectItem>
                            <SelectItem value="length">Length</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Bulk Actions */}
                    {selectedPatterns.size > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-sm">{selectedPatterns.size} patterns selected</span>
                        <Button
                          size="sm"
                          onClick={() => handleBulkPatternMapping('production_stage')}
                          disabled={!selectedStage}
                        >
                          Bulk Map to Stage
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPatterns(new Set())}
                        >
                          Clear
                        </Button>
                      </div>
                    )}

                    {/* Pattern Stats */}
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Available Text Patterns</h4>
                      <Badge variant="secondary">{getFilteredAndSortedPatterns().length} patterns</Badge>
                    </div>
                    
                    {/* Pattern List */}
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {(() => {
                        const filteredPatterns = getFilteredAndSortedPatterns();
                        const startIdx = (currentPatternPage - 1) * patternsPerPage;
                        const endIdx = startIdx + patternsPerPage;
                        const paginatedPatterns = filteredPatterns.slice(startIdx, endIdx);
                        
                        return paginatedPatterns.map((pattern, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50">
                            <div className="flex items-center gap-3 flex-1">
                              <Checkbox
                                checked={selectedPatterns.has(pattern.text)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedPatterns);
                                  if (checked) {
                                    newSelected.add(pattern.text);
                                  } else {
                                    newSelected.delete(pattern.text);
                                  }
                                  setSelectedPatterns(newSelected);
                                }}
                              />
                              <span className="text-sm font-mono flex-1">{pattern.text}</span>
                              <Badge variant="outline" className="ml-2">
                                {pattern.frequency}x
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowPatternPreview(pattern.text)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => createMapping(pattern.text, 'production_stage')}
                                disabled={isCreatingMapping && currentExcelText === pattern.text}
                              >
                                {isCreatingMapping && currentExcelText === pattern.text ? (
                                  "Creating..."
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Map
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Pattern Pagination */}
                    {(() => {
                      const totalPatterns = getFilteredAndSortedPatterns().length;
                      const totalPages = Math.ceil(totalPatterns / patternsPerPage);
                      
                      if (totalPages > 1) {
                        return (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              Showing {((currentPatternPage - 1) * patternsPerPage) + 1} to {Math.min(currentPatternPage * patternsPerPage, totalPatterns)} of {totalPatterns}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPatternPage(Math.max(1, currentPatternPage - 1))}
                                disabled={currentPatternPage === 1}
                              >
                                Previous
                              </Button>
                              <span className="text-sm">
                                Page {currentPatternPage} of {totalPages}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPatternPage(Math.min(totalPages, currentPatternPage + 1))}
                                disabled={currentPatternPage === totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paper-specs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Paper Specification Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Map Excel text to paper type and weight combinations (e.g., "300gsm Matt")
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Paper Type</label>
                      <Select value={selectedPaperType} onValueChange={setSelectedPaperType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select paper type" />
                        </SelectTrigger>
                        <SelectContent>
                          {paperTypes.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id}>
                              {spec.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Paper Weight</label>
                      <Select value={selectedPaperWeight} onValueChange={setSelectedPaperWeight}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select paper weight" />
                        </SelectTrigger>
                        <SelectContent>
                          {paperWeights.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id}>
                              {spec.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Bulk Actions for Paper */}
                    {selectedPatterns.size > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-sm">{selectedPatterns.size} patterns selected</span>
                        <Button
                          size="sm"
                          onClick={() => handleBulkPatternMapping('paper_specification')}
                          disabled={!selectedPaperType || !selectedPaperWeight}
                        >
                          Bulk Map Paper
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Paper-Related Text Patterns</h4>
                      <Badge variant="secondary">{getFilteredAndSortedPatterns().filter(pattern => {
                        const text = pattern.text.toLowerCase();
                        return text.includes('gsm') || text.includes('matt') || text.includes('gloss') || text.includes('paper');
                      }).length} patterns found</Badge>
                    </div>
                    
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {getFilteredAndSortedPatterns().filter(pattern => {
                        const text = pattern.text.toLowerCase();
                        return text.includes('gsm') || text.includes('matt') || text.includes('gloss') || text.includes('paper');
                      }).slice(0, 50).map((pattern, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={selectedPatterns.has(pattern.text)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedPatterns);
                                if (checked) {
                                  newSelected.add(pattern.text);
                                } else {
                                  newSelected.delete(pattern.text);
                                }
                                setSelectedPatterns(newSelected);
                              }}
                            />
                            <span className="text-sm font-mono flex-1">{pattern.text}</span>
                            <Badge variant="outline" className="ml-2">
                              {pattern.frequency}x
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowPatternPreview(pattern.text)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => createMapping(pattern.text, 'paper_specification')}
                              disabled={isCreatingMapping && currentExcelText === pattern.text}
                            >
                              {isCreatingMapping && currentExcelText === pattern.text ? (
                                "Creating..."
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Map
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="delivery-collection" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Delivery & Collection Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Map Excel text to delivery methods and handle address extraction or collection marking
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Checkbox 
                      id="is-collection" 
                      checked={isCollection} 
                      onCheckedChange={(checked) => setIsCollection(checked === true)}
                    />
                    <label htmlFor="is-collection" className="text-sm font-medium">
                      This is a Collection order (no delivery required)
                    </label>
                  </div>

                  {!isCollection && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Delivery Method</label>
                          <Select value={selectedDeliveryMethod} onValueChange={setSelectedDeliveryMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select delivery method" />
                            </SelectTrigger>
                            <SelectContent>
                              {deliveryMethods.map((spec) => (
                                <SelectItem key={spec.id} value={spec.id}>
                                  {spec.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Address Pattern (optional)</label>
                          <Input
                            placeholder="Pattern to extract address from Address column"
                            value={addressPattern}
                            onChange={(e) => setAddressPattern(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-4">
                    {/* Bulk Actions for Delivery */}
                    {selectedPatterns.size > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-sm">{selectedPatterns.size} patterns selected</span>
                        <Button
                          size="sm"
                          onClick={() => handleBulkPatternMapping('delivery_specification')}
                          disabled={!isCollection && !selectedDeliveryMethod}
                        >
                          Bulk Map Delivery
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Delivery-Related Text Patterns</h4>
                      <Badge variant="secondary">{getFilteredAndSortedPatterns().filter(pattern => {
                        const text = pattern.text.toLowerCase();
                        return text.includes('delivery') || text.includes('collection') || text.includes('courier') || text.includes('post');
                      }).length} patterns found</Badge>
                    </div>
                    
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                      {getFilteredAndSortedPatterns().filter(pattern => {
                        const text = pattern.text.toLowerCase();
                        return text.includes('delivery') || text.includes('collection') || text.includes('courier') || text.includes('post');
                      }).slice(0, 50).map((pattern, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={selectedPatterns.has(pattern.text)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedPatterns);
                                if (checked) {
                                  newSelected.add(pattern.text);
                                } else {
                                  newSelected.delete(pattern.text);
                                }
                                setSelectedPatterns(newSelected);
                              }}
                            />
                            <span className="text-sm font-mono flex-1">{pattern.text}</span>
                            <Badge variant="outline" className="ml-2">
                              {pattern.frequency}x
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowPatternPreview(pattern.text)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => createMapping(pattern.text, 'delivery_specification')}
                              disabled={isCreatingMapping && currentExcelText === pattern.text}
                            >
                              {isCreatingMapping && currentExcelText === pattern.text ? (
                                "Creating..."
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Map
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="statistics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{data.jobs.length}</div>
                    <div className="text-sm text-muted-foreground">Total Jobs</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{paperTypesFromData.length}</div>
                    <div className="text-sm text-muted-foreground">Paper Types Found</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{deliveryMethodsFromData.length}</div>
                    <div className="text-sm text-muted-foreground">Delivery Methods Found</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pattern Preview Dialog */}
      {showPatternPreview && (
        <Card className="fixed inset-0 z-50 bg-background/95 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pattern Preview: "{showPatternPreview}"</CardTitle>
              <Button variant="outline" onClick={() => setShowPatternPreview("")}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h4 className="font-medium">Sample Jobs Containing This Pattern:</h4>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {getPatternPreviewJobs(showPatternPreview).map((job, index) => (
                  <div key={index} className="p-3 border-b last:border-b-0">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>WO:</strong> {job.wo_no}</div>
                      <div><strong>Customer:</strong> {job.customer}</div>
                      <div><strong>Category:</strong> {job.category}</div>
                      <div><strong>Spec:</strong> {job.specification}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};