-- Create learning system tables for Excel import intelligence

-- 1. Excel Import Learning Sessions - tracks each upload session
CREATE TABLE public.excel_import_learning_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  original_data jsonb NOT NULL DEFAULT '{}',
  parsed_data jsonb NOT NULL DEFAULT '{}',
  suggestions_generated jsonb NOT NULL DEFAULT '[]',
  manual_corrections_count integer NOT NULL DEFAULT 0,
  session_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Manual Corrections Log - every change made during import review
CREATE TABLE public.manual_corrections_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_session_id uuid NOT NULL REFERENCES public.excel_import_learning_sessions(id) ON DELETE CASCADE,
  correction_type text NOT NULL, -- 'stage_mapping', 'paper_spec', 'delivery_method', 'address_pattern', 'ignore_row'
  original_excel_text text NOT NULL,
  original_system_mapping jsonb,
  corrected_mapping jsonb NOT NULL,
  confidence_before integer,
  row_index integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  correction_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Learned Patterns - extracted intelligence from corrections
CREATE TABLE public.learned_correction_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type text NOT NULL, -- 'geographic_delivery', 'paper_spec_fix', 'duplicate_detection', 'stage_mapping'
  excel_text_pattern text NOT NULL,
  learned_mapping jsonb NOT NULL,
  confidence_score integer NOT NULL DEFAULT 70,
  usage_count integer NOT NULL DEFAULT 1,
  accuracy_rate numeric(3,2) NOT NULL DEFAULT 0.70,
  last_used_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Intelligent Suggestions - AI-generated recommendations for imports
CREATE TABLE public.intelligent_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_session_id uuid NOT NULL REFERENCES public.excel_import_learning_sessions(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL, -- 'auto_correction', 'highlighted_suggestion', 'warning'
  confidence_level text NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  row_index integer NOT NULL,
  excel_text text NOT NULL,
  original_mapping jsonb,
  suggested_mapping jsonb NOT NULL,
  reasoning text NOT NULL,
  pattern_id uuid REFERENCES public.learned_correction_patterns(id),
  user_action text, -- 'accepted', 'rejected', 'ignored'
  user_feedback text,
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Geographic Delivery Intelligence - location-based delivery patterns
CREATE TABLE public.geographic_delivery_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_pattern text NOT NULL, -- 'East London', 'Manchester', 'Birmingham'
  delivery_method text NOT NULL, -- 'courier', 'collection', 'royal_mail'
  min_service_level text, -- 'overnight', 'same_day', 'standard'
  learned_from_corrections integer NOT NULL DEFAULT 1,
  accuracy_rate numeric(3,2) NOT NULL DEFAULT 0.70,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_learning_sessions_user ON public.excel_import_learning_sessions(uploaded_by);
CREATE INDEX idx_learning_sessions_created ON public.excel_import_learning_sessions(created_at);
CREATE INDEX idx_corrections_log_session ON public.manual_corrections_log(learning_session_id);
CREATE INDEX idx_corrections_log_type ON public.manual_corrections_log(correction_type);
CREATE INDEX idx_corrections_log_text ON public.manual_corrections_log(original_excel_text);
CREATE INDEX idx_learned_patterns_type ON public.learned_correction_patterns(pattern_type);
CREATE INDEX idx_learned_patterns_text ON public.learned_correction_patterns(excel_text_pattern);
CREATE INDEX idx_learned_patterns_active ON public.learned_correction_patterns(is_active);
CREATE INDEX idx_suggestions_session ON public.intelligent_suggestions(learning_session_id);
CREATE INDEX idx_suggestions_type ON public.intelligent_suggestions(suggestion_type);
CREATE INDEX idx_geographic_patterns_location ON public.geographic_delivery_patterns(location_pattern);

-- Enable RLS
ALTER TABLE public.excel_import_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_corrections_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_correction_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligent_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geographic_delivery_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Learning Sessions
CREATE POLICY "Users can view their own learning sessions"
ON public.excel_import_learning_sessions FOR SELECT 
USING (uploaded_by = auth.uid());

CREATE POLICY "Users can create their own learning sessions"
ON public.excel_import_learning_sessions FOR INSERT 
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own learning sessions"
ON public.excel_import_learning_sessions FOR UPDATE 
USING (uploaded_by = auth.uid());

CREATE POLICY "Admins can view all learning sessions"
ON public.excel_import_learning_sessions FOR ALL 
USING (is_admin_simple());

-- RLS Policies for Manual Corrections
CREATE POLICY "Users can log their own corrections"
ON public.manual_corrections_log FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view all corrections for learning"
ON public.manual_corrections_log FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage all corrections"
ON public.manual_corrections_log FOR ALL 
USING (is_admin_simple());

-- RLS Policies for Learned Patterns
CREATE POLICY "All users can view active patterns"
ON public.learned_correction_patterns FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage all patterns"
ON public.learned_correction_patterns FOR ALL 
USING (is_admin_simple());

-- RLS Policies for Intelligent Suggestions
CREATE POLICY "Users can view suggestions for their sessions"
ON public.intelligent_suggestions FOR SELECT 
USING (learning_session_id IN (
  SELECT id FROM public.excel_import_learning_sessions 
  WHERE uploaded_by = auth.uid()
));

CREATE POLICY "Users can update suggestions for their sessions"
ON public.intelligent_suggestions FOR UPDATE 
USING (learning_session_id IN (
  SELECT id FROM public.excel_import_learning_sessions 
  WHERE uploaded_by = auth.uid()
));

CREATE POLICY "System can create suggestions"
ON public.intelligent_suggestions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can manage all suggestions"
ON public.intelligent_suggestions FOR ALL 
USING (is_admin_simple());

-- RLS Policies for Geographic Patterns
CREATE POLICY "All users can view geographic patterns"
ON public.geographic_delivery_patterns FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage geographic patterns"
ON public.geographic_delivery_patterns FOR ALL 
USING (is_admin_simple());

-- Function to update pattern accuracy rates
CREATE OR REPLACE FUNCTION public.update_pattern_accuracy(
  p_pattern_id uuid,
  p_was_correct boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_rate numeric;
  current_count integer;
  new_rate numeric;
BEGIN
  -- Get current accuracy data
  SELECT accuracy_rate, usage_count 
  INTO current_rate, current_count
  FROM public.learned_correction_patterns 
  WHERE id = p_pattern_id;
  
  IF FOUND THEN
    -- Calculate new accuracy rate using weighted average
    IF p_was_correct THEN
      new_rate := ((current_rate * current_count) + 1.0) / (current_count + 1);
    ELSE
      new_rate := (current_rate * current_count) / (current_count + 1);
    END IF;
    
    -- Update pattern with new accuracy and usage count
    UPDATE public.learned_correction_patterns 
    SET 
      accuracy_rate = new_rate,
      usage_count = current_count + 1,
      last_used_at = now(),
      updated_at = now()
    WHERE id = p_pattern_id;
  END IF;
END;
$function$;