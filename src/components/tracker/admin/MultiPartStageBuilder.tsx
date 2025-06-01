
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical } from "lucide-react";

interface MultiPartStageBuilderProps {
  isMultiPart: boolean;
  partDefinitions: string[];
  onMultiPartChange: (isMultiPart: boolean) => void;
  onPartDefinitionsChange: (parts: string[]) => void;
}

export const MultiPartStageBuilder: React.FC<MultiPartStageBuilderProps> = ({
  isMultiPart,
  partDefinitions,
  onMultiPartChange,
  onPartDefinitionsChange
}) => {
  const [newPartName, setNewPartName] = useState("");

  const addPart = () => {
    if (newPartName.trim() && !partDefinitions.includes(newPartName.trim())) {
      onPartDefinitionsChange([...partDefinitions, newPartName.trim()]);
      setNewPartName("");
    }
  };

  const removePart = (index: number) => {
    const newParts = partDefinitions.filter((_, i) => i !== index);
    onPartDefinitionsChange(newParts);
  };

  const updatePart = (index: number, newName: string) => {
    const newParts = [...partDefinitions];
    newParts[index] = newName;
    onPartDefinitionsChange(newParts);
  };

  const movePart = (index: number, direction: 'up' | 'down') => {
    const newParts = [...partDefinitions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newParts.length) {
      [newParts[index], newParts[targetIndex]] = [newParts[targetIndex], newParts[index]];
      onPartDefinitionsChange(newParts);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Multi-Part Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="multi-part"
            checked={isMultiPart}
            onCheckedChange={onMultiPartChange}
          />
          <Label htmlFor="multi-part">Enable multi-part printing</Label>
        </div>

        {isMultiPart && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Define the different parts that will be printed separately (e.g., Cover, Text, Spine for books).
            </div>

            {/* Add new part */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter part name (e.g., Cover, Text)"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPart()}
              />
              <Button onClick={addPart} disabled={!newPartName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Parts list */}
            {partDefinitions.length > 0 && (
              <div className="space-y-2">
                <Label>Parts ({partDefinitions.length})</Label>
                <div className="space-y-2">
                  {partDefinitions.map((part, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <Badge variant="outline" className="font-mono">
                        {index + 1}
                      </Badge>
                      <Input
                        value={part}
                        onChange={(e) => updatePart(index, e.target.value)}
                        className="flex-1"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => movePart(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => movePart(index, 'down')}
                          disabled={index === partDefinitions.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removePart(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {partDefinitions.length === 0 && (
              <div className="text-center py-4 text-gray-500 border-2 border-dashed rounded-lg">
                No parts defined yet. Add parts to enable multi-part printing.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
