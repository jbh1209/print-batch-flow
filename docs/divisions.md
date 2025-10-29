# Divisions Feature Documentation

**Date Created:** 2024-10-29  
**Status:** Deferred for future implementation  
**Reason for Deferral:** Scheduling engine integration issues; core functionality works but needs refinement

---

## Overview

The Divisions feature enables multi-division support across the production tracking system, allowing users to be assigned to different divisions (Digital, Large Format, Litho, Labels, Packaging) and see division-specific data.

**⚠️ IMPORTANT:** This documentation excludes scheduling engine modifications as they require significant rework. The division-aware scheduler function exists but should be reimplemented when divisions are reinstated.

---

## Database Schema

### 1. divisions Table

**Purpose:** Master list of all divisions in the organization

```sql
CREATE TABLE divisions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'package',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Seed Data:**
```sql
INSERT INTO divisions (code, name, color, icon, sort_order) VALUES
  ('DIG', 'Digital', '#3B82F6', 'printer', 1),
  ('LGEFOR', 'Large Format', '#10B981', 'maximize', 2),
  ('LITHO', 'Litho', '#8B5CF6', 'stamp', 3),
  ('LABELS', 'Labels', '#F59E0B', 'tag', 4),
  ('PKG', 'Packaging', '#EC4899', 'package', 5);
```

**RLS Policies:** None required (reference data)

---

### 2. user_division_assignments Table

**Purpose:** Links users to divisions they can access

```sql
CREATE TABLE user_division_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL REFERENCES divisions(code) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, division_code)
);
```

**Indexes:**
```sql
CREATE INDEX idx_user_division_user_id ON user_division_assignments(user_id);
CREATE INDEX idx_user_division_code ON user_division_assignments(division_code);
```

**RLS Policies:**
```sql
-- Users can view their own assignments
CREATE POLICY "Users can view their own division assignments"
ON user_division_assignments FOR SELECT
USING (user_id = auth.uid());

-- Admins can manage all assignments
CREATE POLICY "Admins can manage all division assignments"
ON user_division_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

---

### 3. Division Columns Added to Existing Tables

**Tables with division column:**
- `production_jobs` - division TEXT NOT NULL DEFAULT 'DIG'
- `production_stages` - division TEXT NOT NULL DEFAULT 'DIG'
- `job_stage_instances` - division TEXT NOT NULL DEFAULT 'DIG'
- `categories` - division TEXT NOT NULL DEFAULT 'DIG'
- `batches` - division TEXT NOT NULL DEFAULT 'DIG'
- `print_specifications` - division TEXT (nullable)
- `printers` - division TEXT (nullable)
- `die_cutting_machines` - division TEXT (nullable)
- `stage_specifications` - division TEXT (nullable)

**Migration pattern:**
```sql
-- Add division column with default
ALTER TABLE production_jobs 
ADD COLUMN division TEXT NOT NULL DEFAULT 'DIG';

-- Add foreign key reference
ALTER TABLE production_jobs 
ADD CONSTRAINT fk_production_jobs_division 
FOREIGN KEY (division) REFERENCES divisions(code);

-- Create index for performance
CREATE INDEX idx_production_jobs_division ON production_jobs(division);
```

---

## Database Functions

### 1. user_can_access_division()

**Purpose:** Check if current user can access a specific division

```sql
CREATE OR REPLACE FUNCTION user_can_access_division(p_division TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- sys_dev and admin can access all divisions
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('sys_dev', 'admin')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if user has direct division assignment
  IF EXISTS (
    SELECT 1 FROM user_division_assignments
    WHERE user_id = auth.uid() 
    AND division_code = p_division
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if user's groups allow this division
  IF EXISTS (
    SELECT 1 
    FROM user_group_memberships ugm
    JOIN user_groups ug ON ug.id = ugm.group_id
    WHERE ugm.user_id = auth.uid()
    AND p_division = ANY(ug.allowed_divisions)
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
```

### 2. get_user_divisions()

**Purpose:** Get array of division codes accessible to a user

```sql
CREATE OR REPLACE FUNCTION get_user_divisions(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT division_code ORDER BY division_code),
    ARRAY['DIG']::text[]
  )
  FROM user_division_assignments
  WHERE user_id = p_user_id;
$$;
```

---

## Row Level Security (RLS) Policies

### Pattern Used

All division-aware tables use the `user_can_access_division()` function:

```sql
-- Example: production_jobs
DROP POLICY IF EXISTS "Users can view accessible jobs" ON production_jobs;
CREATE POLICY "Users can view accessible jobs"
ON production_jobs FOR SELECT
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can update accessible jobs" ON production_jobs;
CREATE POLICY "Users can update accessible jobs"
ON production_jobs FOR UPDATE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can delete accessible jobs" ON production_jobs;
CREATE POLICY "Users can delete accessible jobs"
ON production_jobs FOR DELETE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can insert jobs" ON production_jobs;
CREATE POLICY "Users can insert jobs"
ON production_jobs FOR INSERT
WITH CHECK (user_can_access_division(division));
```

