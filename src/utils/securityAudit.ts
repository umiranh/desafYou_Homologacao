import { supabase } from '@/integrations/supabase/client';

export interface SecurityEvent {
  event_type: string;
  target_user_id?: string;
  event_data?: any;
}

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    // For now, log to console and localStorage until audit table is properly set up
    console.warn('Security Event:', event);
    
    const auditLog = JSON.parse(localStorage.getItem('security_audit') || '[]');
    auditLog.push({
      ...event,
      timestamp: new Date().toISOString(),
      user_id: (await supabase.auth.getUser()).data.user?.id,
    });
    
    // Keep only last 100 events
    if (auditLog.length > 100) {
      auditLog.splice(0, auditLog.length - 100);
    }
    
    localStorage.setItem('security_audit', JSON.stringify(auditLog));
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Security event types
export const SECURITY_EVENTS = {
  ADMIN_STATUS_CHANGE: 'admin_status_change',
  FAILED_LOGIN_ATTEMPT: 'failed_login_attempt',
  SUSPICIOUS_FILE_UPLOAD: 'suspicious_file_upload',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_INPUT_DETECTED: 'invalid_input_detected',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'unauthorized_access_attempt',
} as const;