
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Save,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  onNotesUpdate: (notes: string) => Promise<void>;
  jobNumber: string;
  initialNotes?: string;
  className?: string;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  onNotesUpdate,
  jobNumber,
  initialNotes = "",
  className
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(notes !== initialNotes);
  }, [notes, initialNotes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onNotesUpdate(notes);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatLastSaved = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Notes
          </div>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Unsaved
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder={`Add notes for job ${jobNumber}...`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[120px] resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {lastSaved && (
              <>
                <Clock className="h-3 w-3" />
                <span>Last saved: {formatLastSaved(lastSaved)}</span>
              </>
            )}
          </div>

          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            size="sm"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Notes'}
          </Button>
        </div>

        {/* Character count */}
        <div className="text-xs text-gray-400 text-right">
          {notes.length} characters
        </div>
      </CardContent>
    </Card>
  );
};
