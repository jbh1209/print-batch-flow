
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CategorySelectionProps {
  categories: any[];
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
}

export const CategorySelection: React.FC<CategorySelectionProps> = ({
  categories,
  selectedCategoryId,
  onCategorySelect
}) => {
  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">Select Category</Label>
      <Select value={selectedCategoryId} onValueChange={onCategorySelect}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a category..." />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: category.color || '#6B7280' }}
                />
                <span>{category.name}</span>
                <span className="text-xs text-gray-500">
                  ({category.sla_target_days || 0} days SLA)
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
