import { Switch, Route } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/day1/Register';
import { Day1Scores } from './pages/day1/Scores';
import { Day1Leaderboard } from './pages/day1/Leaderboard';
import { Day1Picks } from './pages/day1/Picks';
import { Day2Scores } from './pages/day2/Scores';
import { Day2Leaderboard } from './pages/day2/Leaderboard';
import { Day2Draft } from './pages/day2/Draft';
import { Day3Setup } from './pages/day3/Setup';
import { Day3Match } from './pages/day3/Match';
import { Day3Leaderboard } from './pages/day3/Leaderboard';
import { Admin } from './pages/Admin';

function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/day1/register" component={Register} />
        <Route path="/day1/scores" component={Day1Scores} />
        <Route path="/day1/leaderboard" component={Day1Leaderboard} />
        <Route path="/day1/picks" component={Day1Picks} />
        <Route path="/day2/scores" component={Day2Scores} />
        <Route path="/day2/leaderboard" component={Day2Leaderboard} />
        <Route path="/day2/draft" component={Day2Draft} />
        <Route path="/day3/setup" component={Day3Setup} />
        <Route path="/day3/match/:id" component={Day3Match} />
        <Route path="/day3/leaderboard" component={Day3Leaderboard} />
        <Route path="/admin" component={Admin} />
        <Route>
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-[hsl(var(--muted-foreground))]">Page not found</p>
          </div>
        </Route>
      </Switch>
    </AuthProvider>
  );
}

export default App;
