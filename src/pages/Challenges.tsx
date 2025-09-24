import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Clock, Users, Star, Camera, CheckCircle, Circle, Loader2, Medal } from 'lucide-react';
import CommunityPreview from '@/components/CommunityPreview';

interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  xp_points: number;
  unlock_time: string;
  unlock_days: number[];
  requires_photo: boolean;
  order_index: number;
}

interface UserProgress {
  id: string;
  challenge_item_id: string;
  photo_url?: string;
  notes?: string;
  xp_earned: number;
  completed_at: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  start_date: string;
  end_date: string;
  max_participants?: number;
  challenge_items: ChallengeItem[];
  user_progress: UserProgress[];
  challenge_rewards: { position: number; coins_reward: number }[];
}

interface Ranking {
  id?: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  total_xp: number;
  position: number;
}

export default function Challenges() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [rankings, setRankings] = useState<{ [challengeId: string]: Ranking[] }>({});
  const [participantCounts, setParticipantCounts] = useState<{ [challengeId: string]: number }>({});
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<{ [taskId: string]: string }>({});
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Fetch user's enrolled challenges
  useEffect(() => {
    const fetchChallenges = async () => {
      if (!user) return;

      try {
        setLoadingChallenges(true);

        const { data, error } = await supabase
          .from('challenge_enrollments')
          .select(`
            challenges (
              *,
              challenge_items (*)
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        const userChallenges = data
          .filter(enrollment => enrollment.challenges)
          .map(enrollment => enrollment.challenges)
          .filter(challenge => {
            // Only show active challenges (not ended)
            const now = new Date();
            const endDate = new Date(challenge.end_date);
            return now.getTime() <= endDate.getTime();
          });

        // Fetch user progress for each challenge
        const challengesWithProgress = await Promise.all(
          userChallenges.map(async (challenge) => {
            try {
              const { data: progressData } = await supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', user.id)
                .in('challenge_item_id', challenge.challenge_items?.map(item => item.id) || []);

              // Fetch challenge rewards
              const { data: rewardsData } = await supabase
                .from('challenge_rewards')
                .select('*')
                .eq('challenge_id', challenge.id);

              return {
                ...challenge,
                user_progress: progressData || [],
                challenge_rewards: rewardsData || []
              };
            } catch (error) {
              console.error('Error fetching challenge data:', error);
              return {
                ...challenge,
                user_progress: [],
                challenge_rewards: []
              };
            }
          })
        );

        setChallenges(challengesWithProgress);

        // Fetch rankings and participant counts for each challenge
        const challengeRankings: { [challengeId: string]: Ranking[] } = {};
        const participantCounts: { [challengeId: string]: number } = {};
        
        for (const challenge of challengesWithProgress) {
          try {
            const { data: enrollmentsData } = await supabase
              .from('challenge_enrollments')
              .select('user_id')
              .eq('challenge_id', challenge.id);

            participantCounts[challenge.id] = enrollmentsData?.length || 0;

            if (enrollmentsData && enrollmentsData.length > 0) {
              // Get all user profiles at once
              const userIds = enrollmentsData.map(e => e.user_id);
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_url')
                .in('user_id', userIds);

              const profilesMap = new Map(profilesData?.map(profile => [profile.user_id, profile]) || []);

              // Get all progress data at once
              const { data: allProgressData } = await supabase
                .from('user_progress')
                .select('user_id, xp_earned')
                .in('user_id', userIds)
                .in('challenge_item_id', challenge.challenge_items?.map(item => item.id) || []);

              // Calculate XP for each user
              const userXPMap = new Map<string, number>();
              allProgressData?.forEach(progress => {
                const currentXP = userXPMap.get(progress.user_id) || 0;
                userXPMap.set(progress.user_id, currentXP + (progress.xp_earned || 0));
              });

              // Create ranking data
              const userXPs = enrollmentsData.map(enrollment => {
                const profile = profilesMap.get(enrollment.user_id) as any;
                return {
                  user_id: enrollment.user_id,
                  display_name: profile?.display_name || 'Usuário',
                  avatar_url: profile?.avatar_url,
                  total_xp: userXPMap.get(enrollment.user_id) || 0
                };
              });

              // Sort by XP and assign positions
              const sortedUsers = userXPs.sort((a, b) => b.total_xp - a.total_xp);
              challengeRankings[challenge.id] = sortedUsers.map((user, index) => ({
                id: `${user.user_id}-${challenge.id}`,
                user_id: user.user_id,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                total_xp: user.total_xp,
                position: index + 1
              }));
            }
          } catch (error) {
            console.error('Error fetching rankings for challenge:', challenge.id, error);
            challengeRankings[challenge.id] = [];
          }
        }

        setRankings(challengeRankings);
        setParticipantCounts(participantCounts);

        // Check and distribute rewards for ended challenges
        for (const challenge of challengesWithProgress) {
          await checkAndDistributeRewards(challenge);
        }

      } catch (error: any) {
        console.error('Error fetching challenges:', error);
        toast({
          title: "Erro ao carregar desafios",
          description: error.message || "Ocorreu um erro inesperado",
          variant: "destructive",
        });
      } finally {
        setLoadingChallenges(false);
      }
    };

    fetchChallenges();
  }, [user, toast]);

  // Tick clock to re-evaluate time-based availability
  useEffect(() => {
    const timer = setInterval(() => {
      const newTime = new Date();
      setNow(newTime);
      console.log('Challenges timer updated:', newTime.toISOString());
    }, 5000); // 5s for more precise unlocking
    return () => clearInterval(timer);
  }, []);


  const uploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${user.id}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
      .from('progress-photos')
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const getCurrentDayNumber = (challenge: Challenge) => {
    const start = new Date(challenge.start_date);
    const diffMs = now.getTime() - start.getTime();
    const day = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 because day 1 is the first day
    const totalDays = Math.ceil((new Date(challenge.end_date).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (day < 1) return 1;
    if (day > totalDays) return totalDays;
    return day;
  };

  const completeTask = async (challengeId: string, taskId: string, requiresPhoto: boolean, xpPoints: number) => {
    if (!user) return;
    if (requiresPhoto && !selectedImage) {
      toast({
        title: "Foto obrigatória",
        description: "Esta tarefa requer uma foto para ser concluída",
        variant: "destructive",
      });
      return;
    }

    // Validate schedule before allowing completion
    const parentChallenge = challenges.find(c => c.id === challengeId);
    const task = parentChallenge?.challenge_items.find(i => i.id === taskId);

    const isWithinWindow = (challenge: Challenge) => {
      const start = new Date(challenge.start_date);
      const end = new Date(challenge.end_date);
      return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
    };

    const hasUnlockedToday = (item: ChallengeItem, challenge: Challenge) => {
      if (!item) return false;
      const currentDay = getCurrentDayNumber(challenge);
      
      // Check if task is for today
      if (Array.isArray(item.unlock_days) && item.unlock_days.length > 0 && !item.unlock_days.includes(currentDay)) {
        return false;
      }
      
      // Check unlock time (HH:mm) - only check if it's today
      if (item.unlock_time) {
        const [hh, mm] = item.unlock_time.split(":");
        const threshold = new Date(now);
        threshold.setHours(parseInt(hh || '0'), parseInt(mm || '0'), 0, 0);
        if (now.getTime() < threshold.getTime()) return false;
      }
      
      return true;
    };

    if (!parentChallenge || !task || !isWithinWindow(parentChallenge) || !hasUnlockedToday(task, parentChallenge)) {
      toast({
        title: "Tarefa indisponível",
        description: "Esta tarefa ainda não está liberada para agora.",
        variant: "destructive",
      });
      return;
    }

    setCompletingTasks(prev => new Set([...prev, taskId]));

    try {
      let photoUrl = '';
      if (selectedImage) {
        photoUrl = await uploadImage(selectedImage);
      }

      const { error } = await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          challenge_item_id: taskId,
          photo_url: photoUrl || null,
          notes: notes[taskId] || null,
          xp_earned: xpPoints,
        });

      if (error) throw error;

      // Create community post if photo was uploaded
      if (photoUrl) {
        await supabase
          .from('community_posts')
          .insert({
            content: `Completei a tarefa! ${notes[taskId] || ''}`,
            image_url: photoUrl,
            user_id: user.id,
            challenge_id: challengeId,
          });
      }

      toast({
        title: "Tarefa concluída!",
        description: `Você ganhou ${xpPoints} XP`,
      });

      // Reset form
      setSelectedImage(null);
      setImagePreview('');
      setNotes(prev => ({ ...prev, [taskId]: '' }));

      // Refresh challenges without page reload - just update local state
      setChallenges(prev => prev.map(challenge => {
        if (challenge.id === challengeId) {
          return {
            ...challenge,
            user_progress: [
              ...challenge.user_progress,
              {
                id: `temp-${Date.now()}`,
                challenge_item_id: taskId,
                photo_url: photoUrl || undefined,
                notes: notes[taskId] || undefined,
                xp_earned: xpPoints,
                completed_at: new Date().toISOString(),
              }
            ]
          };
        }
        return challenge;
      }));

    } catch (error: any) {
      console.error('Error completing task:', error);
      toast({
        title: "Erro ao concluir tarefa",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setCompletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const isTaskCompleted = (taskId: string) => {
    return challenges.some(challenge => 
      challenge.user_progress.some(progress => progress.challenge_item_id === taskId)
    );
  };

  const isTaskAvailable = (item: ChallengeItem, challenge: Challenge) => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) return false;

    const currentDay = getCurrentDayNumber(challenge);

    // Check if task is for today
    if (Array.isArray(item.unlock_days) && item.unlock_days.length > 0 && !item.unlock_days.includes(currentDay)) {
      return false;
    }

    // Check unlock time
    if (item.unlock_time) {
      const [hh, mm] = item.unlock_time.split(":");
      const threshold = new Date(now);
      threshold.setHours(parseInt(hh || '0'), parseInt(mm || '0'), 0, 0);
      const isUnlocked = now.getTime() >= threshold.getTime();
      
      // Debug log
      console.log(`Task "${item.title}" unlock check:`, {
        unlock_time: item.unlock_time,
        threshold: threshold.toISOString(),
        now: now.toISOString(),
        isUnlocked,
        currentDay
      });
      
      if (!isUnlocked) return false;
    }

    return true;
  };

  const distributeRewards = async (challengeId: string, rankings: Ranking[]) => {
    try {
      // Get challenge rewards configuration
      const { data: rewardsData } = await supabase
        .from('challenge_rewards')
        .select('position, coins_reward')
        .eq('challenge_id', challengeId)
        .order('position');

      if (!rewardsData || rewardsData.length === 0) {
        console.log('No rewards configured for this challenge');
        return;
      }

      // Distribute rewards based on final ranking
      for (const reward of rewardsData) {
        const user = rankings.find(u => u.position === reward.position);
        if (user) {
          // Add coins to user's profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('total_coins')
            .eq('user_id', user.user_id)
            .single();

          if (profileData) {
            const newCoins = (profileData.total_coins || 0) + reward.coins_reward;
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ total_coins: newCoins })
              .eq('user_id', user.user_id);

            if (updateError) {
              console.error('Error updating user coins:', updateError);
            } else {
              console.log(`Distributed ${reward.coins_reward} coins to ${user.display_name} for position ${reward.position}`);
            }
          }
        }
      }

      // Mark challenge as rewards distributed
      const { error: markError } = await supabase
        .from('challenges')
        .update({ rewards_distributed: true })
        .eq('id', challengeId);

      if (markError) {
        console.error('Error marking rewards as distributed:', markError);
      }

    } catch (error) {
      console.error('Error distributing rewards:', error);
    }
  };

  const checkAndDistributeRewards = async (challenge: Challenge) => {
    const now = new Date();
    const endDate = new Date(challenge.end_date);
    
    // Check if challenge has ended and rewards haven't been distributed yet
    if (now.getTime() > endDate.getTime() && !(challenge as any).rewards_distributed) {
      const challengeRanking = rankings[challenge.id];
      if (challengeRanking && challengeRanking.length > 0) {
        await distributeRewards(challenge.id, challengeRanking);
      }
    }
  };

  const getTaskUnlockTime = (item: ChallengeItem, challenge: Challenge) => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    if (now.getTime() < start.getTime()) {
      return `Disponível em ${start.toLocaleDateString('pt-BR')}`;
    }
    if (now.getTime() > end.getTime()) {
      return 'Desafio finalizado';
    }

    const currentDay = getCurrentDayNumber(challenge);
    
    // Check if task is for a future day
    if (Array.isArray(item.unlock_days) && item.unlock_days.length > 0) {
      const nextAvailableDay = item.unlock_days.find(day => day > currentDay);
      if (nextAvailableDay) {
        const targetDate = new Date(start);
        targetDate.setDate(start.getDate() + nextAvailableDay - 1);
        return `Disponível no dia ${nextAvailableDay} (${targetDate.toLocaleDateString('pt-BR')})`;
      }
    }

    // Check unlock time for today
    if (item.unlock_time) {
      const [hh, mm] = item.unlock_time.split(":");
      const threshold = new Date(now);
      threshold.setHours(parseInt(hh || '0'), parseInt(mm || '0'), 0, 0);
      if (now.getTime() < threshold.getTime()) {
        return `Disponível às ${item.unlock_time}`;
      }
    }

    return 'Disponível agora';
  };

  const getTotalXP = (challenge: Challenge) => {
    return challenge.user_progress.reduce((sum, progress) => sum + progress.xp_earned, 0);
  };

  const getMaxXP = (challenge: Challenge) => {
    return challenge.challenge_items.reduce((sum, item) => sum + item.xp_points, 0);
  };

  const getUserPosition = (challengeId: string) => {
    const ranking = rankings[challengeId];
    if (!ranking) return null;
    return ranking.find(u => u.user_id === user?.id)?.position;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading || loadingChallenges) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-secondary/10 via-background to-secondary/5">
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-md">
          {challenges.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-foreground">
                  {challenges.length > 1 ? `Desafio ${currentChallengeIndex + 1} de ${challenges.length}` : challenges[currentChallengeIndex]?.title}
                </h1>
                {challenges.length > 1 && (
                  <p className="text-sm text-muted-foreground">{challenges[currentChallengeIndex]?.title}</p>
                )}
              </div>
              {challenges.length > 1 && (
                <div className="flex gap-1 mx-3">
                  {challenges.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${
                        index === currentChallengeIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                      onClick={() => setCurrentChallengeIndex(index)}
                    />
                  ))}
                </div>
              )}
              <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-md">
        {challenges.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-background/90 rounded-3xl p-12 border border-primary/20 max-w-md mx-auto">
              <div className="text-8xl mb-6">🏁</div>
              <h3 className="text-2xl font-bold text-primary mb-4">Nenhum desafio ativo</h3>
              <p className="text-muted-foreground mb-6 text-lg">
                Você ainda não está inscrito em nenhum desafio. Que tal começar sua jornada fitness agora?
              </p>
              <Button
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg"
                onClick={() => navigate('/dashboard')}
              >
                🚀 Explorar Desafios
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {challenges.length > 0 && (
              (() => {
                const challenge = challenges[currentChallengeIndex];
                if (!challenge) return null;
                
                const totalXP = getTotalXP(challenge);
                const maxXP = getMaxXP(challenge);
                const progress = maxXP > 0 ? (totalXP / maxXP) * 100 : 0;
                const userPosition = getUserPosition(challenge.id);
                const daysTotal = Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24));
                const daysPassed = Math.ceil((new Date().getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24));
                const currentDay = Math.min(Math.max(1, daysPassed), daysTotal);

                return (
                  <div className="space-y-4">
                    {/* Challenge Info Card */}
                    <Card className="bg-gradient-to-r from-primary to-accent text-white rounded-2xl overflow-hidden mb-4">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h2 className="text-xl font-bold mb-1">{challenge.title}</h2>
                            <div className="flex items-center gap-4 text-sm opacity-90">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{participantCounts[challenge.id] || 0} participantes</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>Termina em {formatDate(challenge.end_date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">#{userPosition || '--'}</div>
                            <div className="text-xs opacity-75">sua posição</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Progress Card */}
                    <Card className="bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-2xl overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h2 className="text-2xl font-bold mb-1">Dia {currentDay}</h2>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-24 bg-white/20 rounded-full h-2">
                                <div 
                                  className="bg-white h-2 rounded-full transition-all duration-500" 
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="w-4 h-4 bg-foreground rounded-full" />
                            </div>
                            <p className="text-sm opacity-90">
                              DESAFIO<br />
                              <span className="font-bold">{Math.round(progress)}% CONCLUÍDO</span>
                            </p>
                          </div>
                          <Button 
                            variant="secondary" 
                            className="bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-full px-4 py-2 text-sm"
                          >
                            Ver Progresso
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Ranking Section */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Ranking</h3>
                      <h3 className="text-lg font-bold">O que estão falando</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Ranking */}
                      <div className="space-y-2">
                        {rankings[challenge.id] && rankings[challenge.id].slice(0, 5).map((u, index) => (
                          <div key={u.user_id} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-amber-600 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index === 0 ? '🏆' : index + 1}
                            </div>
                            <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.display_name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="h-8 w-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                                  <span className="text-primary-foreground font-bold text-xs">
                                    {u.display_name?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{u.display_name}</p>
                              {u.user_id === user.id && <p className="text-xs text-muted-foreground">Você</p>}
                            </div>
                            {index < 3 && <Medal className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        ))}
                      </div>
                      
                      {/* Community Posts Preview */}
                      <CommunityPreview challengeId={challenge.id} onViewCommunity={() => navigate(`/community?challenge=${challenge.id}`)} />
                    </div>
                    
                    {/* Challenge Items */}
                    <div className="bg-foreground rounded-t-3xl -mx-4 px-4 pt-6 pb-20">
                      <h3 className="text-lg font-bold text-background mb-4">Tarefas do Dia {currentDay}</h3>
                      <div className="space-y-3">
                        {challenge.challenge_items
                          ?.sort((a, b) => a.order_index - b.order_index)
                          .filter((item) => {
                            // Only show tasks for current day or completed tasks
                            const currentDay = getCurrentDayNumber(challenge);
                            const isCompleted = isTaskCompleted(item.id);
                            
                            // If no unlock_days specified, show every day
                            if (!Array.isArray(item.unlock_days) || item.unlock_days.length === 0) {
                              return true;
                            }
                            
                            // Show if completed or if it's for today
                            return isCompleted || item.unlock_days.includes(currentDay);
                          })
                          .map((item) => {
                            const isCompleted = isTaskCompleted(item.id);
                            const available = isTaskAvailable(item, challenge);
                            const unlockTime = getTaskUnlockTime(item, challenge);
                            
                            return (
                              <Card key={item.id} className={`bg-background border-0 rounded-2xl overflow-hidden ${
                                isCompleted ? 'opacity-50' : ''
                              }`}>
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0">
                                      {isCompleted ? (
                                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                          <CheckCircle className="h-5 w-5 text-white" />
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                                          <Circle className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                     
                                     <div className="flex-1">
                                       <h4 className="font-medium text-foreground mb-1">{item.title}</h4>
                                       <p className="text-sm text-muted-foreground">{item.description}</p>
                                       {!isCompleted && !available && (
                                         <p className="text-xs text-red-500 mt-2">{unlockTime}</p>
                                       )}
                                       {!isCompleted && available && (
                                         <p className="text-xs text-green-500 mt-2">✓ Disponível agora</p>
                                       )}
                                       
                                       {!isCompleted && item.requires_photo && (
                                         <div className="mt-3 space-y-2">
                                           <Textarea
                                             placeholder="Adicione suas observações (opcional)"
                                             value={notes[item.id] || ''}
                                             onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                             rows={2}
                                             className="text-xs"
                                           />
                                           
                                           {imagePreview && (
                                             <div className="w-full h-24 rounded-lg overflow-hidden">
                                               <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                             </div>
                                           )}
                                           
                                           <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => {
                                               const file = e.target.files?.[0];
                                               if (file) {
                                                 setSelectedImage(file);
                                                 const reader = new FileReader();
                                                 reader.onload = (e) => {
                                                   setImagePreview(e.target?.result as string);
                                                 };
                                                 reader.readAsDataURL(file);
                                               }
                                             }}
                                             className="hidden"
                                             id={`photo-${item.id}`}
                                           />
                                           
                                           <div className="flex gap-2">
                                             <Button
                                               variant="outline"
                                               size="sm"
                                               onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                                               className="flex-1 text-xs"
                                             >
                                               <Camera className="h-3 w-3 mr-1" />
                                               {imagePreview ? 'Trocar' : 'Foto'}
                                             </Button>
                                             
                                             <Button
                                               size="sm"
                                               onClick={() => completeTask(challenge.id, item.id, item.requires_photo, item.xp_points)}
                                               disabled={completingTasks.has(item.id) || !selectedImage || !available}
                                               className="text-xs"
                                             >
                                               {completingTasks.has(item.id) ? (
                                                 <Loader2 className="h-3 w-3 animate-spin" />
                                               ) : (
                                                 'Concluir'
                                               )}
                                             </Button>
                                           </div>
                                         </div>
                                       )}
                                       
                                       {!isCompleted && !item.requires_photo && (
                                         <div className="mt-3 space-y-2">
                                           <Textarea
                                             placeholder="Adicione suas observações (opcional)"
                                             value={notes[item.id] || ''}
                                             onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                             rows={2}
                                             className="text-xs"
                                           />
                                           <Button
                                             size="sm"
                                             onClick={() => completeTask(challenge.id, item.id, item.requires_photo, item.xp_points)}
                                             disabled={completingTasks.has(item.id) || !available}
                                             className="w-full text-xs"
                                           >
                                             {completingTasks.has(item.id) ? (
                                               <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                             ) : (
                                               <>
                                                 <CheckCircle className="h-3 w-3 mr-1" />
                                                 Concluir (+{item.xp_points} XP)
                                               </>
                                             )}
                                           </Button>
                                         </div>
                                       )}
                                     </div>
                                     
                                     {isCompleted && (
                                       <div className="flex-shrink-0">
                                         <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                           <CheckCircle className="h-4 w-4 text-white" />
                                         </div>
                                       </div>
                                     )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      <BottomNav currentPage="challenges" onNavigate={(path) => navigate(path)} />
    </div>
  );
}