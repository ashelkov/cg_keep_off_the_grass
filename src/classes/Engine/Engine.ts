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

  constructor(state: GameState) {
    this.state = state;
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
    const { board } = this.state;
    const { cells } = board;

    if (this.state.myMatter >= 10) {
      const recyclersToBuild = cells
        .filter((_) => _.canBuild && !_.inRangeOfRecycler)
        .filter((_) => _.scrapToMine > 25)
        .sort(
          (a, b) =>
            b.scrapToMine - a.scrapToMine ||
            b.distanceToCenter - a.distanceToCenter
        );

      if (recyclersToBuild[0]) {
        this.builds.push(recyclersToBuild[0]);
        this.state.myMatter -= 10;
        recyclersToBuild[0].canSpawn = false;

        // debugger
        console.error(
          '> recyclers to build:',
          recyclersToBuild.slice(0, 3).map((cell) => ({
            x: cell.x,
            y: cell.y,
            scrapToMine: cell.scrapToMine,
            distanceToCenter: cell.distanceToCenter,
          }))
        );
      }
    }
  }

  commandSpawn() {
    const { board } = this.state;
    const { cells } = board;

    const neutralCount = cells.filter((_) => _.isNeutral()).length;

    /* Expansion spawn */
    if (this.state.myMatter >= 10 && neutralCount > 0) {
      const expansionSpawns = cells
        .filter((cell) => cell.canSpawn && !cell.isGrassNextTurn())
        .filter((cell) => cell.adjacent.find((_) => _.isNeutral()))
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

        // debugger
        console.error(
          '> expansion spawns:',
          expansionSpawns.slice(0, 3).map(({ cell, expansionScore }) => ({
            x: cell.x,
            y: cell.y,
            expansionScore,
          }))
        );
      }
    }

    /* Offensive spawn */
    if (this.state.myMatter >= 10) {
      const offensiveSpawns = cells
        .filter((cell) => cell.canSpawn && !cell.isGrassNextTurn())
        .filter((cell) => cell.inFrontline && cell.hasEmptyEnemyAdjacent())
        .map((cell) => ({
          cell,
          offensiveScore: -cell.adjacentEnemies,
        }))
        .sort(
          (a, b) =>
            b.offensiveScore - a.offensiveScore ||
            a.cell.distanceToCenter - b.cell.distanceToCenter
        );

      if (offensiveSpawns[0]) {
        this.spawns.push(offensiveSpawns[0]);
        this.state.myMatter -= 10;

        // debugger
        console.error(
          '> offensive spawns:',
          offensiveSpawns.slice(0, 3).map(({ cell, offensiveScore }) => ({
            x: cell.x,
            y: cell.y,
            offensiveScore,
            distanceToCenter: cell.distanceToCenter,
          }))
        );
      }
    }

    /* Defensive spawn */
    if (this.state.myMatter >= 10) {
      const defensiveSpawns = cells
        .filter((cell) => cell.canSpawn && !cell.isGrassNextTurn())
        .filter((cell) => cell.inFrontline && cell.adjacentEnemies > 0)
        .map((cell) => ({
          cell,
          defensiveScore: cell.adjacentEnemies,
        }))
        .sort(
          (a, b) =>
            b.defensiveScore - a.defensiveScore ||
            a.cell.distanceToCenter - b.cell.distanceToCenter
        );

      if (defensiveSpawns[0]) {
        this.spawns.push(defensiveSpawns[0]);
        this.state.myMatter -= 10;

        // debugger
        console.error(
          '> defensive spawns:',
          defensiveSpawns.slice(0, 3).map(({ cell, defensiveScore }) => ({
            x: cell.x,
            y: cell.y,
            defensiveScore,
            distanceToCenter: cell.distanceToCenter,
          }))
        );
      }
    }
  }

  commandMove() {
    const { board } = this.state;
    const { cells } = board;

    /* Prepare robots array */
    cells
      .filter((cell) => cell.isMine() && cell.units > 0)
      .forEach((cell) => {
        new Array(cell.units).fill(null).forEach((_) => {
          this.robots.push({
            x: cell.x,
            y: cell.y,
            target: null,
          });
        });
      });

    const targetsToMove = cells.filter(
      (cell) => cell.inOuterline && cell.moveable
    );

    /* Assign targets */
    this.robots.forEach((robot) => {
      const targets = targetsToMove
        .map((cell) => ({
          cell,
          distanceToRobot: cell.distanceTo(robot),
        }))
        .sort(
          (a, b) =>
            a.distanceToRobot - b.distanceToRobot ||
            a.cell.targeted - b.cell.targeted ||
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
      .forEach(({ x, y, target }) =>
        commands.push(`MOVE 1 ${x} ${y} ${target.x} ${target.y}`)
      );

    /* Message */
    const [u0, u1] = this.unitsCount;
    const uD = u0 - u1;
    const uDx = u0 < u1 ? uD : `+${uD}`;
    const [t0, t1] = this.tilesCount;
    const tD = t0 - t1;
    const tDx = t0 < t1 ? tD : `+${tD}`;
    commands.push(
      `MESSAGE Units: ${uDx}, Tiles: ${tDx}, Turn: ${this.state.turn}`
    );

    console.log(commands.join(';'));
  }

  debugger() {
    const [myCount, oppCount] = this.unitsCount;
    // console.error('cellsXY[0][1]', cellsXY[0][1]);
  }
}

interface IRobot {
  x: number;
  y: number;
  target: BoardCell | null;
}
