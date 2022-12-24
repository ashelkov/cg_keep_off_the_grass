import { BoardCell } from '../Board/BoardCell';
import { GameState } from '../Game/GameState';

export class Engine {
  state: GameState;

  unitsCount: [number, number];
  tilesCount: [number, number];

  robots: IRobot[];
  spawns: Array<{
    cell: BoardCell;
    expansionScore?: number;
    defensiveScore?: number;
    offensiveScore?: number;
  }>;
  builds: BoardCell[];
  config: IEngineConfig;

  constructor(state: GameState) {
    this.state = state;

    this.config = {
      DEBUG_DEFENSIVE_SPAWN: false,
      DEBUG_EXPANSION_SPAWN: false,
      DEBUG_OFFENSIVE_SPAWN: false,
      DEBUG_RECYCLERS_BUILD: false,
    };
  }

  analyze() {
    this.builds = [];
    this.spawns = [];
    this.robots = [];

    this.counters();
    this.commandBuild();
    this.commandSpawn();
    this.commandMove();
  }

  counters() {
    const { board } = this.state;
    const { cells } = board;

    this.tilesCount = [
      cells.filter((cell) => cell.isMine()).length,
      cells.filter((cell) => cell.isFoe()).length,
    ];

    this.unitsCount = [
      cells
        .filter((cell) => cell.isMine())
        .reduce((sum, cell) => sum + cell.units, 0),
      cells
        .filter((cell) => cell.isFoe())
        .reduce((sum, cell) => sum + cell.units, 0),
    ];
  }

  commandBuild() {
    const { DEBUG_RECYCLERS_BUILD } = this.config;
    const { board } = this.state;
    const { cells, outerBorder } = board;

    const tilesToCapture = outerBorder.filter((_) => _.canMoveHere);

    if (this.state.myMatter >= 10 && tilesToCapture.length > 0) {
      const recyclersToBuild = cells
        .filter((_) => _.canBuild)
        .filter(
          (_) =>
            (_.scrapToRecycle > 30 && _.tilesToRecycle < 5) ||
            (_.scrapToRecycle > 25 && _.tilesToRecycle < 4)
        )
        .sort(
          (a, b) =>
            a.tilesToRecycle - b.tilesToRecycle ||
            b.scrapToRecycle - a.scrapToRecycle ||
            a.distanceToOpponentSpawn - b.distanceToOpponentSpawn
        );

      if (recyclersToBuild[0]) {
        this.builds.push(recyclersToBuild[0]);
        this.state.myMatter -= 10;
        recyclersToBuild[0].canSpawn = false;

        if (DEBUG_RECYCLERS_BUILD) {
          console.error(
            '[BUILD] Expansion:',
            recyclersToBuild.slice(0, 3).map((cell) => ({
              key: cell.key,
              tilesToRecycle: cell.tilesToRecycle,
              scrapToRecycle: cell.scrapToRecycle,
            }))
          );
        }
      }
    }
  }

