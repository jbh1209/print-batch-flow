
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, MapPin, Settings } from "lucide-react";
import { usePrinters, type Printer as PrinterType } from "@/hooks/tracker/usePrinters";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface PrinterFormData {
  name: string;
  type: string;
  location: string;
  status: 'active' | 'maintenance' | 'offline';
  max_paper_size: string;
  supported_paper_types: string[];
  notes: string;
}

const PrinterForm: React.FC<{
  printer?: PrinterType;
  onSave: (data: Omit<PrinterType, 'id' | 'created_at' | 'updated_at' | 'capabilities'>) => Promise<void>;
  onCancel: () => void;
}> = ({ printer, onSave, onCancel }) => {
  const [formData, setFormData] = useState<PrinterFormData>({
    name: printer?.name || '',
    type: printer?.type || '',
    location: printer?.location || '',
    status: (printer?.status as 'active' | 'maintenance' | 'offline') || 'active',
    max_paper_size: printer?.max_paper_size || '',
    supported_paper_types: printer?.supported_paper_types || [],
    notes: printer?.notes || ''
  });

  const [newPaperType, setNewPaperType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSave({
        ...formData,
        capabilities: {}
      });
    } catch (error) {
      console.error('Error saving printer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPaperType = () => {
    if (newPaperType.trim() && !formData.supported_paper_types.includes(newPaperType.trim())) {
      setFormData(prev => ({
        ...prev,
        supported_paper_types: [...prev.supported_paper_types, newPaperType.trim()]
      }));
      setNewPaperType('');
    }
  };

  const removePaperType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      supported_paper_types: prev.supported_paper_types.filter(t => t !== type)
    }));
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
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
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
          <Select value={formData.status} onValueChange={(value: 'active' | 'maintenance' | 'offline') => 
            setFormData(prev => ({ ...prev, status: value }))
          }>
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

      <div>
        <Label htmlFor="max_paper_size">Max Paper Size</Label>
        <Input
          id="max_paper_size"
          value={formData.max_paper_size}
          onChange={(e) => setFormData(prev => ({ ...prev, max_paper_size: e.target.value }))}
          placeholder="e.g., SRA3, A4, B1"
        />
      </div>

      <div>
        <Label>Supported Paper Types</Label>
        <div className="flex gap-2 mb-2">
          <Input
            value={newPaperType}
            onChange={(e) => setNewPaperType(e.target.value)}
            placeholder="Add paper type..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPaperType())}
          />
          <Button type="button" onClick={addPaperType}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.supported_paper_types.map((type, index) => (
            <Badge key={index} variant="outline" className="flex items-center gap-1">
              {type}
              <button
                type="button"
                onClick={() => removePaperType(type)}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </Badge>
          ))}
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : printer ? 'Update' : 'Create'} Printer
        </Button>
      </div>
    </form>
  );
};

export const PrintersManagement: React.FC = () => {
  const { printers, isLoading, error, createPrinter, updatePrinter, deletePrinter } = usePrinters();
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSave = async (data: Omit<PrinterType, 'id' | 'created_at' | 'updated_at' | 'capabilities'>) => {
    if (selectedPrinter) {
      await updatePrinter(selectedPrinter.id, data);
    } else {
      await createPrinter(data);
    }
    setIsFormOpen(false);
    setSelectedPrinter(null);
  };

  const handleEdit = (printer: PrinterType) => {
    setSelectedPrinter(printer);
    setIsFormOpen(true);
  };

  const handleDelete = async (printer: PrinterType) => {
    if (confirm(`Are you sure you want to delete "${printer.name}"?`)) {
      await deletePrinter(printer.id);
    }
  };

  const openCreateForm = () => {
    setSelectedPrinter(null);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Printers Management</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading printers..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Printers Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Printers Management</CardTitle>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Printer
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {printers.map((printer) => (
            <div key={printer.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <h3 className="font-medium">{printer.name}</h3>
                    <Badge variant="outline">{printer.type}</Badge>
                    <Badge 
                      variant={printer.status === 'active' ? 'default' : 
                               printer.status === 'maintenance' ? 'secondary' : 'destructive'}
                    >
                      {printer.status}
                    </Badge>
                  </div>
                  {printer.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {printer.location}
                    </div>
                  )}
                  {printer.max_paper_size && (
                    <div className="text-sm text-gray-600">
                      Max Size: {printer.max_paper_size}
                    </div>
                  )}
                  {printer.supported_paper_types && printer.supported_paper_types.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {printer.supported_paper_types.map((type, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(printer)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(printer)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {printers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No printers found. Create your first printer to get started.
            </div>
          )}
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedPrinter ? 'Edit Printer' : 'Create New Printer'}
              </DialogTitle>
            </DialogHeader>
            <PrinterForm
              printer={selectedPrinter || undefined}
              onSave={handleSave}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
