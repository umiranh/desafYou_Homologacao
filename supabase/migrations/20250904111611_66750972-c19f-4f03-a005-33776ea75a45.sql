-- Create function to update user XP and level
CREATE OR REPLACE FUNCTION update_user_xp_and_level()
RETURNS TRIGGER AS $$
DECLARE
  new_total_xp INTEGER;
  new_level INTEGER;
BEGIN
  -- Get current total XP and add the earned XP
  SELECT COALESCE(total_xp, 0) + COALESCE(NEW.xp_earned, 0)
  INTO new_total_xp
  FROM profiles 
  WHERE user_id = NEW.user_id;
  
  -- Calculate new level (every 1000 XP = 1 level)
  new_level := GREATEST(1, (new_total_xp / 1000) + 1);
  
  -- Update user profile
  UPDATE profiles 
  SET 
    total_xp = new_total_xp,
    level = new_level,
    updated_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update XP when progress is added
DROP TRIGGER IF EXISTS update_xp_on_progress ON user_progress;
CREATE TRIGGER update_xp_on_progress
AFTER INSERT ON user_progress
FOR EACH ROW
EXECUTE FUNCTION update_user_xp_and_level();