
import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface HoldReason {
  id: string;
  label: string;
  description: string;
  category: 'material' | 'equipment' | 'quality' | 'approval' | 'scheduling' | 'other';
}

const HOLD_REASONS: HoldReason[] = [
  {
    id: 'material_shortage',
    label: 'Material Shortage',
    description: 'Required materials are not available',
    category: 'material'
  },
  {
    id: 'material_defect',
    label: 'Material Defect',
    description: 'Materials have quality issues',
    category: 'material'
  },
  {
    id: 'equipment_malfunction',
    label: 'Equipment Malfunction',
    description: 'Machine or equipment failure',
    category: 'equipment'
  },
  {
    id: 'equipment_maintenance',
    label: 'Equipment Maintenance',
    description: 'Scheduled or unscheduled maintenance',
    category: 'equipment'
  },
  {
    id: 'quality_check',
    label: 'Quality Check Required',
    description: 'Waiting for quality inspection',
    category: 'quality'
  },
  {
    id: 'quality_rework',
    label: 'Quality Rework',
    description: 'Rework required due to quality issues',
    category: 'quality'
  },
  {
    id: 'customer_approval',
    label: 'Customer Approval',
    description: 'Waiting for customer sign-off',
    category: 'approval'
  },
  {
    id: 'supervisor_approval',
    label: 'Supervisor Approval',
    description: 'Requires supervisor authorization',
    category: 'approval'
  },
  {
    id: 'scheduling_conflict',
    label: 'Scheduling Conflict',
    description: 'Resource scheduling conflict',
    category: 'scheduling'
  },
  {
    id: 'break_lunch',
    label: 'Break/Lunch',
    description: 'Temporary hold for break',
    category: 'scheduling'
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other reason (specify in notes)',
    category: 'other'
  }
];

interface HoldReasonSelectorProps {
  selectedReason: string;
  onReasonChange: (reason: string) => void;
}

export const HoldReasonSelector: React.FC<HoldReasonSelectorProps> = ({
  selectedReason,
  onReasonChange
}) => {
  const getReasonsByCategory = () => {
    const categories = ['material', 'equipment', 'quality', 'approval', 'scheduling', 'other'];
    return categories.reduce((acc, category) => {
      acc[category] = HOLD_REASONS.filter(reason => reason.category === category);
      return acc;
    }, {} as Record<string, HoldReason[]>);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      material: 'bg-red-100 text-red-800',
      equipment: 'bg-orange-100 text-orange-800', 
      quality: 'bg-yellow-100 text-yellow-800',
      approval: 'bg-blue-100 text-blue-800',
      scheduling: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const reasonsByCategory = getReasonsByCategory();

  return (
    <div className="space-y-4">
      <Label>Select Hold Reason</Label>
      <RadioGroup value={selectedReason} onValueChange={onReasonChange}>
        {Object.entries(reasonsByCategory).map(([category, reasons]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={getCategoryColor(category)} variant="secondary">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Badge>
            </div>
            <div className="ml-4 space-y-2">
              {reasons.map((reason) => (
                <div key={reason.id} className="flex items-start space-x-2">
                  <RadioGroupItem value={reason.id} id={reason.id} className="mt-0.5" />
                  <div className="flex-1">
                    <Label 
                      htmlFor={reason.id} 
                      className="text-sm font-medium cursor-pointer"
                    >
                      {reason.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {reason.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export { HOLD_REASONS };
export type { HoldReason };
