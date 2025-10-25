import React from 'react';
import { useDivision } from '@/contexts/DivisionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as LucideIcons from 'lucide-react';

export const DivisionSelector = () => {
  const { selectedDivision, setSelectedDivision, availableDivisions, currentDivision } = useDivision();

  // Only show if user has multiple divisions
  if (availableDivisions.length <= 1) {
    return null;
  }

  return (
    <Select value={selectedDivision} onValueChange={setSelectedDivision}>
      <SelectTrigger className="w-[180px] h-9">
        <SelectValue>
          {currentDivision && (
            <div className="flex items-center gap-2">
              {React.createElement(
                (LucideIcons as any)[currentDivision.icon] || LucideIcons.Package,
                { size: 16, style: { color: currentDivision.color } }
              )}
              <span className="font-medium">{currentDivision.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableDivisions.map(division => {
          const Icon = (LucideIcons as any)[division.icon] || LucideIcons.Package;
          return (
            <SelectItem key={division.code} value={division.code}>
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: division.color }} />
                <span>{division.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
