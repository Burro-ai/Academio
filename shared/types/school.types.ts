// Multi-School Architecture Types

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';

export type SchoolMemberRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface School {
  id: string;
  name: string;
  domain?: string;
  settings: SchoolSettings;
  subscriptionTier: SubscriptionTier;
  maxStudents: number;
  maxTeachers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolSettings {
  allowStudentRegistration?: boolean;
  requireEmailVerification?: boolean;
  defaultStudentRole?: string;
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    schoolName?: string;
  };
}

export interface SchoolMembership {
  id: string;
  userId: string;
  schoolId: string;
  role: SchoolMemberRole;
  isPrimary: boolean;
  permissions: SchoolPermissions;
  joinedAt: string;
}

export interface SchoolPermissions {
  canManageStudents?: boolean;
  canManageTeachers?: boolean;
  canManageClassrooms?: boolean;
  canViewAnalytics?: boolean;
  canEditSettings?: boolean;
}

export interface SchoolWithStats extends School {
  studentCount: number;
  teacherCount: number;
  classroomCount: number;
}

export interface CreateSchoolRequest {
  name: string;
  domain?: string;
  subscriptionTier?: SubscriptionTier;
  maxStudents?: number;
  maxTeachers?: number;
}

export interface UpdateSchoolRequest {
  name?: string;
  domain?: string;
  settings?: Partial<SchoolSettings>;
  subscriptionTier?: SubscriptionTier;
  maxStudents?: number;
  maxTeachers?: number;
  isActive?: boolean;
}

export interface AddSchoolMemberRequest {
  userId: string;
  schoolId: string;
  role: SchoolMemberRole;
  isPrimary?: boolean;
  permissions?: Partial<SchoolPermissions>;
}

export interface UpdateSchoolMemberRequest {
  role?: SchoolMemberRole;
  isPrimary?: boolean;
  permissions?: Partial<SchoolPermissions>;
}
