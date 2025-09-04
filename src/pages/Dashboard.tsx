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
import { Search, Filter, Trophy, Users, Calendar, Star, Loader2, Plus, Settings, ArrowLeft, Flame } from 'lucide-react';
import fitnessChallenge1 from '@/assets/fitness-challenge-1.jpg';
import fitnessChallenge2 from '@/assets/fitness-challenge-2.jpg';
import fitnessChallenge3 from '@/assets/fitness-challenge-3.jpg';
import { ChallengeDetailModal } from '@/components/ChallengeDetailModal';

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
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [enrollingChallenges, setEnrollingChallenges] = useState<Set<string>>(new Set());
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

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
    
    const matchesLevel = selectedLevel === 'all' || selectedLevel === 'enrolled' ||
                        challenge.title.toLowerCase().includes(selectedLevel.toLowerCase());
    
    const matchesEnrolled = selectedLevel !== 'enrolled' || challenge.user_enrolled;
    
    return matchesSearch && matchesLevel && matchesEnrolled;
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
    <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-background to-secondary/30 pb-20">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Escolha</h1>
              <h2 className="text-2xl font-bold text-foreground">seu desafio!</h2>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium">{profile?.total_xp || 0} XP</p>
                <p className="text-xs text-muted-foreground">Nível {profile?.level || 1}</p>
              </div>
              <div className="relative">
                <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-primary-foreground" />
                </div>
                {profile?.level && profile.level > 1 && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                    {profile.level}
                  </div>
                )}
              </div>
              {profile?.is_admin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-1 mb-4 bg-card/30 backdrop-blur rounded-full p-1 max-w-sm mx-auto">
            <Button 
              variant={selectedLevel === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('all')}
              className="rounded-full flex-1 text-xs py-2"
            >
              Todos
            </Button>
            <Button 
              variant={selectedLevel === 'iniciante' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('iniciante')}
              className="rounded-full flex-1 text-xs py-2"
            >
              Iniciante
            </Button>
            <Button 
              variant={selectedLevel === 'intermediário' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('intermediário')}
              className="rounded-full flex-1 text-xs py-2"
            >
              Intermediário
            </Button>
            <Button 
              variant={selectedLevel === 'avançado' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('avançado')}
              className="rounded-full flex-1 text-xs py-2"
            >
              Avançado
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar desafios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 rounded-xl"
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-20 max-w-md mx-auto">
        {loadingChallenges ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Em Alta Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Em alta</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {filteredChallenges.slice(0, 3).map((challenge) => (
                  <div key={challenge.id} className="flex-shrink-0 w-64">
                    <ChallengeCard 
                      challenge={challenge}
                      onClick={() => setSelectedChallenge(challenge)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Novidade Section */}
            {filteredChallenges.length > 3 && (
              <div className="mb-4">
                <h3 className="text-lg font-bold mb-3">Novidade</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {filteredChallenges.slice(3, 6).map((challenge) => (
                    <div key={challenge.id} className="flex-shrink-0 w-64">
                      <ChallengeCard 
                        challenge={challenge}
                        onClick={() => setSelectedChallenge(challenge)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredChallenges.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery || selectedLevel !== 'all' 
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
            )}
          </div>
        )}
      </div>

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onEnroll={() => {
            enrollInChallenge(selectedChallenge.id);
            setSelectedChallenge(null);
          }}
          isEnrolling={enrollingChallenges.has(selectedChallenge.id)}
        />
      )}

      <BottomNav currentPage="dashboard" onNavigate={(path) => navigate(path)} />
    </div>
  );
}

// Challenge Card Component
const ChallengeCard = ({ challenge, onClick }: { 
  challenge: Challenge; 
  onClick: () => void; 
}) => {
  const defaultImages = [fitnessChallenge1, fitnessChallenge2, fitnessChallenge3];
  const imageIndex = parseInt(challenge.id) % defaultImages.length;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group bg-card/80 backdrop-blur border-border/50"
      onClick={onClick}
    >
      <div className="aspect-[3/2] relative overflow-hidden">
        <img
          src={challenge.image_url || defaultImages[imageIndex]}
          alt={challenge.title}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = defaultImages[imageIndex];
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="font-bold text-white text-sm leading-tight mb-1">
            {challenge.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`h-2.5 w-2.5 ${i < 4 ? 'text-yellow-400 fill-current' : 'text-white/40'}`} 
                />
              ))}
            </div>
            <div className="flex items-center text-white/90 text-xs">
              <span className="font-medium">{challenge.participants_count || 0}</span>
              <Users className="h-2.5 w-2.5 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};