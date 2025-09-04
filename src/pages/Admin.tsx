import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';

interface ChallengeItem {
  id?: string;
  title: string;
  description: string;
  xp_points: number;
  unlock_time: string;
  unlock_days: number[];
  requires_photo: boolean;
  order_index: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [challengeData, setChallengeData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    max_participants: '',
    daily_calories: '',
    daily_time_minutes: '',
    difficulty_level: 'iniciante',
    total_days: '',
  });

  const [finalRewards, setFinalRewards] = useState([
    { position: 1, coins_reward: 100 },
    { position: 2, coins_reward: 50 },
    { position: 3, coins_reward: 25 },
  ]);

  const [challengeItems, setChallengeItems] = useState<ChallengeItem[]>([
    {
      title: '',
      description: '',
      xp_points: 10,
      unlock_time: '08:00',
      unlock_days: [0, 1, 2, 3, 4, 5, 6],
      requires_photo: false,
      order_index: 0,
    }
  ]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();

        if (profile?.is_admin) {
          setIsAdmin(true);
        } else {
          toast({
            title: "Acesso negado",
            description: "Você precisa ser administrador para acessar esta página",
            variant: "destructive",
          });
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate('/dashboard');
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading, navigate, toast]);

  const addChallengeItem = () => {
    setChallengeItems([...challengeItems, {
      title: '',
      description: '',
      xp_points: 10,
      unlock_time: '08:00',
      unlock_days: [0, 1, 2, 3, 4, 5, 6],
      requires_photo: false,
      order_index: challengeItems.length,
    }]);
  };

  const removeChallengeItem = (index: number) => {
    if (challengeItems.length > 1) {
      setChallengeItems(challengeItems.filter((_, i) => i !== index));
    }
  };

  const updateChallengeItem = (index: number, field: keyof ChallengeItem, value: any) => {
    const updatedItems = [...challengeItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setChallengeItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!challengeData.title || !challengeData.description || !challengeData.start_date || !challengeData.end_date) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Calculate total days automatically
      const startDate = new Date(challengeData.start_date);
      const endDate = new Date(challengeData.end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Create challenge
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert({
          title: challengeData.title,
          description: challengeData.description,
          start_date: challengeData.start_date,
          end_date: challengeData.end_date,
          max_participants: challengeData.max_participants ? parseInt(challengeData.max_participants) : null,
          daily_calories: challengeData.daily_calories ? parseInt(challengeData.daily_calories) : null,
          daily_time_minutes: challengeData.daily_time_minutes ? parseInt(challengeData.daily_time_minutes) : null,
          difficulty_level: challengeData.difficulty_level,
          total_days: totalDays,
          created_by: user!.id,
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Create challenge items
      const itemsToInsert = challengeItems
        .filter(item => item.title.trim())
        .map((item, index) => ({
          challenge_id: challenge.id,
          title: item.title,
          description: item.description,
          xp_points: item.xp_points,
          unlock_time: item.unlock_time,
          unlock_days: item.unlock_days,
          requires_photo: item.requires_photo,
          order_index: index,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('challenge_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Create final rewards
      const rewardsToInsert = finalRewards.map(reward => ({
        challenge_id: challenge.id,
        position: reward.position,
        coins_reward: reward.coins_reward,
      }));

      if (rewardsToInsert.length > 0) {
        const { error: rewardsError } = await supabase
          .from('challenge_final_rewards')
          .insert(rewardsToInsert);

        if (rewardsError) throw rewardsError;
      }

      toast({
        title: "Desafio criado!",
        description: "O desafio foi criado com sucesso",
      });

      // Reset form
      setChallengeData({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        max_participants: '',
        daily_calories: '',
        daily_time_minutes: '',
        difficulty_level: 'iniciante',
        total_days: '',
      });
      setChallengeItems([{
        title: '',
        description: '',
        xp_points: 10,
        unlock_time: '08:00',
        unlock_days: [0, 1, 2, 3, 4, 5, 6],
        requires_photo: false,
        order_index: 0,
      }]);
      setFinalRewards([
        { position: 1, coins_reward: 100 },
        { position: 2, coins_reward: 50 },
        { position: 3, coins_reward: 25 },
      ]);

    } catch (error: any) {
      console.error('Error creating challenge:', error);
      toast({
        title: "Erro ao criar desafio",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const weekDays = [
    { value: 0, label: 'Dom' },
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="font-bold text-lg">Admin - Criar Desafio</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Desafio</CardTitle>
            <CardDescription>
              Preencha os detalhes básicos do desafio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={challengeData.title}
                  onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
                  placeholder="Nome do desafio"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={challengeData.description}
                  onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
                  placeholder="Descreva o desafio..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={challengeData.start_date}
                    onChange={(e) => setChallengeData({ ...challengeData, start_date: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Fim *</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={challengeData.end_date}
                    onChange={(e) => setChallengeData({ ...challengeData, end_date: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily_calories">Calorias Diárias</Label>
                  <Input
                    id="daily_calories"
                    type="number"
                    value={challengeData.daily_calories}
                    onChange={(e) => setChallengeData({ ...challengeData, daily_calories: e.target.value })}
                    placeholder="Ex: 500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_time_minutes">Tempo Diário (min)</Label>
                  <Input
                    id="daily_time_minutes"
                    type="number"
                    value={challengeData.daily_time_minutes}
                    onChange={(e) => setChallengeData({ ...challengeData, daily_time_minutes: e.target.value })}
                    placeholder="Ex: 90"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty_level">Nível de Dificuldade</Label>
                  <select
                    id="difficulty_level"
                    value={challengeData.difficulty_level}
                    onChange={(e) => setChallengeData({ ...challengeData, difficulty_level: e.target.value })}
                    className="w-full p-2 border border-border rounded-lg bg-background"
                  >
                    <option value="iniciante">Iniciante</option>
                    <option value="intermediário">Intermediário</option>
                    <option value="avançado">Avançado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_participants">Máximo de Participantes (opcional)</Label>
                <Input
                  id="max_participants"
                  type="number"
                  value={challengeData.max_participants}
                  onChange={(e) => setChallengeData({ ...challengeData, max_participants: e.target.value })}
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recompensas Finais</CardTitle>
            <CardDescription>
              Configure as recompensas em moedas por posição no ranking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {finalRewards.map((reward, index) => (
              <div key={reward.position} className="flex items-center gap-4">
                <div className="w-16 text-center">
                  <span className="text-sm font-medium">{reward.position}º lugar</span>
                </div>
                <Input
                  type="number"
                  value={reward.coins_reward}
                  onChange={(e) => {
                    const newRewards = [...finalRewards];
                    newRewards[index].coins_reward = parseInt(e.target.value) || 0;
                    setFinalRewards(newRewards);
                  }}
                  placeholder="Moedas"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">moedas</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Tarefas do Desafio
              <Button
                type="button"
                size="sm"
                onClick={addChallengeItem}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Tarefa
              </Button>
            </CardTitle>
            <CardDescription>
              Configure as tarefas que aparecerão durante o desafio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {challengeItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Tarefa {index + 1}</h3>
                  {challengeItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChallengeItem(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Título da Tarefa *</Label>
                    <Input
                      value={item.title}
                      onChange={(e) => updateChallengeItem(index, 'title', e.target.value)}
                      placeholder="Ex: Fazer 50 flexões"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateChallengeItem(index, 'description', e.target.value)}
                      placeholder="Instruções detalhadas..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Pontos XP</Label>
                      <Input
                        type="number"
                        value={item.xp_points}
                        onChange={(e) => updateChallengeItem(index, 'xp_points', parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={item.unlock_time}
                        onChange={(e) => updateChallengeItem(index, 'unlock_time', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Foto Obrigatória</Label>
                      <div className="flex items-center space-x-2 h-10">
                        <input
                          type="checkbox"
                          checked={item.requires_photo}
                          onChange={(e) => updateChallengeItem(index, 'requires_photo', e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Sim</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dias da Semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={item.unlock_days.includes(day.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const updatedDays = item.unlock_days.includes(day.value)
                              ? item.unlock_days.filter(d => d !== day.value)
                              : [...item.unlock_days, day.value];
                            updateChallengeItem(index, 'unlock_days', updatedDays);
                          }}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary/80"
              disabled={isCreating}
              onClick={handleSubmit}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Desafio
            </Button>
          </CardContent>
        </Card>
      </div>

      <BottomNav currentPage="admin" onNavigate={(path) => navigate(path)} />
    </div>
  );
}