import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Edit3, Trash2, RotateCcw, Plus } from "lucide-react";
import type { RowMappingResult } from "@/utils/excel/types";

interface StageSpecification {
  id: string;
  name: string;
  production_stage_id: string;
}

interface RowMappingTableProps {
  rowMappings: RowMappingResult[];
  availableStages: { id: string; name: string; category: string }[];
  stageSpecifications: { [stageId: string]: StageSpecification[] };
  workOrderNumber: string;
  onUpdateMapping: (woNo: string, rowIndex: number, stageId: string, stageName: string, stageSpecId?: string, stageSpecName?: string) => void;
  onToggleManualOverride: (woNo: string, rowIndex: number) => void;
  onIgnoreRow?: (woNo: string, rowIndex: number) => void;
  onRestoreRow?: (woNo: string, rowIndex: number) => void;
}

export const RowMappingTable: React.FC<RowMappingTableProps> = ({
  rowMappings,
  availableStages,
  stageSpecifications,
  workOrderNumber,
  onUpdateMapping,
  onToggleManualOverride,
  onIgnoreRow,
  onRestoreRow
}) => {
  const getConfidenceColor = (confidence: number, isUnmapped: boolean) => {
    if (isUnmapped) return "bg-red-100 text-red-700";
    if (confidence >= 80) return "bg-green-100 text-green-700";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-orange-100 text-orange-700";
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      printing: "bg-blue-100 text-blue-700",
      finishing: "bg-purple-100 text-purple-700",
      prepress: "bg-green-100 text-green-700",
      packaging: "bg-amber-100 text-amber-700",
      delivery: "bg-orange-100 text-orange-700",
      unknown: "bg-gray-100 text-gray-700"
    };
    return colors[category as keyof typeof colors] || colors.unknown;
  };

  const getStageSpecifications = (stageId: string) => {
    return stageSpecifications[stageId] || [];
  };

  // Create unique identifier for each row mapping to handle multi-rows correctly
  // CRITICAL: customRowId MUST be prioritized to prevent duplicate keys for custom rows
  // CRITICAL: Include workOrderNumber to prevent cross-order key collisions
  const getUniqueRowId = (mapping: RowMappingResult, fallbackIndex: number) => {
    // Always prefer customRowId for custom rows - this is guaranteed unique
    if (mapping.customRowId) {
      return `${workOrderNumber}-${mapping.customRowId}`;
    }
    // For Excel rows, create composite key with order prefix
    if (mapping.excelRowIndex >= 0) {
      return `${workOrderNumber}-excel-${mapping.excelRowIndex}-${mapping.mappedStageId || 'unmapped'}-${mapping.mappedStageSpecId || 'no-spec'}`;
    }
    // Absolute fallback: use array index (should never happen)
    return `${workOrderNumber}-fallback-${fallbackIndex}-${Date.now()}`;
  };

  const unmappedCount = rowMappings.filter(m => m.isUnmapped && !m.ignored).length;
  const ignoredCount = rowMappings.filter(m => m.ignored).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-semibold">Row-by-Row Mapping Review</h3>
        <div className="flex items-center gap-2">
          {unmappedCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              {unmappedCount} unmapped
            </Badge>
          )}
          {ignoredCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              {ignoredCount} ignored
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {rowMappings.filter(m => !m.ignored).length}/{rowMappings.length} active
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[60px] w-16">Row</TableHead>
              <TableHead className="min-w-[150px]">Excel Data</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="min-w-[60px] w-20">Qty</TableHead>
              <TableHead className="min-w-[100px]">Category</TableHead>
              <TableHead className="min-w-[250px]">Mapped Stage + Sub-Spec</TableHead>
              <TableHead className="min-w-[120px]">Paper/Spec</TableHead>
              <TableHead className="min-w-[100px] w-24">Confidence</TableHead>
              <TableHead className="min-w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {rowMappings.map((mapping, index) => {
            const isIgnored = mapping.ignored;
            const isCustom = mapping.isCustomRow;
            
            return (
              <TableRow 
                key={getUniqueRowId(mapping, index)} 
                className={`${mapping.isUnmapped ? "bg-red-50" : ""} ${isIgnored ? "opacity-50" : ""}`}
              >
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-1">
                    {isCustom ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <Plus className="h-3 w-3" />
                      </Badge>
                    ) : (
                      mapping.excelRowIndex + 1
                    )}
                  </div>
                </TableCell>
              <TableCell>
                <div className="text-sm font-medium truncate max-w-[150px]" title={mapping.groupName}>
                  {mapping.groupName}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  WO Qty: {mapping.woQty}
                </div>
              </TableCell>
              <TableCell>
                <div className={`text-sm truncate max-w-[200px] ${isIgnored ? "line-through" : ""}`} title={mapping.description}>
                  {mapping.description || 'No description'}
                  {isCustom && (
                    <div className="text-xs text-blue-600 mt-1">Custom row</div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center font-medium">
                {mapping.qty}
              </TableCell>
              <TableCell>
                <Badge className={getCategoryColor(mapping.category)}>
                  {mapping.category}
                </Badge>
              </TableCell>
              <TableCell>
                {mapping.manualOverride ? (
                  <div className="space-y-2">
                    {/* Stage Selection */}
                    <Select
                      value={mapping.mappedStageId || ""}
                      onValueChange={(stageId) => {
                        const selectedStage = availableStages.find(s => s.id === stageId);
                        if (selectedStage) {
                          // Reset stage specification when changing stage
                          onUpdateMapping(workOrderNumber, mapping.excelRowIndex, stageId, selectedStage.name);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 min-w-[200px]">
                        <SelectValue placeholder="Select stage..." />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        {availableStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <span>{stage.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {stage.category}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Stage Specification Selection (if available) */}
                    {mapping.mappedStageId && getStageSpecifications(mapping.mappedStageId).length > 0 && (
                      <Select
                        value={mapping.mappedStageSpecId || ""}
                        onValueChange={(stageSpecId) => {
                          const specs = getStageSpecifications(mapping.mappedStageId!);
                          const selectedSpec = specs.find(s => s.id === stageSpecId);
                          if (selectedSpec && mapping.mappedStageId) {
                            const stageName = availableStages.find(s => s.id === mapping.mappedStageId)?.name || '';
                            onUpdateMapping(workOrderNumber, mapping.excelRowIndex, mapping.mappedStageId, stageName, stageSpecId, selectedSpec.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 min-w-[200px]">
                          <SelectValue placeholder="Select specification (optional)..." />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          {getStageSpecifications(mapping.mappedStageId).map((stageSpec) => (
                            <SelectItem key={stageSpec.id} value={stageSpec.id}>
                              {stageSpec.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <div className="text-sm min-w-[200px]">
                    {mapping.mappedStageName ? (
                      <div>
                        <span className="font-medium block" title={mapping.mappedStageName}>
                          {mapping.mappedStageName}
                        </span>
                        {mapping.mappedStageSpecName && (
                          <span className="text-xs text-gray-600 block" title={mapping.mappedStageSpecName}>
                            + {mapping.mappedStageSpecName}
                          </span>
                        )}
                        {mapping.instanceId && (
                          <span className="text-xs text-blue-600 block">
                            Instance: {mapping.instanceId}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No mapping found</span>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {mapping.paperSpecification ? (
                    <Badge variant="outline" className="text-xs">
                      {mapping.paperSpecification}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">No paper spec</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {mapping.isUnmapped ? (
                  <Badge className="bg-red-100 text-red-700 text-xs">
                    Unmapped
                  </Badge>
                ) : (
                  <Badge className={getConfidenceColor(mapping.confidence, mapping.isUnmapped)}>
                    {mapping.confidence}%
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {!isIgnored ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleManualOverride(workOrderNumber, mapping.excelRowIndex)}
                        className="h-8 w-8 p-0"
                        title={`Edit row ${isCustom ? 'custom' : mapping.excelRowIndex + 1}: ${mapping.groupName}`}
                      >
                        {mapping.manualOverride ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Edit3 className="h-4 w-4" />
                        )}
                      </Button>
                      {onIgnoreRow && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onIgnoreRow(workOrderNumber, mapping.excelRowIndex)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Ignore this row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    onRestoreRow && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRestoreRow(workOrderNumber, mapping.excelRowIndex)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Restore this row"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};