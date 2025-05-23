
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchSummary } from "./types/BatchTypes";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Eye, Trash2 } from "lucide-react";

interface AllBatchesTabsProps {
  currentBatches: BatchSummary[];
  completedBatches: BatchSummary[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  getBadgeVariant: (status: string) => "default" | "secondary" | "destructive" | "outline" | "success";
  getBatchUrl: (batch: BatchSummary) => string;
  handleBatchClick: (url: string) => void;
  handleDeleteBatch?: (batchId: string) => void; // Add this prop for deletion
}

const AllBatchesTabs = ({ 
  currentBatches, 
  completedBatches, 
  activeTab, 
  setActiveTab, 
  getBadgeVariant,
  getBatchUrl,
  handleBatchClick,
  handleDeleteBatch
}: AllBatchesTabsProps) => {
  return (
    <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mt-6">
      <div className="border-b pb-2 mb-4">
        <TabsList className="mb-2">
          <TabsTrigger value="current" className="relative">
            Current
            <Badge variant="secondary" className="ml-2">{currentBatches.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <Badge variant="secondary" className="ml-2">{completedBatches.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="current" className="space-y-4">
        {currentBatches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No current batches found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBatches.map((batch) => (
              <Card key={batch.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {batch.name}
                    </CardTitle>
                    <Badge variant={getBadgeVariant(batch.status)}>
                      {batch.status.charAt(0).toUpperCase() + batch.status.slice(1).replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Type:</strong> {batch.product_type}</p>
                    <p><strong>Due:</strong> {formatDistanceToNow(new Date(batch.due_date), { addSuffix: true })}</p>
                    <p><strong>Created:</strong> {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleBatchClick(getBatchUrl(batch))}
                    className="gap-2"
                  >
                    <Eye size={16} />
                    View Details
                  </Button>
                  
                  {handleDeleteBatch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBatch(batch.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
      
      <TabsContent value="completed" className="space-y-4">
        {completedBatches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No completed batches found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedBatches.map((batch) => (
              <Card key={batch.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {batch.name}
                    </CardTitle>
                    <Badge variant={getBadgeVariant(batch.status)}>
                      {batch.status.charAt(0).toUpperCase() + batch.status.slice(1).replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Type:</strong> {batch.product_type}</p>
                    <p><strong>Due:</strong> {formatDistanceToNow(new Date(batch.due_date), { addSuffix: true })}</p>
                    <p><strong>Created:</strong> {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}</p>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleBatchClick(getBatchUrl(batch))}
                    className="w-full gap-2 justify-center"
                  >
                    <Eye size={16} />
                    View Details
                    <ArrowRight size={16} className="ml-auto" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default AllBatchesTabs;
