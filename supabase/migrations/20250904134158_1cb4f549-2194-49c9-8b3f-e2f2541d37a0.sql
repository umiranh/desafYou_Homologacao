-- Add additional fields to challenges table for real challenge information
ALTER TABLE public.challenges 
ADD COLUMN IF NOT EXISTS daily_calories integer,
ADD COLUMN IF NOT EXISTS daily_time_minutes integer,
ADD COLUMN IF NOT EXISTS difficulty_level text CHECK (difficulty_level IN ('iniciante', 'intermediário', 'avançado')),
ADD COLUMN IF NOT EXISTS total_days integer,
ADD COLUMN IF NOT EXISTS is_finished boolean DEFAULT false;

-- Create challenge rewards table for storing position-based rewards
CREATE TABLE IF NOT EXISTS public.challenge_final_rewards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    position integer NOT NULL,
    coins_reward integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(challenge_id, position)
);

-- Enable RLS for challenge final rewards
ALTER TABLE public.challenge_final_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for challenge final rewards
CREATE POLICY "Challenge final rewards are viewable by everyone" 
ON public.challenge_final_rewards 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage challenge final rewards" 
ON public.challenge_final_rewards 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
));

-- Add automatic challenge finalization function
CREATE OR REPLACE FUNCTION public.finalize_expired_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expired_challenge RECORD;
    ranking_record RECORD;
    reward_record RECORD;
BEGIN
    -- Find expired challenges that haven't been finalized yet
    FOR expired_challenge IN
        SELECT id, title, end_date 
        FROM challenges 
        WHERE end_date < now() 
        AND is_active = true 
        AND is_finished = false
    LOOP
        -- Calculate final rankings for this challenge
        DELETE FROM challenge_rankings WHERE challenge_id = expired_challenge.id;
        
        -- Insert final rankings based on XP earned
        INSERT INTO challenge_rankings (challenge_id, user_id, position, total_xp)
        SELECT 
            expired_challenge.id,
            enrollments.user_id,
            ROW_NUMBER() OVER (ORDER BY COALESCE(user_xp.total_xp, 0) DESC),
            COALESCE(user_xp.total_xp, 0)
        FROM challenge_enrollments enrollments
        LEFT JOIN (
            SELECT 
                up.user_id,
                SUM(up.xp_earned) as total_xp
            FROM user_progress up
            JOIN challenge_items ci ON up.challenge_item_id = ci.id
            WHERE ci.challenge_id = expired_challenge.id
            GROUP BY up.user_id
        ) user_xp ON enrollments.user_id = user_xp.user_id
        WHERE enrollments.challenge_id = expired_challenge.id;
        
        -- Award coins based on final rewards configuration
        FOR reward_record IN
            SELECT position, coins_reward 
            FROM challenge_final_rewards 
            WHERE challenge_id = expired_challenge.id
        LOOP
            -- Update coins for users in winning positions
            UPDATE profiles 
            SET 
                coins = COALESCE(coins, 0) + reward_record.coins_reward,
                updated_at = now()
            WHERE user_id IN (
                SELECT user_id 
                FROM challenge_rankings 
                WHERE challenge_id = expired_challenge.id 
                AND position = reward_record.position
            );
        END LOOP;
        
        -- Mark challenge as finished and inactive
        UPDATE challenges 
        SET 
            is_finished = true,
            is_active = false,
            updated_at = now()
        WHERE id = expired_challenge.id;
        
    END LOOP;
END;
$$;