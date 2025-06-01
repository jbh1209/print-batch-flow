
export interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
}

export interface UserWithGroups {
  id: string;
  email: string;
  full_name: string;
  groups: UserGroup[];
}

export interface UserGroupManagerProps {
  userId?: string;
  showAllUsers?: boolean;
}
