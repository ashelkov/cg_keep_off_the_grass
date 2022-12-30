import { BoardCell } from '../Board/BoardCell';
import { GameState } from '../Game/GameState';

export class Engine {
  state: GameState;
  debug: IDebugConfig;

  unitsCount: [number, number];
  tilesCount: [number, number];
  uncapturedCount: [number, number];

  builds: IBuildAction[];
  spawns: ISpawnAction[];
  robots: IRobotAction[];

  innerBorder: BoardCell[];
  outerBorder: BoardCell[];

  constructor(state: GameState) {
    this.state = state;
    this.debug = {
      DEBUG_BUILD_ACTIONS: false,
      DEBUG_SPAWN_ACTIONS: false,
    };
  }

  analyze() {
    this.builds = [];
    this.spawns = [];
    this.robots = this.getMyRobots();

    this.innerBorder = this.state.board.cells.filter((_) => _.isInnerBorder());
    this.outerBorder = this.state.board.cells.filter((_) => _.isOuterBorder());

    this.updateCounters();
    this.produceActions();
  }

  updateCounters() {
    const { board } = this.state;
    const { cells } = board;

    this.tilesCount = [
      cells.filter((cell) => cell.isMine()).length,
      cells.filter((cell) => cell.isFoe()).length,
    ];

    this.uncapturedCount = [
      cells.filter((cell) => cell.isMyArea() && cell.isUncaptured()).length,
      cells.filter((cell) => cell.isEnemyArea() && cell.isUncaptured()).length,
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

  produceActions() {
    if (this.innerBorder.length === 0) return;

    this.buildBloker();
    this.buildMiner();

    this.spawnDefender();
    this.spawnExplorer();
    this.spawnAttacker();

    this.spawnDefender();
    this.spawnExplorer();
    this.spawnAttacker();

    this.moveDefault();
  }

  /* BUILD ACTIONS */

  buildBloker() {
    if (this.state.myMatter < 10) return;

    const tilesToBlock = this.innerBorder
      .filter((_) => _.canBuild)
      .filter((_) => _.attacked > 1)
      .sort(
        (a, b) =>
          b.attacked - a.attacked || b.distanceToMySpawn - a.distanceToMySpawn
      );

    if (tilesToBlock[0]) {
      this.builds.push({ type: 'blocker', cell: tilesToBlock[0] });
      this.state.myMatter -= 10;
      tilesToBlock[0].canSpawn = false;
      tilesToBlock[0].canBuild = false;
      console.error(`[build] blocker at ${tilesToBlock[0].key}`);
    }
  }

  buildMiner() {
    const { cells } = this.state.board;

    const enemyBorder = this.outerBorder.filter((_) => _.isFoe());
    const untakenFrontier = cells.filter(
      (_) => _.isMyFrontier() && _.isUncaptured()
    );

    const canBuild = this.state.myMatter >= 10;
    const shouldBuild =
      (enemyBorder.length || untakenFrontier.length) && !this.builds[0];

    if (!canBuild || !shouldBuild) return;

    const tilesMineSafely = cells
      .filter((_) => _.canBuild)
      .filter(
        (_) =>
          (_.tilesToRecycle === 1 && _.scrapToRecycle >= 20) ||
          (_.tilesToRecycle === 2 && _.scrapToRecycle >= 25)
      )
      .sort(
        (a, b) =>
          a.tilesToRecycle - b.tilesToRecycle ||
          b.scrapToRecycle - a.scrapToRecycle ||
          a.distanceToOpponentSpawn - b.distanceToOpponentSpawn
      );

    if (tilesMineSafely[0]) {
      this.builds.push({ type: 'miner', cell: tilesMineSafely[0] });
      this.state.myMatter -= 10;
      tilesMineSafely[0].canSpawn = false;
      tilesMineSafely[0].canBuild = false;
      console.error(`[build] miner at ${tilesMineSafely[0].key}`);
    }
  }

  /* SPAWN ACTIONS */

  spawnExplorer() {
    if (this.state.myMatter < 10) return;
    if (this.innerBorder.length === 0) return;

    const explorer = this.innerBorder
      .filter((_) => _.canSpawn)
      .sort(
        (a, b) =>
          b.distanceToMySpawn - a.distanceToMySpawn ||
          a.units - b.units ||
          a.distanceToCenter - b.distanceToCenter
      );

    if (explorer[0]) {
      const amount = 1;
      this.spawns.push({ type: 'explorer', cell: explorer[0], amount });
      this.state.myMatter -= 10 * amount;
      explorer[0].defended += amount;
      console.error(`[spawn] explorer at ${explorer[0].key}`);
    }
  }

  spawnDefender() {
    if (this.state.myMatter < 10) return;

    const defenders = this.innerBorder
      .filter((_) => _.canSpawn)
      .filter((_) => _.attacked > _.defended)
      .sort(
        (a, b) =>
          a.distanceToMySpawn - b.distanceToMySpawn ||
          a.distanceToCenter - b.distanceToCenter
      );

    if (defenders[0]) {
      const amount = 1;
      this.spawns.push({ type: 'defender', cell: defenders[0], amount });
      this.state.myMatter -= 10 * amount;
      defenders[0].defended += amount;
      console.error(`[spawn] defender at ${defenders[0].key}`);
    }
  }

  spawnAttacker() {
    if (this.state.myMatter < 10) return;

    const attackers = this.innerBorder
      .filter((_) => _.canSpawn)
      .filter((_) => _.attacked > 0 && _.units > 0)
      .sort(
        (a, b) =>
          b.distanceToCenter - a.distanceToMySpawn ||
          b.distanceToMySpawn - a.distanceToMySpawn
      );

    if (attackers[0]) {
      const amount = 1;
      this.spawns.push({ type: 'attacker', cell: attackers[0], amount });
      this.state.myMatter -= 10 * amount;
      attackers[0].defended += amount;
      console.error(`[Spawn] attacker at ${attackers[0].key}`);
    }
  }

  /* MOVE ACTIONS */

  moveDefault() {
    this.robots
      .filter((_) => !_.target)
      .sort(
        (a, b) =>
          a.cell.distanceToOpponentSpawn - b.cell.distanceToOpponentSpawn ||
          a.cell.distanceToCenter - b.cell.distanceToCenter
      )
      .forEach((robot) => {
        this.getRobotPath(robot);
      });
  }

  getRobotPath(robot: IRobotAction) {
    const pathLength = 7;
    const open = [[robot.cell]];
    const closed = [];
    let current: BoardCell[];

    while ((current = open.pop())) {
      if (current.length === pathLength) {
        closed.push(current.slice(1));
      } else {
        const tail = current[current.length - 1];
        const keys = current.map((_) => _.key);
        const next = tail.adjacent.filter(
          (_) => _.canMoveHere && !keys.includes(_.key)
        );
        if (next.length) {
          next.forEach((cell) => {
            open.push([].concat(current).concat(cell));
          });
        } else {
          closed.push(current.slice(1));
        }
      }
    }

    const bestScored = closed
      .map((path) => ({ path, score: this.getPathScore(path) }))
      .sort((a, b) => b.score - a.score)[0];

    robot.path = bestScored?.path;
    robot.target = robot.path[0];

    robot.path.forEach((cell, index) => {
      cell.trafficCoef *= 0.5;
    });
  }

  getPathScore(path: BoardCell[]) {
    return path.reduce((score, cell, index) => {
      const tileScore = this.getBasicTileScore(cell);
      const speedCoef = [2, 1.5, 1][index] || 0.5;
      const distanceCoef =
        (cell._distanceToMySpawn + (1 - cell._distanceToOpponentSpawn)) / 2;
      const trafficCoef = cell.trafficCoef;
      const cellScore = tileScore * distanceCoef * speedCoef * trafficCoef;
      return score + cellScore;
    }, 0);
  }

  getBasicTileScore(cell: BoardCell) {
    if (cell.isMine()) return 0;
    if (cell.isNeutral()) {
      if (cell.isMidline()) return 3;
      if (cell.isMyFrontier()) return 2;
      if (cell.isEnemyArea()) return 2;
      if (cell.isMyArea()) return 1;
      return 1;
    }
    if (cell.isFoe()) {
      if (cell.isMidline()) return 2;
      if (cell.isMyFrontier()) return 3;
      if (cell.isMyArea()) return 2;
      if (cell.isEnemyArea()) return 1;
      return 1;
    }
  }

  /* COMMAND OUTPUT */

  commandOutput() {
    const commands: string[] = [];

    /* Build */
    this.builds.forEach(({ cell }) =>
      commands.push(`BUILD ${cell.x} ${cell.y}`)
    );

    /* Spawn */
    this.spawns.forEach(({ cell, amount = 1 }) =>
      commands.push(`SPAWN ${amount} ${cell.x} ${cell.y}`)
    );

    /* Moves */
    this.robots
      .filter((_) => Boolean(_.target))
      .forEach(({ cell, target: { x, y }, amount = 1 }) =>
        commands.push(`MOVE ${amount} ${cell.x} ${cell.y} ${x} ${y}`)
      );

    /* Message */
    const [u0, u1] = this.unitsCount;
    const uD = u0 - u1;
    const uDx = u0 < u1 ? uD : `+${uD}`;
    const [t0, t1] = this.tilesCount;
    const tD = t0 - t1;
    const tDx = t0 < t1 ? tD : `+${tD}`;
    commands.push(`MESSAGE Tiles: ${tDx}, Units: ${uDx}`);

    console.log(commands.join(';'));
  }

  debugger() {
    const { turn, turnTimestamp, board } = this.state;
    const inspected = ['x-y', 'x-y'];

    console.error(`turn ${turn}, ${Date.now() - turnTimestamp}ms`);

    // inspect cell values
    board.cells
      .filter((_) => inspected.includes(_.key))
      .forEach(
        ({ key, areaOwner, _distanceToMySpawn, _distanceToOpponentSpawn }) => {
          console.error({
            key,
            areaOwner,
            _distToMe: _distanceToMySpawn,
            _distToOpp: _distanceToOpponentSpawn,
          });
        }
      );

    // inspect robot path
    this.robots
      .filter((_) => _.path)
      .slice(0, 4)
      .forEach((robot, index) => {
        const path = robot.path.map((_) => _.key).join(', ');
        console.error(`robot ${robot.cell.key}: `, path);
      });
  }

  /* Helper functions */

  getMyRobots() {
    const robots: IRobotAction[] = [];
    this.state.board.cells
      .filter((cell) => cell.isMine() && cell.units > 0)
      .forEach((cell) => {
        new Array(cell.units).fill(null).forEach((_) => {
          robots.push({ cell, amount: 1 });
        });
      });
    return robots;
  }
}

interface IBuildAction {
  type: 'miner' | 'blocker';
  cell: BoardCell;
}

interface ISpawnAction {
  type: 'explorer' | 'defender' | 'attacker';
  cell: BoardCell;
  amount?: number;
}
interface IRobotAction {
  cell: BoardCell;
  target?: BoardCell;
  path?: BoardCell[];
  objective?: 'default_move' | 'take_frontier' | 'hold_position';
  amount: number;
}

interface IDebugConfig {
  DEBUG_BUILD_ACTIONS: boolean;
  DEBUG_SPAWN_ACTIONS: boolean;
}
