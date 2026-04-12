import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CitizenAuthProvider } from "./contexts/CitizenAuthContext";
import { DispatchAuthProvider } from "./contexts/DispatchAuthContext";

// Citizen Pages
import Landing from "./pages/citizen/Landing";
import Register from "./pages/citizen/Register";
import VerifyOtp from "./pages/citizen/VerifyOtp";
import Login from "./pages/citizen/Login";
import CitizenHome from "./pages/citizen/Home";
import SosConfirm from "./pages/citizen/SosConfirm";
import SosActive from "./pages/citizen/SosActive";
import AlertHistory from "./pages/citizen/History";
import Profile from "./pages/citizen/Profile";
import ForgotPin from "./pages/citizen/ForgotPin";

// Dispatch Pages
import DispatchLogin from "./pages/dispatch/DispatchLogin";
import DispatchRegister from "./pages/dispatch/DispatchRegister";
import Dashboard from "./pages/dispatch/Dashboard";
import AlertQueue from "./pages/dispatch/AlertQueue";
import DispatchHistory from "./pages/dispatch/DispatchHistory";
import Citizens from "./pages/dispatch/Citizens";
import Officers from "./pages/dispatch/Officers";
import Settings from "./pages/dispatch/Settings";
import Metrics from "./pages/dispatch/Metrics";
import OfficerDashboard from "./pages/dispatch/OfficerDashboard";

function NotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a2e', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800 }}>404</h1>
        <p style={{ color: '#888' }}>Page not found</p>
        <a href="/" style={{ color: '#FFD700' }}>Go Home</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Citizen Routes */}
      <Route path="/" component={Landing} />
      <Route path="/register" component={Register} />
      <Route path="/verify" component={VerifyOtp} />
      <Route path="/login" component={Login} />
      <Route path="/home" component={CitizenHome} />
      <Route path="/sos/confirm" component={SosConfirm} />
      <Route path="/sos/active" component={SosActive} />
      <Route path="/history" component={AlertHistory} />
      <Route path="/profile" component={Profile} />
      <Route path="/forgot-pin" component={ForgotPin} />

      {/* Dispatch Routes */}
      <Route path="/dispatch/login" component={DispatchLogin} />
      <Route path="/dispatch/register" component={DispatchRegister} />
      <Route path="/dispatch" component={Dashboard} />
      <Route path="/dispatch/queue" component={AlertQueue} />
      <Route path="/dispatch/history" component={DispatchHistory} />
      <Route path="/dispatch/citizens" component={Citizens} />
      <Route path="/dispatch/officers" component={Officers} />
      <Route path="/dispatch/settings" component={Settings} />
      <Route path="/dispatch/metrics" component={Metrics} />
      <Route path="/dispatch/officer-dashboard" component={OfficerDashboard} />
      <Route path="/officer" component={OfficerDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <CitizenAuthProvider>
          <DispatchAuthProvider>
            <Router />
          </DispatchAuthProvider>
        </CitizenAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
