import { useState, useEffect } from 'react';
import { ProductConfig } from '@/config/productTypes';

export interface ExtendedJob {
  id: string;
  name: string;
  quantity: number;
  due_date: string;
  productConfig: ProductConfig;
  urgency: string;
  job_number: string;
  reference?: string;
  pdf_url?: string;
}

export const useAllPendingJobs = () => {
  const [jobs, setJobs] = useState<ExtendedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate fetching jobs from different sources
      const businessCards = await fetchBusinessCards();
      const flyers = await fetchFlyers();
      const postcards = await fetchPostcards();
      const posters = await fetchPosters();
      const sleeves = await fetchSleeves();
      const boxes = await fetchBoxes();
      const covers = await fetchCovers();
      const stickers = await fetchStickers();

      // Combine and set the jobs
      const allJobs = [
        ...businessCards,
        ...flyers,
        ...postcards,
        ...posters,
        ...sleeves,
        ...boxes,
        ...covers,
        ...stickers,
      ];
      setJobs(allJobs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { jobs, isLoading, error, refetch };
};

// Mock functions to simulate fetching jobs for each product type
const fetchBusinessCards = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockBusinessCards: ExtendedJob[] = [
        {
          id: '1',
          name: 'Business Card Design 1',
          quantity: 500,
          due_date: '2024-03-15',
          productConfig: {
            productType: 'Business Cards',
            tableName: 'business_cards',
            hasSize: false,
            hasPaperType: false,
            slaTargetDays: 3,
            ui: {
              color: '#624cf5',
              title: 'Business Cards',
              batchFormTitle: 'Create Business Card Batch',
              jobFormTitle: 'New Business Card Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/business-cards/jobs',
              batches: '/batches/business-cards',
              newJob: '/batches/business-cards/jobs/new'
            }
          },
          urgency: 'critical',
          job_number: 'BC-001',
          reference: 'Client Ref BC-001',
          pdf_url: 'https://example.com/bc-001.pdf'
        },
        {
          id: '2',
          name: 'Business Card Design 2',
          quantity: 1000,
          due_date: '2024-03-20',
          productConfig: {
            productType: 'Business Cards',
            tableName: 'business_cards',
            hasSize: false,
            hasPaperType: false,
            slaTargetDays: 3,
            ui: {
              color: '#624cf5',
              title: 'Business Cards',
              batchFormTitle: 'Create Business Card Batch',
              jobFormTitle: 'New Business Card Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/business-cards/jobs',
              batches: '/batches/business-cards',
              newJob: '/batches/business-cards/jobs/new'
            }
          },
          urgency: 'high',
          job_number: 'BC-002',
          reference: 'Client Ref BC-002',
          pdf_url: 'https://example.com/bc-002.pdf'
        },
      ];
      resolve(mockBusinessCards);
    }, 500);
  });
};

const fetchFlyers = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockFlyers: ExtendedJob[] = [
        {
          id: '3',
          name: 'Flyer Design 1',
          quantity: 2000,
          due_date: '2024-03-18',
          productConfig: {
            productType: 'Flyers',
            tableName: 'flyers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 5,
            ui: {
              color: '#f54c82',
              title: 'Flyers',
              batchFormTitle: 'Create Flyer Batch',
              jobFormTitle: 'New Flyer Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/flyers/jobs',
              batches: '/batches/flyers',
              newJob: '/batches/flyers/jobs/new'
            }
          },
          urgency: 'medium',
          job_number: 'FL-001',
          reference: 'Client Ref FL-001',
          pdf_url: 'https://example.com/fl-001.pdf'
        },
        {
          id: '4',
          name: 'Flyer Design 2',
          quantity: 1500,
          due_date: '2024-03-22',
          productConfig: {
            productType: 'Flyers',
            tableName: 'flyers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 5,
            ui: {
              color: '#f54c82',
              title: 'Flyers',
              batchFormTitle: 'Create Flyer Batch',
              jobFormTitle: 'New Flyer Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/flyers/jobs',
              batches: '/batches/flyers',
              newJob: '/batches/flyers/jobs/new'
            }
          },
          urgency: 'low',
          job_number: 'FL-002',
          reference: 'Client Ref FL-002',
          pdf_url: 'https://example.com/fl-002.pdf'
        },
      ];
      resolve(mockFlyers);
    }, 300);
  });
};

