-- Elevate timeouts at function level to avoid PostgREST statement timeouts during scheduling

-- simple_scheduler_wrapper: set higher timeouts  
ALTER FUNCTION public.simple_scheduler_wrapper(text)
  SET statement_timeout = '180s';

ALTER FUNCTION public.simple_scheduler_wrapper(text)
  SET idle_in_transaction_session_timeout = '300s';

-- keep search_path explicit 
ALTER FUNCTION public.simple_scheduler_wrapper(text)
  SET search_path = public;

-- Apply timeouts to the underlying parallel scheduler function
ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware()
  SET statement_timeout = '180s';

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware()
  SET idle_in_transaction_session_timeout = '300s';