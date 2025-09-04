import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Zap, Users, Timer, Flame } from 'lucide-react';
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

interface ChallengeDetailModalProps {
  challenge: Challenge;
  onClose: () => void;
  onEnroll: () => void;
  isEnrolling: boolean;
}

export function ChallengeDetailModal({ challenge, onClose, onEnroll, isEnrolling }: ChallengeDetailModalProps) {
  const defaultImages = [fitnessChallenge1, fitnessChallenge2, fitnessChallenge3];
  const imageIndex = parseInt(challenge.id) % defaultImages.length;
  
  const getDuration = () => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const mockParticipants = [
    { id: 1, avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&h=100&fit=crop&crop=face" },
    { id: 2, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
    { id: 3, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
    { id: 4, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto p-0 bg-gradient-to-br from-secondary/20 via-background to-secondary/30 border-none overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-12 w-12 rounded-full bg-white/20 backdrop-blur hover:bg-white/30"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full">
              <div className="h-6 w-6 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">+</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-12 w-12 rounded-full bg-white/20 backdrop-blur hover:bg-white/30"
            >
              Mais
            </Button>
          </div>

          {/* Challenge Image */}
          <div className="px-4 mb-4">
            <div className="aspect-video relative overflow-hidden rounded-2xl">
              <img
                src={challenge.image_url || defaultImages[imageIndex]}
                alt={challenge.title}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = defaultImages[imageIndex];
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          </div>

          {/* Challenge Info */}
          <div className="px-4 space-y-4">
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {challenge.title}
            </h1>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {challenge.description}
            </p>

            {/* Stats */}
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-full flex-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">{getDuration()} dias</span>
              </div>
              <div className="flex items-center gap-2 bg-card/50 px-4 py-2 rounded-full flex-1">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">14.400 kcal</span>
              </div>
            </div>

            {/* Community Section */}
            <div className="bg-card/50 backdrop-blur rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Estão com você</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-4"
                >
                  Ver comunidade
                </Button>
              </div>

              {/* Participants Avatars */}
              <div className="flex -space-x-2">
                {mockParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="h-10 w-10 rounded-full border-2 border-background overflow-hidden"
                  >
                    <img
                      src={participant.avatar}
                      alt="Participant"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&h=100&fit=crop&crop=face`;
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Stats Row */}
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-foreground/10 rounded-full flex items-center justify-center">
                    <Timer className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">1h30min</p>
                    <p className="text-xs text-muted-foreground">Diários</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Flame className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">680 kcal</p>
                    <p className="text-xs text-muted-foreground">Calorias</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Participate Button */}
            <div className="pb-6">
              <Button 
                className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-2xl py-4 text-lg font-medium"
                disabled={challenge.user_enrolled || isEnrolling || (challenge.max_participants && challenge.participants_count! >= challenge.max_participants)}
                onClick={onEnroll}
              >
                {isEnrolling ? (
                  'Inscrevendo...'
                ) : challenge.user_enrolled ? (
                  'Já Inscrito'
                ) : challenge.max_participants && challenge.participants_count! >= challenge.max_participants ? (
                  'Vagas Esgotadas'
                ) : (
                  'Participar'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}