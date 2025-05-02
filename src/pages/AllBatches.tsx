
import React, { useState } from 'react';
import { useBatchesList } from "@/hooks/useBatchesList";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BatchUrgencyIndicator from "@/components/batches/BatchUrgencyIndicator";
import { calculateJobUrgency } from "@/utils/dateCalculations";
import { productConfigs } from "@/config/productTypes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AllBatches: React.FC = () => {
  const { batches, isLoading, error, getProductUrl, getBatchUrl } = useBatchesList();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("current");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">There was a problem loading batches</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleBatchClick = (batchUrl: string) => {
    navigate(batchUrl);
  };
  
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'queued': return 'outline';
      case 'in_progress': return 'secondary';
      case 'sent_to_print': return 'secondary';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  // Get row background color based on batch status
  const getRowBackgroundColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50';
      case 'sent_to_print':
        return 'bg-blue-50';
      case 'processing':
        return 'bg-amber-50';
      case 'cancelled':
        return 'bg-red-50';
      default:
        return '';
    }
  };

  // Separate batches into current and completed
  const currentBatches = batches.filter(
    batch => !['completed', 'sent_to_print'].includes(batch.status)
  );
  
  const completedBatches = batches.filter(
    batch => ['completed', 'sent_to_print'].includes(batch.status)
  );

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Batches</h1>
          <p className="text-muted-foreground">
            View and manage all batches across product types
          </p>
        </div>
      </div>

      <Tabs defaultValue="current" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="current">
            Current Batches ({currentBatches.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed Batches ({completedBatches.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="bg-white shadow rounded-lg">
          {currentBatches.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium">No current batches</h3>
              <p className="text-muted-foreground mt-1">There are no batches in progress.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Product Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentBatches.map((batch) => {
                    const config = productConfigs[batch.product_type] || productConfigs["Business Cards"];
                    const urgencyLevel = calculateJobUrgency(batch.due_date, config);
                    
                    return (
                      <TableRow 
                        key={batch.id} 
                        className={getRowBackgroundColor(batch.status)}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <BatchUrgencyIndicator 
                              urgencyLevel={urgencyLevel}
                              earliestDueDate={batch.due_date}
                              productType={batch.product_type}
                            />
                            <span>{batch.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{batch.product_type}</TableCell>
                        <TableCell>{batch.due_date ? format(new Date(batch.due_date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(batch.status)}>
                            {batch.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            onClick={() => handleBatchClick(getBatchUrl(batch))}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="bg-white shadow rounded-lg">
          {completedBatches.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium">No completed batches</h3>
              <p className="text-muted-foreground mt-1">No batches have been completed or sent to print yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Product Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedBatches.map((batch) => {
                    const config = productConfigs[batch.product_type] || productConfigs["Business Cards"];
                    const urgencyLevel = calculateJobUrgency(batch.due_date, config);
                    
                    return (
                      <TableRow 
                        key={batch.id}
                        className={getRowBackgroundColor(batch.status)}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <BatchUrgencyIndicator 
                              urgencyLevel={urgencyLevel}
                              earliestDueDate={batch.due_date}
                              productType={batch.product_type}
                            />
                            <span>{batch.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{batch.product_type}</TableCell>
                        <TableCell>{batch.due_date ? format(new Date(batch.due_date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(batch.status)}>
                            {batch.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            onClick={() => handleBatchClick(getBatchUrl(batch))}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AllBatches;
