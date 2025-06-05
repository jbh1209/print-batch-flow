
import React, { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, FileText } from "lucide-react";

interface NotesEditorProps {
  onNotesUpdate?: (notes: string) => Promise<void>;
  jobNumber: string;
  initialNotes?: string;
  maxLength?: number;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  onNotesUpdate,
  jobNumber,
  initialNotes = "",
  maxLength = 1000
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveNotes = useCallback(async () => {
    if (!onNotesUpdate || !notes.trim()) return;

    setIsSaving(true);
    try {
      await onNotesUpdate(notes.trim());
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setIsSaving(false);
    }
  }, [onNotesUpdate, notes]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setNotes(value);
    }
  }, [maxLength]);

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Work Notes
      </h4>
      
      <Textarea
        placeholder={`Add notes about your work on ${jobNumber}...`}
        value={notes}
        onChange={handleNotesChange}
        className="min-h-[120px] resize-none"
      />
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">
          {notes.length}/{maxLength} characters
        </span>
        <Button 
          onClick={handleSaveNotes}
          disabled={!notes.trim() || isSaving}
          size="sm"
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Notes'}
        </Button>
      </div>
    </div>
  );
};
