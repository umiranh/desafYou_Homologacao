import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CommunityPreviewProps {
  challengeId: string;
  onViewCommunity: () => void;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name?: string;
  };
}

export default function CommunityPreview({ challengeId, onViewCommunity }: CommunityPreviewProps) {
  const { user } = useAuth();
  const [latestPost, setLatestPost] = useState<Post | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    const fetchCommunityData = async () => {
      if (!user) return;

      try {
        // Get latest post
        const { data: postsData } = await supabase
          .from('community_posts')
          .select(`
            id,
            content,
            created_at,
            user_id
          `)
          .eq('challenge_id', challengeId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (postsData && postsData[0]) {
          // Get user profile for the post
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', postsData[0].user_id)
            .single();

          setLatestPost({
            ...postsData[0],
            profiles: {
              display_name: profileData?.display_name || 'Usuário'
            }
          });
        }

        // Get participant count
        const { count } = await supabase
          .from('challenge_enrollments')
          .select('*', { count: 'exact' })
          .eq('challenge_id', challengeId);

        setParticipantCount(count || 0);
      } catch (error) {
        console.error('Error fetching community data:', error);
      }
    };

    fetchCommunityData();
  }, [challengeId, user]);

  return (
    <div className="space-y-2">
      {latestPost ? (
        <Card className="bg-muted/30 border-0 p-3">
          <div className="flex items-start gap-2">
            <div className="h-6 w-6 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-xs">
                {latestPost.profiles.display_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium">{latestPost.profiles.display_name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(latestPost.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {latestPost.content}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-muted/30 border-0 p-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Seja o primeiro a compartilhar sua evolução!
            </p>
          </div>
        </Card>
      )}
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onViewCommunity}
        className="w-full h-8 text-xs rounded-full border-muted"
      >
        Ver comunidade ({participantCount} participantes)
      </Button>
    </div>
  );
}