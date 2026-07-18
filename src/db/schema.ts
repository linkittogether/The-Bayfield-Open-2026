import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Small key/value store for runtime config that must persist across serverless
// invocations (e.g. the auto-refreshed Grint session cookie).
export const appConfig = pgTable("app_config", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const teamName = pgEnum("team_name", [
  "truffle_hogs",
  "mycelium_syndicate",
]);

export const holeWinner = pgEnum("hole_winner", [
  "truffle_hogs",
  "mycelium_syndicate",
  "tie",
]);

// One tournament per year. The season row also carries what used to be the
// single-row tournament_state (currentDay + completion flags + nextPickerRank).
export const seasons = pgTable(
  "seasons",
  {
    id: serial().primaryKey(),
    year: integer().notNull().unique(),
    isCurrent: boolean().notNull().default(false),
    // Hidden seasons (e.g. dry-run sandboxes) are excluded from the season
    // switcher and 404 on direct access.
    hidden: boolean().notNull().default(false),
    // Whether this season has Sunday team match play. Pre-2025 seasons predate
    // the Huron Cup / franchises — Day 3 is greyed out for them.
    matchPlay: boolean().notNull().default(true),
    currentDay: integer().notNull().default(1),
    day1Complete: boolean().notNull().default(false),
    day1PickingStarted: boolean().notNull().default(false),
    day1PickingComplete: boolean().notNull().default(false),
    day2Complete: boolean().notNull().default(false),
    day2DraftComplete: boolean().notNull().default(false),
    day3Complete: boolean().notNull().default(false),
    nextPickerRank: integer(),
  },
  // At most one season can be current at a time.
  (t) => [
    uniqueIndex("seasons_one_current").on(t.isCurrent).where(sql`${t.isCurrent}`),
  ],
);

// The two persistent teams (franchises). slug MUST equal the old team_name enum
// values ("truffle_hogs"/"mycelium_syndicate") so existing CSS color tokens and
// emojis keyed off those strings keep working.
export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  slug: text().notNull().unique(),
});

