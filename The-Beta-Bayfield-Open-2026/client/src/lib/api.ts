const BASE = '/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  playerLogin: (data: { player_id: number; pin: string }) =>
    req<AuthUser>('/auth/player-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  adminLogin: (data: { username: string; code: string }) =>
    req<AuthUser>('/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getPlayersForLogin: () => req<Array<{ id: number; name: string; photo_url: string | null; has_pin: boolean }>>('/auth/players-list'),
  getAdmins: () => req<Admin[]>('/auth/admins'),
  addAdmin: (data: { username: string; code: string }) =>
    req<Admin>('/auth/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteAdmin: (id: number) =>
    req<{ success: boolean }>(`/auth/admins/${id}`, { method: 'DELETE' }),

  // Players
  getPlayers: () => req<Player[]>('/players'),
  getPlayer: (id: number) => req<Player>(`/players/${id}`),
  registerPlayer: (data: FormData) =>
    req<Player>('/players', { method: 'POST', body: data }),
  updatePlayer: (id: number, data: { handicap?: number; pin?: string; name?: string }) =>
    req<Player>(`/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deletePlayer: (id: number) =>
    req<{ success: boolean }>(`/players/${id}`, { method: 'DELETE' }),

  // Tournament state
  getTournament: () => req<TournamentState>('/tournament'),
  updateTournament: (data: Partial<TournamentState>) =>
    req<TournamentState>('/tournament', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  resetTournament: () =>
    req<{ success: boolean }>('/tournament/reset', { method: 'POST' }),

  // Day 1
  getDay1Scores: () => req<Day1Score[]>('/day1/scores'),
  submitDay1Score: (data: { player_id: number; gross_score: number }) =>
    req<Day1Score>('/day1/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getDay1Leaderboard: () => req<Day1LeaderboardEntry[]>('/day1/leaderboard'),
  getDay1Picks: () => req<Day1PickState>('/day1/picks'),
  makePick: (data: {
    picker_player_id: number;
    picked_player_id: number;
    auth_player_id?: number;
    auth_pin?: string;
    is_admin?: boolean;
  }) =>
    req<{ success: boolean; pickingComplete: boolean }>('/day1/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  completeDay1: () => req<{ success: boolean }>('/day1/complete', { method: 'POST' }),

  // Day 2
  getDay2Teams: () => req<Day2Team[]>('/day2/teams'),
  getDay2Leaderboard: () => req<Day2LeaderboardEntry[]>('/day2/leaderboard'),
  submitDay2Score: (data: {
    team_id: number; round_number: number; player1_gross: number; player2_gross: number;
    is_admin?: boolean; auth_player_id?: number; auth_pin?: string;
  }) =>
    req<Day2RoundScore>('/day2/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getDay2Draft: () => req<Day2DraftState>('/day2/draft'),
  draftPlayer: (data: { player_id: number; team_name: string; is_captain?: boolean }) =>
    req<Day3Player>('/day2/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  undraftPlayer: (playerId: number) =>
    req<{ success: boolean }>(`/day2/draft/${playerId}`, { method: 'DELETE' }),
  completeDraft: () => req<{ success: boolean }>('/day2/draft/complete', { method: 'POST' }),

  // Day 3
  getDay3Teams: () => req<Day3Teams>('/day3/teams'),
  getDay3Matches: () => req<Day3Match[]>('/day3/matches'),
  getDay3Match: (id: number) => req<Day3MatchDetail>(`/day3/matches/${id}`),
  createMatches: (matches: { match_number: number; truffle_player_id: number; syndicate_player_id: number }[]) =>
    req<Day3Match[]>('/day3/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches }),
    }),
  submitHole: (data: {
    match_id: number;
    hole_number: number;
    winner: 'truffle_hogs' | 'mycelium_syndicate' | 'tie';
    is_admin?: boolean;
    auth_player_id?: number;
    auth_pin?: string;
  }) =>
    req<Day3Hole>('/day3/holes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteHole: (matchId: number, holeNumber: number, auth?: { is_admin?: boolean; auth_player_id?: number; auth_pin?: string }) =>
    req<{ success: boolean }>(`/day3/holes/${matchId}/${holeNumber}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth ?? {}),
    }),
  getDay3Leaderboard: () => req<Day3Leaderboard>('/day3/leaderboard'),
  completeDay3: () => req<{ success: boolean }>('/day3/complete', { method: 'POST' }),
};

