import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Star, Coins, Medal, Edit3, Save, X, Loader2, Camera } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
  coins: number;
  is_admin: boolean;
}

interface Achievement {
  challenge_title: string;
  position: number;
  coins_earned: number;
  completed_at: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        setLoadingProfile(true);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          return;
        }

        if (data) {
          setProfile(data);
          setEditForm({
            display_name: data.display_name || '',
            bio: data.bio || '',
          });
        }

        // Fetch achievements (completed challenges with rankings)
        const { data: achievementsData } = await supabase
          .from('challenge_rankings')
          .select(`
            position,
            coins_earned,
            created_at,
            challenges (
              title
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (achievementsData) {
          const formattedAchievements = achievementsData.map(achievement => ({
            challenge_title: achievement.challenges?.title || 'Desafio',
            position: achievement.position,
            coins_earned: achievement.coins_earned,
            completed_at: achievement.created_at,
          }));
          
          setAchievements(formattedAchievements);
        }

      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user]);

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

  const uploadAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}-avatar.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const saveProfile = async () => {
    if (!user || !profile) return;

    setIsSaving(true);

    try {
      let avatarUrl = profile.avatar_url;
      
      if (selectedImage) {
        avatarUrl = await uploadAvatar(selectedImage);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name.trim() || null,
          bio: editForm.bio.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        display_name: editForm.display_name.trim() || undefined,
        bio: editForm.bio.trim() || undefined,
        avatar_url: avatarUrl,
      } : null);

      setIsEditing(false);
      setSelectedImage(null);
      setImagePreview('');

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso",
      });

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao salvar perfil",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
    });
    setSelectedImage(null);
    setImagePreview('');
  };

  const getNextLevelXP = (level: number) => {
    return level * 1000; // Simple formula: each level requires 1000 XP per level
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1: return 'text-yellow-600 bg-yellow-50';
      case 2: return 'text-gray-600 bg-gray-50';
      case 3: return 'text-amber-600 bg-amber-50';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${position}`;
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const nextLevelXP = getNextLevelXP(profile.level);
  const xpProgress = profile.total_xp % 1000;
  const progressPercentage = (xpProgress / 1000) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-secondary/50 pb-20">
      <header className="bg-background/95 backdrop-blur sticky top-0 z-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Perfil</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Informações do Perfil</CardTitle>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveProfile}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-lg">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="rounded-full object-cover" />
                    ) : profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="rounded-full object-cover" />
                    ) : (
                      profile.display_name?.charAt(0) || user.email?.charAt(0) || 'U'
                    )}
                  </AvatarFallback>
                </Avatar>
                
                {isEditing && (
                  <div className="absolute -bottom-2 -right-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label htmlFor="avatar-upload">
                      <Button variant="secondary" size="sm" asChild>
                        <span className="cursor-pointer">
                          <Camera className="h-3 w-3" />
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Nome de exibição"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold">
                      {profile.display_name || user.email}
                    </h2>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                  </div>
                )}
                
                <div className="flex items-center space-x-4 mt-2">
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    Nível {profile.level}
                  </Badge>
                  {profile.is_admin && (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                </div>
              </div>
            </div>
            
            {isEditing ? (
              <Textarea
                placeholder="Conte um pouco sobre você..."
                value={editForm.bio}
                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                rows={3}
              />
            ) : (
              profile.bio && (
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              )
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XP Total</p>
                  <p className="text-xl font-bold">{profile.total_xp}</p>
                </div>
              </div>
              
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Próximo nível</span>
                  <span>{xpProgress} / 1000 XP</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <Coins className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Moedas</p>
                  <p className="text-xl font-bold text-yellow-600">{profile.coins}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/10 rounded-full">
                  <Medal className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conquistas</p>
                  <p className="text-xl font-bold">{achievements.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Conquistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievements.map((achievement, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`px-2 py-1 rounded-full text-xs font-bold ${getPositionColor(achievement.position)}`}>
                        {getPositionIcon(achievement.position)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{achievement.challenge_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(achievement.completed_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-yellow-600">
                        +{achievement.coins_earned} moedas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coming Soon - Shop */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Loja de Recompensas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              Em breve! Use suas moedas para trocar por recompensas reais.
            </p>
          </CardContent>
        </Card>
      </div>

      <BottomNav currentPage="profile" onNavigate={navigate} />
    </div>
  );
}