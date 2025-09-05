import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const calculateStrength = (password: string) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    score = Object.values(checks).filter(Boolean).length;
    return { score, checks };
  };

  const { score, checks } = calculateStrength(password);
  
  const getStrengthText = () => {
    if (score === 0) return '';
    if (score <= 2) return 'Fraca';
    if (score <= 3) return 'Média';
    if (score <= 4) return 'Forte';
    return 'Muito Forte';
  };

  const getStrengthColor = () => {
    if (score <= 2) return 'bg-destructive';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1 flex-1 rounded-full",
              level <= score ? getStrengthColor() : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-sm">
        <span className={cn("font-medium", score <= 2 ? "text-destructive" : score <= 3 ? "text-yellow-600" : "text-green-600")}>
          {getStrengthText()}
        </span>
        <span className="text-muted-foreground">
          {score}/5 requisitos
        </span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className={cn("flex items-center gap-2", checks.length ? "text-green-600" : "text-muted-foreground")}>
          <span className="w-1 h-1 rounded-full bg-current" />
          Mínimo 8 caracteres
        </div>
        <div className={cn("flex items-center gap-2", checks.lowercase ? "text-green-600" : "text-muted-foreground")}>
          <span className="w-1 h-1 rounded-full bg-current" />
          Letra minúscula
        </div>
        <div className={cn("flex items-center gap-2", checks.uppercase ? "text-green-600" : "text-muted-foreground")}>
          <span className="w-1 h-1 rounded-full bg-current" />
          Letra maiúscula
        </div>
        <div className={cn("flex items-center gap-2", checks.numbers ? "text-green-600" : "text-muted-foreground")}>
          <span className="w-1 h-1 rounded-full bg-current" />
          Número
        </div>
        <div className={cn("flex items-center gap-2", checks.special ? "text-green-600" : "text-muted-foreground")}>
          <span className="w-1 h-1 rounded-full bg-current" />
          Caractere especial
        </div>
      </div>
    </div>
  );
}