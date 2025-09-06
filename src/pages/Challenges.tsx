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
  total_xp: number;
  position: number;
}

export default function Challenges() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [rankings, setRankings] = useState<{ [challengeId: string]: Ranking[] }>({});
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<{ [taskId: string]: string }>({});
  const [loadingChallenges, setLoadingChallenges] = useState(true);

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
          .map(enrollment => enrollment.challenges);

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

        // Fetch rankings for each challenge
        const challengeRankings: { [challengeId: string]: Ranking[] } = {};
        
        for (const challenge of challengesWithProgress) {
          try {
            const { data: enrollmentsData } = await supabase
              .from('challenge_enrollments')
              .select('user_id')
              .eq('challenge_id', challenge.id);

            if (enrollmentsData && enrollmentsData.length > 0) {
              const userXPs = await Promise.all(
                enrollmentsData.map(async (enrollment) => {
                  try {
                    const { data: profileData } = await supabase
                      .from('profiles')
                      .select('display_name')
                      .eq('user_id', enrollment.user_id)
                      .single();

                    const { data: progressData } = await supabase
                      .from('user_progress')
                      .select('xp_earned')
                      .eq('user_id', enrollment.user_id)
                      .in('challenge_item_id', challenge.challenge_items?.map(item => item.id) || []);

                    const totalXP = progressData?.reduce((sum, progress) => sum + (progress.xp_earned || 0), 0) || 0;

                    return {
                      user_id: enrollment.user_id,
                      display_name: profileData?.display_name || 'Usuário',
                      total_xp: totalXP
                    };
                  } catch (error) {
                    console.error('Error fetching user ranking data:', error);
                    return {
                      user_id: enrollment.user_id,
                      display_name: 'Usuário',
                      total_xp: 0
                    };
                  }
                })
              );

              // Sort by XP and assign positions
              const sortedUsers = userXPs.sort((a, b) => b.total_xp - a.total_xp);
              challengeRankings[challenge.id] = sortedUsers.map((user, index) => ({
                id: `${user.user_id}-${challenge.id}`,
                user_id: user.user_id,
                display_name: user.display_name,
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
              <h1 className="text-xl font-bold text-foreground">{challenges[0].title}</h1>
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
            {challenges.map((challenge) => {
              const totalXP = getTotalXP(challenge);
              const maxXP = getMaxXP(challenge);
              const progress = maxXP > 0 ? (totalXP / maxXP) * 100 : 0;
              const userPosition = getUserPosition(challenge.id);
              const daysTotal = Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24));
              const daysPassed = Math.ceil((new Date().getTime() - new Date(challenge.start_date).getTime()) / (1000 * 60 * 60 * 24));
              const currentDay = Math.min(Math.max(1, daysPassed), daysTotal);

              return (
                <div key={challenge.id} className="space-y-4">
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
                          className="bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-full px-6"
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
                          <div className="h-8 w-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-foreground font-bold text-xs">
                              {u.display_name?.[0]?.toUpperCase() || 'U'}
                            </span>
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
                    <h3 className="text-lg font-bold text-background mb-4">Tarefas</h3>
                    <div className="space-y-3">
                      {challenge.challenge_items
                        ?.sort((a, b) => a.order_index - b.order_index)
                        .map((item) => {
                          const isCompleted = isTaskCompleted(item.id);
                          
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
                                  </div>
                                  
                                  {!isCompleted && (
                                    <div className="flex-shrink-0">
                                      <Button
                                        onClick={() => completeTask(challenge.id, item.id, item.requires_photo, item.xp_points)}
                                        disabled={completingTasks.has(item.id)}
                                        size="sm"
                                        className="w-10 h-10 rounded-full bg-muted text-muted-foreground hover:bg-foreground hover:text-background"
                                      >
                                        {completingTasks.has(item.id) ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Camera className="h-4 w-4" />
                                        )}
                                      </Button>
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
            })}
          </div>
        )}
      </div>

      <BottomNav currentPage="challenges" onNavigate={(path) => navigate(path)} />
    </div>
  );
}