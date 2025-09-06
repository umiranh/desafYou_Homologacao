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
import { Heart, MessageCircle, Camera, Send, Trophy, Loader2, Users } from 'lucide-react';

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
}

export default function Community() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  // Rate limiting state
  const [rateLimitState, setRateLimitState] = useState<{ [key: string]: number[] }>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string>('all');
  const [newPost, setNewPost] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

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
              title
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        const userChallenges = data
          .filter(enrollment => enrollment.challenges)
          .map(enrollment => enrollment.challenges);

        setChallenges(userChallenges);
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };

    fetchChallenges();
  }, [user]);

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user || challenges.length === 0) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      try {
        setLoadingPosts(true);
        
        // Get user's enrolled challenge IDs
        const userChallengeIds = challenges.map(c => c.id);
        
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
          .in('challenge_id', userChallengeIds)
          .order('created_at', { ascending: false });

        if (selectedChallenge !== 'all') {
          query = query.eq('challenge_id', selectedChallenge);
        }

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
  }, [selectedChallenge, toast, user, challenges]);

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
    if (selectedChallenge === 'all' || challenges.length === 0) {
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

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-br from-secondary/10 via-background to-secondary/5">
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-md">
          {/* Header with title and avatar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-foreground" />
              <h1 className="text-xl font-bold text-foreground">Comunidade</h1>
            </div>
            <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-4 bg-muted rounded-full p-1">
            <Button 
              variant="ghost"
              size="sm"
              className="rounded-full flex-1 text-sm py-2 bg-foreground text-background hover:bg-foreground/90"
            >
              Meu feed
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              className="rounded-full flex-1 text-sm py-2 text-muted-foreground hover:bg-muted"
            >
              Minhas comunidades
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              className="rounded-full flex-1 text-sm py-2 text-muted-foreground hover:bg-muted"
            >
              Todas
            </Button>
          </div>

          {/* New post form */}
          <Card className="bg-background border-0 shadow-sm rounded-2xl mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                  <Trophy className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="o que tem a dizer?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none text-sm text-muted-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              
              {imagePreview && (
                <div className="relative mb-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg object-cover w-full"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview('');
                    }}
                  >
                    ✕
                  </Button>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload">
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground text-xs px-3">
                      <span className="cursor-pointer flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-3 w-3" />
                        </div>
                        Público
                      </span>
                    </Button>
                  </label>
                </div>
                
                <Button
                  onClick={createPost}
                  disabled={!newPost.trim() || isPosting || selectedChallenge === 'all' || challenges.length === 0}
                  className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-6 py-1 h-8 text-sm font-medium"
                >
                  {isPosting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Publicar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-md">
        {loadingPosts ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando posts da comunidade...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  {challenges.length === 0 
                    ? "Inscreva-se em um desafio para ver posts da comunidade"
                    : "Ainda não há posts neste feed"}
                </p>
              </div>
            ) : (
              posts.map((post) => {
                const isLiked = post.post_likes.some(like => like.user_id === user.id);
                
                return (
                  <Card key={post.id} className="bg-background border-0 shadow-sm rounded-2xl overflow-hidden mb-4">
                    <CardContent className="p-0">
                      {/* Challenge Tag */}
                      <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Postado em {post.challenges.title}</span>
                          <button className="text-muted-foreground hover:text-primary">
                            Ver comunidade
                          </button>
                        </div>
                      </div>
                      
                      {/* Post Content */}
                      <div className="px-4 pb-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-10 w-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-foreground font-bold">
                              {post.profiles.display_name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-foreground text-sm">{post.profiles.display_name || 'Usuário'}</h3>
                              <span className="text-xs text-muted-foreground">#{post.profiles.level || 1}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Sorocaba/SP</p>
                          </div>
                        </div>

                        <p className="text-foreground text-sm mb-3 leading-relaxed">{post.content}</p>

                        {post.image_url && (
                          <div className="mb-3">
                            <img
                              src={post.image_url}
                              alt="Post image"
                              className="w-full rounded-lg object-cover max-h-64"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => toggleLike(post.id)}
                              className={`flex items-center gap-1 text-xs transition-colors ${
                                isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                              <span>{post.post_likes.length}</span>
                            </button>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageCircle className="h-4 w-4" />
                              <span>{post.post_comments.length}</span>
                            </div>
                          </div>
                          <button className="text-muted-foreground hover:text-primary">
                            <div className="h-4 w-4 rotate-90">
                              <Send className="h-4 w-4" />
                            </div>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      <BottomNav currentPage="community" onNavigate={(path) => navigate(path)} />
    </div>
  );
}