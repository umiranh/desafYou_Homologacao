import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeHtml } from '@/utils/inputSanitizer';
import { logSecurityEvent, SECURITY_EVENTS } from '@/utils/securityAudit';
import { Heart, MessageCircle, Camera, Send, Trophy, Loader2, Users, ArrowLeft } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  user_id: string;
  challenge_id: string;
  created_at: string;
  profiles: {
    display_name?: string;
    level: number;
    avatar_url?: string;
  };
  challenges: {
    title: string;
  };
  post_likes: { user_id: string }[];
  post_comments: {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    profiles: {
      display_name?: string;
      avatar_url?: string;
    };
  }[];
}

interface Challenge {
  id: string;
  title: string;
  description: string;
}

export default function Community() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  // Rate limiting state
  const [rateLimitState, setRateLimitState] = useState<{ [key: string]: number[] }>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string>('');
  const [newPost, setNewPost] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [currentChallengeInfo, setCurrentChallengeInfo] = useState<Challenge | null>(null);

  // Check if we should filter by specific challenge from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const challengeId = urlParams.get('challenge');
    if (challengeId) {
      setSelectedChallenge(challengeId);
    }
  }, []);

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
        const { data, error } = await supabase
          .from('challenge_enrollments')
          .select(`
            challenges (
              id,
              title,
              description
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        const userChallenges = data
          .filter(enrollment => enrollment.challenges)
          .map(enrollment => enrollment.challenges);

        setChallenges(userChallenges);
        
        // Set first challenge as default if none selected or set current challenge info
        if (userChallenges.length > 0) {
          if (!selectedChallenge) {
            setSelectedChallenge(userChallenges[0].id);
            setCurrentChallengeInfo(userChallenges[0]);
          } else {
            const currentChallenge = userChallenges.find(c => c.id === selectedChallenge);
            if (currentChallenge) {
              setCurrentChallengeInfo(currentChallenge);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };

    fetchChallenges();
  }, [user, selectedChallenge]);

  // Fetch posts for the selected challenge
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user || !selectedChallenge) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      try {
        setLoadingPosts(true);
        
        let query = supabase
          .from('community_posts')
          .select(`
            *,
            challenges (
              title
            ),
            post_likes (
              user_id
            ),
            post_comments (
              id,
              content,
              user_id,
              created_at
            )
          `)
          .eq('challenge_id', selectedChallenge)
          .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        
        // Get user profiles separately to avoid relationship issues
        const userIds = [...new Set([
          ...data?.map(post => post.user_id) || [],
          ...data?.flatMap(post => post.post_comments?.map(comment => comment.user_id) || []) || []
        ])];
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, level, avatar_url')
          .in('user_id', userIds);
        
        const profilesMap = new Map(profilesData?.map(profile => [profile.user_id, profile]) || []);
        
        // Format data with profile information
        const formattedPosts = data?.map(post => {
          const userProfile = profilesMap.get(post.user_id);
          
          return {
            ...post,
            profiles: {
              display_name: userProfile?.display_name || 'Usuário',
              level: userProfile?.level || 1,
              avatar_url: userProfile?.avatar_url
            },
            post_comments: (post.post_comments || []).map((comment: any) => {
              const commentProfile = profilesMap.get(comment.user_id);
              return {
                ...comment,
                profiles: {
                  display_name: commentProfile?.display_name || 'Usuário',
                  avatar_url: commentProfile?.avatar_url
                }
              };
            })
          };
        }) || [];
        
        setPosts(formattedPosts);
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast({
          title: "Erro ao carregar posts",
          description: "Ocorreu um erro inesperado",
          variant: "destructive",
        });
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [selectedChallenge, toast, user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size and type
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas imagens JPEG, PNG, GIF e WebP são permitidas",
          variant: "destructive",
        });
        return;
      }
      
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
      .from('post-images')
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createPost = async () => {
    if (!user || !newPost.trim()) return;
    if (!selectedChallenge || challenges.length === 0) {
      toast({
        title: "Selecione um desafio",
        description: "Você precisa estar inscrito e selecionar um desafio para postar",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting - 5 posts per minute
    const rateLimitKey = `${user.id}-post_creation`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 5;
    
    const attempts = rateLimitState[rateLimitKey] || [];
    const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      toast({
        title: "Muitos posts",
        description: "Aguarde um momento antes de postar novamente",
        variant: "destructive",
      });
      return;
    }
    
    // Update rate limit state
    setRateLimitState(prev => ({
      ...prev,
      [rateLimitKey]: [...recentAttempts, now]
    }));

    setIsPosting(true);

    try {
      // Sanitize input
      const sanitizedContent = sanitizeHtml(newPost.trim());
      
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          content: sanitizedContent,
          image_url: imageUrl || null,
          user_id: user.id,
          challenge_id: selectedChallenge,
        });

      if (error) throw error;

      // Log security event
      await logSecurityEvent({
        event_type: 'post_created',
        target_user_id: user.id,
        event_data: {
          challenge_id: selectedChallenge,
          has_image: !!imageUrl
        }
      });

      toast({
        title: "Post criado!",
        description: "Seu post foi compartilhado com sucesso",
      });

      // Reset form
      setNewPost('');
      setSelectedImage(null);
      setImagePreview('');

      // Update posts locally without page reload
      const { data: newPostData } = await supabase
        .from('community_posts')
        .select(`
          *,
          challenges (
            title
          ),
          post_likes (
            user_id
          ),
          post_comments (
            id,
            content,
            user_id,
            created_at
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1);

      if (newPostData && newPostData[0]) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, display_name, level, avatar_url')
          .eq('user_id', user.id)
          .single();

        const newPost = {
          ...newPostData[0],
          profiles: {
            display_name: profileData?.display_name || 'Usuário',
            level: profileData?.level || 1,
            avatar_url: profileData?.avatar_url
          },
          post_comments: []
        };

        setPosts(prev => [newPost, ...prev]);
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: "Erro ao criar post",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    const isLiked = post?.post_likes.some(like => like.user_id === user.id);

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          if (isLiked) {
            return {
              ...post,
              post_likes: post.post_likes.filter(like => like.user_id !== user.id)
            };
          } else {
            return {
              ...post,
              post_likes: [...post.post_likes, { user_id: user.id }]
            };
          }
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (challenges.length === 0) {
    return (
      <div className="min-h-screen pb-20 bg-gradient-to-br from-secondary/10 via-background to-secondary/5">
        <div className="text-center py-20">
          <div className="bg-background/90 rounded-3xl p-12 border border-primary/20 max-w-md mx-auto">
            <div className="text-8xl mb-6">🏆</div>
            <h3 className="text-2xl font-bold text-primary mb-4">Participe de um desafio</h3>
            <p className="text-muted-foreground mb-6 text-lg">
              Você precisa estar inscrito em um desafio para acessar sua comunidade.
            </p>
            <Button
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg"
              onClick={() => navigate('/dashboard')}
            >
              🚀 Explorar Desafios
            </Button>
          </div>
        </div>
        <BottomNav currentPage="community" onNavigate={(page) => navigate(`/${page}`)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-secondary/10 via-background to-secondary/5">
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 max-w-md">
          {/* Compact Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/challenges')}
                className="p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  {currentChallengeInfo ? currentChallengeInfo.title : 'Comunidade'}
                </h1>
                {currentChallengeInfo && (
                  <p className="text-xs text-muted-foreground">Comunidade do desafio</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Challenge Selector */}
          {challenges.length > 1 && (
            <div className="flex gap-1 mb-3 bg-muted rounded-full p-1 overflow-x-auto">
              {challenges.map((challenge) => (
                <Button 
                  key={challenge.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChallenge(challenge.id)}
                  className={`rounded-full flex-shrink-0 text-xs py-1 px-3 ${
                    selectedChallenge === challenge.id 
                      ? 'bg-foreground text-background hover:bg-foreground/90' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {challenge.title}
                </Button>
              ))}
            </div>
          )}

          {/* New post form */}
          {selectedChallenge && (
            <Card className="bg-background border-0 shadow-sm rounded-xl mb-3">
              <CardContent className="p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                    <Trophy className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Compartilhe sua evolução..."
                      className="w-full p-2 rounded-lg bg-muted border-0 resize-none placeholder:text-muted-foreground text-sm"
                      rows={2}
                    />
                  </div>
                </div>
                
                {imagePreview && (
                  <div className="mb-3 relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover rounded-lg" />
                    <Button
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview('');
                      }}
                      className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full bg-background/80 hover:bg-background text-foreground"
                    >
                      ×
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Camera className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  </label>
                  <Button
                    onClick={createPost}
                    disabled={isPosting || (!newPost.trim() && !selectedImage) || !selectedChallenge}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white px-4 py-2 rounded-full text-sm font-medium"
                  >
                    {isPosting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        Postar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-md">
        {/* Posts */}
        {loadingPosts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum post ainda</h3>
            <p className="text-muted-foreground mb-4">
              Seja o primeiro a compartilhar sua evolução neste desafio!
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const isLiked = post.post_likes.some(like => like.user_id === user.id);
            const likesCount = post.post_likes.length;
            
            return (
              <Card key={post.id} className="bg-background border-0 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-bold text-sm">
                        {post.profiles.display_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {post.profiles.display_name}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="h-3 w-3" />
                          <span>Nv. {post.profiles.level}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-foreground mb-3">{post.content}</p>

                  {post.image_url && (
                    <div className="mb-3 rounded-xl overflow-hidden">
                      <img
                        src={post.image_url}
                        alt="Post"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-2 border-t border-muted">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1 h-8 px-2 rounded-full ${
                        isLiked ? 'text-red-500' : 'text-muted-foreground'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                      <span className="text-xs">{likesCount}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 h-8 px-2 rounded-full text-muted-foreground"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-xs">{post.post_comments.length}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <BottomNav currentPage="community" onNavigate={(page) => navigate(`/${page}`)} />
    </div>
  );
}