import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Flame, Users, Clock, Zap } from "lucide-react";
import fitnessImage1 from "@/assets/fitness-challenge-1.jpg";
import fitnessImage2 from "@/assets/fitness-challenge-2.jpg";
import fitnessImage3 from "@/assets/fitness-challenge-3.jpg";

const challenges = [
  {
    id: 1,
    title: "30 Dias de Energia e Foco",
    instructor: "Maria Fernanda", 
    participants: 3705,
    image: fitnessImage1,
    difficulty: "Intermediário",
    rating: 5,
    calories: 14400,
    duration: "30 dias"
  },
  {
    id: 2,
    title: "Desafio Movimento e Saúde",
    instructor: "Jorge Augusto",
    participants: 2670,
    image: fitnessImage2,
    difficulty: "Intermediário", 
    rating: 4,
    calories: 12000,
    duration: "21 dias"
  },
  {
    id: 3,
    title: "Missão Corpo em Forma",
    instructor: "Malena Figo",
    participants: 1890,
    image: fitnessImage3,
    difficulty: "Avançado",
    rating: 4,
    calories: 18000,
    duration: "45 dias"
  }
];

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedLevel, setSelectedLevel] = useState('Intermediário');

  const levels = ['Iniciante', 'Intermediário', 'Avançado'];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-xs ${i < rating ? 'text-accent' : 'text-muted-foreground'}`}>
        ★
      </span>
    ));
  };

  if (currentPage !== 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-secondary/50 pb-20">
        <div className="p-4 text-center pt-16">
          <h1 className="text-2xl font-bold">
            {currentPage === 'community' && 'Comunidade'}
            {currentPage === 'challenges' && 'Meus Desafios'}
            {currentPage === 'profile' && 'Meu Perfil'}
          </h1>
          <p className="text-muted-foreground mt-2">Em desenvolvimento</p>
        </div>
        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-secondary/50 pb-20">
      {/* Header */}
      <div className="p-4 pt-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              Escolha<br />seu desafio!
            </h1>
          </div>
          <Avatar className="h-14 w-14 border-2 border-accent/20">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
              U
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Level Selection */}
        <div className="flex bg-secondary/70 rounded-full p-1 mb-6">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`flex-1 px-4 py-3 text-sm font-medium rounded-full transition-all ${
                selectedLevel === level
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Trending Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-accent" />
            <h2 className="font-bold text-lg">Em alta</h2>
          </div>

          <div className="space-y-4">
            {challenges.map((challenge) => (
              <Card key={challenge.id} className="bg-card/95 backdrop-blur-sm border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    <img 
                      src={challenge.image}
                      alt={challenge.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-accent text-accent-foreground">
                        {challenge.difficulty}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1">{challenge.title}</h3>
                    <p className="text-muted-foreground text-sm mb-2">{challenge.instructor}</p>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex">{renderStars(challenge.rating)}</div>
                      <div className="flex items-center text-muted-foreground text-sm">
                        <Users className="h-4 w-4 mr-1" />
                        {challenge.participants}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {challenge.duration}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-4 w-4" />
                          {challenge.calories} kcal
                        </div>
                      </div>
                    </div>

                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                      Participar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}