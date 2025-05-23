
# BatchFlow Design System & Architecture Guide

## Overview
BatchFlow is a printing batch management application built with React, TypeScript, Tailwind CSS, and Shadcn/UI components. This document serves as the master reference for maintaining UI consistency and functionality.

## Color Palette & Branding
```css
--batchflow-primary: #15365b (Dark blue)
--batchflow-secondary: #3498db (Light blue) 
--batchflow-accent: #2ecc71 (Green)
--batchflow-background: #f6f8fa (Light gray background)
```

## Layout Architecture

### Root Layout Structure
- **Sidebar**: Fixed left sidebar with collapsible functionality
- **Main Content**: Flex layout with header and content area
- **Header**: Top navigation bar with search, notifications, and user profile

### Sidebar Design
- **Width**: 64px collapsed, 256px expanded
- **Background**: `bg-batchflow-primary` (Dark blue #15365b)
- **Text**: White text with hover effects
- **Navigation**: Hierarchical with General and Batch Types sections
- **Collapse**: ChevronLeft icon rotates on toggle

### Header Design
- **Height**: 64px (h-16)
- **Background**: White with border-bottom
- **Content**: SearchBar on left, actions (Bell, Help, Logout, Avatar) on right
- **Avatar**: Sky-blue circle with user initial

### Main Content Area
- **Background**: `bg-batchflow-background` 
- **Padding**: p-6 for consistent spacing
- **Cards**: White background with shadow and rounded corners

## Component Standards

### Button Styles
- **Primary**: Default shadcn button styling
- **Secondary**: `variant="outline"`
- **Destructive**: Red background for delete actions
- **Icon Buttons**: Square with icon, used in header

### Card Components
- **Background**: White
- **Border**: Subtle gray border
- **Shadow**: `shadow-sm` 
- **Padding**: p-6 for headers, p-6 pt-0 for content
- **Rounded**: `rounded-lg`

### Typography
- **Headings**: 
  - H1: `text-2xl font-bold tracking-tight`
  - H2: Various sizes with `font-bold` or `font-semibold`
- **Body**: Default text sizing
- **Descriptions**: `text-gray-500` for subtitles

### Status Badges
- **Default**: Gray background
- **Success**: Green background (`bg-green-100 text-green-800`)
- **Destructive**: Red background
- **Secondary**: Light gray background

## Page Layout Patterns

### Standard Page Header
```tsx
<div className="flex justify-between items-center mb-6">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">[Page Title]</h1>
    <p className="text-gray-500">[Page Description]</p>
  </div>
  <div className="flex space-x-2">
    // Action buttons
  </div>
</div>
```

### Dashboard Layout
- **Stats Cards**: 4-column grid on desktop, responsive
- **Content Sections**: Two-column layout for charts and activity
- **Quick Actions**: Card-based layout for batch creation

### Table/List Views
- **Background**: White cards with shadow
- **Empty States**: Centered with icon and descriptive text
- **Loading States**: Skeleton components
- **Actions**: Right-aligned action buttons

## Navigation Structure

### Main Navigation (Sidebar)
1. **General Section**:
   - Dashboard (/)
   - All Jobs (/all-jobs)
   - All Batches (/batches)

2. **Batch Types Section**:
   - Business Cards (/batches/business-cards)
   - Flyers (/batches/flyers)
   - Postcards (/batches/postcards)
   - Sleeves (/batches/sleeves)
   - Boxes (/batches/boxes)
   - Stickers (/batches/stickers)
   - Covers (/batches/covers)
   - Posters (/batches/posters)

3. **Administration Section**:
   - Users (/users)
   - Settings (/settings)

### Route Patterns
- **Product Overview**: `/batches/[product-type]`
- **Jobs List**: `/batches/[product-type]/jobs`
- **New Job**: `/batches/[product-type]/jobs/new`
- **Job Details**: `/batches/[product-type]/jobs/[jobId]`
- **Batches List**: `/batches/[product-type]/batches`
- **Batch Details**: `/batches/[product-type]/batches/[batchId]`

## State Management Patterns

### Authentication
- **useAuth Hook**: Provides user state and auth methods
- **ProtectedRoute**: Wraps authenticated routes
- **AuthProvider**: Context provider at app root

### Data Fetching
- **React Query**: For server state management
- **Custom Hooks**: Product-specific data hooks (useFlyerJobs, etc.)
- **Error Handling**: Consistent error display with retry options

### Loading States
- **Skeleton Components**: For table and card loading
- **Spinner**: For button loading states
- **Empty States**: Descriptive empty states with actions

## Interactive Elements

### Dialogs & Modals
- **Alert Dialogs**: For destructive actions (delete confirmations)
- **Modal Dialogs**: For forms and detailed views
- **Toast Notifications**: For success/error feedback

### Forms
- **Shadcn Form Components**: Consistent form styling
- **Validation**: React Hook Form with proper error display
- **Submit States**: Loading states on form submission

### Tables
- **Responsive**: Mobile-friendly table layouts
- **Sorting**: Column header indicators
- **Actions**: Right-aligned action buttons
- **Selection**: Checkbox-based selection for batch operations

## Error Handling

### Error Display
- **Alert Components**: Red-bordered alerts for errors
- **Retry Buttons**: Allow users to retry failed operations
- **Fallback UI**: Graceful degradation for missing data

### Loading States
- **Progressive Loading**: Show skeleton while loading
- **Empty States**: Clear messaging when no data exists
- **Error Boundaries**: Catch and display component errors

## Animation & Transitions

### Sidebar
- **Collapse Animation**: Smooth width transition (300ms)
- **Icon Rotation**: ChevronLeft rotates 180deg when collapsed

### Interactive Elements
- **Hover States**: Subtle color transitions on buttons/links
- **Focus States**: Ring outlines for keyboard navigation
- **Loading Spinners**: Smooth rotation animations

## Responsive Design

### Breakpoints
- **Mobile**: Default responsive behavior
- **Tablet**: md: breakpoints for medium screens
- **Desktop**: lg: breakpoints for large screens

### Layout Adaptations
- **Sidebar**: Auto-collapse on mobile
- **Tables**: Horizontal scroll or card view on mobile
- **Grid Layouts**: Responsive column counts

## Icons & Assets

### Icon Library
- **Lucide React**: Primary icon library
- **Consistent Sizing**: h-4 w-4 for small icons, h-6 w-6 for larger
- **Color**: Inherit from parent or specific color classes

### Product Type Icons
- Business Cards: CreditCard
- Flyers: FileText
- Postcards: Mail
- Boxes: Box
- Stickers: Sticker
- Covers: Book
- Posters: Image
- Sleeves: Package

## Data Display Patterns

### Batch/Job Cards
- **White Background**: shadow-sm rounded-lg
- **Header**: Bold title with status badge
- **Content**: Key information in structured layout
- **Actions**: Button row at bottom

### Status Indicators
- **Color Coding**: Green for success, red for errors, gray for pending
- **Consistent Badges**: Same badge component across all views
- **Clear Labels**: Descriptive status text

## CRITICAL RULES FOR MODIFICATIONS

1. **NEVER** change the sidebar layout or navigation structure
2. **ALWAYS** use the established color palette
3. **MAINTAIN** the three-section layout (General, Batch Types, Administration)
4. **PRESERVE** the header layout with SearchBar and action buttons
5. **USE** consistent card layouts for content
6. **FOLLOW** the established route patterns
7. **MAINTAIN** the responsive design patterns
8. **USE** Shadcn/UI components consistently
9. **PRESERVE** the authentication flow and protected routes
10. **MAINTAIN** the established loading and error states

## Component File Organization

### Structure
- `/components/ui/` - Shadcn/UI base components
- `/components/generic/` - Reusable business components
- `/components/batches/` - Batch-specific components
- `/hooks/` - Custom hooks for data and state
- `/pages/` - Page components
- `/config/` - Configuration and type definitions

### Naming Conventions
- **Components**: PascalCase (BatchDetails, GenericJobsTable)
- **Hooks**: camelCase with 'use' prefix (useBatchDetails, useAuth)
- **Files**: Match component names exactly
- **Types**: PascalCase interfaces (BatchSummary, ProductConfig)

This design system must be referenced and followed for ALL future modifications to ensure consistency and prevent UI/functionality regression.
