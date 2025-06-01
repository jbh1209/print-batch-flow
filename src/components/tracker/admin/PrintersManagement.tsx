
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Printer } from "lucide-react";
import { usePrinters, type Printer } from "@/hooks/tracker/usePrinters";
import { toast } from "sonner";

const PrinterForm = ({ 
  printer, 
  onSave, 
  onCancel 
}: { 
  printer?: Printer; 
  onSave: (data: any) => void; 
  onCancel: () => void; 
}) => {
  const [formData, setFormData] = useState({
    name: printer?.name || '',
    type: printer?.type || '',
    location: printer?.location || '',
    status: printer?.status || 'active',
    max_paper_size: printer?.max_paper_size || '',
    supported_paper_types: printer?.supported_paper_types?.join(', ') || '',
    notes: printer?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const printerData = {
      ...formData,
      supported_paper_types: formData.supported_paper_types
        .split(',')
        .map(type => type.trim())
        .filter(type => type.length > 0),
      capabilities: {}
    };
    
    onSave(printerData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Printer Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="type">Printer Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select printer type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Digital">Digital</SelectItem>
              <SelectItem value="Offset">Offset</SelectItem>
              <SelectItem value="Large Format">Large Format</SelectItem>
              <SelectItem value="Inkjet">Inkjet</SelectItem>
              <SelectItem value="Laser">Laser</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="max_paper_size">Max Paper Size</Label>
          <Input
            id="max_paper_size"
            value={formData.max_paper_size}
            onChange={(e) => setFormData(prev => ({ ...prev, max_paper_size: e.target.value }))}
            placeholder="e.g., SRA3, B1, 1600mm"
          />
        </div>
        
        <div>
          <Label htmlFor="supported_paper_types">Supported Paper Types</Label>
          <Input
            id="supported_paper_types"
            value={formData.supported_paper_types}
            onChange={(e) => setFormData(prev => ({ ...prev, supported_paper_types: e.target.value }))}
            placeholder="Coated, Uncoated, Cardboard (comma separated)"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {printer ? 'Update' : 'Create'} Printer
        </Button>
      </div>
    </form>
  );
};

export const PrintersManagement = () => {
  const { printers, isLoading, createPrinter, updatePrinter, deletePrinter } = usePrinters();
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreatePrinter = async (data: any) => {
    try {
      await createPrinter(data);
      setShowCreateDialog(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleUpdatePrinter = async (data: any) => {
    if (!editingPrinter) return;
    
    try {
      await updatePrinter(editingPrinter.id, data);
      setEditingPrinter(null);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDeletePrinter = async (printer: Printer) => {
    if (window.confirm(`Are you sure you want to delete ${printer.name}?`)) {
      try {
        await deletePrinter(printer.id);
      } catch (err) {
        // Error handled in hook
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'maintenance':
        return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      case 'offline':
        return <Badge className="bg-red-100 text-red-800">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading printers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Printers Management</h2>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Printer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Printer</DialogTitle>
            </DialogHeader>
            <PrinterForm
              onSave={handleCreatePrinter}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Printers ({printers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Max Size</TableHead>
                <TableHead>Paper Types</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell className="font-medium">{printer.name}</TableCell>
                  <TableCell>{printer.type}</TableCell>
                  <TableCell>{printer.location || '-'}</TableCell>
                  <TableCell>{getStatusBadge(printer.status)}</TableCell>
                  <TableCell>{printer.max_paper_size || '-'}</TableCell>
                  <TableCell>
                    {printer.supported_paper_types?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {printer.supported_paper_types.slice(0, 2).map((type, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {printer.supported_paper_types.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{printer.supported_paper_types.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPrinter(printer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePrinter(printer)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {printers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No printers configured yet. Add your first printer to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPrinter} onOpenChange={(open) => !open && setEditingPrinter(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Printer</DialogTitle>
          </DialogHeader>
          {editingPrinter && (
            <PrinterForm
              printer={editingPrinter}
              onSave={handleUpdatePrinter}
              onCancel={() => setEditingPrinter(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