const fetchPostcards = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockPostcards: ExtendedJob[] = [
        {
          id: '5',
          name: 'Postcard Design 1',
          quantity: 800,
          due_date: '2024-03-25',
          productConfig: {
            productType: 'Postcards',
            tableName: 'postcards',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 4,
            ui: {
              color: '#f5a74c',
              title: 'Postcards',
              batchFormTitle: 'Create Postcard Batch',
              jobFormTitle: 'New Postcard Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/postcards/jobs',
              batches: '/batches/postcards',
              newJob: '/batches/postcards/jobs/new'
            }
          },
          urgency: 'high',
          job_number: 'PC-001',
          reference: 'Client Ref PC-001',
          pdf_url: 'https://example.com/pc-001.pdf'
        },
        {
          id: '6',
          name: 'Postcard Design 2',
          quantity: 1200,
          due_date: '2024-03-28',
          productConfig: {
            productType: 'Postcards',
            tableName: 'postcards',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 4,
            ui: {
              color: '#f5a74c',
              title: 'Postcards',
              batchFormTitle: 'Create Postcard Batch',
              jobFormTitle: 'New Postcard Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/postcards/jobs',
              batches: '/batches/postcards',
              newJob: '/batches/postcards/jobs/new'
            }
          },
          urgency: 'medium',
          job_number: 'PC-002',
          reference: 'Client Ref PC-002',
          pdf_url: 'https://example.com/pc-002.pdf'
        },
      ];
      resolve(mockPostcards);
    }, 400);
  });
};

const fetchPosters = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockPosters: ExtendedJob[] = [
        {
          id: '7',
          name: 'Poster Design 1',
          quantity: 300,
          due_date: '2024-03-22',
          productConfig: {
            productType: 'Posters',
            tableName: 'posters',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 7,
            ui: {
              color: '#4cf598',
              title: 'Posters',
              batchFormTitle: 'Create Poster Batch',
              jobFormTitle: 'New Poster Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/posters/jobs',
              batches: '/batches/posters',
              newJob: '/batches/posters/jobs/new'
            }
          },
          urgency: 'critical',
          job_number: 'PO-001',
          reference: 'Client Ref PO-001',
          pdf_url: 'https://example.com/po-001.pdf'
        },
        {
          id: '8',
          name: 'Poster Design 2',
          quantity: 500,
          due_date: '2024-03-26',
          productConfig: {
            productType: 'Posters',
            tableName: 'posters',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 7,
            ui: {
              color: '#4cf598',
              title: 'Posters',
              batchFormTitle: 'Create Poster Batch',
              jobFormTitle: 'New Poster Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/posters/jobs',
              batches: '/batches/posters',
              newJob: '/batches/posters/jobs/new'
            }
          },
          urgency: 'high',
          job_number: 'PO-002',
          reference: 'Client Ref PO-002',
          pdf_url: 'https://example.com/po-002.pdf'
        },
      ];
      resolve(mockPosters);
    }, 600);
  });
};

const fetchSleeves = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockSleeves: ExtendedJob[] = [
        {
          id: '9',
          name: 'Sleeve Design 1',
          quantity: 1000,
          due_date: '2024-03-20',
          productConfig: {
            productType: 'Sleeves',
            tableName: 'sleeves',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 5,
            ui: {
              color: '#4c87f5',
              title: 'Sleeves',
              batchFormTitle: 'Create Sleeve Batch',
              jobFormTitle: 'New Sleeve Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/sleeves/jobs',
              batches: '/batches/sleeves',
              newJob: '/batches/sleeves/jobs/new'
            }
          },
          urgency: 'medium',
          job_number: 'SL-001',
          reference: 'Client Ref SL-001',
          pdf_url: 'https://example.com/sl-001.pdf'
        },
        {
          id: '10',
          name: 'Sleeve Design 2',
          quantity: 800,
          due_date: '2024-03-24',
          productConfig: {
            productType: 'Sleeves',
            tableName: 'sleeves',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 5,
            ui: {
              color: '#4c87f5',
              title: 'Sleeves',
              batchFormTitle: 'Create Sleeve Batch',
              jobFormTitle: 'New Sleeve Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/sleeves/jobs',
              batches: '/batches/sleeves',
              newJob: '/batches/sleeves/jobs/new'
            }
          },
          urgency: 'low',
          job_number: 'SL-002',
          reference: 'Client Ref SL-002',
          pdf_url: 'https://example.com/sl-002.pdf'
        },
      ];
      resolve(mockSleeves);
    }, 450);
  });
};

