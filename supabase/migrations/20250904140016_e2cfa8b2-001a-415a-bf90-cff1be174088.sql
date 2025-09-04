-- CRITICAL SECURITY FIXES

-- 1. Create security definer function to safely check admin status
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_admin, false)
  FROM profiles
  WHERE profiles.user_id = $1;
$$;

-- 2. Drop existing problematic RLS policies on profiles table
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 3. Create secure RLS policies for profiles table
-- Only authenticated users can view profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile BUT NOT the is_admin field
CREATE POLICY "Users can update their own profile except admin status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND 
  -- Prevent users from changing their admin status
  (OLD.is_admin IS NOT DISTINCT FROM NEW.is_admin)
);

-- 4. Create admin-only policy for updating admin status
CREATE POLICY "Only admins can manage admin status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Only existing admins can update admin status
  public.is_admin_user(auth.uid()) = true
)
WITH CHECK (
  -- Only existing admins can grant/revoke admin status
  public.is_admin_user(auth.uid()) = true
);

-- 5. Drop existing community posts policy and create secure one
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.community_posts;

-- Only authenticated users can view community posts
CREATE POLICY "Authenticated users can view posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (true);

-- 6. Update existing admin-checking policies to use the secure function
DROP POLICY IF EXISTS "Only admins can create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Only admins can update challenges" ON public.challenges;
DROP POLICY IF EXISTS "Only admins can manage challenge items" ON public.challenge_items;
DROP POLICY IF EXISTS "Only admins can manage challenge rewards" ON public.challenge_rewards;
DROP POLICY IF EXISTS "Only admins can manage challenge final rewards" ON public.challenge_final_rewards;

-- Recreate admin policies using the secure function
CREATE POLICY "Only admins can create challenges"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user() = true);

CREATE POLICY "Only admins can update challenges"
ON public.challenges
FOR UPDATE
TO authenticated
USING (public.is_admin_user() = true);

CREATE POLICY "Only admins can manage challenge items"
ON public.challenge_items
FOR ALL
TO authenticated
USING (public.is_admin_user() = true);

CREATE POLICY "Only admins can manage challenge rewards"
ON public.challenge_rewards
FOR ALL
TO authenticated
USING (public.is_admin_user() = true);

CREATE POLICY "Only admins can manage challenge final rewards"
ON public.challenge_final_rewards
FOR ALL
TO authenticated
USING (public.is_admin_user() = true);

-- 7. Create audit trigger for admin status changes
CREATE OR REPLACE FUNCTION public.audit_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log admin status changes
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
    INSERT INTO auth.audit_log_entries (
      instance_id,
      id,
      payload,
      created_at,
      ip_address
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      json_build_object(
        'event_type', 'admin_status_change',
        'user_id', NEW.user_id,
        'old_admin_status', OLD.is_admin,
        'new_admin_status', NEW.is_admin,
        'changed_by', auth.uid()
      ),
      now(),
      inet_client_addr()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_admin_changes_trigger ON public.profiles;
CREATE TRIGGER audit_admin_changes_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_changes();