import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Eye, Lightbulb, Zap, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { IntelligentSuggestion } from "@/utils/excel/learningEngine";

interface IntelligentSuggestionsPanelProps {
  suggestions: IntelligentSuggestion[];
  onAcceptSuggestion: (suggestionId: string, suggestion: IntelligentSuggestion) => void;
  onRejectSuggestion: (suggestionId: string, feedback?: string) => void;
  onIgnoreSuggestion: (suggestionId: string) => void;
}

export const IntelligentSuggestionsPanel: React.FC<IntelligentSuggestionsPanelProps> = ({
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onIgnoreSuggestion
}) => {
  const { toast } = useToast();
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'auto_correction':
        return <Zap className="h-4 w-4" />;
      case 'highlighted_suggestion':
        return <Lightbulb className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSuggestionTypeColor = (type: string) => {
    switch (type) {
      case 'auto_correction':
        return 'bg-blue-100 text-blue-700';
      case 'highlighted_suggestion':
        return 'bg-purple-100 text-purple-700';
      case 'warning':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const autoCorrections = suggestions.filter(s => s.suggestion_type === 'auto_correction');
  const highlightedSuggestions = suggestions.filter(s => s.suggestion_type === 'highlighted_suggestion');
  const warnings = suggestions.filter(s => s.suggestion_type === 'warning');

  const handleAccept = (suggestion: IntelligentSuggestion) => {
    onAcceptSuggestion(suggestion.id!, suggestion);
    toast({
      title: "Suggestion applied",
      description: "The intelligent suggestion has been applied to your import",
    });
  };

  const handleReject = (suggestion: IntelligentSuggestion) => {
    onRejectSuggestion(suggestion.id!, "User rejected suggestion");
    toast({
      title: "Suggestion rejected",
      description: "This feedback will help improve future suggestions",
    });
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>No intelligent suggestions generated.</p>
            <p className="text-sm">Your import looks good or the system is still learning!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Smart Suggestions ({suggestions.length})
          </CardTitle>
          <div className="flex gap-2">
            {autoCorrections.length > 0 && (
              <Badge className="bg-blue-100 text-blue-700">
                {autoCorrections.length} Auto-fixes
              </Badge>
            )}
            {highlightedSuggestions.length > 0 && (
              <Badge className="bg-purple-100 text-purple-700">
                {highlightedSuggestions.length} Suggestions
              </Badge>
            )}
            {warnings.length > 0 && (
              <Badge className="bg-red-100 text-red-700">
                {warnings.length} Warnings
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-powered suggestions based on learned patterns from previous imports
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({suggestions.length})</TabsTrigger>
            <TabsTrigger value="auto">Auto-fix ({autoCorrections.length})</TabsTrigger>
            <TabsTrigger value="suggestions">Review ({highlightedSuggestions.length})</TabsTrigger>
            <TabsTrigger value="warnings">Warnings ({warnings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id || index}
                suggestion={suggestion}
                expanded={expandedSuggestion === (suggestion.id || index.toString())}
                onToggleExpand={() => setExpandedSuggestion(
                  expandedSuggestion === (suggestion.id || index.toString()) 
                    ? null 
                    : (suggestion.id || index.toString())
                )}
                onAccept={() => handleAccept(suggestion)}
                onReject={() => handleReject(suggestion)}
                onIgnore={() => onIgnoreSuggestion(suggestion.id!)}
                getSuggestionIcon={getSuggestionIcon}
                getConfidenceColor={getConfidenceColor}
                getSuggestionTypeColor={getSuggestionTypeColor}
              />
            ))}
          </TabsContent>

          <TabsContent value="auto" className="space-y-4">
            {autoCorrections.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id || index}
                suggestion={suggestion}
                expanded={expandedSuggestion === (suggestion.id || index.toString())}
                onToggleExpand={() => setExpandedSuggestion(
                  expandedSuggestion === (suggestion.id || index.toString()) 
                    ? null 
                    : (suggestion.id || index.toString())
                )}
                onAccept={() => handleAccept(suggestion)}
                onReject={() => handleReject(suggestion)}
                onIgnore={() => onIgnoreSuggestion(suggestion.id!)}
                getSuggestionIcon={getSuggestionIcon}
                getConfidenceColor={getConfidenceColor}
                getSuggestionTypeColor={getSuggestionTypeColor}
              />
            ))}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            {highlightedSuggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id || index}
                suggestion={suggestion}
                expanded={expandedSuggestion === (suggestion.id || index.toString())}
                onToggleExpand={() => setExpandedSuggestion(
                  expandedSuggestion === (suggestion.id || index.toString()) 
                    ? null 
                    : (suggestion.id || index.toString())
                )}
                onAccept={() => handleAccept(suggestion)}
                onReject={() => handleReject(suggestion)}
                onIgnore={() => onIgnoreSuggestion(suggestion.id!)}
                getSuggestionIcon={getSuggestionIcon}
                getConfidenceColor={getConfidenceColor}
                getSuggestionTypeColor={getSuggestionTypeColor}
              />
            ))}
          </TabsContent>

          <TabsContent value="warnings" className="space-y-4">
            {warnings.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.id || index}
                suggestion={suggestion}
                expanded={expandedSuggestion === (suggestion.id || index.toString())}
                onToggleExpand={() => setExpandedSuggestion(
                  expandedSuggestion === (suggestion.id || index.toString()) 
                    ? null 
                    : (suggestion.id || index.toString())
                )}
                onAccept={() => handleAccept(suggestion)}
                onReject={() => handleReject(suggestion)}
                onIgnore={() => onIgnoreSuggestion(suggestion.id!)}
                getSuggestionIcon={getSuggestionIcon}
                getConfidenceColor={getConfidenceColor}
                getSuggestionTypeColor={getSuggestionTypeColor}
              />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface SuggestionCardProps {
  suggestion: IntelligentSuggestion;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onIgnore: () => void;
  getSuggestionIcon: (type: string) => React.ReactNode;
  getConfidenceColor: (level: string) => string;
  getSuggestionTypeColor: (type: string) => string;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onIgnore,
  getSuggestionIcon,
  getConfidenceColor,
  getSuggestionTypeColor
}) => {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex items-center gap-2">
            {getSuggestionIcon(suggestion.suggestion_type)}
            <Badge className={getSuggestionTypeColor(suggestion.suggestion_type)}>
              {suggestion.suggestion_type.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">Row {suggestion.row_index + 1}</span>
              <Badge variant="outline" className={getConfidenceColor(suggestion.confidence_level)}>
                {suggestion.confidence_level} confidence
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {suggestion.reasoning}
            </p>
            
            {!expanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="text-blue-600 hover:text-blue-700 p-0 h-auto"
              >
                View details
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {suggestion.suggestion_type !== 'warning' && (
            <Button
              size="sm"
              onClick={onAccept}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Apply
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onIgnore}
            className="text-gray-600 hover:bg-gray-50"
          >
            Ignore
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t pt-3 space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Original Excel Text:</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-auto">
              {suggestion.excel_text}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium text-sm mb-2">Suggested Mapping:</h4>
            <pre className="text-xs bg-blue-50 p-2 rounded max-h-32 overflow-auto">
              {JSON.stringify(suggestion.suggested_mapping, null, 2)}
            </pre>
          </div>
          
          {suggestion.original_mapping && (
            <div>
              <h4 className="font-medium text-sm mb-2">Current Mapping:</h4>
              <pre className="text-xs bg-yellow-50 p-2 rounded max-h-32 overflow-auto">
                {JSON.stringify(suggestion.original_mapping, null, 2)}
              </pre>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="text-blue-600 hover:text-blue-700 p-0 h-auto"
          >
            Hide details
          </Button>
        </div>
      )}
    </div>
  );
};