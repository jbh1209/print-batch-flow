
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Edit } from "lucide-react";
import { useCategories } from "@/hooks/tracker/useCategories";
import { CategoryForm } from "./CategoryForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const CategoriesManagement = () => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading categories...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
              </div>
              <div className="flex items-center gap-2">
                <CategoryForm 
                  category={category} 
                  onSubmit={(data) => updateCategory(category.id, data)}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Category</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{category.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteCategory(category.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
  );
};
