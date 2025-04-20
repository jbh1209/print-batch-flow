
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { laminationLabels } from "@/components/postcards/schema/postcardJobFormSchema";

interface PrintSpecsCardProps {
  size: string;
  paperType: string;
  laminationType: string;
  quantity: number;
}

export const PrintSpecsCard = ({
  size,
  paperType,
  laminationType,
  quantity
}: PrintSpecsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Print Specifications</CardTitle>
        <CardDescription>Technical details for printing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Size:</span>
            <span>{size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Paper Type:</span>
            <span>{paperType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Lamination:</span>
            <span>{laminationLabels[laminationType]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Quantity:</span>
            <span>{quantity}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
