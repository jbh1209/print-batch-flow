
# Data Flow Analysis & Workflow Documentation

## Overview
This document maps the complete data flow across the Tracker application, identifying components, their dependencies, data sources, and interactions. This serves as a baseline for understanding the application architecture and debugging issues.

**Last Updated:** 2025-06-04
**Status:** Initial comprehensive analysis

---

## Core Data Entities & Tables

### User Management System
```
auth.users (Supabase Auth)
├── profiles (public.profiles)
├── user_roles (public.user_roles)
├── user_group_memberships (public.user_group_memberships)
└── user_groups (public.user_groups)
```

### Production System
```
production_jobs (public.production_jobs)
├── job_stage_instances (public.job_stage_instances)
├── categories (public.categories)
├── production_stages (public.production_stages)
└── category_production_stages (public.category_production_stages)
```

### Permission System
```
user_groups (public.user_groups)
├── user_group_memberships (public.user_group_memberships)
├── user_group_stage_permissions (public.user_group_stage_permissions)
└── production_stages (public.production_stages)
```

---

## Component Data Flow Analysis

### 1. User Management Flow

#### Source Files:
- `/pages/tracker/TrackerUsers.tsx`
- `/components/users/SimpleUserManagement.tsx`
- `/components/users/UserForm.tsx`
- `/components/users/UserTable.tsx`
- `supabase/functions/get-users-admin/index.ts`

#### Data Flow:
```
1. TrackerUsers.tsx → SimpleUserManagement.tsx
2. SimpleUserManagement.tsx → UserManagementContext
3. UserManagementContext → userService.fetchUsers()
4. fetchUsers() → supabase.functions.invoke('get-users-admin')
5. get-users-admin → Returns user data
6. UserTable displays users
7. UserForm edits user data
```

#### **IDENTIFIED ISSUE:** 
- `get-users-admin` edge function does NOT return user group memberships
- UserForm expects `groups` array but receives undefined
- This causes the UI to show no selected groups even when user has groups assigned

#### Status: ❌ BROKEN - Groups don't display in edit form

---

### 2. Job Access & Permission Flow

#### Source Files:
- `/hooks/tracker/useAccessibleJobs.tsx`
- `/components/tracker/factory/DtpDashboard.tsx`
- `/components/tracker/factory/CompactDtpJobCard.tsx`
- Database function: `get_user_accessible_jobs`

#### Data Flow:
```
1. DtpDashboard.tsx → useAccessibleJobs()
2. useAccessibleJobs() → fetchJobs()
3. fetchJobs() → Checks user groups via user_group_memberships
4. fetchJobs() → Gets stage permissions via user_group_stage_permissions
5. fetchJobs() → Filters jobs via job_stage_instances + production_jobs
6. fetchJobs() → Calls get_user_accessible_jobs() RPC function
7. Returns filtered job list → CompactDtpJobCard displays jobs
```

#### **IDENTIFIED ISSUE:**
- Database contains correct data (users have groups, permissions exist)
- `get_user_accessible_jobs` function appears to work correctly
- BUT DTP Dashboard shows no jobs for users with correct permissions
- Job counts show as 0 despite having accessible jobs

#### Status: ❌ BROKEN - No jobs visible on DTP dashboard

---

### 3. Job Stage Management Flow

#### Source Files:
- `/hooks/tracker/useAccessibleJobs/useJobActions.tsx`
- `/components/tracker/factory/JobModalActions.tsx`
- `/components/tracker/factory/CompactDtpJobCard.tsx`

#### Data Flow:
```
1. Job card shows Start/Complete buttons based on permissions
2. Button click → useJobActions.startJob() or completeJob()
3. useJobActions → Updates job_stage_instances table
4. useJobActions → Calls refreshJobs() to update UI
5. UI reflects new job status
```

#### Status: ❓ UNKNOWN - Dependent on job visibility fix

---

### 4. User Group Assignment Flow

#### Source Files:
- `/components/tracker/user-groups/components/SingleUserGroups.tsx`
- `/components/tracker/user-groups/hooks/useGroupOperations.ts`

#### Data Flow:
```
1. SingleUserGroups → Displays user's current groups
2. Checkbox toggle → useGroupOperations.addUserToGroup/removeUserFromGroup
3. Updates user_group_memberships table
4. Refreshes display
```

#### Status: ✅ WORKING - Database updates correctly, UI shows current state

---

## Critical Issues Summary

### Issue #1: User Group Display (High Priority)
**Problem:** User edit form doesn't show assigned groups
**Root Cause:** `get-users-admin` edge function missing group data
**Impact:** Users appear to have no groups assigned in UI
**Fix Required:** Update edge function to return group memberships

### Issue #2: Job Visibility (Critical Priority)
**Problem:** DTP Dashboard shows no jobs despite correct permissions
**Root Cause:** Unknown - data exists but not reaching UI
**Impact:** Core application functionality broken
**Fix Required:** Debug job fetching pipeline

### Issue #3: Job Counts (Medium Priority)
**Problem:** All counters show 0 or incorrect values
**Root Cause:** Related to Issue #2
**Impact:** Dashboard metrics unusable
**Fix Required:** Fix job visibility first

---

## Recommended Fix Order

1. **Fix User Management Data Fetching** - Update get-users-admin edge function
2. **Debug Job Visibility Pipeline** - Trace why jobs aren't reaching DTP dashboard
3. **Test End-to-End Workflow** - Verify complete user → permissions → jobs flow
4. **Update Documentation** - Add findings to this document

---

## Testing Checklist

### User Management
- [ ] User groups display correctly in edit form
- [ ] Group assignments save and persist
- [ ] UI reflects actual database state

### Job Management
- [ ] Users see jobs they have permissions for
- [ ] Job counts are accurate
- [ ] Start/Complete actions work
- [ ] Real-time updates function

### Permissions
- [ ] User group assignments control job visibility
- [ ] Stage permissions properly filter available actions
- [ ] Admin users see all jobs

---

## Development Notes

**For Future Development:**
1. Always update this document when making significant changes
2. Test data flow end-to-end before marking features complete
3. Verify UI state matches database state
4. Use browser dev tools to trace data fetching issues
5. Check console logs for permission-related errors

**Common Debugging Steps:**
1. Check browser console for errors
2. Verify database contains expected data
3. Test edge functions directly
4. Trace data through component hierarchy
5. Verify TypeScript types match actual data structure

---

## Architecture Decisions

### Authentication Strategy
- Uses Supabase Auth with custom profiles table
- Role-based access via user_roles table
- Group-based permissions via user_groups system

### Permission Model
- Groups define sets of stage permissions
- Users assigned to groups via memberships
- Job visibility filtered by current stage permissions
- Supports view/edit/work/manage permission levels

### Job Workflow
- Jobs flow through production stages
- Stage instances track job progress
- Users can start/complete stages they have permission for
- Real-time updates via Supabase subscriptions

---

*This document should be updated whenever significant changes are made to data flow or component interactions.*
