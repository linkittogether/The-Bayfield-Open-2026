import { sql } from "drizzle-orm";
import {
  boolean,
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
  name: text().notNull(),
  photoUrl: text(),
  handicap: numeric({ precision: 3, scale: 1, mode: "number" })
    .notNull()
    .default(0),
  grintId: integer().unique(),
  pinHash: text().notNull(),
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
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    absent: boolean().notNull().default(false),
    isCaptain: boolean().notNull().default(false),
  },
  (t) => [unique().on(t.seasonId, t.playerId)],
);

export const admins = pgTable("admins", {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  codeHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const day1Scores = pgTable(
  "day1_scores",
  {
    id: serial().primaryKey(),
    seasonId: integer()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    playerId: integer()
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    grossScore: integer().notNull(),
    netScore: integer().notNull(),
  },
  (t) => [unique().on(t.seasonId, t.playerId)],
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
});

export const day2RoundScores = pgTable(
  "day2_round_scores",
  {
    id: serial().primaryKey(),
    teamId: integer()
      .notNull()
      .references(() => day2Teams.id, { onDelete: "cascade" }),
    roundNumber: integer().notNull(),
    player1Gross: integer().notNull(),
    player2Gross: integer().notNull(),
    netScore: integer().notNull(),
  },
  (t) => [unique().on(t.teamId, t.roundNumber)],
);

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
    winner: holeWinner().notNull(),
  },
  (t) => [unique().on(t.matchId, t.holeNumber)],
);
