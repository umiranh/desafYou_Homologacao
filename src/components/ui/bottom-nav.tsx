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
      <div className="flex items-center justify-around px-4 py-6 max-w-lg mx-auto">
        {navItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 transition-all duration-300",
              currentPage === item.id
                ? "scale-110"
                : "scale-100"
            )}
          >
            <div className={cn(
              "p-4 rounded-full transition-all duration-300 shadow-lg",
              currentPage === item.id 
                ? "bg-primary text-primary-foreground scale-110 shadow-xl" 
                : index === 0 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-white/80 backdrop-blur-sm text-foreground hover:bg-white/90"
            )}>
              <item.icon className="h-6 w-6" />
            </div>
            {currentPage !== item.id && (
              <span className="text-xs font-medium text-foreground/60">{item.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};