const fetchBoxes = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockBoxes: ExtendedJob[] = [
        {
          id: '11',
          name: 'Box Design 1',
          quantity: 400,
          due_date: '2024-03-18',
          productConfig: {
            productType: 'Boxes',
            tableName: 'boxes',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 10,
            ui: {
              color: '#f54cca',
              title: 'Boxes',
              batchFormTitle: 'Create Box Batch',
              jobFormTitle: 'New Box Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/boxes/jobs',
              batches: '/batches/boxes',
              newJob: '/batches/boxes/jobs/new'
            }
          },
          urgency: 'critical',
          job_number: 'BX-001',
          reference: 'Client Ref BX-001',
          pdf_url: 'https://example.com/bx-001.pdf'
        },
        {
          id: '12',
          name: 'Box Design 2',
          quantity: 600,
          due_date: '2024-03-22',
          productConfig: {
            productType: 'Boxes',
            tableName: 'boxes',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 10,
            ui: {
              color: '#f54cca',
              title: 'Boxes',
              batchFormTitle: 'Create Box Batch',
              jobFormTitle: 'New Box Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/boxes/jobs',
              batches: '/batches/boxes',
              newJob: '/batches/boxes/jobs/new'
            }
          },
          urgency: 'high',
          job_number: 'BX-002',
          reference: 'Client Ref BX-002',
          pdf_url: 'https://example.com/bx-002.pdf'
        },
      ];
      resolve(mockBoxes);
    }, 550);
  });
};

const fetchCovers = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockCovers: ExtendedJob[] = [
        {
          id: '13',
          name: 'Cover Design 1',
          quantity: 700,
          due_date: '2024-03-25',
          productConfig: {
            productType: 'Covers',
            tableName: 'covers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 6,
            ui: {
              color: '#caf54c',
              title: 'Covers',
              batchFormTitle: 'Create Cover Batch',
              jobFormTitle: 'New Cover Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/covers/jobs',
              batches: '/batches/covers',
              newJob: '/batches/covers/jobs/new'
            }
          },
          urgency: 'medium',
          job_number: 'CV-001',
          reference: 'Client Ref CV-001',
          pdf_url: 'https://example.com/cv-001.pdf'
        },
        {
          id: '14',
          name: 'Cover Design 2',
          quantity: 900,
          due_date: '2024-03-29',
          productConfig: {
            productType: 'Covers',
            tableName: 'covers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 6,
            ui: {
              color: '#caf54c',
              title: 'Covers',
              batchFormTitle: 'Create Cover Batch',
              jobFormTitle: 'New Cover Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/covers/jobs',
              batches: '/batches/covers',
              newJob: '/batches/covers/jobs/new'
            }
          },
          urgency: 'low',
          job_number: 'CV-002',
          reference: 'Client Ref CV-002',
          pdf_url: 'https://example.com/cv-002.pdf'
        },
      ];
      resolve(mockCovers);
    }, 350);
  });
};

const fetchStickers = async (): Promise<ExtendedJob[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockStickers: ExtendedJob[] = [
        {
          id: '15',
          name: 'Sticker Design 1',
          quantity: 1200,
          due_date: '2024-03-22',
          productConfig: {
            productType: 'Stickers',
            tableName: 'stickers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 4,
            ui: {
              color: '#4cf5f0',
              title: 'Stickers',
              batchFormTitle: 'Create Sticker Batch',
              jobFormTitle: 'New Sticker Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/stickers/jobs',
              batches: '/batches/stickers',
              newJob: '/batches/stickers/jobs/new'
            }
          },
          urgency: 'high',
          job_number: 'ST-001',
          reference: 'Client Ref ST-001',
          pdf_url: 'https://example.com/st-001.pdf'
        },
        {
          id: '16',
          name: 'Sticker Design 2',
          quantity: 1500,
          due_date: '2024-03-26',
          productConfig: {
            productType: 'Stickers',
            tableName: 'stickers',
            hasSize: true,
            hasPaperType: true,
            slaTargetDays: 4,
            ui: {
              color: '#4cf5f0',
              title: 'Stickers',
              batchFormTitle: 'Create Sticker Batch',
              jobFormTitle: 'New Sticker Job'
            },
            fields: {},
            routes: {
              jobs: '/batches/stickers/jobs',
              batches: '/batches/stickers',
              newJob: '/batches/stickers/jobs/new'
            }
          },
          urgency: 'medium',
          job_number: 'ST-002',
          reference: 'Client Ref ST-002',
          pdf_url: 'https://example.com/st-002.pdf'
        },
      ];
      resolve(mockStickers);
    }, 500);
  });
};
