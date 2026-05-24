import { BadgesPage } from './badges'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth'
import { AppShell, ErrorBoundary } from './components'
import {
  HomePage, BrowsePage, ContentPage, PathPage,
  PlaygroundPage, PlaygroundExercisePage,
  ActivitiesPage, ActivityDetailPage,
  AssessmentPage, QuizPage,
  CurriculumPage, SeminarsPage,
  WorkflowsPage, ToolsPage, ToolDetailPage,
  TeacherPage, DashboardPage, ProgressPage, ChatPage,
  LoginPage, SignupPage, ForgotPasswordPage, SettingsPage, NotFoundPage,
} from './pages'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <ErrorBoundary>
          <Routes>
            <Route path="/"               element={<HomePage/>}/>
            <Route path="/browse"         element={<BrowsePage/>}/>
            <Route path="/content/:id"    element={<ContentPage/>}/>
            <Route path="/paths/:id"      element={<PathPage/>}/>
            <Route path="/playground"     element={<PlaygroundPage/>}/>
            <Route path="/playground/:id" element={<PlaygroundExercisePage/>}/>
            <Route path="/activities"     element={<ActivitiesPage/>}/>
            <Route path="/activities/:id" element={<ActivityDetailPage/>}/>
            <Route path="/assessment"     element={<AssessmentPage/>}/>
            <Route path="/assessment/:pathId" element={<QuizPage/>}/>
            <Route path="/curriculum"     element={<CurriculumPage/>}/>
            <Route path="/seminars"       element={<SeminarsPage/>}/>
            <Route path="/workflows"      element={<WorkflowsPage/>}/>
            <Route path="/tools"          element={<ToolsPage/>}/>
            <Route path="/tools/:id"      element={<ToolDetailPage/>}/>
            <Route path="/teacher"        element={<TeacherPage/>}/>
            <Route path="/dashboard"      element={<DashboardPage/>}/>
            <Route path="/my-paths"       element={<Navigate to="/curriculum" replace/>}/>
            <Route path="/saved"          element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/progress"       element={<ProgressPage/>}/>
            <Route path="/chat"           element={<ChatPage/>}/>
            <Route path="/badges"         element={<BadgesPage/>}/>
            <Route path="/auth/login"          element={<LoginPage/>}/>
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage/>}/>
            <Route path="/settings"             element={<SettingsPage/>}/>
            <Route path="/auth/signup"    element={<SignupPage/>}/>
            <Route path="*"              element={<NotFoundPage/>}/>
          </Routes>
          </ErrorBoundary>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  )
}
