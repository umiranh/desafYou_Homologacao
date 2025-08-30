-- Add coins system to profiles
ALTER TABLE public.profiles ADD COLUMN coins INTEGER DEFAULT 0;

-- Create challenge rewards table
CREATE TABLE public.challenge_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL,
  position INTEGER NOT NULL,
  coins_reward INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_challenge_position UNIQUE (challenge_id, position)
);

-- Enable RLS on challenge_rewards
ALTER TABLE public.challenge_rewards ENABLE ROW LEVEL SECURITY;

-- Create policies for challenge_rewards
CREATE POLICY "Challenge rewards are viewable by everyone" 
ON public.challenge_rewards 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage challenge rewards" 
ON public.challenge_rewards 
FOR ALL 
USING (EXISTS ( 
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
));

-- Create rankings table to store final rankings when challenge ends
CREATE TABLE public.challenge_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL,
  total_xp INTEGER NOT NULL,
  coins_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_challenge_ranking UNIQUE (challenge_id, user_id),
  CONSTRAINT unique_challenge_position_ranking UNIQUE (challenge_id, position)
);

-- Enable RLS on challenge_rankings
ALTER TABLE public.challenge_rankings ENABLE ROW LEVEL SECURITY;

-- Create policies for challenge_rankings
CREATE POLICY "Challenge rankings are viewable by everyone" 
ON public.challenge_rankings 
FOR SELECT 
USING (true);

CREATE POLICY "Only system can manage rankings" 
ON public.challenge_rankings 
FOR ALL 
USING (false);