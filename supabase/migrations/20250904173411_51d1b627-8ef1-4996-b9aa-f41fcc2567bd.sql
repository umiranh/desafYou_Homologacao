-- Add column to track if challenge was manually finalized
ALTER TABLE challenges 
ADD COLUMN manually_finalized BOOLEAN DEFAULT false;

-- Add column to control whether rewards should be given on manual finalization
ALTER TABLE challenges 
ADD COLUMN give_rewards_on_manual_finalization BOOLEAN DEFAULT true;