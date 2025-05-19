
import { lazy } from 'react';
import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy loaded components
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AllBatches = lazy(() => import("./pages/AllBatches"));
const AllJobsPage = lazy(() => import("./pages/AllJobsPage"));
const Settings = lazy(() => import("./pages/Settings"));
const Users = lazy(() => import("./pages/Users"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Business Cards
const BusinessCardBatches = lazy(() => import("./pages/BusinessCardBatches"));
const BusinessCardJobs = lazy(() => import("./pages/BusinessCardJobs"));
const BusinessCardJobNew = lazy(() => import("./pages/BusinessCardJobNew"));
const BusinessCardJobEdit = lazy(() => import("./pages/BusinessCardJobEdit"));

// Flyers
const FlyerBatches = lazy(() => import("./pages/FlyerBatches"));
const FlyerJobs = lazy(() => import("./pages/FlyerJobs"));
const FlyerJobNew = lazy(() => import("./pages/FlyerJobNew"));
const FlyerJobEdit = lazy(() => import("./pages/FlyerJobEdit"));
const FlyerJobDetail = lazy(() => import("./pages/FlyerJobDetail"));

// Sleeves
const SleeveJobsPage = lazy(() => import("./pages/generic/SleeveJobsPage"));
const SleeveBatchesPage = lazy(() => import("./pages/generic/SleeveBatchesPage"));
const SleeveJobNewPage = lazy(() => import("./pages/generic/SleeveJobNewPage"));

// Boxes
const BoxJobsPage = lazy(() => import("./pages/generic/BoxJobsPage"));
const BoxBatchesPage = lazy(() => import("./pages/generic/BoxBatchesPage"));
const BoxJobNewPage = lazy(() => import("./pages/generic/BoxJobNewPage"));

// Covers
const CoverJobsPage = lazy(() => import("./pages/generic/CoverJobsPage"));
const CoverBatchesPage = lazy(() => import("./pages/generic/CoverBatchesPage"));
const CoverJobNewPage = lazy(() => import("./pages/generic/CoverJobNewPage"));

// Posters
const PosterJobsPage = lazy(() => import("./pages/generic/PosterJobsPage"));
const PosterBatchesPage = lazy(() => import("./pages/generic/PosterBatchesPage"));
const PosterJobNewPage = lazy(() => import("./pages/generic/PosterJobNewPage"));

// Stickers
const StickerJobsPage = lazy(() => import("./pages/generic/StickerJobsPage"));
const StickerBatchesPage = lazy(() => import("./pages/generic/StickerBatchesPage"));
const StickerJobNewPage = lazy(() => import("./pages/generic/StickerJobNewPage"));

// Postcards
const PostcardJobsPage = lazy(() => import("./pages/generic/PostcardJobsPage"));
const PostcardBatchesPage = lazy(() => import("./pages/generic/PostcardBatchesPage"));
const PostcardJobNewPage = lazy(() => import("./pages/generic/PostcardJobNewPage"));

// Auth
const Auth = lazy(() => import("./pages/Auth"));

// Product Pages Admin
const ProductPagesTemplatesPage = lazy(() => import("./pages/admin/ProductPagesTemplatesPage"));
const ProductPagesJobsPage = lazy(() => import("./pages/admin/ProductPagesJobsPage"));
const ProductPagesJobNewPage = lazy(() => import("./pages/admin/ProductPagesJobNewPage"));
const ProductPagesBatchesPage = lazy(() => import("./pages/admin/ProductPagesBatchesPage"));
const ProductPageBatchDetailsPage = lazy(() => import("./pages/admin/ProductPageBatchDetailsPage"));

export const routes = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    errorElement: <NotFound />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/batches", element: <AllBatches /> },
      { path: "/all-jobs", element: <AllJobsPage /> },
      { path: "/settings", element: <Settings /> },
      { path: "/users", element: <Users /> },

      // Business Cards
      { path: "/batches/business-cards", element: <BusinessCardBatches /> },
      { path: "/batches/business-cards/jobs", element: <BusinessCardJobs /> },
      { path: "/batches/business-cards/jobs/new", element: <BusinessCardJobNew /> },
      { path: "/batches/business-cards/jobs/:id", element: <BusinessCardJobEdit /> },
      
      // Flyers
      { path: "/batches/flyers", element: <FlyerBatches /> },
      { path: "/batches/flyers/jobs", element: <FlyerJobs /> },
      { path: "/batches/flyers/jobs/new", element: <FlyerJobNew /> },
      { path: "/batches/flyers/jobs/:id", element: <FlyerJobEdit /> },
      { path: "/batches/flyers/jobs/:id/details", element: <FlyerJobDetail /> },
      
      // Sleeves
      { path: "/batches/sleeves/jobs", element: <SleeveJobsPage /> },
      { path: "/batches/sleeves", element: <SleeveBatchesPage /> },
      { path: "/batches/sleeves/jobs/new", element: <SleeveJobNewPage /> },
      
      // Boxes
      { path: "/batches/boxes/jobs", element: <BoxJobsPage /> },
      { path: "/batches/boxes", element: <BoxBatchesPage /> },
      { path: "/batches/boxes/jobs/new", element: <BoxJobNewPage /> },
      
      // Covers
      { path: "/batches/covers/jobs", element: <CoverJobsPage /> },
      { path: "/batches/covers", element: <CoverBatchesPage /> },
      { path: "/batches/covers/jobs/new", element: <CoverJobNewPage /> },
      
      // Posters
      { path: "/batches/posters/jobs", element: <PosterJobsPage /> },
      { path: "/batches/posters", element: <PosterBatchesPage /> },
      { path: "/batches/posters/jobs/new", element: <PosterJobNewPage /> },
      
      // Stickers
      { path: "/batches/stickers/jobs", element: <StickerJobsPage /> },
      { path: "/batches/stickers", element: <StickerBatchesPage /> },
      { path: "/batches/stickers/jobs/new", element: <StickerJobNewPage /> },
      
      // Postcards
      { path: "/batches/postcards/jobs", element: <PostcardJobsPage /> },
      { path: "/batches/postcards", element: <PostcardBatchesPage /> },
      { path: "/batches/postcards/jobs/new", element: <PostcardJobNewPage /> },
      
      // Product Pages Admin
      { path: "/admin/product-pages/templates", element: <ProductPagesTemplatesPage /> },
      { path: "/admin/product-pages/jobs", element: <ProductPagesJobsPage /> },
      { path: "/admin/product-pages/jobs/new", element: <ProductPagesJobNewPage /> },
      { path: "/admin/product-pages/batches", element: <ProductPagesBatchesPage /> },
      { path: "/admin/product-pages/batch-details", element: <ProductPageBatchDetailsPage /> }
    ],
  },
  {
    path: "/login",
    element: <Auth />,
  },
  {
    path: "/signup",
    element: <Auth />,
  },
]);
