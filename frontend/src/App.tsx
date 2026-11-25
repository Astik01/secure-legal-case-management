import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { PublicLayout } from './layouts/PublicLayout';
import NotFound from './pages/NotFound';
import CaseDetails from './pages/shared/CaseDetails';
import CaseExplorer from './pages/shared/CaseExplorer';
import Profile from './pages/shared/Profile';
import Bookmarks from './pages/student/Bookmarks';
import StudentDashboard from './pages/student/StudentDashboard';
import About from './pages/public/About';
import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import { GuestOnly, ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Available to every signed-in role; the API still filters what each role may see. */}
          <Route path="cases" element={<CaseExplorer />} />
          <Route path="cases/:id" element={<CaseDetails />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="profile" element={<Profile />} />

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route path="student" element={<StudentDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
