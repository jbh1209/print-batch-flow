
import FlyerBatchDetails from './FlyerBatchDetails';
import FlyerBatchErrorBoundary from '@/components/flyers/batch-details/FlyerBatchErrorBoundary';

const FlyerBatchDetailsWrapper = () => {
  return (
    <FlyerBatchErrorBoundary>
      <FlyerBatchDetails />
    </FlyerBatchErrorBoundary>
  );
};

export default FlyerBatchDetailsWrapper;
