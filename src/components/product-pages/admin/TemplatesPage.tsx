
import { useState } from 'react';
import { useProductPageTemplates } from '@/hooks/product-pages/useProductPageTemplates';
import { ProductPageTemplate } from '@/components/product-pages/types/ProductPageTypes';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Copy } from 'lucide-react';
import { TemplateForm } from '../TemplateForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function TemplatesPage() {
  const { 
    templates, 
    isLoading, 
    error, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    isSaving,
    isDeleting
  } = useProductPageTemplates();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProductPageTemplate | null>(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<ProductPageTemplate | null>(null);

  const handleCreateTemplate = async (templateData: {
    name: string;
    description?: string;
    fields: any[];
  }) => {
    const result = await createTemplate(templateData);
    if (result) {
      setIsCreateDialogOpen(false);
      toast.success('Template created successfully');
    }
  };

  const handleUpdateTemplate = async (templateData: {
    name: string;
    description?: string;
    fields: any[];
  }) => {
    if (!editingTemplate) return;
    
    const result = await updateTemplate(editingTemplate.id, templateData);
    if (result) {
      setEditingTemplate(null);
      toast.success('Template updated successfully');
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmTemplate) return;
    
    const result = await deleteTemplate(deleteConfirmTemplate.id);
    if (result) {
      setDeleteConfirmTemplate(null);
      toast.success('Template deleted successfully');
    }
  };

  const copyTemplateToClipboard = (template: ProductPageTemplate) => {
    const templateJson = JSON.stringify(template, null, 2);
    navigator.clipboard.writeText(templateJson);
    toast.success('Template JSON copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-800 p-4 rounded-md">
        <h3 className="text-lg font-medium">Error loading templates</h3>
        <p>{error}</p>
        <Button className="mt-2" variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Page Templates</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" /> Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first template to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" /> Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm mb-4">
                  <span className="text-muted-foreground">Fields: </span>
                  <span className="font-medium">{template.fields.length}</span>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => copyTemplateToClipboard(template)}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => setDeleteConfirmTemplate(template)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Define the fields for your product page template.
            </DialogDescription>
          </DialogHeader>
          
          <TemplateForm 
            onSubmit={handleCreateTemplate} 
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the fields for this product page template.
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <TemplateForm 
              initialData={{
                name: editingTemplate.name,
                description: editingTemplate.description,
                fields: editingTemplate.fields
              }}
              onSubmit={handleUpdateTemplate} 
              isSaving={isSaving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmTemplate} onOpenChange={(open) => !open && setDeleteConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              template and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
