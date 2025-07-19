import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import type { RowMappingResult } from "@/utils/excel/types";

interface AvailableStage {
  id: string;
  name: string;
  category: string;
}

interface AddRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  woNo: string;
  availableStages: AvailableStage[];
  stageSpecifications: { [stageId: string]: any[] };
  onAddRow: (newRow: RowMappingResult) => void;
}

export const AddRowDialog: React.FC<AddRowDialogProps> = ({
  open,
  onOpenChange,
  woNo,
  availableStages,
  stageSpecifications,
  onAddRow
}) => {
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedStageSpecId, setSelectedStageSpecId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [partType, setPartType] = useState("");
  const [paperSpecification, setPaperSpecification] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStageId("");
      setSelectedStageSpecId("");
      setDescription("");
      setQuantity(1);
      setPartType("");
      setPaperSpecification("");
    }
  }, [open]);

  const selectedStage = availableStages.find(s => s.id === selectedStageId);
  const availableSpecs = selectedStageId ? (stageSpecifications[selectedStageId] || []) : [];

  const handleAdd = () => {
    if (!selectedStageId || !selectedStage || !description.trim()) {
      return;
    }

    const selectedSpec = availableSpecs.find(s => s.id === selectedStageSpecId);
    const customRowId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRow: RowMappingResult = {
      success: true,
      message: "Custom row added successfully",
      excelRowIndex: -1, // Custom rows have negative index
      excelData: [],
      groupName: description.trim(),
      description: description.trim(),
      qty: quantity,
      woQty: quantity,
      mappedStageId: selectedStageId,
      mappedStageName: selectedStage.name,
      mappedStageSpecId: selectedStageSpecId || null,
      mappedStageSpecName: selectedSpec?.name || null,
      confidence: 100, // Manual additions have max confidence
      category: selectedStage.category as any,
      manualOverride: true,
      isUnmapped: false,
      isCustomRow: true,
      customRowId,
      partType: partType.trim() || undefined,
      paperSpecification: paperSpecification.trim() || undefined,
    };

    onAddRow(newRow);
    onOpenChange(false);
  };

  const isValid = selectedStageId && description.trim() && quantity > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Custom Row
          </DialogTitle>
          <DialogDescription>
            Add a custom production stage for work order {woNo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-select">Production Stage *</Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a production stage" />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStageId && availableSpecs.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="spec-select">Stage Specification</Label>
              <Select value={selectedStageSpecId} onValueChange={setSelectedStageSpecId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select specification (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specification</SelectItem>
                  {availableSpecs.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Enter stage description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part-type">Part Type</Label>
              <Input
                id="part-type"
                placeholder="e.g., Cover, Text"
                value={partType}
                onChange={(e) => setPartType(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paper-spec">Paper Specification</Label>
            <Input
              id="paper-spec"
              placeholder="e.g., 250gsm Silk"
              value={paperSpecification}
              onChange={(e) => setPaperSpecification(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            Add Row
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};