### Tables with Division-Aware RLS

Apply the above pattern to:
- `production_jobs`
- `production_stages`
- `job_stage_instances`
- `categories`
- `batches` (if division-aware batches are needed)

---

## User Groups Integration

### allowed_divisions Column

**Added to:** `user_groups` table

```sql
ALTER TABLE user_groups 
ADD COLUMN allowed_divisions TEXT[] DEFAULT ARRAY['DIG'];

-- Ensure existing groups have default
UPDATE user_groups 
SET allowed_divisions = ARRAY['DIG']
WHERE allowed_divisions IS NULL;
```

**Purpose:** Groups can specify which divisions their members can access

---

## React Implementation

### 1. DivisionContext

**File:** `src/contexts/DivisionContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Division {
  code: string;
  name: string;
  color: string;
  icon: string;
}

interface DivisionContextType {
  selectedDivision: string;
  setSelectedDivision: (code: string) => void;
  availableDivisions: Division[];
  currentDivision: Division | null;
  isLoading: boolean;
}

const DivisionContext = createContext<DivisionContextType | undefined>(undefined);

export const DivisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedDivision, setSelectedDivisionState] = useState<string>(() => {
    return localStorage.getItem('selected_division') || 'DIG';
  });
  const [availableDivisions, setAvailableDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDivisions = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get user's division assignments
        const { data: userDivisions } = await supabase
          .from('user_division_assignments')
          .select('division_code, is_primary')
          .eq('user_id', user.id);

        const divisionCodes = userDivisions?.map(ud => ud.division_code) || ['DIG'];
        const primaryDivision = userDivisions?.find(ud => ud.is_primary)?.division_code;

        // Fetch division details
        const { data: divisions } = await supabase
          .from('divisions')
          .select('*')
          .in('code', divisionCodes)
          .eq('is_active', true)
          .order('sort_order');

        setAvailableDivisions(divisions || []);
        
        // Switch to primary or first available if current selection not accessible
        if (!divisionCodes.includes(selectedDivision)) {
          setSelectedDivisionState(primaryDivision || divisions?.[0]?.code || 'DIG');
        }
      } catch (error) {
        console.error('Failed to fetch divisions:', error);
        setAvailableDivisions([{ 
          code: 'DIG', 
          name: 'Digital', 
          color: '#3B82F6', 
          icon: 'printer' 
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDivisions();
  }, [user, selectedDivision]);

  const setSelectedDivision = (code: string) => {
    setSelectedDivisionState(code);
    localStorage.setItem('selected_division', code);
  };

  const currentDivision = availableDivisions.find(d => d.code === selectedDivision) || null;

  return (
    <DivisionContext.Provider value={{
      selectedDivision,
      setSelectedDivision,
      availableDivisions,
      currentDivision,
      isLoading
    }}>
      {children}
    </DivisionContext.Provider>
  );
};

export const useDivision = () => {
  const context = useContext(DivisionContext);
  if (!context) {
    throw new Error('useDivision must be used within DivisionProvider');
  }
  return context;
};
```

**App Integration:** Wrap app in `<DivisionProvider>` in `src/App.tsx`

```typescript
<DivisionProvider>
  {/* App routes */}
</DivisionProvider>
```

---

### 2. DivisionSelector Component

**File:** `src/components/tracker/DivisionSelector.tsx`

```typescript
import React from 'react';
import { useDivision } from '@/contexts/DivisionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as LucideIcons from 'lucide-react';

export const DivisionSelector = () => {
  const { selectedDivision, setSelectedDivision, availableDivisions, currentDivision } = useDivision();

  // Only show if user has multiple divisions
  if (availableDivisions.length <= 1) {
    return null;
  }

  return (
    <Select value={selectedDivision} onValueChange={setSelectedDivision}>
      <SelectTrigger className="w-[180px] h-9">
        <SelectValue>
          {currentDivision && (
            <div className="flex items-center gap-2">
              {React.createElement(
                (LucideIcons as any)[currentDivision.icon] || LucideIcons.Package,
                { size: 16, style: { color: currentDivision.color } }
              )}
              <span className="font-medium">{currentDivision.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableDivisions.map(division => {
          const Icon = (LucideIcons as any)[division.icon] || LucideIcons.Package;
          return (
            <SelectItem key={division.code} value={division.code}>
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color: division.color }} />
                <span>{division.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
```

**Usage:** Add to headers/navigation components

```typescript
import { DivisionSelector } from './DivisionSelector';

// In your header component
<DivisionSelector />
```

---

### 3. Hook Integration Pattern

**Update hooks to accept divisionFilter:**

