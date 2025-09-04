-- CRITICAL SECURITY FIXES (CORRECTED)

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

-- Users can update their own profile (excluding admin status)
CREATE POLICY "Users can update their own profile data"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Create a trigger function to prevent admin status changes by non-admins
CREATE OR REPLACE FUNCTION public.prevent_admin_self_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If admin status is being changed
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin THEN
    -- Check if the user making the change is an admin
    IF NOT public.is_admin_user(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can modify admin status';
    END IF;
    
    -- Log admin status changes
    RAISE LOG 'Admin status change: user_id=%, old_status=%, new_status=%, changed_by=%', 
      NEW.user_id, OLD.is_admin, NEW.is_admin, auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to profiles table
DROP TRIGGER IF EXISTS prevent_admin_self_promotion_trigger ON public.profiles;
CREATE TRIGGER prevent_admin_self_promotion_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_self_promotion();

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