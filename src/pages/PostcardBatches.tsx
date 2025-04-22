
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import BatchesList from "@/components/batches/BatchesList";
import { usePostcardBatches } from "@/hooks/usePostcardBatches";
import DeleteBatchDialog from "@/components/batches/DeleteBatchDialog";

const PostcardBatches = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete,
    fetchBatches
  } = usePostcardBatches();

  // Convert postcard batches to the common BatchSummary format for BatchesList component
  const batchSummaries = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Postcards",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // Filter batches based on search query
  const filteredBatches = searchQuery
    ? batchSummaries.filter(batch => 
        batch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : batchSummaries;

  // URL for batch details
  const getBatchUrl = (batch) => `/batches/postcards/batches/${batch.id}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Batches</h1>
          <p className="text-gray-500 mt-1">View and manage all your postcard batches</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards")}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </Button>
          <Button onClick={() => navigate("/batches/postcards/jobs")}>
            <Plus size={16} className="mr-1" />
            <span>Create Batch</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search batches"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <BatchesList
        batches={filteredBatches}
        getBatchUrl={getBatchUrl}
        isLoading={isLoading}
        error={error}
        onRetry={fetchBatches}
      />

      <DeleteBatchDialog
        open={!!batchToDelete}
        batchName={batches.find(b => b.id === batchToDelete)?.name || ""}
        isDeleting={isDeleting}
        onConfirm={handleDeleteBatch}
        onCancel={() => setBatchToDelete(null)}
      />
    </div>
  );
};

export default PostcardBatches;
