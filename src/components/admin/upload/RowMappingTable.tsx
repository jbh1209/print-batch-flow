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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Row-by-Row Mapping Review</h3>
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {rowMappings.filter(rm => rm.isUnmapped).length} unmapped rows
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Row</TableHead>
            <TableHead>Excel Data</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-20">Qty</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Mapped Stage</TableHead>
            <TableHead className="w-24">Confidence</TableHead>
            <TableHead className="w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowMappings.map((mapping, index) => (
            <TableRow key={index} className={mapping.isUnmapped ? "bg-red-50" : ""}>
              <TableCell className="font-mono text-sm">
                {mapping.excelRowIndex + 1}
              </TableCell>
              <TableCell className="max-w-48">
                <div className="text-sm font-medium truncate">
                  {mapping.groupName}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  WO Qty: {mapping.woQty}
                </div>
              </TableCell>
              <TableCell className="max-w-64">
                <div className="text-sm truncate" title={mapping.description}>
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
              <TableCell className="max-w-48">
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
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredStages(mapping.category).map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm">
                    {mapping.mappedStageName ? (
                      <span className="font-medium">{mapping.mappedStageName}</span>
                    ) : (
                      <span className="text-gray-500 italic">No mapping found</span>
                    )}
                  </div>
                )}
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
  );
};