// ─── Primitives ────────────────────────────────────────────────────────────────
export type Difficulty  = 'beginner' | 'intermediate' | 'advanced'
export type Audience    = 'teacher' | 'student' | 'both'
export type ContentType = 'video' | 'seminar' | 'guide' | 'walkthrough' | 'pdf' | 'book' | 'course' | 'article'
export type Board       = 'CBSE' | 'IGCSE' | 'IB' | 'RBSE' | 'All'
export type Language    = 'English' | 'Hindi'
export type UserRole    = 'student' | 'teacher' | 'admin'
export type OnboardRole = 'teacher' | 'student' | 'curious'
export type ActivityType = 'debate' | 'investigation' | 'comparison' | 'challenge' | 'audit' | 'creation'
export type AgeGroup   = 'middle-school' | 'high-school' | 'college'

// ─── Resource ─────────────────────────────────────────────────────────────────
export interface Resource {
  id: string; title: string; description: string
  type: ContentType; url: string
  youtubeId?: string; thumbnailUrl?: string
  duration?: string; author?: string; source?: string; year?: number
  freeAccess: boolean; difficulty: Difficulty; audience: Audience
  topics: string[]; tags: string[]
  isFeatured?: boolean; completionCount: number; rating: number
  boards?: Board[]; language?: Language
  cbseUnit?: string; igcseSection?: string; ibConcept?: string
}

// ─── Learning Path ────────────────────────────────────────────────────────────
export interface LearningPath {
  id: string; title: string; description: string
  resourceIds: string[]; resources?: Resource[]
  difficulty: Difficulty; audience: Audience
  estimatedHours: number; topics: string[]
  completedByCount: number; rating: number
  accentColor: string; iconName: string
  board?: string; boardUnit?: string
}

// ─── Classroom Activity ───────────────────────────────────────────────────────
export interface ActivityStep {
  duration: string; instruction: string; facilitatorNote?: string
}

export interface ClassroomActivity {
  id: string; title: string; tagline: string
  type: ActivityType; ageGroups: AgeGroup[]
  classTime: string; groupSize: string
  materials: string[]; objective: string; overview: string
  steps: ActivityStep[]
  discussionQuestions: string[]
  teacherNotes: string
  conceptsCovered: string[]
}

// ─── Deep Exercise (Playground) ───────────────────────────────────────────────
export interface ExerciseStage {
  id: string; title: string; instruction: string
  promptToTry: string; whatToNotice: string[]; followUps: string[]
}

export interface Perspective {
  role: string; icon: string
  view: string; concern: string; action: string
}

export interface RealWorldCase {
  title: string; context: string
  what: string; impact: string; lesson: string
}

export interface Misconception { myth: string; reality: string }

export interface BehaviourChange {
  situation: string; oldBehaviour: string; newBehaviour: string
}

export interface DeepExercise {
  id: string; title: string; tagline: string
  concept: string; difficulty: Difficulty
  estimatedMinutes: number; isPro: boolean; badgeColor: string
  whyItMatters: string; whatYouWillLearn: string[]
  systemPrompt: string; stages: ExerciseStage[]
  coreConcept: string; mechanism: string; implications: string[]
  perspectives: Perspective[]
  realWorldCases: RealWorldCase[]
  misconceptions: Misconception[]
  behaviourChanges: BehaviourChange[]
  furtherReading: { title: string; source: string; url: string }[]
}

// ─── Tool Guide ───────────────────────────────────────────────────────────────
export interface WalkthroughStep {
  id: string; title: string; content: string
  tip?: string; warning?: string; code?: string
}

export interface Walkthrough {
  id: string; toolId: string; title: string
  description: string; duration: string; difficulty: Difficulty
  steps: WalkthroughStep[]; keyTakeaway: string
}

export interface ToolGuide {
  id: string; toolName: string; tagline: string
  logoColor: string; textColor: string; guideCount: number
  guides: { id: string; title: string; duration: string; difficulty: Difficulty }[]
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface ResourceProgress {
  resource_id: string; completed: boolean; percent: number; updated_at: string
}

export interface Profile {
  id: string; email: string | null; full_name: string | null
  avatar_url: string | null; role: UserRole; tier: 'free' | 'pro'
}

export interface Message { role: 'user' | 'assistant'; content: string }

// ─── Onboarding ───────────────────────────────────────────────────────────────
export interface OnboardingProfile {
  role: OnboardRole; board?: string; goals: string[]
  completed: boolean; completedAt: string
}

// ─── API envelopes ────────────────────────────────────────────────────────────
export interface ListResponse<T> { data: T[]; total: number }
