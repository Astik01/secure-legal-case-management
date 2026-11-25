import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { PublicLayout } from './layouts/PublicLayout';
import Analytics from './pages/admin/Analytics';
import AdminDashboard from './pages/admin/AdminDashboard';
import BlockchainRecords from './pages/admin/BlockchainRecords';
import CaseApprovals from './pages/admin/CaseApprovals';
import CaseManagement from './pages/admin/CaseManagement';
import RoleManagement from './pages/admin/RoleManagement';
import SystemSettings from './pages/admin/SystemSettings';
import UserManagement from './pages/admin/UserManagement';
import CaseForm from './pages/faculty/CaseForm';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import Submissions from './pages/faculty/Submissions';
import UploadDocuments from './pages/faculty/UploadDocuments';
import NotFound from './pages/NotFound';
import AuditLogs from './pages/shared/AuditLogs';
import CaseDetails from './pages/shared/CaseDetails';
import CaseExplorer from './pages/shared/CaseExplorer';
import DocumentViewer from './pages/shared/DocumentViewer';
import Profile from './pages/shared/Profile';
import VerificationHistory from './pages/shared/VerificationHistory';
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
          <Route path="documents/:id" element={<DocumentViewer />} />
          <Route path="verify" element={<VerificationHistory />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="profile" element={<Profile />} />

          <Route element={<ProtectedRoute roles={['FACULTY']} />}>
            <Route path="faculty" element={<FacultyDashboard />} />
            <Route path="faculty/cases/new" element={<CaseForm />} />
            <Route path="faculty/submissions" element={<Submissions />} />
            <Route path="faculty/verifications" element={<VerificationHistory />} />
            <Route path="faculty/audit-logs" element={<AuditLogs />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/roles" element={<RoleManagement />} />
            <Route path="admin/cases" element={<CaseManagement />} />
            <Route path="admin/approvals" element={<CaseApprovals />} />
            <Route path="admin/blockchain" element={<BlockchainRecords />} />
            <Route path="admin/audit-logs" element={<AuditLogs />} />
            <Route path="admin/analytics" element={<Analytics />} />
            <Route path="admin/settings" element={<SystemSettings />} />
          </Route>
          <Route element={<ProtectedRoute roles={['FACULTY', 'ADMIN']} />}>
            <Route path="faculty/cases/:id/edit" element={<CaseForm />} />
            <Route path="faculty/cases/:id/documents" element={<UploadDocuments />} />
          </Route>

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route path="student" element={<StudentDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
