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
  }, [searchTerm, filterField, data.jobs]);

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

    // Text search
    if (searchTerm) {
      filtered = filtered.filter(job => {
        const searchableText = Object.values(job).join(' ').toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }

    // Field filter
    if (filterField !== "all") {
      filtered = filtered.filter(job => {
        const fieldValue = job[filterField];
        return fieldValue && fieldValue.toString().trim() !== "";
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
          [job.category, job.specification, job.reference, job.location].forEach(text => {
            if (text && text.toString().trim()) {
              uniqueTexts.add(text.toString().trim());
            }
          });
        }
      });

      // Create mappings for each unique text
      const mappingPromises = Array.from(uniqueTexts).map(text => 
        supabase.from('excel_import_mappings').insert({
          excel_text: text,
          production_stage_id: selectedStage,
          stage_specification_id: selectedSpecification || null,
          confidence_score: 95, // High confidence for manual mappings
          is_verified: true, // Auto-verify manual mappings
          created_by: null // Will be set by RLS policy
        })
      );

      const results = await Promise.all(mappingPromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to create ${errors.length} mappings`);
      }

      toast({
        title: "Mappings Created",
        description: `Successfully created ${uniqueTexts.size} mappings for ${selectedJobs.size} selected jobs`,
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

  return (
    <div className="space-y-6">
      {/* Data Overview */}
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
                        <TableHead>Category</TableHead>
                        <TableHead>Specification</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentJobs.map((job, i) => {
                        const globalIndex = startIndex + i;
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