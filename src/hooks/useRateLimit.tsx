import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  action: string;
}

export function useRateLimit({ maxAttempts = 5, windowMs = 3600000, action }: RateLimitConfig) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);

  const checkRateLimit = (): boolean => {
    if (!user) return false;

    const key = `${user.id}-${action}`;
    const now = Date.now();
    
    // Get stored attempts from localStorage
    const stored = localStorage.getItem(key);
    let attempts: number[] = stored ? JSON.parse(stored) : [];
    
    // Remove old attempts outside the time window
    attempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (attempts.length >= maxAttempts) {
      if (!isBlocked) {
        setIsBlocked(true);
        toast({
          title: "Limite atingido",
          description: `Você atingiu o limite de ${maxAttempts} tentativas. Tente novamente em 1 hora.`,
          variant: "destructive",
        });
        
        // Auto-unblock after window period
        setTimeout(() => {
          setIsBlocked(false);
        }, windowMs);
      }
      return false;
    }
    
    // Add current attempt
    attempts.push(now);
    localStorage.setItem(key, JSON.stringify(attempts));
    
    return true;
  };

  return { checkRateLimit, isBlocked };
}