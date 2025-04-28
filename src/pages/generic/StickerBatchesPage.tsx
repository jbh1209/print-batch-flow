
import { useState } from 'react';
import { GenericBatchesList } from '@/components/generic/GenericBatchesList';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';
import { productConfigs } from '@/config/productTypes';

const StickerBatchesPage = () => {
  const config = productConfigs["Stickers"];
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete,
  } = useGenericBatches(config);

  return (
    <div className="container mx-auto py-6">
      <GenericBatchesList
        batches={batches}
        isLoading={isLoading}
        error={error}
        batchToDelete={batchToDelete}
        isDeleting={isDeleting}
        onViewPDF={handleViewPDF}
        onDeleteBatch={handleDeleteBatch}
        onViewBatchDetails={handleViewBatchDetails}
        onSetBatchToDelete={setBatchToDelete}
        productType={config.productType}
        title={config.ui.title}
      />
    </div>
  );
};

export default StickerBatchesPage;
