
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface JobFormFieldsProps {
  jobNumber: string;
  clientName: string;
  quantity: number;
  dueDate: string;
  onJobNumberChange: (value: string) => void;
  onClientNameChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
}

export const JobFormFields: React.FC<JobFormFieldsProps> = ({
  jobNumber,
  clientName,
  quantity,
  dueDate,
  onJobNumberChange,
  onClientNameChange,
  onQuantityChange
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="jobNumber">Job Number</Label>
        <Input
          id="jobNumber"
          value={jobNumber}
          onChange={(e) => onJobNumberChange(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="clientName">Client Name</Label>
        <Input
          id="clientName"
          value={clientName}
          onChange={(e) => onClientNameChange(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          value={quantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value))}
          min="1"
          required
        />
      </div>
      <div>
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          disabled
          className="bg-gray-50"
        />
      </div>
    </div>
  );
};
