
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { BaseJob } from '@/config/productTypes';

interface TableRowRendererOptions {
  includeSpecifications?: boolean;
  specificationDisplayValues?: {
    size?: string;
    paper_type?: string;
    paper_weight?: string;
  };
}

export const renderFlyerJobTableRow = (
  job: FlyerJob, 
  options: TableRowRendererOptions = {}
): string => {
  const { 
    includeSpecifications = false, 
    specificationDisplayValues = {} 
  } = options;

  // Use display values from specifications if provided, otherwise show N/A
  const size = specificationDisplayValues.size || 'N/A';
  const paperType = specificationDisplayValues.paper_type || 'N/A';
  const paperWeight = specificationDisplayValues.paper_weight || 'N/A';

  let row = `
    <tr>
      <td>${job.name}</td>
      <td>${job.job_number}</td>
      <td>${job.quantity}</td>
      <td>${new Date(job.due_date).toLocaleDateString()}</td>
      <td>${job.status}</td>
  `;

  if (includeSpecifications) {
    row += `
      <td>${size}</td>
      <td>${paperType}</td>
      <td>${paperWeight}</td>
    `;
  }

  row += `</tr>`;
  return row;
};

export const renderBaseJobTableRow = (
  job: BaseJob,
  options: TableRowRendererOptions = {}
): string => {
  const { 
    includeSpecifications = false, 
    specificationDisplayValues = {} 
  } = options;

  // Use display values from specifications if provided, otherwise show N/A
  const size = specificationDisplayValues.size || job.size || 'N/A';
  const paperType = specificationDisplayValues.paper_type || job.paper_type || 'N/A';
  const paperWeight = specificationDisplayValues.paper_weight || job.paper_weight || 'N/A';

  let row = `
    <tr>
      <td>${job.name}</td>
      <td>${job.job_number || job.name}</td>
      <td>${job.quantity}</td>
      <td>${new Date(job.due_date).toLocaleDateString()}</td>
      <td>${job.status}</td>
  `;

  if (includeSpecifications) {
    row += `
      <td>${size}</td>
      <td>${paperType}</td>
      <td>${paperWeight}</td>
    `;
  }

  row += `</tr>`;
  return row;
};
