import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Camera, Send, Trophy, Loader2 } from 'lucide-react';

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

    setIsPosting(true);

    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          content: newPost.trim(),
          image_url: imageUrl || null,
          user_id: user.id,
          challenge_id: selectedChallenge,
        });

      if (error) throw error;

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
    <div className="min-h-screen pb-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50 border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 max-w-4xl">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-primary mb-1">💬 Comunidade</h1>
            <p className="text-sm text-muted-foreground">Compartilhe seu progresso</p>
          </div>
          
          {/* Challenge filter */}
          <div className="space-y-3">
            <select
              value={selectedChallenge}
              onChange={(e) => setSelectedChallenge(e.target.value)}
              className="w-full p-2.5 rounded-xl border-0 bg-white/60 backdrop-blur-sm shadow-sm text-primary font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm"
            >
              {challenges.length > 0 ? (
                <>
                  <option value="all">🏆 Todos os Meus Desafios</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.title}
                    </option>
                  ))}
                </>
              ) : (
                <option value="all">📝 Inscreva-se em um desafio primeiro</option>
              )}
            </select>

            {/* New post form */}
            <Card className="bg-background/90 backdrop-blur-sm border border-primary/20 shadow-lg">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Textarea
                    placeholder="💪 Compartilhe seu progresso e inspire outros..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    rows={2}
                    className="border-primary/20 bg-background rounded-xl resize-none focus:ring-2 focus:ring-primary/20 text-sm"
                  />
                  
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-48 rounded-md object-cover"
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
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload">
                        <Button variant="outline" size="sm" asChild className="rounded-full border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs px-3 py-1.5">
                          <span className="cursor-pointer">
                            <Camera className="h-3 w-3 mr-1" />
                            📸 Foto
                          </span>
                        </Button>
                      </label>
                    </div>
                    
                     <Button
                      onClick={createPost}
                      disabled={!newPost.trim() || isPosting || selectedChallenge === 'all' || challenges.length === 0}
                      className="gap-2 rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium px-6 py-2 shadow-lg text-sm"
                    >
                      {isPosting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Compartilhar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-4xl">
        {loadingPosts ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando posts da comunidade...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-background/90 rounded-3xl p-8 border border-primary/20">
              <div className="text-6xl mb-4">💭</div>
              <h3 className="text-xl font-semibold text-primary mb-2">Nenhum post ainda</h3>
              <p className="text-muted-foreground">
                Seja o primeiro a compartilhar seu progresso e inspirar outros!
              </p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="bg-background/90 backdrop-blur-sm border border-primary/10 shadow-xl rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="border-2 border-white/50">
                      {post.profiles?.avatar_url ? (
                        <img 
                          src={post.profiles.avatar_url} 
                          alt={post.profiles?.display_name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-bold">
                          {post.profiles?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-sm text-primary">
                          {post.profiles?.display_name || 'Usuário'}
                        </p>
                        <Badge variant="outline" className="text-xs border-primary/20 bg-primary/10">
                          <Trophy className="h-3 w-3 mr-1" />
                          Nível {post.profiles?.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {post.challenges?.title} • {formatDate(post.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <p className="text-sm">{post.content}</p>
                  
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="rounded-md max-h-64 object-cover w-full"
                    />
                  )}
                  
                  <div className="flex items-center space-x-4 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(post.id)}
                      className={`gap-2 ${
                        post.post_likes.some(like => like.user_id === user.id)
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Heart 
                        className={`h-4 w-4 ${
                          post.post_likes.some(like => like.user_id === user.id)
                            ? 'fill-current'
                            : ''
                        }`}
                      />
                      {post.post_likes.length}
                    </Button>
                    
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      {post.post_comments.length}
                    </Button>
                  </div>
                  
                  {/* Comments */}
                  {post.post_comments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      {post.post_comments.slice(0, 2).map((comment) => (
                        <div key={comment.id} className="flex space-x-2">
                          <Avatar className="h-6 w-6">
                            {comment.profiles?.avatar_url ? (
                              <img 
                                src={comment.profiles.avatar_url} 
                                alt={comment.profiles?.display_name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <AvatarFallback className="text-xs">
                                {comment.profiles?.display_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-xs">
                              <span className="font-medium">
                                {comment.profiles?.display_name || 'Usuário'}
                              </span>
                              {' '}
                              {comment.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(comment.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {post.post_comments.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{post.post_comments.length - 2} comentários
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav currentPage="community" onNavigate={(path) => navigate(path)} />
    </div>
  );
}