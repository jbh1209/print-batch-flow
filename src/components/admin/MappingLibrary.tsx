import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BatchMappingOperations } from "./mapping/BatchMappingOperations";
import { Search, Download, Upload, Trash2, Edit, CheckCircle, AlertCircle, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Mapping {
  id: string;
  excel_text: string;
  production_stage_id?: string;
  stage_specification_id?: string;
  print_specification_id?: string;
  mapping_type: 'production_stage' | 'print_specification';
  confidence_score?: number;
  is_verified: boolean;
  created_at: string;
  stage_name?: string;
  specification_name?: string;
  print_specification_name?: string;
  print_specification_category?: string;
}

export const MappingLibrary: React.FC = () => {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [filteredMappings, setFilteredMappings] = useState<Mapping[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [mappingTypeFilter, setMappingTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    unverified: 0,
    avgConfidence: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMappings();
  }, []);

  useEffect(() => {
    let filtered = mappings;
    
    // Filter by mapping type
    if (mappingTypeFilter !== "all") {
      filtered = filtered.filter(mapping => mapping.mapping_type === mappingTypeFilter);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(mapping =>
        mapping.excel_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.stage_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.specification_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.print_specification_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredMappings(filtered);
  }, [searchTerm, mappingTypeFilter, mappings]);

  const loadMappings = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('excel_import_mappings')
        .select(`
          *,
          production_stages!excel_import_mappings_production_stage_id_fkey (
            name
          ),
          stage_specifications!excel_import_mappings_stage_specification_id_fkey (
            name
          ),
          print_specifications!excel_import_mappings_print_specification_id_fkey (
            name,
            display_name,
            category
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedMappings = data?.map(mapping => ({
        ...mapping,
        stage_name: mapping.production_stages?.name,
        specification_name: mapping.stage_specifications?.name,
        print_specification_name: mapping.print_specifications?.display_name || mapping.print_specifications?.name,
        print_specification_category: mapping.print_specifications?.category
      })) || [];

      setMappings(processedMappings);
      
      // Calculate stats
      const totalMappings = processedMappings.length;
      const verifiedMappings = processedMappings.filter(m => m.is_verified).length;
      const avgConfidence = totalMappings > 0 
        ? processedMappings.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / totalMappings 
        : 0;

      setStats({
        total: totalMappings,
        verified: verifiedMappings,
        unverified: totalMappings - verifiedMappings,
        avgConfidence: Math.round(avgConfidence)
      });

    } catch (error: any) {
      console.error('Error loading mappings:', error);
      toast({
        title: "Error Loading Mappings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVerification = async (mappingId: string, currentlyVerified: boolean) => {
    try {
      const { error } = await supabase
        .from('excel_import_mappings')
        .update({ is_verified: !currentlyVerified })
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(prev => prev.map(m => 
        m.id === mappingId ? { ...m, is_verified: !currentlyVerified } : m
      ));

      toast({
        title: currentlyVerified ? "Mapping Unverified" : "Mapping Verified",
        description: `Mapping has been ${currentlyVerified ? 'unverified' : 'verified'}`,
      });

    } catch (error: any) {
      toast({
        title: "Error Updating Mapping",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteMapping = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('excel_import_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      setMappings(prev => prev.filter(m => m.id !== mappingId));
      
      toast({
        title: "Mapping Deleted",
        description: "Mapping has been removed from the library",
      });

    } catch (error: any) {
      toast({
        title: "Error Deleting Mapping",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportMappings = () => {
    const exportData = mappings.map(m => ({
      excel_text: m.excel_text,
      stage_name: m.stage_name,
      specification_name: m.specification_name,
      confidence_score: m.confidence_score,
      is_verified: m.is_verified
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `excel-mappings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Mappings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            <div className="text-sm text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.unverified}</div>
            <div className="text-sm text-muted-foreground">Unverified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
            <div className="text-sm text-muted-foreground">Avg Confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="mappings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mappings">Mapping Library</TabsTrigger>
          <TabsTrigger value="operations">Batch Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="mappings">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Mapping Library</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage your Excel text to production stage mappings
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportMappings} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button onClick={loadMappings} variant="outline" size="sm">
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mappings by Excel text, stage, or specification..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={mappingTypeFilter} onValueChange={setMappingTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="production_stage">Production Stages</SelectItem>
                  <SelectItem value="print_specification">Paper & Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mappings Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Excel Text</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Specification</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {searchTerm || mappingTypeFilter !== "all" ? "No mappings match your filters" : "No mappings found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {mapping.excel_text}
                        </TableCell>
                        <TableCell>
                          <Badge variant={mapping.mapping_type === 'production_stage' ? 'default' : 'secondary'}>
                            {mapping.mapping_type === 'production_stage' ? 'Production' : 'Print Spec'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.mapping_type === 'production_stage' 
                            ? mapping.stage_name 
                            : mapping.print_specification_name}
                        </TableCell>
                        <TableCell>
                          {mapping.mapping_type === 'production_stage' 
                            ? (mapping.specification_name || "—")
                            : (mapping.print_specification_category || "—")}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              (mapping.confidence_score || 0) >= 80 
                                ? "default" 
                                : (mapping.confidence_score || 0) >= 60 
                                ? "secondary" 
                                : "destructive"
                            }
                          >
                            {mapping.confidence_score || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {mapping.is_verified ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                            )}
                            <span className="text-sm">
                              {mapping.is_verified ? "Verified" : "Unverified"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleVerification(mapping.id, mapping.is_verified)}
                            >
                              {mapping.is_verified ? "Unverify" : "Verify"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMapping(mapping.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="operations">
          <BatchMappingOperations onOperationComplete={loadMappings} />
        </TabsContent>
      </Tabs>
    </div>
  );
};