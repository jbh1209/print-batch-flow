
-- Create enhanced function to get user accessible stages with master queue information
CREATE OR REPLACE FUNCTION public.get_user_accessible_stages_with_master_queue(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(
   stage_id uuid, 
   stage_name text, 
   stage_color text, 
   can_view boolean, 
   can_edit boolean, 
   can_work boolean, 
   can_manage boolean,
   master_queue_id uuid,
   master_queue_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id as stage_id,
    ps.name as stage_name,
    ps.color as stage_color,
    BOOL_OR(ugsp.can_view) as can_view,
    BOOL_OR(ugsp.can_edit) as can_edit,
    BOOL_OR(ugsp.can_work) as can_work,
    BOOL_OR(ugsp.can_manage) as can_manage,
    ps.master_queue_id,
    mq.name as master_queue_name
  FROM public.production_stages ps
  INNER JOIN public.user_group_stage_permissions ugsp ON ps.id = ugsp.production_stage_id
  INNER JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
  LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
  WHERE ugm.user_id = p_user_id
    AND ps.is_active = true
  GROUP BY ps.id, ps.name, ps.color, ps.order_index, ps.master_queue_id, mq.name
  ORDER BY ps.order_index;
END;
$function$;