```typescript
// Example: useEnhancedProductionJobs
interface UseEnhancedProductionJobsOptions {
  fetchAllJobs?: boolean;
  divisionFilter?: string | null; // Add this
}

export const useEnhancedProductionJobs = (options: UseEnhancedProductionJobsOptions = {}) => {
  const { divisionFilter = null } = options;
  
  // In query builder:
  if (divisionFilter) {
    query = query.eq('division', divisionFilter);
  }
  
  // ...
};
```

**Component usage:**

```typescript
import { useDivision } from '@/contexts/DivisionContext';

const MyComponent = () => {
  const { selectedDivision } = useDivision();
  const { jobs } = useEnhancedProductionJobs({ 
    divisionFilter: selectedDivision 
  });
  
  // ...
};
```

---

## Files Modified for Division Support

### Core Files
- `src/contexts/DivisionContext.tsx` *(new)*
- `src/components/tracker/DivisionSelector.tsx` *(new)*
- `src/App.tsx` - Added DivisionProvider wrapper

### Hooks Modified
- `src/hooks/tracker/useEnhancedProductionJobs.tsx`
- `src/hooks/tracker/useDepartments.tsx`
- All job-fetching hooks that query production data

### Components Modified
- `src/components/tracker/DynamicHeader.tsx` - Added DivisionSelector
- `src/components/tracker/ProductionKanban.tsx`
- `src/components/tracker/MultiStageKanban.tsx`
- `src/components/tracker/EnhancedProductionKanban.tsx`
- `src/components/tracker/ExcelUpload.tsx`
- `src/components/tracker/factory/FactoryFloorView.tsx`
- `src/components/tracker/factory/DtpDashboard.tsx`
- All dashboard components that display jobs

### Pattern in Components
```typescript
import { useDivision } from "@/contexts/DivisionContext";

const { selectedDivision } = useDivision();
const { jobs } = useHook({ divisionFilter: selectedDivision });
```

---

## Type Definitions

**Add to:** `src/types/user-types.ts` or similar

```typescript
export interface UserDivisionAssignment {
  id: string;
  user_id: string;
  division_code: string;
  assigned_at: string;
  assigned_by?: string;
  is_primary: boolean;
}

export interface Division {
  code: string;
  name: string;
  color: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
```

---

## Admin Management UI (Future)

When divisions are reinstated, consider adding:

1. **Division Management Page**
   - CRUD operations for divisions
   - Enable/disable divisions
   - Reorder divisions

2. **User Division Assignment UI**
   - Assign users to divisions
   - Set primary division
   - Bulk assignment tools

3. **Group Division Settings**
   - Configure allowed_divisions for groups
   - Division-specific permissions

---

## Migration Sequence

When reinstating divisions, execute in this order:

1. **Create divisions table** with seed data
2. **Create user_division_assignments table**
3. **Add division columns** to existing tables
4. **Create helper functions** (user_can_access_division, get_user_divisions)
5. **Update RLS policies** to use division checks
6. **Seed initial user assignments** (all users → DIG by default)
7. **Deploy frontend code** (context, selector, hook updates)

---

## Testing Checklist

- [ ] Users assigned to DIG can only see DIG jobs
- [ ] Users assigned to multiple divisions can switch between them
- [ ] Division selector appears only when user has 2+ divisions
- [ ] Selected division persists in localStorage
- [ ] Admins can see all divisions regardless of assignments
- [ ] RLS properly restricts data access by division
- [ ] New jobs inherit division from current user selection
- [ ] Division filter works in all kanban/list views

---

## Known Issues / Deferred Items

### ⚠️ Scheduling Engine
- **Status:** Deferred
- **Issue:** Division-aware scheduler (`scheduler_reschedule_all_by_division`) exists but has integration issues with the rest of the scheduling system
- **Recommendation:** When reinstating divisions, rebuild scheduler with proper division awareness from scratch rather than using existing function

### Data Migration
- All existing data defaults to 'DIG' division
- Historical data will need proper division assignment based on business logic

---

## Rollback Procedure

If divisions need to be removed:

1. Drop RLS policies that reference `user_can_access_division()`
2. Restore original RLS policies (non-division-aware)
3. Drop division columns from tables (or set all to 'DIG')
4. Drop `user_division_assignments` table
5. Drop division helper functions
6. Remove DivisionProvider from App.tsx
7. Remove divisionFilter from all hook calls

---

## Future Enhancements

- **Cross-division reporting:** Allow admins to view aggregate data across divisions
- **Division-specific SLA targets:** Different turnaround times per division
- **Division capacity planning:** Resource allocation per division
- **Inter-division job transfers:** Move jobs between divisions with audit trail

---

**Document Version:** 1.0  
**Last Updated:** 2024-10-29  
**Prepared For:** Future reinstatement of divisions feature
