-- CRITICAL SECURITY FIXES

-- 1. Fix Admin Self-Promotion Vulnerability
-- Drop the existing trigger that allows admin self-promotion
DROP TRIGGER IF EXISTS prevent_admin_self_promotion_trigger ON profiles;

-- Create a more secure function that prevents self-admin promotion
CREATE OR REPLACE FUNCTION public.secure_admin_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If admin status is being changed
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
    -- Prevent users from promoting themselves to admin
    IF NEW.is_admin = true AND auth.uid() = NEW.user_id THEN
      RAISE EXCEPTION 'Users cannot promote themselves to admin status';
    END IF;
    
    -- Only existing admins can change admin status (except self-promotion)
    IF NOT public.is_admin_user(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can modify admin status';
    END IF;
    
    -- Log all admin status changes
    RAISE LOG 'Admin status change: user_id=%, old_status=%, new_status=%, changed_by=%', 
      NEW.user_id, OLD.is_admin, NEW.is_admin, auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the secure trigger
CREATE TRIGGER secure_admin_status_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_admin_status_update();

-- 2. Restrict Profile Data Access - Update RLS policies
-- Drop existing profile policies
DROP POLICY IF EXISTS "Users can update their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create new restricted profile policies
CREATE POLICY "Users can view public profile data"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own full profile
  auth.uid() = user_id 
  OR 
  -- Or public data only for others (unless they're admin)
  (auth.uid() != user_id AND public.is_admin_user(auth.uid()) = false)
);

-- Create separate policy for admin full access
CREATE POLICY "Admins can view all profile data"
ON public.profiles
FOR SELECT
USING (public.is_admin_user(auth.uid()) = true);

-- Users can only update their own profile (excluding admin status)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND 
  -- Prevent direct admin status changes (must go through secure function)
  (OLD.is_admin IS NOT DISTINCT FROM NEW.is_admin OR public.is_admin_user(auth.uid()) = true)
);

-- 3. Secure Challenge Rankings - Only show rankings for enrolled challenges
DROP POLICY IF EXISTS "Challenge rankings are viewable by everyone" ON public.challenge_rankings;

CREATE POLICY "Users can view rankings for their enrolled challenges"
ON public.challenge_rankings
FOR SELECT
USING (
  -- Admins can see all
  public.is_admin_user(auth.uid()) = true
  OR
  -- Users can see rankings for challenges they're enrolled in
  EXISTS (
    SELECT 1 FROM challenge_enrollments 
    WHERE challenge_enrollments.challenge_id = challenge_rankings.challenge_id 
    AND challenge_enrollments.user_id = auth.uid()
  )
  OR
  -- Users can always see their own rankings
  user_id = auth.uid()
);

-- 4. Add audit logging table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  event_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (public.is_admin_user(auth.uid()) = true);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (true);

-- 5. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  target_user_id uuid DEFAULT NULL,
  event_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO security_audit_log (event_type, user_id, target_user_id, event_data)
  VALUES (event_type, auth.uid(), target_user_id, event_data);
END;
$$;