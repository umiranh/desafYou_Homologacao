import { Home, Users, CheckSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  currentPage: string;
  onNavigate: (path: string) => void;
}

export const BottomNav = ({ currentPage, onNavigate }: BottomNavProps) => {
  const navItems = [
    { id: 'dashboard', path: '/dashboard', icon: Home, label: 'Início' },
    { id: 'community', path: '/community', icon: Users, label: 'Comunidade' },
    { id: 'challenges', path: '/challenges', icon: CheckSquare, label: 'Desafios' },
    { id: 'profile', path: '/profile', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="bg-white/90 backdrop-blur-lg border-t border-white/20 shadow-2xl">
        <div className="flex items-center justify-around px-4 py-3 max-w-lg mx-auto">
          {navItems.map((item, index) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 transition-all duration-300 rounded-2xl min-w-[60px]",
                  isActive
                    ? "scale-105 bg-primary/10"
                    : "scale-100 hover:bg-white/50"
                )}
              >
                <div className={cn(
                  "p-3 rounded-2xl transition-all duration-300 shadow-sm",
                  isActive 
                    ? "bg-primary text-white shadow-lg scale-110" 
                    : "bg-white/70 text-primary/70 hover:bg-white hover:text-primary"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  isActive 
                    ? "text-primary font-semibold" 
                    : "text-primary/60"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};