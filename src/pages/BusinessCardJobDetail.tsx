
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericJobDetailsPage from '@/pages/generic/GenericJobDetailsPage';

const BusinessCardJobDetail = () => {
  return <GenericJobDetailsPage config={productConfigs["BusinessCards"]} />;
};

export default BusinessCardJobDetail;
