-- Create a simple smoke-test function to validate JSON pipeline end-to-end
CREATE OR REPLACE FUNCTION public.scheduler_wrapper_smoke_test()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'ok', true,
    'message', 'scheduler wrapper smoke test',
    'now', now(),
    'sample_array', json_build_array(1,2,3),
    'sample_object', json_build_object('a',1,'b','two')
  );
END;
$$;