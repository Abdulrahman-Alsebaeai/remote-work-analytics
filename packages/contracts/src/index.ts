export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export interface AuthenticatedUser { id: string; email: string; displayName: string; role: UserRole; locale: 'en' | 'ar'; }
export interface TokenPair { accessToken: string; refreshToken: string; expiresInSeconds: number; }
export interface ProductivitySummary { productivityScore: number; focusScore: number; trackedSeconds: number; activeSeconds: number; idleSeconds: number; }
export interface ProductivityRanking extends ProductivitySummary { employeeId: string; displayName: string; }
export type ActivityCategory = 'WORK' | 'COMMUNICATION' | 'BROWSING' | 'ENTERTAINMENT' | 'IDLE' | 'OTHER';
export type AiJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
