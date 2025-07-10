import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, MapPin, Database, Eye, Target } from "lucide-react";
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

export const ExcelDataAnalyzer: React.FC<ExcelDataAnalyzerProps> = ({ data, onMappingCreated }) => {
  const [filteredJobs, setFilteredJobs] = useState(data.jobs);
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [stageSpecifications, setStageSpecifications] = useState<StageSpecification[]>([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedSpecification, setSelectedSpecification] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);
  const { toast } = useToast();

  const itemsPerPage = 50;
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  useEffect(() => {
    loadProductionStages();
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
  }, [searchTerm, filterField, selectedGroup, selectedItemType, data.jobs]);

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

  const filterJobs = () => {
    let filtered = data.jobs;

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

  const toggleJobSelection = (index: number) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedJobs(newSelected);
  };

  const selectAllVisible = () => {
    const visibleIndices = currentJobs.map((_, i) => startIndex + i);
    setSelectedJobs(new Set([...selectedJobs, ...visibleIndices]));
  };

  const clearSelection = () => {
    setSelectedJobs(new Set());
  };

  const createMapping = async () => {
    if (!selectedStage || selectedJobs.size === 0) {
      toast({
        title: "Invalid Selection",
        description: "Please select a production stage and at least one job",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingMapping(true);

    try {
      // Get unique text values from selected jobs
      const selectedIndices = Array.from(selectedJobs);
      const uniqueTexts = new Set<string>();

      selectedIndices.forEach(index => {
        const job = filteredJobs[index];
        if (job) {
          // Extract meaningful text from various fields
          const fieldsToExtract = [job.category, job.specification, job.reference, job.location];
          
          // If this is matrix mode, also extract from group specifications
          if (data.isMatrixMode) {
            // Extract from matrix-specific specification fields
            if (job.paper_specifications) {
              Object.values(job.paper_specifications).forEach((spec: any) => {
                if (spec?.specifications) fieldsToExtract.push(spec.specifications);
              });
            }
            if (job.finishing_specifications) {
              Object.values(job.finishing_specifications).forEach((spec: any) => {
                if (spec?.specifications) fieldsToExtract.push(spec.specifications);
              });
            }
            if (job.printing_specifications) {
              Object.values(job.printing_specifications).forEach((spec: any) => {
                if (spec?.specifications) fieldsToExtract.push(spec.specifications);
              });
            }
            if (job.prepress_specifications) {
              Object.values(job.prepress_specifications).forEach((spec: any) => {
                if (spec?.specifications) fieldsToExtract.push(spec.specifications);
              });
            }
            if (job.delivery_specifications) {
              Object.values(job.delivery_specifications).forEach((spec: any) => {
                if (spec?.specifications) fieldsToExtract.push(spec.specifications);
              });
            }
          }
          
          fieldsToExtract.forEach(text => {
            if (text && text.toString().trim()) {
              uniqueTexts.add(text.toString().trim());
            }
          });
        }
      });

      // Create mappings for each unique text using upsert
      const mappingPromises = Array.from(uniqueTexts).map(text => 
        supabase.rpc('upsert_excel_mapping', {
          p_excel_text: text,
          p_production_stage_id: selectedStage,
          p_stage_specification_id: selectedSpecification || null,
          p_confidence_score: 95
        }).single()
      );

      const results = await Promise.all(mappingPromises);
      
      // Check for errors and collect results
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to create ${errors.length} mappings: ${errors[0].error.message}`);
      }

      // Count created vs updated mappings
      const createdCount = results.filter(r => r.data?.action_taken === 'created').length;
      const updatedCount = results.filter(r => r.data?.action_taken === 'updated').length;
      const conflictCount = results.filter(r => r.data?.conflict_detected).length;

      let toastMessage = "Mappings Processed";
      let toastDescription = `Processed ${uniqueTexts.size} unique text patterns for ${selectedJobs.size} selected jobs.`;
      
      if (createdCount > 0 && updatedCount > 0) {
        toastDescription += ` Created ${createdCount} new, updated ${updatedCount} existing.`;
      } else if (createdCount > 0) {
        toastDescription += ` Created ${createdCount} new mappings.`;
      } else if (updatedCount > 0) {
        toastDescription += ` Updated ${updatedCount} existing mappings.`;
      }
      
      if (conflictCount > 0) {
        toastDescription += ` ⚠️ ${conflictCount} text patterns map to multiple stages.`;
      }

      toast({
        title: toastMessage,
        description: toastDescription,
        variant: conflictCount > 0 ? "default" : "default",
      });

      clearSelection();
      onMappingCreated();

    } catch (error: any) {
      console.error('Error creating mappings:', error);
      toast({
        title: "Error Creating Mappings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingMapping(false);
    }
  };

  const getFieldOptions = () => {
    if (data.jobs.length === 0) return [];
    
    const firstJob = data.jobs[0];
    return Object.keys(firstJob).filter(key => 
      typeof firstJob[key] === 'string' || typeof firstJob[key] === 'number'
    );
  };

  const getAvailableGroups = () => {
    if (!data.isMatrixMode || data.jobs.length === 0) return [];
    
    const groups = new Set<string>();
    data.jobs.forEach(job => {
      if (job.paper_specifications) groups.add('Paper');
      if (job.printing_specifications) groups.add('Printing');
      if (job.finishing_specifications) groups.add('Finishing');
      if (job.prepress_specifications) groups.add('Prepress');
      if (job.delivery_specifications) groups.add('Delivery');
    });
    
    return Array.from(groups);
  };

  const getAvailableItemTypes = (group: string) => {
    if (!data.isMatrixMode || data.jobs.length === 0 || group === "all") return [];
    
    const itemTypes = new Set<string>();
    data.jobs.forEach(job => {
      const groupKey = `${group.toLowerCase()}_specifications`;
      const specifications = job[groupKey];
      if (specifications && typeof specifications === 'object') {
        Object.keys(specifications).forEach(key => {
          itemTypes.add(key);
        });
      }
    });
    
    return Array.from(itemTypes);
  };

  return (
    <div className="space-y-6">
      {/* Data Overview */}
      <div className="space-y-4">
        {/* File Type Indicator */}
        {data.isMatrixMode && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">Matrix Excel Format Detected</p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This file contains {data.matrixData?.detectedGroups?.length || 0} group categories with detailed specifications
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{data.totalRows.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{data.jobs.length.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Processed Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{filteredJobs.length.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Filtered Results</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{selectedJobs.size}</div>
              <div className="text-sm text-muted-foreground">Selected Jobs</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Analyze Data
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Create Mappings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Analysis & Filtering</CardTitle>
              <p className="text-sm text-muted-foreground">
                Filter and analyze your Excel data to identify patterns for mapping
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search across all fields..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterField} onValueChange={setFilterField}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      {getFieldOptions().map(field => (
                        <SelectItem key={field} value={field}>
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Matrix-specific filters */}
                {data.isMatrixMode && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {getAvailableGroups().map(group => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={selectedItemType} 
                      onValueChange={setSelectedItemType}
                      disabled={selectedGroup === "all"}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by item type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        {getAvailableItemTypes(selectedGroup).map(itemType => (
                          <SelectItem key={itemType} value={itemType}>
                            {itemType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Selection Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button onClick={selectAllVisible} variant="outline" size="sm">
                      Select Page ({currentJobs.length})
                    </Button>
                    <Button onClick={clearSelection} variant="outline" size="sm">
                      Clear Selection
                    </Button>
                    {selectedJobs.size > 0 && (
                      <Badge variant="secondary">
                        {selectedJobs.size} selected
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredJobs.length} total)
                  </div>
                </div>

                {/* Data Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={currentJobs.length > 0 && currentJobs.every((_, i) => selectedJobs.has(startIndex + i))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllVisible();
                              } else {
                                const visibleIndices = currentJobs.map((_, i) => startIndex + i);
                                setSelectedJobs(prev => {
                                  const newSet = new Set(prev);
                                  visibleIndices.forEach(i => newSet.delete(i));
                                  return newSet;
                                });
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>WO No</TableHead>
                        <TableHead>Customer</TableHead>
                        {data.isMatrixMode ? (
                          <>
                            <TableHead>Group</TableHead>
                            <TableHead>Item Type</TableHead>
                            <TableHead>Specifications</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Category</TableHead>
                            <TableHead>Specification</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Location</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentJobs.map((job, i) => {
                        const globalIndex = startIndex + i;
                        
                        if (data.isMatrixMode) {
                          // For matrix mode, show group-specific information
                          const groupSpecifications = [];
                          if (selectedGroup === "all") {
                            // Show all groups for this job
                            if (job.paper_specifications) groupSpecifications.push({ group: 'Paper', specs: job.paper_specifications });
                            if (job.printing_specifications) groupSpecifications.push({ group: 'Printing', specs: job.printing_specifications });
                            if (job.finishing_specifications) groupSpecifications.push({ group: 'Finishing', specs: job.finishing_specifications });
                            if (job.prepress_specifications) groupSpecifications.push({ group: 'Prepress', specs: job.prepress_specifications });
                            if (job.delivery_specifications) groupSpecifications.push({ group: 'Delivery', specs: job.delivery_specifications });
                          } else {
                            // Show only selected group
                            const groupKey = `${selectedGroup.toLowerCase()}_specifications`;
                            if (job[groupKey]) {
                              groupSpecifications.push({ group: selectedGroup, specs: job[groupKey] });
                            }
                          }

                          return groupSpecifications.map((groupSpec, specIndex) => {
                            const itemTypes = Object.keys(groupSpec.specs);
                            const filteredItemTypes = selectedItemType === "all" ? itemTypes : itemTypes.filter(type => type === selectedItemType);
                            
                            return filteredItemTypes.map((itemType, itemIndex) => {
                              const spec = groupSpec.specs[itemType];
                              const rowKey = `${globalIndex}-${specIndex}-${itemIndex}`;
                              
                              return (
                                <TableRow key={rowKey}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedJobs.has(globalIndex)}
                                      onCheckedChange={() => toggleJobSelection(globalIndex)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{job.wo_no}</TableCell>
                                  <TableCell>{job.customer}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{groupSpec.group}</Badge>
                                  </TableCell>
                                  <TableCell>{itemType}</TableCell>
                                  <TableCell>
                                    <div className="space-y-1 text-sm">
                                      {spec.description && (
                                        <div><strong>Desc:</strong> {spec.description}</div>
                                      )}
                                      {spec.specifications && (
                                        <div><strong>Specs:</strong> {spec.specifications}</div>
                                      )}
                                      {spec.qty > 0 && (
                                        <div><strong>Qty:</strong> {spec.qty}</div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          }).flat();
                        } else {
                          // Standard mode
                          return (
                            <TableRow key={globalIndex}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedJobs.has(globalIndex)}
                                  onCheckedChange={() => toggleJobSelection(globalIndex)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{job.wo_no}</TableCell>
                              <TableCell>{job.customer}</TableCell>
                              <TableCell>{job.category}</TableCell>
                              <TableCell>{job.specification}</TableCell>
                              <TableCell>{job.reference}</TableCell>
                              <TableCell>{job.location}</TableCell>
                            </TableRow>
                          );
                        }
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Production Stage Mappings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Map selected Excel data to production stages and specifications
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Production Stage *</label>
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select production stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionStages.map(stage => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Stage Specification (Optional)</label>
                    <Select 
                      value={selectedSpecification} 
                      onValueChange={setSelectedSpecification}
                      disabled={!selectedStage}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select specification" />
                      </SelectTrigger>
                      <SelectContent>
                        {stageSpecifications.map(spec => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">
                      Ready to create mapping for {selectedJobs.size} selected jobs
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This will extract unique text patterns and map them to the selected stage
                    </p>
                  </div>
                  <Button
                    onClick={createMapping}
                    disabled={!selectedStage || selectedJobs.size === 0 || isCreatingMapping}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    {isCreatingMapping ? "Creating..." : "Create Mapping"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};