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
          })
        );

        setChallenges(challengesWithProgress);

        // Fetch rankings for each challenge
        const challengeRankings: { [challengeId: string]: Ranking[] } = {};
        
        for (const challenge of challengesWithProgress) {
          const { data: enrollmentsData } = await supabase
            .from('challenge_enrollments')
            .select('user_id')
            .eq('challenge_id', challenge.id);

          if (enrollmentsData) {
            const userXPs = await Promise.all(
              enrollmentsData.map(async (enrollment) => {
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
    return ranking.find(user => user.user_id === user!.id)?.position;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (loading || loadingChallenges) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50 border-b shadow-sm">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-primary mb-2">🏆 Meus Desafios</h1>
            <p className="text-muted-foreground">Acompanhe seu progresso e complete suas tarefas</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
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
          <div className="grid gap-6 lg:gap-8">
            {challenges.map((challenge) => {
              const totalXP = getTotalXP(challenge);
              const maxXP = getMaxXP(challenge);
              const progress = maxXP > 0 ? (totalXP / maxXP) * 100 : 0;
              const userPosition = getUserPosition(challenge.id);
              
              return (
                <Card key={challenge.id} className="bg-background/90 backdrop-blur-sm border border-primary/10 shadow-xl rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-300">
                <CardHeader className="p-6 bg-gradient-to-r from-primary/5 to-accent/5">
                  <div className="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
                    <div className="flex-1">
                      <CardTitle className="text-xl lg:text-2xl text-primary mb-2 leading-tight">{challenge.title}</CardTitle>
                      <p className="text-muted-foreground leading-relaxed">{challenge.description}</p>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {userPosition && (
                        <Badge variant="outline" className="gap-2 border-primary/30 bg-primary/10 text-primary px-4 py-2">
                          <Medal className="h-4 w-4" />
                          Posição #{userPosition}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="bg-accent/20 text-accent px-4 py-2 font-semibold">
                        {totalXP} / {maxXP} XP
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:space-x-6 lg:space-y-0">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <span>{formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 bg-accent/10 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-accent" />
                      </div>
                      <span>{rankings[challenge.id]?.length || 0} participantes ativos</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 bg-background/50 rounded-2xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Progresso Geral</span>
                      <span className="text-lg font-bold text-primary">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-3 bg-muted" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 p-6">
                  {/* Ranking */}
                  {rankings[challenge.id] && rankings[challenge.id].length > 0 && (
                    <Card className="border border-primary/10 bg-background/50">
                      <CardHeader className="p-6 bg-gradient-to-r from-primary/5 to-accent/5">
                        <CardTitle className="text-lg flex items-center gap-3">
                          <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center">
                            <Trophy className="h-4 w-4 text-primary" />
                          </div>
                          Ranking do Desafio
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="space-y-2">
                          {rankings[challenge.id].slice(0, 5).map((user, index) => (
                            <div
                              key={user.user_id}
                              className={`flex items-center justify-between p-3 rounded-xl ${
                                user.user_id === user!.id ? 'bg-primary/10' : 'bg-white/30'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-7 h-7 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0 ? 'bg-yellow-500 text-white' :
                                  index === 1 ? 'bg-gray-400 text-white' :
                                  index === 2 ? 'bg-amber-600 text-white' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="font-medium text-sm truncate">{user.display_name}</span>
                              </div>
                              <span className="text-xs md:text-sm font-medium flex-shrink-0">{user.total_xp} XP</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Challenge rewards */}
                        {challenge.challenge_rewards.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-medium mb-2">Recompensas</h4>
                            <div className="space-y-1">
                              {challenge.challenge_rewards
                                .sort((a, b) => a.position - b.position)
                                .map((reward) => (
                                <div key={reward.position} className="flex justify-between text-xs">
                                  <span>{reward.position}º lugar</span>
                                  <span className="font-medium text-yellow-600">
                                    {reward.coins_reward} moedas
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Challenge items */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-base">Tarefas</h3>
                    {challenge.challenge_items
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((item) => {
                        const completed = isTaskCompleted(item.id);
                        const isCompleting = completingTasks.has(item.id);
                        
                        return (
                          <Card key={item.id} className={`border-0 ${completed ? 'bg-green-50/80' : 'bg-white/60'}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start space-x-3">
                                <div className="pt-1 flex-shrink-0">
                                  {completed ? (
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                  ) : (
                                    <Circle className="h-6 w-6 text-muted-foreground" />
                                  )}
                                </div>
                                
                                <div className="flex-1 space-y-3 min-w-0">
                                  <div>
                                    <h4 className="font-medium text-sm md:text-base leading-tight">{item.title}</h4>
                                    {item.description && (
                                      <p className="text-xs md:text-sm text-muted-foreground mt-2 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    <div className="flex items-center space-x-1">
                                      <Star className="h-3 w-3 flex-shrink-0" />
                                      <span>{item.xp_points} XP</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3 flex-shrink-0" />
                                      <span>{item.unlock_time}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <span className="break-words">
                                        {item.unlock_days.map(day => weekDays[day]).join(', ')}
                                      </span>
                                    </div>
                                    {item.requires_photo && (
                                      <div className="flex items-center space-x-1 text-primary">
                                        <Camera className="h-3 w-3 flex-shrink-0" />
                                        <span>Foto obrigatória</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {!completed && (
                                    <div className="space-y-4">
                                      <Textarea
                                        placeholder="Adicione uma observação (opcional)..."
                                        value={notes[item.id] || ''}
                                        onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        rows={3}
                                        className="text-sm resize-none border-primary/20 focus:border-primary/40"
                                      />
                                      
                                      {item.requires_photo && (
                                        <div className="space-y-3">
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            className="hidden"
                                            id={`image-upload-${item.id}`}
                                          />
                                          <label htmlFor={`image-upload-${item.id}`}>
                                            <Button variant="outline" size="default" asChild className="w-full md:w-auto">
                                              <span className="cursor-pointer gap-2 py-3">
                                                <Camera className="h-4 w-4" />
                                                {selectedImage ? 'Trocar Foto' : 'Adicionar Foto'}
                                              </span>
                                            </Button>
                                          </label>
                                          
                                          {imagePreview && (
                                            <div className="relative bg-gray-50 rounded-xl p-3">
                                              <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full max-h-48 md:max-h-32 rounded-lg object-cover"
                                              />
                                              <Button
                                                variant="secondary"
                                                size="sm"
                                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg"
                                                onClick={() => {
                                                  setSelectedImage(null);
                                                  setImagePreview('');
                                                }}
                                              >
                                                ✕
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      <Button
                                        size="default"
                                        onClick={() => completeTask(challenge.id, item.id, item.requires_photo, item.xp_points)}
                                        disabled={isCompleting || (item.requires_photo && !selectedImage)}
                                        className="w-full gap-2 py-3 bg-primary hover:bg-primary/90"
                                      >
                                        {isCompleting ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <CheckCircle className="h-4 w-4" />
                                        )}
                                        Concluir Tarefa
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>

      <BottomNav currentPage="challenges" onNavigate={(path) => navigate(path)} />
    </div>
  );
}