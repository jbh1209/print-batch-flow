
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, FileText, Image, Sticker, Box, Bookmark } from 'lucide-react';

interface BatchCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface BatchCategorySelectorProps {
  onSelectCategory: (category: string) => void;
  selectedCategory?: string;
  disabled?: boolean;
}

const batchCategories: BatchCategory[] = [
  {
    id: 'business_cards',
    name: 'Business Cards',
    description: 'Standard and premium business cards',
    icon: Package,
    color: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'flyers',
    name: 'Flyers',
    description: 'Marketing flyers and leaflets',
    icon: FileText,
    color: 'bg-green-100 text-green-800'
  },
  {
    id: 'postcards',
    name: 'Postcards',
    description: 'Promotional postcards',
    icon: Image,
    color: 'bg-purple-100 text-purple-800'
  },
  {
    id: 'stickers',
    name: 'Stickers',
    description: 'Custom stickers and labels',
    icon: Sticker,
    color: 'bg-yellow-100 text-yellow-800'
  },
  {
    id: 'boxes',
    name: 'Boxes',
    description: 'Custom packaging boxes',
    icon: Box,
    color: 'bg-orange-100 text-orange-800'
  },
  {
    id: 'covers',
    name: 'Covers',
    description: 'Book and magazine covers',
    icon: Bookmark,
    color: 'bg-red-100 text-red-800'
  }
];

export const BatchCategorySelector: React.FC<BatchCategorySelectorProps> = ({
  onSelectCategory,
  selectedCategory,
  disabled = false
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Batch Category</CardTitle>
        <p className="text-sm text-gray-600">
          Choose the product category for batch processing
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {batchCategories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            
            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto p-4 flex flex-col items-center gap-2 ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => onSelectCategory(category.id)}
                disabled={disabled}
              >
                <Icon className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-medium text-sm">{category.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {category.description}
                  </div>
                </div>
                {isSelected && (
                  <Badge variant="secondary" className="mt-1">
                    Selected
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
