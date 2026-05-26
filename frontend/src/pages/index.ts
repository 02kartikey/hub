/**
 * pages/index.ts
 * Single re-export barrel so App.tsx imports from './pages' unchanged.
 */

export { HomePage, DashboardPage }              from './home'
export { BrowsePage, ContentPage, PathPage }    from './content'
export { PlaygroundPage, PlaygroundExercisePage } from './playground'
export {
  ActivitiesPage, ActivityDetailPage,
  AssessmentPage, QuizPage,
}                                               from './activities'
export { CurriculumPage, SeminarsPage }         from './curriculum'
export { WorkflowsPage, ToolsPage, ToolDetailPage } from './tools'
export { TeacherPage }                          from './teacher-hub'
export { ProgressPage }                         from './progress'
export { TeacherClassroomDashboard }            from './classroom'
export { ChatPage }                             from './chat'
export { TryPage }                              from './try'
export {
  LoginPage, SignupPage,
  ForgotPasswordPage, SettingsPage, NotFoundPage,
}                                               from './auth-pages'
