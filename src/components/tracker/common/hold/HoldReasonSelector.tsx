
import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  AlertTriangle,
  Wrench,
  Clock,
  FileQuestion,
  Coffee,
  MoreHorizontal
} from "lucide-react";

export interface HoldReason {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'material' | 'equipment' | 'quality' | 'approval' | 'break' | 'other';
}

export const HOLD_REASONS: HoldReason[] = [
  {
    id: 'material_shortage',
    label: 'Material Shortage',
    description: 'Required materials are not available',
    icon: <AlertTriangle className="h-4 w-4" />,
    category: 'material'
  },
  {
    id: 'equipment_issue',
    label: 'Equipment Issue',
    description: 'Machine or equipment malfunction',
    icon: <Wrench className="h-4 w-4" />,
    category: 'equipment'
  },
  {
    id: 'quality_check',
    label: 'Quality Check Needed',
    description: 'Requires quality inspection or approval',
    icon: <FileQuestion className="h-4 w-4" />,
    category: 'quality'
  },
  {
    id: 'waiting_approval',
    label: 'Waiting for Approval',
    description: 'Pending customer or manager approval',
    icon: <Clock className="h-4 w-4" />,
    category: 'approval'
  },
  {
    id: 'break_lunch',
    label: 'Break/Lunch',
    description: 'Personal break or lunch time',
    icon: <Coffee className="h-4 w-4" />,
    category: 'break'
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Custom reason (specify in notes)',
    icon: <MoreHorizontal className="h-4 w-4" />,
    category: 'other'
  }
];

interface HoldReasonSelectorProps {
  selectedReason: string;
  onReasonChange: (reasonId: string) => void;
}

export const HoldReasonSelector: React.FC<HoldReasonSelectorProps> = ({
  selectedReason,
  onReasonChange
}) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Hold Reason</Label>
      <RadioGroup 
        value={selectedReason} 
        onValueChange={onReasonChange}
        className="grid grid-cols-1 gap-3"
      >
        {HOLD_REASONS.map((reason) => (
          <div 
            key={reason.id} 
            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RadioGroupItem value={reason.id} id={reason.id} />
            <div className="flex items-center gap-3 flex-1">
              <div className="text-gray-500">
                {reason.icon}
              </div>
              <div className="flex-1">
                <Label htmlFor={reason.id} className="font-medium cursor-pointer">
                  {reason.label}
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  {reason.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};