export const players = pgTable("players", {
  id: serial().primaryKey(),
  // Short display name used everywhere in the app (e.g. "Josh W").
  name: text().notNull(),
  // Full legal name (e.g. "Josh Wright") for external comms like the pairings
  // email to the course. Nullable; falls back to `name` when unset.
  fullName: text(),
  photoUrl: text(),
  handicap: numeric({ precision: 3, scale: 1, mode: "number" })
    .notNull()
    .default(0),
  grintId: integer().unique(),
  // 4-digit login PIN for players without a Google account. Stored in plaintext
  // so an admin can view/share it; the table is unreachable via the public API
  // (RLS deny-all + the app connects as the RLS-bypassing postgres role). Unique
  // so a PIN alone identifies one player at login. Null = no PIN set.
  pin: text().unique(),
  // Google account email for SSO login; admin-assigned. Nullable until assigned.
  email: text().unique(),
  // Tournament organizer. An admin is just a player with this flag set.
  isAdmin: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Per-season team membership + absence. Replaces day3_players as the single
// source of truth for which team a player is on in a given year.
export const seasonRosters = pgTable(
  "season_rosters",
  {
    id: serial().primaryKey(),
    seasonId: integer()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    playerId: integer()
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    // Nullable: pre-2025 seasons had no teams/franchises (see seasons.matchPlay).
    teamId: integer().references(() => teams.id, { onDelete: "restrict" }),
    absent: boolean().notNull().default(false),
    isCaptain: boolean().notNull().default(false),
    // The player's handicap index FOR THIS SEASON (indices change year to year).
    // players.handicap stays as the current/Grint convenience value.
    handicapIndex: numeric({ precision: 3, scale: 1, mode: "number" }),
    // When true, this player's handicap was set manually and a Grint pull must
    // NOT overwrite it. Set automatically when an admin edits the handicap;
    // cleared by unchecking the lock in the player editor.
    handicapLocked: boolean().notNull().default(false),
  },
  (t) => [unique().on(t.seasonId, t.playerId)],
);

// A golf course (reusable across seasons).
export const courses = pgTable("courses", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  grintCourseId: integer(),
});

// A scored segment of a season's stroke-play rounds — normally a nine, but can be
// an 18 (rating/slope/par are the WHS inputs for those holes). Net is COMPUTED from
// these + the player's season index; it is never stored. rating/slope/par are
// nullable until sourced (Grint or manual/back-solved).
export const segments = pgTable("segments", {
  id: serial().primaryKey(),
  seasonId: integer()
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  courseId: integer().references(() => courses.id, { onDelete: "set null" }),
  day: integer().notNull(), // 1 = Friday, 2 = Saturday (stroke-play days)
  sortOrder: integer().notNull(),
  label: text().notNull(), // e.g. "Bluewater", "Sunset back 9"
  holes: integer().notNull().default(9),
  // The tee played for this segment (e.g. "White", "Blue"). Determines which
  // rating/slope/par apply — the group plays different tees per course.
  tee: text(),
  // TheGrint round scope for pulling course data: "18", "F9" (front 9), or
  // "B9" (back 9). Lets a tee change re-pull the right rating/slope/par.
  grintRound: text(),
  rating: numeric({ precision: 4, scale: 1, mode: "number" }),
  slope: integer(),
  par: integer(),
  // Calendar date this round was played (YYYY-MM-DD). Used to match a player's
  // TheGrint round to this segment when importing scores. Nullable until set.
  date: date({ mode: "string" }),
});

// Per-hole par + stroke index for a course/tee, sourced from TheGrint's course
// data. The stroke index (hole handicap 1–18) drives match-play stroke
// allocation. Keyed by (course, tee) since ratings/pars can differ by tee.
export const courseHoles = pgTable(
  "course_holes",
  {
    id: serial().primaryKey(),
    courseId: integer()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tee: text().notNull(),
    holeNumber: integer().notNull(),
    par: integer(),
    strokeIndex: integer(),
  },
  (t) => [unique().on(t.courseId, t.tee, t.holeNumber)],
);

export const segmentScores = pgTable(
  "segment_scores",
  {
    id: serial().primaryKey(),
    segmentId: integer()
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    playerId: integer()
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    gross: integer().notNull(),
  },
  (t) => [unique().on(t.segmentId, t.playerId)],
);

export const day2Teams = pgTable("day2_teams", {
  id: serial().primaryKey(),
  seasonId: integer()
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  player1Id: integer()
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  player2Id: integer()
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  pickOrder: integer().notNull(),
  name: text(),
  // A DQ'd pair is excluded from the Pairs standings/champion (e.g. a partner
  // didn't finish a round). Kept on the board, ranked last, flagged with reason.
  disqualified: boolean().notNull().default(false),
  dqReason: text(),
});

export const day3Matches = pgTable("day3_matches", {
  id: serial().primaryKey(),
  seasonId: integer()
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  matchNumber: integer().notNull(),
  trufflePlayerId: integer()
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  syndicatePlayerId: integer()
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
});

export const day3Holes = pgTable(
  "day3_holes",
  {
    id: serial().primaryKey(),
    matchId: integer()
      .notNull()
      .references(() => day3Matches.id, { onDelete: "cascade" }),
    holeNumber: integer().notNull(),
    // Each player's gross on this hole (full-auto scoring). The net winner is
    // computed from these + match-play strokes. Nullable until entered.
    trufflePlayerGross: integer(),
    syndicatePlayerGross: integer(),
    // Legacy / manual override: the hole winner. Populated for 2025 (imported
    // from match results, no per-hole grosses); computed from grosses otherwise.
    winner: holeWinner(),
  },
  (t) => [unique().on(t.matchId, t.holeNumber)],
);
