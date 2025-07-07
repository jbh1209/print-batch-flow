
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Settings, Workflow, Split } from "lucide-react";
import { useCategories } from "@/hooks/tracker/useCategories";
import { CategoryForm } from "./CategoryForm";
import { CategoryStageBuilder } from "./CategoryStageBuilder";
import { SafeCategoryDeleteDialog } from "./SafeCategoryDeleteDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export const CategoriesManagement = () => {
  const { categories, isLoading, error, createCategory, updateCategory, fetchCategories } = useCategories();
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);

  const handleCategoryDeleted = () => {
    setCategoryToDelete(null);
    fetchCategories(); // Refresh the categories list
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories Management</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading categories..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories Management</CardTitle>
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
    <ErrorBoundary>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Categories Management</CardTitle>
            <CategoryForm onSubmit={createCategory} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <h3 className="font-medium">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                    </div>
                    <Badge variant="outline">
                      {category.sla_target_days} day{category.sla_target_days !== 1 ? 's' : ''} SLA
                    </Badge>
                    {category.requires_part_assignment && (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Split className="h-3 w-3 mr-1" />
                        Part Assignment
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Workflow className="h-4 w-4 mr-1" />
                          Build Workflow
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Category Workflow Builder</DialogTitle>
                        </DialogHeader>
                        <CategoryStageBuilder 
                          categoryId={category.id} 
                          categoryName={category.name} 
                        />
                      </DialogContent>
                    </Dialog>
                    
                    <CategoryForm 
                      category={category} 
                      onSubmit={(data) => updateCategory(category.id, data)}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      }
                    />
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCategoryToDelete(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No categories found. Create your first category to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {categoryToDelete && (
          <SafeCategoryDeleteDialog
            isOpen={!!categoryToDelete}
            onClose={() => setCategoryToDelete(null)}
            category={categoryToDelete}
            allCategories={categories}
            onDeleted={handleCategoryDeleted}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};
