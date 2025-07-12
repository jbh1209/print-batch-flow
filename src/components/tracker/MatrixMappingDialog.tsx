import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Grid3X3, Sparkles, ArrowRight } from "lucide-react";
import type { MatrixExcelData } from '@/utils/excel/types';

export interface MatrixColumnMapping {
  // Basic fields
  woNo: number;
  customer: number;
  reference: number;
  date: number;
  dueDate: number;
  rep: number;
  category: number;
  location: number;
  size: number;
  specification: number;
  contact: number;
  // Matrix-specific fields
  groupColumn: number;
  descriptionColumn: number;
  qtyColumn: number;
  woQtyColumn: number;
}

interface MatrixMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matrixData: MatrixExcelData | null;
  onMappingConfirmed: (mapping: MatrixColumnMapping) => void;
}

export const MatrixMappingDialog: React.FC<MatrixMappingDialogProps> = ({
  open,
  onOpenChange,
  matrixData,
  onMappingConfirmed
}) => {
  const [mapping, setMapping] = useState<MatrixColumnMapping>({
    woNo: -1,
    customer: -1,
    reference: -1,
    date: -1,
    dueDate: -1,
    rep: -1,
    category: -1,
    location: -1,
    size: -1,
    specification: -1,
    contact: -1,
    groupColumn: -1,
    descriptionColumn: -1,
    qtyColumn: -1,
    woQtyColumn: -1
  });

  // Auto-detect mapping when matrixData changes
  useEffect(() => {
    if (matrixData) {
      setMapping({
        woNo: findColumn(matrixData.headers, ['WO', 'Work Order', 'WorkOrder', 'wo_no']),
        customer: findColumn(matrixData.headers, ['Customer', 'CUSTOMER', 'customer', 'Client']),
        reference: findColumn(matrixData.headers, ['Reference', 'REFERENCE', 'reference', 'Ref']),
        date: findColumn(matrixData.headers, ['Date', 'DATE', 'date', 'Order Date']),
        dueDate: findColumn(matrixData.headers, ['Due Date', 'DUE_DATE', 'due_date', 'Due']),
        rep: findColumn(matrixData.headers, ['Rep', 'REP', 'rep', 'Sales Rep']),
        category: findColumn(matrixData.headers, ['Category', 'CATEGORY', 'category', 'Type']),
        location: findColumn(matrixData.headers, ['Location', 'LOCATION', 'location']),
        size: findColumn(matrixData.headers, ['Size', 'SIZE', 'size', 'Dimensions']),
        specification: findColumn(matrixData.headers, ['Specification', 'SPECIFICATION', 'specification', 'Spec']),
        contact: findColumn(matrixData.headers, ['Contact', 'CONTACT', 'contact']),
        groupColumn: matrixData.groupColumn || -1,
        descriptionColumn: matrixData.descriptionColumn || -1,
        qtyColumn: matrixData.qtyColumn || -1,
        woQtyColumn: matrixData.woQtyColumn || -1
      });
    }
  }, [matrixData]);

  const findColumn = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && header.toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  };

  const updateMapping = (field: keyof MatrixColumnMapping, value: number | string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    onMappingConfirmed(mapping);
    onOpenChange(false);
  };

  const isValidMapping = mapping.groupColumn !== -1 && mapping.woQtyColumn !== -1;

  if (!matrixData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Matrix Excel Mapping
          </DialogTitle>
          <DialogDescription>
            Configure how to extract data from your matrix-structured Excel file. 
            Map columns to fields and verify the group-based data structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detection Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Auto-Detection Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium">Total Rows</div>
                  <div className="text-2xl font-bold">{matrixData.rows.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Detected Groups</div>
                  <div className="text-2xl font-bold">{matrixData.detectedGroups.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Columns</div>
                  <div className="text-2xl font-bold">{matrixData.headers.length}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Matrix Structure</div>
                  <Badge variant={matrixData.groupColumn !== -1 ? "default" : "destructive"}>
                    {matrixData.groupColumn !== -1 ? "Detected" : "Not Found"}
                  </Badge>
                </div>
              </div>
              
              {matrixData.detectedGroups.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Groups Found:</div>
                  <div className="flex flex-wrap gap-2">
                    {matrixData.detectedGroups.map(group => (
                      <Badge key={group} variant="outline">{group}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column Mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
              <CardDescription>
                Map Excel columns to system fields. Matrix-specific fields are highlighted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Matrix-specific mappings */}
                <div className="col-span-full">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Matrix Structure Fields
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                    <MappingSelect
                      label="Groups Column"
                      value={mapping.groupColumn}
                      onChange={(value) => updateMapping('groupColumn', value)}
                      headers={matrixData.headers}
                      required
                    />
                    <MappingSelect
                      label="Description Column"
                      value={mapping.descriptionColumn}
                      onChange={(value) => updateMapping('descriptionColumn', value)}
                      headers={matrixData.headers}
                    />
                    <MappingSelect
                      label="Qty Column"
                      value={mapping.qtyColumn}
                      onChange={(value) => updateMapping('qtyColumn', value)}
                      headers={matrixData.headers}
                    />
                     <MappingSelect
                       label="WO Qty Column"
                       value={mapping.woQtyColumn}
                       onChange={(value) => updateMapping('woQtyColumn', value)}
                       headers={matrixData.headers}
                       required
                     />
                   </div>
                 </div>

                  <Separator className="col-span-full" />

                {/* Basic job fields */}
                <h4 className="col-span-full font-medium">Basic Job Fields</h4>
                
                <MappingSelect
                  label="Work Order"
                  value={mapping.woNo}
                  onChange={(value) => updateMapping('woNo', value)}
                  headers={matrixData.headers}
                  required
                />
                <MappingSelect
                  label="Customer"
                  value={mapping.customer}
                  onChange={(value) => updateMapping('customer', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Reference"
                  value={mapping.reference}
                  onChange={(value) => updateMapping('reference', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Date"
                  value={mapping.date}
                  onChange={(value) => updateMapping('date', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Due Date"
                  value={mapping.dueDate}
                  onChange={(value) => updateMapping('dueDate', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Rep"
                  value={mapping.rep}
                  onChange={(value) => updateMapping('rep', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Category"
                  value={mapping.category}
                  onChange={(value) => updateMapping('category', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Location"
                  value={mapping.location}
                  onChange={(value) => updateMapping('location', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Size"
                  value={mapping.size}
                  onChange={(value) => updateMapping('size', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Specification"
                  value={mapping.specification}
                  onChange={(value) => updateMapping('specification', value)}
                  headers={matrixData.headers}
                />
                <MappingSelect
                  label="Contact"
                  value={mapping.contact}
                  onChange={(value) => updateMapping('contact', value)}
                  headers={matrixData.headers}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Sample of how your matrix data will be interpreted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {matrixData.headers.slice(0, 8).map((header, index) => (
                        <TableHead key={index}>{header}</TableHead>
                      ))}
                      {matrixData.headers.length > 8 && <TableHead>...</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixData.rows.slice(0, 5).map((row, index) => (
                      <TableRow key={index}>
                        {row.slice(0, 8).map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{String(cell || '').substring(0, 50)}</TableCell>
                        ))}
                        {row.length > 8 && <TableCell>...</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Validation & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isValidMapping && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-600">
                    Groups Column and WO Qty Column are required for matrix parsing
                  </span>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={!isValidMapping}
                className="flex items-center gap-2"
              >
                Parse Matrix Data
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface MappingSelectProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  headers: string[];
  required?: boolean;
}

const MappingSelect: React.FC<MappingSelectProps> = ({ label, value, onChange, headers, required }) => {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger>
          <SelectValue placeholder="Select column..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">Not mapped</SelectItem>
          {headers.map((header, index) => (
            <SelectItem key={index} value={index.toString()}>
              Column {index + 1}: {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
