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
      try {
        setLoadingPosts(true);
        
        let query = supabase
          .from('community_posts')
          .select(`
            *,
            profiles!community_posts_user_id_fkey (
              display_name,
              level
            ),
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
              created_at,
              profiles!post_comments_user_id_fkey (
                display_name
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (selectedChallenge !== 'all') {
          query = query.eq('challenge_id', selectedChallenge);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // Format data to handle type issues
        const formattedPosts = data?.map(post => {
          const profiles = post.profiles && typeof post.profiles === 'object' && post.profiles !== null 
            ? post.profiles as any
            : null;
          
          return {
            ...post,
            profiles: profiles && 'display_name' in profiles
              ? {
                  display_name: profiles.display_name || 'Usuário',
                  level: profiles.level || 1
                }
              : {
                  display_name: 'Usuário',
                  level: 1
                },
            post_comments: (post.post_comments || []).map((comment: any) => ({
              ...comment,
              profiles: comment.profiles && typeof comment.profiles === 'object' && 'display_name' in comment.profiles
                ? { display_name: comment.profiles.display_name || 'Usuário' }
                : { display_name: 'Usuário' }
            }))
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
  }, [selectedChallenge, toast]);

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
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}-${Date.now()}.${fileExt}`;
    const filePath = `post-images/${fileName}`;

    const { error } = await supabase.storage
      .from('post-images')
      .upload(filePath, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createPost = async () => {
    if (!user || !newPost.trim()) return;
    if (selectedChallenge === 'all') {
      toast({
        title: "Selecione um desafio",
        description: "Você precisa selecionar um desafio para postar",
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

      // Refresh posts
      const { data, error: fetchError } = await supabase
        .from('community_posts')
        .select(`
          *,
          profiles!community_posts_user_id_fkey (
            display_name,
            level
          ),
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
            created_at,
            profiles!post_comments_user_id_fkey (
              display_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (!fetchError && data) {
        // Format data to handle type issues  
        const formattedPosts = data.map(post => {
          const profiles = post.profiles && typeof post.profiles === 'object' && post.profiles !== null 
            ? post.profiles as any
            : null;
          
          return {
            ...post,
            profiles: profiles && 'display_name' in profiles
              ? {
                  display_name: profiles.display_name || 'Usuário',
                  level: profiles.level || 1
                }
              : {
                  display_name: 'Usuário',
                  level: 1
                },
            post_comments: (post.post_comments || []).map((comment: any) => ({
              ...comment,
              profiles: comment.profiles && typeof comment.profiles === 'object' && 'display_name' in comment.profiles
                ? { display_name: comment.profiles.display_name || 'Usuário' }
                : { display_name: 'Usuário' }
            }))
          };
        });
        
        setPosts(formattedPosts);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-secondary/50 pb-20">
      <header className="bg-background/95 backdrop-blur sticky top-0 z-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-primary mb-4">Comunidade</h1>
          
          {/* Challenge filter */}
          <div className="space-y-4">
            <select
              value={selectedChallenge}
              onChange={(e) => setSelectedChallenge(e.target.value)}
              className="w-full p-2 rounded-md border bg-background"
            >
              <option value="all">Todos os Desafios</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.title}
                </option>
              ))}
            </select>

            {/* New post form */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <Textarea
                    placeholder="Compartilhe seu progresso..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    rows={3}
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
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload">
                        <Button variant="outline" size="sm" asChild>
                          <span className="cursor-pointer">
                            <Camera className="h-4 w-4 mr-2" />
                            Foto
                          </span>
                        </Button>
                      </label>
                    </div>
                    
                    <Button
                      onClick={createPost}
                      disabled={!newPost.trim() || isPosting || selectedChallenge === 'all'}
                      className="gap-2"
                    >
                      {isPosting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Postar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {loadingPosts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum post encontrado. Seja o primeiro a compartilhar!
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        {post.profiles?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-sm">
                          {post.profiles?.display_name || 'Usuário'}
                        </p>
                        <Badge variant="outline" className="text-xs">
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
                            <AvatarFallback className="text-xs">
                              {comment.profiles?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
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