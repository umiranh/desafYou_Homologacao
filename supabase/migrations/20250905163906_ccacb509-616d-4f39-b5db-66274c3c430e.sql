-- CRITICAL SECURITY FIXES - Fixed Version

-- 1. Fix Admin Self-Promotion Vulnerability
-- Create a secure function that prevents self-admin promotion
CREATE OR REPLACE FUNCTION public.secure_admin_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If admin status is being changed
  IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin) THEN
    -- Prevent users from promoting themselves to admin
    IF (NEW.is_admin = true AND auth.uid() = NEW.user_id) THEN
      RAISE EXCEPTION 'Users cannot promote themselves to admin status';
    END IF;
    
    -- Only existing admins can change admin status
    IF NOT (SELECT public.is_admin_user(auth.uid())) THEN
      RAISE EXCEPTION 'Only administrators can modify admin status';
    END IF;
    
    -- Log admin status changes
    RAISE LOG 'Admin status change: user_id=%, old_status=%, new_status=%, changed_by=%', 
      NEW.user_id, OLD.is_admin, NEW.is_admin, auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_admin_self_promotion_trigger ON profiles;
DROP TRIGGER IF EXISTS secure_admin_status_trigger ON profiles;

-- Create the secure trigger
CREATE TRIGGER secure_admin_status_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_admin_status_update();

-- 2. Restrict Profile Data Access - Update RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can update their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view public profile data" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new secure profile view policy
CREATE POLICY "Secure profile visibility"
ON public.profiles
FOR SELECT
USING (
  -- Users can see their own full profile
  auth.uid() = user_id 
  OR 
  -- Admins can see all profiles
  public.is_admin_user(auth.uid()) = true
);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile only"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Secure Challenge Rankings
DROP POLICY IF EXISTS "Challenge rankings are viewable by everyone" ON public.challenge_rankings;
DROP POLICY IF EXISTS "Users can view rankings for their enrolled challenges" ON public.challenge_rankings;

CREATE POLICY "Secure challenge rankings visibility"
ON public.challenge_rankings
FOR SELECT
USING (
  -- Admins can see all rankings
  public.is_admin_user(auth.uid()) = true
  OR
  -- Users can see their own rankings
  user_id = auth.uid()
  OR
  -- Users can see rankings for challenges they're enrolled in
  EXISTS (
    SELECT 1 FROM challenge_enrollments 
    WHERE challenge_enrollments.challenge_id = challenge_rankings.challenge_id 
    AND challenge_enrollments.user_id = auth.uid()
  )
);