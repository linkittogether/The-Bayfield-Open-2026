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

export const admins = pgTable("admins", {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  codeHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const day1Scores = pgTable("day1_scores", {
  id: serial().primaryKey(),
  playerId: integer()
    .notNull()
    .unique()
    .references(() => players.id, { onDelete: "cascade" }),
  grossScore: integer().notNull(),
  netScore: integer().notNull(),
});

export const day2Teams = pgTable("day2_teams", {
  id: serial().primaryKey(),
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

export const day3Players = pgTable("day3_players", {
  id: serial().primaryKey(),
  playerId: integer()
    .notNull()
    .unique()
    .references(() => players.id, { onDelete: "cascade" }),
  teamName: teamName().notNull(),
  isCaptain: boolean().notNull().default(false),
});

export const day3Matches = pgTable("day3_matches", {
  id: serial().primaryKey(),
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

export const tournamentState = pgTable("tournament_state", {
  id: integer().primaryKey(),
  currentDay: integer().notNull().default(1),
  day1Complete: boolean().notNull().default(false),
  day1PickingStarted: boolean().notNull().default(false),
  day1PickingComplete: boolean().notNull().default(false),
  day2Complete: boolean().notNull().default(false),
  day2DraftComplete: boolean().notNull().default(false),
  day3Complete: boolean().notNull().default(false),
  nextPickerRank: integer(),
});
