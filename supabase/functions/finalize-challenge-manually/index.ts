import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { challengeId, giveRewards } = await req.json()

    if (!challengeId) {
      return new Response(
        JSON.stringify({ error: 'Challenge ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Starting manual finalization for challenge ${challengeId} with rewards: ${giveRewards}`)

    // Get challenge details
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return new Response(
        JSON.stringify({ error: 'Challenge not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (challenge.is_finished) {
      return new Response(
        JSON.stringify({ error: 'Challenge is already finished' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate final rankings for this challenge
    const { error: deleteRankingsError } = await supabase
      .from('challenge_rankings')
      .delete()
      .eq('challenge_id', challengeId)

    if (deleteRankingsError) {
      console.error('Error deleting existing rankings:', deleteRankingsError)
    }

    // Get enrollments and calculate XP
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('challenge_enrollments')
      .select('user_id')
      .eq('challenge_id', challengeId)

    if (enrollmentsError) {
      console.error('Error fetching enrollments:', enrollmentsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch enrollments' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate user XP for this challenge
    const userXpData = []
    
    // First get all challenge items for this challenge
    const { data: challengeItems, error: challengeItemsError } = await supabase
      .from('challenge_items')
      .select('id')
      .eq('challenge_id', challengeId)

    if (challengeItemsError) {
      console.error('Error fetching challenge items:', challengeItemsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch challenge items' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const challengeItemIds = challengeItems?.map(item => item.id) || []

    for (const enrollment of enrollments || []) {
      const { data: userProgress } = await supabase
        .from('user_progress')
        .select('xp_earned')
        .eq('user_id', enrollment.user_id)
        .in('challenge_item_id', challengeItemIds)

      const totalXp = userProgress?.reduce((sum, progress) => sum + (progress.xp_earned || 0), 0) || 0
      userXpData.push({
        user_id: enrollment.user_id,
        total_xp: totalXp
      })
    }

    // Sort by XP and create rankings
    userXpData.sort((a, b) => b.total_xp - a.total_xp)
    
    const rankings = userXpData.map((user, index) => ({
      challenge_id: challengeId,
      user_id: user.user_id,
      position: index + 1,
      total_xp: user.total_xp
    }))

    // Insert rankings
    if (rankings.length > 0) {
      const { error: rankingsError } = await supabase
        .from('challenge_rankings')
        .insert(rankings)

      if (rankingsError) {
        console.error('Error inserting rankings:', rankingsError)
        return new Response(
          JSON.stringify({ error: 'Failed to create rankings' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Award coins if rewards should be given
    if (giveRewards) {
      const { data: rewards, error: rewardsError } = await supabase
        .from('challenge_final_rewards')
        .select('position, coins_reward')
        .eq('challenge_id', challengeId)

      if (!rewardsError && rewards) {
      for (const reward of rewards) {
        const winnersAtPosition = rankings.filter(r => r.position === reward.position)
        
        for (const winner of winnersAtPosition) {
          // Get current coins
          const { data: profile } = await supabase
            .from('profiles')
            .select('coins')
            .eq('user_id', winner.user_id)
            .single()

          const currentCoins = profile?.coins || 0
          
          const { error: updateCoinsError } = await supabase
            .from('profiles')
            .update({ 
              coins: currentCoins + reward.coins_reward,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', winner.user_id)

          if (updateCoinsError) {
            console.error('Error updating coins for user:', winner.user_id, updateCoinsError)
          }
        }
      }
      }
    }

    // Mark challenge as finished and manually finalized
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        is_finished: true,
        is_active: false,
        manually_finalized: true,
        give_rewards_on_manual_finalization: giveRewards,
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId)

    if (updateError) {
      console.error('Error updating challenge:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to finalize challenge' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Challenge ${challengeId} manually finalized successfully`)

    return new Response(
      JSON.stringify({ 
        message: 'Challenge finalized successfully',
        rankings: rankings.length,
        rewardsGiven: giveRewards
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Unexpected error occurred' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})