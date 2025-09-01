-- Add foreign key constraints to establish proper relationships

-- Add foreign key from challenge_enrollments to profiles
ALTER TABLE public.challenge_enrollments 
ADD CONSTRAINT challenge_enrollments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from challenge_items to challenges
ALTER TABLE public.challenge_items 
ADD CONSTRAINT challenge_items_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Add foreign key from challenge_rankings to profiles
ALTER TABLE public.challenge_rankings 
ADD CONSTRAINT challenge_rankings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from challenge_rankings to challenges
ALTER TABLE public.challenge_rankings 
ADD CONSTRAINT challenge_rankings_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Add foreign key from challenge_rewards to challenges
ALTER TABLE public.challenge_rewards 
ADD CONSTRAINT challenge_rewards_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Add foreign key from community_posts to profiles
ALTER TABLE public.community_posts 
ADD CONSTRAINT community_posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from community_posts to challenges
ALTER TABLE public.community_posts 
ADD CONSTRAINT community_posts_challenge_id_fkey 
FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Add foreign key from post_comments to profiles
ALTER TABLE public.post_comments 
ADD CONSTRAINT post_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from post_comments to community_posts
ALTER TABLE public.post_comments 
ADD CONSTRAINT post_comments_post_id_fkey 
FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;

-- Add foreign key from post_likes to profiles
ALTER TABLE public.post_likes 
ADD CONSTRAINT post_likes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from post_likes to community_posts
ALTER TABLE public.post_likes 
ADD CONSTRAINT post_likes_post_id_fkey 
FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;

-- Add foreign key from user_progress to profiles
ALTER TABLE public.user_progress 
ADD CONSTRAINT user_progress_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from user_progress to challenge_items
ALTER TABLE public.user_progress 
ADD CONSTRAINT user_progress_challenge_item_id_fkey 
FOREIGN KEY (challenge_item_id) REFERENCES public.challenge_items(id) ON DELETE CASCADE;