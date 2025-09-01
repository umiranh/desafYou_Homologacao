import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, Trophy, Users, Calendar, Star, Loader2, Plus, Settings } from 'lucide-react';
import fitnessChallenge1 from '@/assets/fitness-challenge-1.jpg';
import fitnessChallenge2 from '@/assets/fitness-challenge-2.jpg';
import fitnessChallenge3 from '@/assets/fitness-challenge-3.jpg';

interface Challenge {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  start_date: string;
  end_date: string;
  max_participants?: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  participants_count?: number;
  user_enrolled?: boolean;
}

interface Profile {
  display_name?: string;
  total_xp: number;
  level: number;
  is_admin: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [enrollingChallenges, setEnrollingChallenges] = useState<Set<string>>(new Set());

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          return;
        }

        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch challenges
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setLoadingChallenges(true);

        // Get challenges with enrollment status
        const { data: challengesData, error: challengesError } = await supabase
          .from('challenges')
          .select(`
            *,
            challenge_enrollments!left(user_id)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (challengesError) throw challengesError;

        // Process challenges to add enrollment status and participant count
        const processedChallenges = await Promise.all(
          challengesData.map(async (challenge) => {
            // Count participants
            const { count: participantsCount } = await supabase
              .from('challenge_enrollments')
              .select('*', { count: 'exact', head: true })
              .eq('challenge_id', challenge.id);

            // Check if current user is enrolled
            const userEnrolled = challenge.challenge_enrollments?.some(
              (enrollment: any) => enrollment.user_id === user?.id
            ) || false;

            return {
              ...challenge,
              participants_count: participantsCount || 0,
              user_enrolled: userEnrolled,
            };
          })
        );

        setChallenges(processedChallenges);
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

    if (user) {
      fetchChallenges();
    }
  }, [user, toast]);

  const enrollInChallenge = async (challengeId: string) => {
    if (!user) return;

    setEnrollingChallenges(prev => new Set([...prev, challengeId]));

    try {
      const { error } = await supabase
        .from('challenge_enrollments')
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
        });

      if (error) throw error;

      // Update challenges state
      setChallenges(prev => prev.map(challenge => 
        challenge.id === challengeId 
          ? { 
              ...challenge, 
              user_enrolled: true,
              participants_count: (challenge.participants_count || 0) + 1
            }
          : challenge
      ));

      toast({
        title: "Inscrição realizada!",
        description: "Você se inscreveu no desafio com sucesso",
      });
    } catch (error: any) {
      console.error('Error enrolling in challenge:', error);
      toast({
        title: "Erro ao se inscrever",
        description: error.message === 'duplicate key value violates unique constraint "challenge_enrollments_user_id_challenge_id_key"' 
          ? "Você já está inscrito neste desafio"
          : error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setEnrollingChallenges(prev => {
        const newSet = new Set(prev);
        newSet.delete(challengeId);
        return newSet;
      });
    }
  };

  const filteredChallenges = challenges.filter(challenge => {
    const matchesSearch = challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         challenge.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || 
                         (activeFilter === 'enrolled' && challenge.user_enrolled);
    
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-secondary/50 pb-20">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">DesafYOU</h1>
              <p className="text-muted-foreground text-sm">Olá, {profile?.display_name || 'Usuário'}!</p>
            </div>
            <div className="flex items-center space-x-2">
              {profile?.is_admin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Admin
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Sair
              </Button>
              <div className="text-right">
                <p className="text-sm font-medium">{profile?.total_xp || 0} XP</p>
                <p className="text-xs text-muted-foreground">Nível {profile?.level || 1}</p>
              </div>
              <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar desafios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50"
            />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Button 
              variant={activeFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveFilter('all')}
            >
              Todos
            </Button>
            <Button 
              variant={activeFilter === 'enrolled' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveFilter('enrolled')}
            >
              Meus Desafios
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-20">
        {loadingChallenges ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery || activeFilter !== 'all' 
                ? 'Nenhum desafio encontrado com os filtros aplicados.' 
                : 'Nenhum desafio disponível no momento.'}
            </p>
            {profile?.is_admin && (
              <Button
                className="mt-4"
                onClick={() => navigate('/admin')}
              >
                Criar Primeiro Desafio
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredChallenges.map((challenge) => {
              const daysRemaining = getDaysRemaining(challenge.end_date);
              const defaultImages = [fitnessChallenge1, fitnessChallenge2, fitnessChallenge3];
              const imageIndex = parseInt(challenge.id) % defaultImages.length;
              
              return (
                <Card key={challenge.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={challenge.image_url || defaultImages[imageIndex]}
                      alt={challenge.title}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = defaultImages[imageIndex];
                      }}
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="bg-background/80">
                        {daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Finalizado'}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge 
                        variant={challenge.user_enrolled ? 'default' : 'outline'}
                        className={challenge.user_enrolled ? 'bg-primary' : 'bg-background/80'}
                      >
                        {challenge.user_enrolled ? 'Inscrito' : 'Disponível'}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{challenge.title}</h3>
                        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                          {challenge.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{challenge.participants_count}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}</span>
                          </div>
                        </div>
                      </div>

                      {challenge.max_participants && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Vagas</span>
                            <span className="font-medium">
                              {challenge.participants_count}/{challenge.max_participants}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, (challenge.participants_count! / challenge.max_participants) * 100)}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      <Button 
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        disabled={challenge.user_enrolled || enrollingChallenges.has(challenge.id) || (challenge.max_participants && challenge.participants_count! >= challenge.max_participants)}
                        onClick={() => enrollInChallenge(challenge.id)}
                      >
                        {enrollingChallenges.has(challenge.id) ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Inscrevendo...
                          </>
                        ) : challenge.user_enrolled ? (
                          'Já Inscrito'
                        ) : challenge.max_participants && challenge.participants_count! >= challenge.max_participants ? (
                          'Vagas Esgotadas'
                        ) : (
                          'Participar'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav currentPage="dashboard" onNavigate={(path) => navigate(path)} />
    </div>
  );
}