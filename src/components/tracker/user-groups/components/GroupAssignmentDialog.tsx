
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { UserGroup, UserWithGroups } from "../types";

interface GroupAssignmentDialogProps {
  groups: UserGroup[];
  users: UserWithGroups[];
  onAssign: (userId: string, groupId: string) => Promise<boolean>;
}

export const GroupAssignmentDialog = ({ groups, users, onAssign }: GroupAssignmentDialogProps) => {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [open, setOpen] = useState(false);

  const handleAssign = async () => {
    const success = await onAssign(selectedUser, selectedGroup);
    if (success) {
      setSelectedUser("");
      setSelectedGroup("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Assign User to Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign User to Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleAssign}
            disabled={!selectedUser || !selectedGroup}
            className="w-full"
          >
            Assign to Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
