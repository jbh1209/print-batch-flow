
import React from 'react';

interface FormLoadingSpinnerProps {
  message: string;
}

const FormLoadingSpinner: React.FC<FormLoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  );
};

export default FormLoadingSpinner;