// Types
export interface Player {
  id: number;
  name: string;
  photo_url: string | null;
  handicap: number;
  has_pin: boolean;
  created_at: string;
}

export interface TournamentState {
  id: number;
  current_day: number;
  day1_complete: boolean;
  day1_picking_started: boolean;
  day1_picking_complete: boolean;
  day2_complete: boolean;
  day2_draft_complete: boolean;
  day3_complete: boolean;
  next_picker_rank: number;
}

export interface Day1Score {
  id: number;
  player_id: number;
  gross_score: number;
  net_score: number;
  name: string;
  handicap: number;
  photo_url: string | null;
}

export interface Day1LeaderboardEntry {
  id: number;
  name: string;
  photo_url: string | null;
  handicap: number;
  gross_score: number;
  net_score: number;
  rank: number;
}

export interface Day1PickState {
  state: TournamentState;
  leaderboard: Day1LeaderboardEntry[];
  teams: Day2Team[];
  nextPicker: Day1LeaderboardEntry | null;
  nextPickerRank: number;
  available: Day1LeaderboardEntry[];
  pickingComplete: boolean;
}

export interface Day2Team {
  id: number;
  name: string;
  pick_order: number;
  player1_id: number;
  player1_name: string;
  player1_handicap: number;
  player1_photo: string | null;
  player2_id: number;
  player2_name: string;
  player2_handicap: number;
  player2_photo: string | null;
}

export interface Day2RoundScore {
  id: number;
  team_id: number;
  round_number: number;
  player1_gross: number;
  player2_gross: number;
  net_score: number;
}

export interface Day2LeaderboardEntry {
  team_id: number;
  team_name: string;
  player1_id: number;
  player1_name: string;
  player1_handicap: number;
  player1_photo: string | null;
  player2_id: number;
  player2_name: string;
  player2_handicap: number;
  player2_photo: string | null;
  total_net_score: number;
  rounds_complete: number;
  round_scores: Array<{
    round: number;
    player1_gross: number;
    player2_gross: number;
    net_score: number;
  }> | null;
}

export interface Day3Player {
  id: number;
  player_id: number;
  team_name: 'truffle_hogs' | 'mycelium_syndicate';
  is_captain: boolean;
}

export interface Day2DraftState {
  state: TournamentState;
  winners: Array<{
    team_id: number;
    player1_id: number;
    player1_name: string;
    player2_id: number;
    player2_name: string;
    total_net_score: number;
  }>;
  allPlayers: Player[];
  selected: Day3Player[];
}

export interface Day3PlayerInfo {
  team_name: 'truffle_hogs' | 'mycelium_syndicate';
  is_captain: boolean;
  player_id: number;
  name: string;
  photo_url: string | null;
  handicap: number;
}

export interface Day3Teams {
  truffle_hogs: Day3PlayerInfo[];
  mycelium_syndicate: Day3PlayerInfo[];
}

export interface AuthUser {
  type: 'player' | 'admin';
  id: number;
  name: string;
  photo_url?: string | null;
  handicap?: number;
  pin?: string;
}

export interface Admin {
  id: number;
  username: string;
  created_at: string;
}

export interface Day3Match {
  id: number;
  match_number: number;
  truffle_player_id: number;
  truffle_player_name: string;
  truffle_photo: string | null;
  syndicate_player_id: number;
  syndicate_player_name: string;
  syndicate_photo: string | null;
  holes_played: number;
  truffle_holes_won: number;
  syndicate_holes_won: number;
  tied_holes: number;
}

export interface Day3Hole {
  id: number;
  match_id: number;
  hole_number: number;
  winner: 'truffle_hogs' | 'mycelium_syndicate' | 'tie';
}

export interface Day3MatchDetail extends Day3Match {
  holes: Day3Hole[];
}

export interface Day3Leaderboard {
  summary: {
    truffle_match_wins: number;
    syndicate_match_wins: number;
    tied_matches: number;
    truffle_total_holes: number;
    syndicate_total_holes: number;
  };
  matches: Array<{
    id: number;
    match_number: number;
    truffle_name: string;
    syndicate_name: string;
    truffle_holes: number;
    syndicate_holes: number;
    ties: number;
    holes_played: number;
  }>;
}
