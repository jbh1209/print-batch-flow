import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Edit3 } from "lucide-react";
import type { RowMappingResult } from "@/utils/excel/types";

interface RowMappingTableProps {
  rowMappings: RowMappingResult[];
  availableStages: { id: string; name: string; category: string }[];
  onUpdateMapping: (rowIndex: number, stageId: string, stageName: string) => void;
  onToggleManualOverride: (rowIndex: number) => void;
}

export const RowMappingTable: React.FC<RowMappingTableProps> = ({
  rowMappings,
  availableStages,
  onUpdateMapping,
  onToggleManualOverride
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
      delivery: "bg-orange-100 text-orange-700",
      unknown: "bg-gray-100 text-gray-700"
    };
    return colors[category as keyof typeof colors] || colors.unknown;
  };

  const getFilteredStages = (category: string) => {
    return availableStages.filter(stage => 
      category === 'unknown' || stage.category === category
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-semibold">Row-by-Row Mapping Review</h3>
        <Badge variant="outline" className="flex items-center gap-1 self-start sm:self-auto">
          <AlertTriangle className="h-3 w-3" />
          {rowMappings.filter(rm => rm.isUnmapped).length} unmapped rows
        </Badge>
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
              <TableHead className="min-w-[80px] w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {rowMappings.map((mapping, index) => (
            <TableRow key={index} className={mapping.isUnmapped ? "bg-red-50" : ""}>
              <TableCell className="font-mono text-sm">
                {mapping.excelRowIndex + 1}
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
                <div className="text-sm truncate max-w-[200px]" title={mapping.description}>
                  {mapping.description || 'No description'}
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
                  <Select
                    value={mapping.mappedStageId || ""}
                    onValueChange={(stageId) => {
                      const stage = availableStages.find(s => s.id === stageId);
                      if (stage) {
                        onUpdateMapping(index, stageId, stage.name);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 min-w-[200px]">
                      <SelectValue placeholder="Select stage..." />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      {getFilteredStages(mapping.category).map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleManualOverride(index)}
                  className="h-8 w-8 p-0"
                >
                  {mapping.manualOverride ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Edit3 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};