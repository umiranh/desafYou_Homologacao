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
import { Loader2, ArrowLeft, Plus, Trash2, Camera, Crown, Users, Calendar } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

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
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [finalizingChallenge, setFinalizingChallenge] = useState<string | null>(null);

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

  const [selectedCoverImage, setSelectedCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');

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

  // Load active challenges
  useEffect(() => {
    const loadActiveChallenges = async () => {
      if (!isAdmin) return;
      
      setLoadingChallenges(true);
      try {
        const { data, error } = await supabase
          .from('challenges')
          .select(`
            *,
            challenge_enrollments(count)
          `)
          .eq('is_active', true)
          .eq('is_finished', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setActiveChallenges(data || []);
      } catch (error) {
        console.error('Error loading challenges:', error);
        toast({
          title: "Erro",
          description: "Falha ao carregar desafios ativos",
          variant: "destructive",
        });
      } finally {
        setLoadingChallenges(false);
      }
    };

    loadActiveChallenges();
  }, [isAdmin, toast]);

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

  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedCoverImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadCoverImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-challenge-cover.${fileExt}`;
    const filePath = `challenges/${fileName}`;

    const { error } = await supabase.storage
      .from('challenge-images')
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data } = supabase.storage
      .from('challenge-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
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

      // Upload cover image if selected
      let imageUrl = null;
      if (selectedCoverImage) {
        try {
          imageUrl = await uploadCoverImage(selectedCoverImage);
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          toast({
            title: "Erro no upload da imagem",
            description: "A imagem não pôde ser enviada. O desafio será criado sem imagem personalizada.",
            variant: "destructive",
          });
        }
      }

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
          image_url: imageUrl,
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
      setSelectedCoverImage(null);
      setCoverImagePreview('');

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

  const handleFinalizeChallengeManually = async (challengeId: string, giveRewards: boolean) => {
    setFinalizingChallenge(challengeId);
    
    try {
      const { data, error } = await supabase.functions.invoke('finalize-challenge-manually', {
        body: { 
          challengeId,
          giveRewards
        }
      });

      if (error) throw error;

      toast({
        title: "Desafio finalizado",
        description: `Desafio finalizado com sucesso. ${giveRewards ? 'Recompensas distribuídas.' : 'Sem recompensas distribuídas.'}`,
      });

      // Reload active challenges
      const { data: updatedChallenges, error: reloadError } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_enrollments(count)
        `)
        .eq('is_active', true)
        .eq('is_finished', false)
        .order('created_at', { ascending: false });

      if (!reloadError) {
        setActiveChallenges(updatedChallenges || []);
      }

    } catch (error) {
      console.error('Error finalizing challenge:', error);
      toast({
        title: "Erro",
        description: "Falha ao finalizar desafio",
        variant: "destructive",
      });
    } finally {
      setFinalizingChallenge(null);
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4 max-w-6xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2 hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="text-center">
            <h1 className="font-bold text-xl text-primary">🎯 Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gerencie desafios e usuários</p>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <div className="container max-w-6xl mx-auto p-4 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white/50 border-primary/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{activeChallenges.length}</div>
              <p className="text-sm text-muted-foreground">Desafios Ativos</p>
            </CardContent>
          </Card>
          <Card className="bg-white/50 border-accent/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">
                {activeChallenges.reduce((sum, c) => sum + (c.challenge_enrollments?.[0]?.count || 0), 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Participantes</p>
            </CardContent>
          </Card>
          <Card className="bg-white/50 border-secondary/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-secondary">0</div>
              <p className="text-sm text-muted-foreground">Usuários Ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Challenges Management */}
        <Card className="bg-white/70 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              Gerenciar Desafios Ativos
            </CardTitle>
            <CardDescription className="text-base">
              Visualize e finalize desafios em andamento com controle total sobre recompensas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChallenges ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : activeChallenges.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum desafio ativo encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {activeChallenges.map((challenge) => (
                  <div key={challenge.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{challenge.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {challenge.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {challenge.challenge_enrollments?.[0]?.count || 0} participantes
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Termina em: {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      <Badge variant={challenge.is_active ? "default" : "secondary"}>
                        {challenge.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id={`rewards-${challenge.id}`}
                            defaultChecked={true}
                          />
                          <Label htmlFor={`rewards-${challenge.id}`} className="text-sm">
                            Distribuir recompensas baseadas no ranking atual
                          </Label>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => {
                          const giveRewards = (document.getElementById(`rewards-${challenge.id}`) as HTMLInputElement)?.checked ?? true;
                          handleFinalizeChallengeManually(challenge.id, giveRewards);
                        }}
                        disabled={finalizingChallenge === challenge.id}
                        variant="destructive"
                        size="sm"
                      >
                        {finalizingChallenge === challenge.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Finalizando...
                          </>
                        ) : (
                          'Finalizar Desafio'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Challenge Creation Form */}
        <Card className="bg-white/70 border-accent/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-accent/10 to-primary/10">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="h-10 w-10 bg-accent/20 rounded-full flex items-center justify-center">
                <Plus className="h-5 w-5 text-accent" />
              </div>
              Criar Novo Desafio
            </CardTitle>
            <CardDescription className="text-base">
              Configure um novo desafio fitness completo com tarefas e recompensas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={challengeData.title}
                    onChange={(e) => setChallengeData({...challengeData, title: e.target.value})}
                    placeholder="Ex: Desafio 30 dias"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Dificuldade</Label>
                  <select
                    id="difficulty"
                    value={challengeData.difficulty_level}
                    onChange={(e) => setChallengeData({...challengeData, difficulty_level: e.target.value})}
                    className="w-full p-2 border border-input rounded-md bg-background"
                  >
                    <option value="iniciante">Iniciante</option>
                    <option value="intermediário">Intermediário</option>
                    <option value="avançado">Avançado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={challengeData.description}
                  onChange={(e) => setChallengeData({...challengeData, description: e.target.value})}
                  placeholder="Descreva os objetivos e benefícios do desafio"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={challengeData.start_date}
                    onChange={(e) => setChallengeData({...challengeData, start_date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Fim *</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={challengeData.end_date}
                    onChange={(e) => setChallengeData({...challengeData, end_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Máximo de Participantes</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    value={challengeData.max_participants}
                    onChange={(e) => setChallengeData({...challengeData, max_participants: e.target.value})}
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_calories">Calorias Diárias</Label>
                  <Input
                    id="daily_calories"
                    type="number"
                    value={challengeData.daily_calories}
                    onChange={(e) => setChallengeData({...challengeData, daily_calories: e.target.value})}
                    placeholder="Ex: 300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_time">Tempo Diário (minutos)</Label>
                  <Input
                    id="daily_time"
                    type="number"
                    value={challengeData.daily_time_minutes}
                    onChange={(e) => setChallengeData({...challengeData, daily_time_minutes: e.target.value})}
                    placeholder="Ex: 45"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tarefas do Desafio</h3>
                {challengeItems.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Tarefa {index + 1}</h4>
                        {challengeItems.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeChallengeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Título da Tarefa</Label>
                          <Input
                            value={item.title}
                            onChange={(e) => updateChallengeItem(index, 'title', e.target.value)}
                            placeholder="Ex: 20 flexões"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>XP da Tarefa</Label>
                          <Input
                            type="number"
                            value={item.xp_points}
                            onChange={(e) => updateChallengeItem(index, 'xp_points', parseInt(e.target.value) || 10)}
                            min="1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                          value={item.description}
                          onChange={(e) => updateChallengeItem(index, 'description', e.target.value)}
                          placeholder="Instruções detalhadas da tarefa"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Horário de Desbloqueio</Label>
                          <Input
                            type="time"
                            value={item.unlock_time}
                            onChange={(e) => updateChallengeItem(index, 'unlock_time', e.target.value)}
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`requires_photo_${index}`}
                            checked={item.requires_photo}
                            onChange={(e) => updateChallengeItem(index, 'requires_photo', e.target.checked)}
                          />
                          <Label htmlFor={`requires_photo_${index}`}>Requer foto</Label>
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
                                const newDays = item.unlock_days.includes(day.value)
                                  ? item.unlock_days.filter(d => d !== day.value)
                                  : [...item.unlock_days, day.value];
                                updateChallengeItem(index, 'unlock_days', newDays);
                              }}
                            >
                              {day.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addChallengeItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Tarefa
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Foto de Capa</h3>
                {coverImagePreview && (
                  <div className="relative w-full h-48">
                    <img
                      src={coverImagePreview}
                      alt="Preview da capa"
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageSelect}
                    className="hidden"
                    id="cover-image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('cover-image-upload')?.click()}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {coverImagePreview ? 'Alterar Foto de Capa' : 'Escolher Foto de Capa'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Se não escolher uma foto, será usada uma imagem padrão automaticamente.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando Desafio...
                  </>
                ) : (
                  'Criar Desafio'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <BottomNav currentPage="admin" onNavigate={(path) => navigate(path)} />
    </div>
  );
}