  commandSpawn() {
    const { board } = this.state;
    const { cells, innerBorder, outerBorder } = board;
    const {
      DEBUG_EXPANSION_SPAWN,
      DEBUG_DEFENSIVE_SPAWN,
      DEBUG_OFFENSIVE_SPAWN,
    } = this.config;

    /* Offensive spawn */
    if (this.state.myMatter >= 10) {
      const offensiveSpawns = innerBorder
        .filter((cell) => cell.canSpawn && cell.canMoveHere)
        .filter((cell) =>
          cell.adjacent.some((_) => _.isFoe() && _.canMoveHere && _.units === 0)
        )
        .map((cell) => ({
          cell,
          offensiveScore: -cell.distanceToOpponentSpawn,
        }))
        .sort((a, b) => b.offensiveScore - a.offensiveScore);

      if (offensiveSpawns[0]) {
        this.spawns.push(offensiveSpawns[0]);
        this.state.myMatter -= 10;

        if (DEBUG_OFFENSIVE_SPAWN) {
          console.error(
            '[SPAWN] Offensive:',
            offensiveSpawns.slice(0, 3).map(({ cell, offensiveScore }) => ({
              key: cell.key,
              distanceToCenter: cell.distanceToCenter,
              offensiveScore,
            }))
          );
        }
      }
    }

    /* Defensive spawn */
    if (this.state.myMatter >= 10) {
      const defensiveSpawns = innerBorder
        .filter((cell) => cell.canSpawn && !cell.isGrassNextTurn())
        .filter((cell) => cell.adjacentEnemies > 0)
        .map((cell) => ({
          cell,
          defensiveScore: cell.adjacentEnemies,
        }))
        .sort(
          (a, b) =>
            b.defensiveScore - a.defensiveScore ||
            a.cell.distanceToMySpawn - b.cell.distanceToMySpawn
        );

      if (defensiveSpawns[0]) {
        this.spawns.push(defensiveSpawns[0]);
        this.state.myMatter -= 10;

        if (this.state.myMatter > 10) {
          this.spawns.push(defensiveSpawns[0]);
          this.state.myMatter -= 10;
        }

        if (DEBUG_DEFENSIVE_SPAWN) {
          console.error(
            '[SPAWN] Defensive:',
            defensiveSpawns.slice(0, 3).map(({ cell, defensiveScore }) => ({
              key: cell.key,
              distanceToCenter: cell.distanceToCenter,
              defensiveScore,
            }))
          );
        }
      }
    }

    const uncaptured = outerBorder.filter((_) => _.isUncaptured());

    /* Expansion spawn */
    const canSpawn = this.state.myMatter >= 10;
    const shouldSpawnExpansion = uncaptured.length > 0;
    if (canSpawn && shouldSpawnExpansion) {
      const expansionSpawns = innerBorder
        .filter((cell) => cell.canSpawn && !cell.isGrassNextTurn())
        .filter(
          (cell) =>
            cell.adjacent.find((_) => _.isUncaptured()) && cell.units === 0
        )
        .map((cell) => ({
          cell,
          expansionScore: cell.surround.reduce(
            (score, _) => score + _.getExpansionScore(),
            cell.getExpansionScore()
          ),
        }))
        .sort(
          (a, b) =>
            b.expansionScore - a.expansionScore ||
            a.cell.distanceToCenter - b.cell.distanceToCenter
        );

      if (expansionSpawns[0]?.cell) {
        this.spawns.push(expansionSpawns[0]);
        this.state.myMatter -= 10;

        if (DEBUG_EXPANSION_SPAWN) {
          console.error(
            '[SPAWN] Expansion:',
            expansionSpawns.slice(0, 3).map(({ cell, expansionScore }) => ({
              key: cell.key,
              expansionScore,
            }))
          );
        }
      }
    }
  }

  commandMove() {
    const { board } = this.state;
    const { cells, outerBorder } = board;

    /* Prepare robots array */
    cells
      .filter((cell) => cell.isMine() && cell.units > 0)
      .forEach((cell) => {
        new Array(cell.units).fill(null).forEach((_) => {
          this.robots.push({
            cell,
            target: null,
          });
        });
      });

    /* Assign targets */
    this.robots
      .sort(
        (a, b) =>
          a.cell.distanceToOpponentSpawn - b.cell.distanceToOpponentSpawn ||
          a.cell.distanceToCenter - b.cell.distanceToCenter
      )
      .forEach((robot) => {
        const targets = outerBorder
          .map((cell) => ({
            cell,
            score:
              cell.distanceTo(robot.cell) * 2 +
              cell.distanceToOpponentSpawn * 0.5 +
              cell.targeted,
          }))
          .sort(
            (a, b) =>
              a.score - b.score ||
              a.cell.distanceToCenter - b.cell.distanceToCenter
          );

        if (targets[0]) {
          robot.target = targets[0].cell;
          robot.target.targeted++;
        }
      });
  }

  printCommand() {
    const commands: string[] = [];

    /* Bui;d */
    this.builds.forEach((cell) => commands.push(`BUILD ${cell.x} ${cell.y}`));

    /* Spawn */
    this.spawns.forEach(({ cell }) =>
      commands.push(`SPAWN 1 ${cell.x} ${cell.y}`)
    );

    /* Moves */
    this.robots
      .filter((_) => Boolean(_.target))
      .forEach(({ cell, target }) =>
        commands.push(`MOVE 1 ${cell.x} ${cell.y} ${target.x} ${target.y}`)
      );

    /* Message */
    const [u0, u1] = this.unitsCount;
    const uD = u0 - u1;
    const uDx = u0 < u1 ? uD : `+${uD}`;
    const [t0, t1] = this.tilesCount;
    const tD = t0 - t1;
    const tDx = t0 < t1 ? tD : `+${tD}`;
    commands.push(`MESSAGE Units: ${uDx}, Tiles: ${tDx}`);

    console.log(commands.join(';'));
  }

  debugger() {
    const { turn, turnTimestamp, board } = this.state;
    console.error(`turn ${turn}, ${Date.now() - turnTimestamp}ms`);
  }
}

interface IRobot {
  cell: BoardCell;
  target?: BoardCell;
}

interface IEngineConfig {
  DEBUG_RECYCLERS_BUILD: boolean;
  DEBUG_OFFENSIVE_SPAWN: boolean;
  DEBUG_DEFENSIVE_SPAWN: boolean;
  DEBUG_EXPANSION_SPAWN: boolean;
}
