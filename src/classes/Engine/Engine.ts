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
  warzones: BoardCell[];

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
    this.warzones = this.state.board.cells.filter((_) => _.isWarzone());

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
    this.spawnDefender();
    this.spawnExplorer();
    this.spawnExplorer();
    this.spawnAttacker();
    this.spawnAttacker();

    this.holdPosition();
    this.moveDefault();
  }

  /* BUILD ACTIONS */

  buildBloker() {
    if (this.state.myMatter < 10) return;

    const tilesToBlock = this.innerBorder
      .filter((_) => _.canBuild)
      .filter((_) => {
        if (_.isMidline() || _.isEnemyArea()) return _.attackedMaxStack > 0;
        return _.attackedMaxStack > 1;
      })
      .sort(
        (a, b) =>
          a.distanceToMySpawn - b.distanceToMySpawn ||
          a.distanceToCenter - b.distanceToCenter
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
    if (this.warzones.length > 0) return;

    const explorer = this.innerBorder
      .filter((_) => _.canSpawn)
      .filter((_) => _.adjacentUncaptured > 0 && !_.spawnedHere)
      .sort(
        (a, b) =>
          b.distanceCoef - a.distanceCoef ||
          b.distanceToMySpawn - a.distanceToMySpawn
      );

    if (explorer[0]) {
      const amount = 1;
      this.spawns.push({ type: 'explorer', cell: explorer[0], amount });
      this.state.myMatter -= 10 * amount;
      explorer[0].spawnedHere += amount;
      console.error(`[spawn] explorer at ${explorer[0].key}`);
    }
  }

  spawnDefender() {
    if (this.state.myMatter < 10) return;

    const defenders = this.innerBorder
      .filter((_) => _.canSpawn)
      .filter((_) => _.attackedMaxStack > _.spawnedHere + _.movedHere)
      .sort(
        (a, b) =>
          a.spawnedHere - b.spawnedHere ||
          b.distanceToMySpawn - a.distanceToMySpawn ||
          b.distanceToCenter - a.distanceToCenter
      );

    if (defenders[0]) {
      const amount = 1;
      this.spawns.push({ type: 'defender', cell: defenders[0], amount });
      this.state.myMatter -= 10 * amount;
      defenders[0].spawnedHere += amount;
      console.error(`[spawn] defender at ${defenders[0].key}`);
    }
  }

  spawnAttacker() {
    if (this.state.myMatter < 10) return;

    const attackers = this.innerBorder
      .filter((_) => _.canSpawn)
      .sort(
        (a, b) =>
          +b.isWarzone() - +a.isWarzone() ||
          a.units - b.units ||
          a.attacked - b.attacked ||
          a.distanceToOpponentSpawn - b.distanceToOpponentSpawn ||
          b.distanceToCenter - a.distanceToMySpawn
      );

    if (attackers[0]) {
      const amount = 1;
      this.spawns.push({ type: 'attacker', cell: attackers[0], amount });
      this.state.myMatter -= 10 * amount;
      attackers[0].spawnedHere += amount;
      console.error(`[Spawn] attacker at ${attackers[0].key}`);
    }
  }

  /* MOVEMENT ACTIONS */

  holdPosition() {
    this.robots
      .filter((_) => !_.target)
      .filter(({ cell }) => cell.attacked > 0)
      .forEach((robot) => {
        const { attacked, spawnedHere, movedHere, key } = robot.cell;
        const isDefended =
          movedHere || spawnedHere || robot.cell.isGrassNextTurn();
        const shouldHold = attacked && !isDefended;
        if (shouldHold) {
          robot.objective = 'hold_position';
          robot.target = robot.cell;
          robot.cell.movedHere += 1;
          console.error(`[hold] position at ${key}`);
        }
      });
  }

  moveDefault() {
    this.robots
      .filter((_) => !_.target)
      .sort(
        (a, b) =>
          b.cell.distanceToCenter - a.cell.distanceToCenter ||
          b.cell.distanceToOpponentSpawn - a.cell.distanceToOpponentSpawn
      )
      .forEach((robot) => {
        const { path, score } = this.getOptimalPath(robot);

        if (score > 0) {
          robot.path = path;
          robot.target = robot.path[0];
          // decrease traffic coef
          robot.path.forEach((cell, index) => {
            let decrease = 0;
            if (cell.isNeutral() || cell.isMine()) {
              decrease = [0.5, 0.4, 0.3, 0.2, 0.1][index] || 0.1;
            }
            if (cell.isFoe() || cell.attacked) {
              decrease = 0.1;
            }
            cell.trafficCoef = Math.max(0, cell.trafficCoef - decrease);
          });
        } else {
          // move to closest outer border
          const target = this.outerBorder.sort(
            (a, b) =>
              +b.isFoe() - +a.isFoe() ||
              a.distanceTo(robot.cell) - b.distanceTo(robot.cell)
          )[0];
          if (target) {
            robot.target = target;
            // console.error(
            //   `[warn] robot ${robot.cell.key} has zero path score, go to ${target.key}`
            // );
          }
        }
      });
  }

  getOptimalPath(robot: IRobotAction) {
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

    return closed
      .map((path) => ({ path, score: this.getPathScore(path) }))
      .sort((a, b) => b.score - a.score)[0];
  }

  getPathScore(path: BoardCell[]) {
    return path.reduce((score, cell, index) => {
      const { distanceCoef, trafficCoef } = cell;
      const tileScore = this.getBasicTileScore(cell);
      const speedCoef = [1, 0.9, 0.8, 0.7, 0.6][index] || 0.5;
      const cellScore = tileScore * distanceCoef * trafficCoef * speedCoef;
      return score + cellScore;
    }, 0);
  }

  getBasicTileScore(cell: BoardCell) {
    if (cell.isMine()) return 0;
    if (cell.isNeutral()) return 2;
    if (cell.isFoe()) return 1;
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
    const inspected = ['x-y', 'x-y', 'x-y'];

    console.error(`turn ${turn}, ${Date.now() - turnTimestamp}ms`);
    console.error(`warzones count: ${this.warzones.length}`);

    // inspect cell values
    board.cells
      .filter((_) => inspected.includes(_.key))
      .forEach((_) => {
        const basicScore = this.getBasicTileScore(_);
        console.error({
          key: _.key,
          basicScore,
          distanceCoef: _.distanceCoef,
          trafficCoef: _.trafficCoef,
          score: this.getBasicTileScore(_) * _.distanceCoef * _.trafficCoef,
        });
      });

    // inspect robot path
    // this.robots
    //   .filter((_) => _.path)
    //   .slice(0, 4)
    //   .forEach((robot, index) => {
    //     const path = robot.path.map((_) => _.key).join(', ');
    //     console.error(`robot ${robot.cell.key}: `, path);
    //   });
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
