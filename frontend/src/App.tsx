import { BadgesPage } from './badges'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { AppShell, ErrorBoundary } from './components'
import {
  HomePage, BrowsePage, ContentPage, PathPage,
  PlaygroundPage, PlaygroundExercisePage,
  ActivitiesPage, ActivityDetailPage,
  AssessmentPage, QuizPage,
  CurriculumPage, SeminarsPage,
  WorkflowsPage, ToolsPage, ToolDetailPage,
  TeacherPage, DashboardPage, ProgressPage, ChatPage,
  TeacherClassroomDashboard,
  LoginPage, SignupPage, ForgotPasswordPage, SettingsPage, NotFoundPage, TryPage,
} from './pages'

function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) {
    // First-time visitor → guided onboarding. Already visited → skip straight to content.
    const hasVisited = localStorage.getItem('aihub_signup_role') || localStorage.getItem('aihub_try_done')
    return <Navigate to={hasVisited ? '/browse' : '/try'} replace/>
  }
  return <HomePage/>
}

/** Layout wrapper — renders AppShell around whatever child route matches */
function ShellLayout() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Outlet/>
      </ErrorBoundary>
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Bare pages — no sidebar, no shell ──────────────────────────── */}
          <Route path="/try"                  element={<TryPage/>}/>
          <Route path="/auth/login"           element={<LoginPage/>}/>
          <Route path="/auth/signup"          element={<SignupPage/>}/>
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage/>}/>

          {/* ── App pages — all wrapped in AppShell via ShellLayout ─────────── */}
          <Route element={<ShellLayout/>}>
            <Route path="/"                       element={<RootRoute/>}/>
            <Route path="/browse"                 element={<BrowsePage/>}/>
            <Route path="/content/:id"            element={<ContentPage/>}/>
            <Route path="/paths/:id"              element={<PathPage/>}/>
            <Route path="/playground"             element={<PlaygroundPage/>}/>
            <Route path="/playground/:id"         element={<PlaygroundExercisePage/>}/>
            <Route path="/activities"             element={<ActivitiesPage/>}/>
            <Route path="/activities/:id"         element={<ActivityDetailPage/>}/>
            <Route path="/assessment"             element={<AssessmentPage/>}/>
            <Route path="/assessment/:pathId"     element={<QuizPage/>}/>
            <Route path="/curriculum"             element={<CurriculumPage/>}/>
            <Route path="/seminars"               element={<SeminarsPage/>}/>
            <Route path="/workflows"              element={<WorkflowsPage/>}/>
            <Route path="/tools"                  element={<ToolsPage/>}/>
            <Route path="/tools/:id"              element={<ToolDetailPage/>}/>
            <Route path="/teacher"                element={<TeacherPage/>}/>
            <Route path="/classroom"              element={<TeacherClassroomDashboard/>}/>
            <Route path="/dashboard"              element={<DashboardPage/>}/>
            <Route path="/my-paths"               element={<Navigate to="/curriculum" replace/>}/>
            <Route path="/saved"                  element={<Navigate to="/dashboard" replace/>}/>
            <Route path="/progress"               element={<ProgressPage/>}/>
            <Route path="/chat"                   element={<ChatPage/>}/>
            <Route path="/badges"                 element={<BadgesPage/>}/>
            <Route path="/settings"               element={<SettingsPage/>}/>
            <Route path="*"                       element={<NotFoundPage/>}/>
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
