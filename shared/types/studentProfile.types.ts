// Student Profile Types (for AI Personalization)

export interface StudentProfile {
  id: string;
  userId: string;
  age?: number;
  favoriteSports?: string[];
  skillsToImprove?: string[];
  gradeHistory?: Record<string, number[]>;
  learningSystemPrompt?: string;
  gradeLevel?: string;
  classroomId?: string;
  teacherId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileWithUser extends StudentProfile {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  classroom?: {
    id: string;
    name: string;
    subject?: string;
  };
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UpdateStudentProfileRequest {
  age?: number;
  favoriteSports?: string[];
  skillsToImprove?: string[];
  learningSystemPrompt?: string;
  gradeLevel?: string;
  classroomId?: string;
}

export interface StudentProfileSummary {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  age?: number;
  gradeLevel?: string;
  classroomName?: string;
  currentStruggleScore?: number;
  totalSessions?: number;
}

// For the personalization context sent to AI
export interface PersonalizationContext {
  age?: number;
  interests: string[];
  skillsToImprove: string[];
  learningSystemPrompt?: string;
  recentTopics?: string[];
  struggleAreas?: string[];
}
