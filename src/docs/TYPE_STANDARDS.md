
# Type System Standards

## Core Type Hierarchy

Our application uses a consistent type system built around these core interfaces:

- **BaseJob**: The foundational interface for all job types
- **BaseBatch**: The foundational interface for all batch types
- **ProductConfig**: Configuration for each product type

All product-specific interfaces must properly extend these base interfaces.

## Type Validation

We use runtime type validation to ensure data integrity:

- **Type Guards**: Functions like `isBaseJob()`, `isBaseBatch()` check if objects conform to interfaces
- **Type Assertions**: Functions like `assertBaseJob()` throw errors for invalid data
- **Safe Conversion**: Functions like `toSafeBaseJob()` safely convert unknown data

## Hook Standards

Hooks follow these standardization principles:

- **Consistent Parameters**: Config object as first parameter, options object for customization
- **Standard Return Types**: All hooks return objects with consistent property names
- **Built-in Validation**: Type validation is built into standardized hooks
- **Error Handling**: Consistent error handling pattern in all operations

## Usage Examples

### Using Type Guards

```typescript
import { isBaseJob } from "@/utils/validation/typeGuards";

function processJob(job: unknown) {
  if (isBaseJob(job)) {
    // TypeScript knows job is BaseJob here
    console.log(job.name);
  } else {
    console.error("Invalid job data");
  }
}
```

### Using Standardized Hooks

```typescript
import { useStandardJobs } from "@/hooks/generic/useStandardJobs";
import { productConfigs } from "@/config/productTypes";

function MyComponent() {
  const config = productConfigs["BusinessCards"];
  
  const { 
    jobs, 
    isLoading,
    error, 
    createJob, 
    updateJob, 
    deleteJob 
  } = useStandardJobs(config, { validateData: true });
  
  // ...component implementation
}
```

### Safe Type Conversion

```typescript
import { toSafeBaseJob } from "@/utils/validation/typeGuards";

function processApiResult(data: unknown) {
  const job = toSafeBaseJob(data);
  
  if (job) {
    // Process valid job
  } else {
    // Handle invalid data
  }
}
```

## Extending the Type System

When adding new product types:

1. Create interfaces that extend base types with specific properties
2. Add type guards and validation for the new types
3. Create specialized hooks that use the standard hook patterns
