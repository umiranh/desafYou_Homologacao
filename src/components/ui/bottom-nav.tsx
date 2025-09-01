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
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around px-2 py-3 max-w-lg mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors",
              currentPage === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-full transition-colors",
              currentPage === item.id && "bg-primary text-primary-foreground"
            )}>
              <item.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};