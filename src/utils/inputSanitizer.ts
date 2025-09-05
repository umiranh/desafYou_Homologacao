// Input sanitization and validation utilities

export function sanitizeHtml(input: string): string {
  // Basic HTML sanitization - removes script tags and dangerous attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export function validateFileUpload(file: File): { isValid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (file.size > MAX_SIZE) {
    return { isValid: false, error: 'Arquivo muito grande. Máximo 5MB.' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { isValid: false, error: 'Tipo de arquivo não permitido. Use apenas imagens.' };
  }

  return { isValid: true };
}

export function validateTextInput(input: string, maxLength = 500): { isValid: boolean; error?: string } {
  if (input.length > maxLength) {
    return { isValid: false, error: `Texto muito longo. Máximo ${maxLength} caracteres.` };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onclick=/i,
    /onerror=/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return { isValid: false, error: 'Conteúdo não permitido detectado.' };
    }
  }

  return { isValid: true };
}

export function rateLimitCheck(userId: string, action: string, maxAttempts = 5, windowMs = 3600000): boolean {
  const key = `${userId}-${action}`;
  const now = Date.now();
  
  // Get stored attempts from localStorage (in production, use Redis or database)
  const stored = localStorage.getItem(key);
  let attempts: number[] = stored ? JSON.parse(stored) : [];
  
  // Remove old attempts outside the time window
  attempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  // Check if limit exceeded
  if (attempts.length >= maxAttempts) {
    return false;
  }
  
  // Add current attempt
  attempts.push(now);
  localStorage.setItem(key, JSON.stringify(attempts));
  
  return true;
}