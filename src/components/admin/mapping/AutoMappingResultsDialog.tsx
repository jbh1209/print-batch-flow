import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, FileText } from "lucide-react";
import type { AutoMappingResult } from "@/utils/excel/automaticMappingCreator";

interface AutoMappingResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: AutoMappingResult | null;
  onCreateSpecifications?: () => void;
}

export function AutoMappingResultsDialog({
  open,
  onOpenChange,
  results,
  onCreateSpecifications
}: AutoMappingResultsDialogProps) {
  if (!results) return null;

  const hasConflicts = results.conflicts.length > 0;
  const hasErrors = results.errors.length > 0;
  const totalCreated = results.mappingsCreated;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Automatic Mapping Results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center text-2xl font-bold text-green-600 mb-1">
                  <CheckCircle className="h-6 w-6 mr-2" />
                  {totalCreated}
                </div>
                <p className="text-sm text-muted-foreground">Total Mappings</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {results.papersCreated}
                </div>
                <p className="text-sm text-muted-foreground">Paper Mappings</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {results.deliveriesCreated}
                </div>
                <p className="text-sm text-muted-foreground">Delivery Mappings</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center text-2xl font-bold text-orange-600 mb-1">
                  <AlertTriangle className="h-6 w-6 mr-2" />
                  {results.conflicts.length}
                </div>
                <p className="text-sm text-muted-foreground">Conflicts</p>
              </CardContent>
            </Card>
          </div>

          {/* Success Message */}
          {totalCreated > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <p className="font-medium">
                    Successfully created {totalCreated} automatic mappings from Excel data
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conflicts Section */}
          {hasConflicts && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-5 w-5" />
                  Mapping Conflicts ({results.conflicts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.conflicts.map((conflict, index) => (
                  <div key={index} className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">"{conflict.excelText}"</div>
                        <div className="text-sm text-muted-foreground">{conflict.message}</div>
                      </div>
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        {conflict.conflictType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Errors Section */}
          {hasErrors && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <XCircle className="h-5 w-5" />
                  Processing Errors ({results.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.errors.map((error, index) => (
                  <div key={index} className="border border-red-200 rounded p-2 bg-red-50">
                    <div className="text-sm text-red-800">{error}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {(totalCreated > 0 || hasConflicts) && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-blue-700">
                {totalCreated > 0 && (
                  <p>• Review the created mappings in the Mapping Library for accuracy</p>
                )}
                {hasConflicts && (
                  <p>• Resolve mapping conflicts by verifying which specifications are correct</p>
                )}
                <p>• Consider creating missing print specifications for unmapped paper types</p>
                <p>• Use the mapping verification tools to improve confidence scores</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {onCreateSpecifications && (
            <Button variant="outline" onClick={onCreateSpecifications}>
              Create Specifications
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}