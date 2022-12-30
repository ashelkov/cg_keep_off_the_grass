import { ICellTurnData } from '../Game/TurnData';
import { Board } from './Board';

export class BoardCell {
  x: number;
  y: number;
  key: string;
  board: Board;

  // received
  scrapAmount: number;
  owner: number; // 1 - mine, 0 - enemy, -1 - neutral
  units: number;
  recycler: boolean;
  canBuild: boolean;
  canSpawn: boolean;
  inRangeOfRecycler: boolean;

  // computed
  adjacent: BoardCell[]; // 4 cells - up, down, left, right
  surround: BoardCell[]; // 8 surrounding cells
  prev?: BoardCell;
  areaOwner: number; // 1 - mine, 0 - enemy, -1 - neutral
  distanceToCenter: number;
  distanceToMySpawn: number;
  distanceToOpponentSpawn: number;
  _distanceToMySpawn: number; // 0..1, where 1 - is max distance, 0 - is spawn
  _distanceToOpponentSpawn: number;

  // analyzed
  scrapToRecycle?: number;
  tilesToRecycle?: number;
  canMoveHere?: boolean;
  attacked?: number;
  targeted?: number;
  defended?: number;
  trafficCoef?: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.key = `${x}-${y}`;
    this.scrapAmount = 0;
    this.owner = 0;
    this.units = 0;
    this.recycler = false;
    this.canBuild = false;
    this.canSpawn = false;
    this.inRangeOfRecycler = false;
    this.adjacent = [];
    this.surround = [];
    this.prev = null;
  }

  initialize(board: Board) {
    const { width, height } = board;
    this.board = board;
    this.distanceToCenter = this.distanceTo({ x: width / 2, y: height / 2 });
    this.adjacent = [
      [this.x + 1, this.y],
      [this.x - 1, this.y],
      [this.x, this.y + 1],
      [this.x, this.y - 1],
    ]
      .filter(([x, y]) => !(x < 0 || y < 0 || x >= width || y >= height))
      .map(([x, y]) => board.cellsXY[y][x]);
    this.surround = [
      [this.x + 1, this.y + 1],
      [this.x + 1, this.y - 1],
      [this.x - 1, this.y + 1],
      [this.x - 1, this.y - 1],
    ]
      .filter(([x, y]) => !(x < 0 || y < 0 || x >= width || y >= height))
      .map(([x, y]) => board.cellsXY[y][x])
      .concat(this.adjacent);
  }

  update(cellData: ICellTurnData) {
    this.prev = this.clone();
    this.scrapAmount = cellData.scrapAmount;
    this.owner = cellData.owner;
    this.units = cellData.units;
    this.recycler = Boolean(cellData.recycler);
    this.canBuild = Boolean(cellData.canBuild);
    this.canSpawn = Boolean(cellData.canSpawn);
    this.inRangeOfRecycler = Boolean(cellData.inRangeOfRecycler);
  }

  updateAnalytics() {
    this.scrapToRecycle = this.getScrapToRecycle();
    this.tilesToRecycle = this.getTilesToRecycle();
    this.canMoveHere = this.isAbleMoveHere();
    this.attacked = this.getAdjacentEnemies();
    this.targeted = 0;
    this.defended = 0;
    this.trafficCoef = 1;
  }

  clone() {
    const clone = new BoardCell(this.x, this.y);
    clone.scrapAmount = this.scrapAmount;
    clone.owner = this.owner;
    clone.units = this.units;
    clone.recycler = this.recycler;
    clone.canBuild = this.canBuild;
    clone.canSpawn = this.canSpawn;
    clone.inRangeOfRecycler = this.inRangeOfRecycler;
    clone.adjacent = this.adjacent;
    clone.surround = this.surround;
    clone.prev = this.prev;
    clone.updateAnalytics();
    return clone;
  }

  distanceTo({ x, y }: Partial<BoardCell>) {
    return Math.abs(this.x - x) + Math.abs(this.y - y);
  }

  /* Basic methods */

  isMine() {
    return this.owner === 1;
  }

  isFoe() {
    return this.owner === 0;
  }

  isNeutral() {
    return this.owner === -1;
  }

  isGrass() {
    return this.scrapAmount === 0;
  }

  isGrassNextTurn() {
    return this.scrapAmount === 1 && this.inRangeOfRecycler;
  }

  isUncaptured() {
    return this.isNeutral() && this.scrapAmount > 0;
  }

  isAbleMoveHere() {
    return !(this.recycler || this.isGrass() || this.isGrassNextTurn());
  }

  /* Recycler methods */

  isRecycledByMe() {
    return !!this.adjacent.find((_) => _.recycler && _.isMine());
  }

  isRecycledByEnemy() {
    return !!this.adjacent.find((_) => _.recycler && _.isFoe());
  }

  getScrapToRecycle() {
    if (!this.canBuild) return 0;
    const recycleTurns = this.scrapAmount - Number(this.inRangeOfRecycler);
    return this.adjacent
      .slice()
      .concat(this)
      .map((_) => {
        if (_.isRecycledByMe()) return 0;
        if (_.isRecycledByEnemy()) return _.scrapAmount - 1;
        return _.scrapAmount;
      })
      .reduce((sum, scrap) => sum + Math.min(scrap, recycleTurns), 0);
  }

  getTilesToRecycle() {
    return (
      1 +
      this.adjacent
        .filter((_) => _.scrapAmount > 0)
        .filter((_) => _.scrapAmount <= this.scrapAmount).length
    );
  }

  /* Surrounding methods */

  isInDanger() {
    return this.isMine() && this.canMoveHere && this.attacked > 0;
  }

  getAdjacentEnemies() {
    return this.adjacent.reduce((sum, _) => sum + (_.isFoe() ? _.units : 0), 0);
  }

  /* Area methods */

  isMyArea() {
    return this.areaOwner === 1;
  }

  isEnemyArea() {
    return this.areaOwner === 0;
  }

  isMidline() {
    return this.areaOwner === -1;
  }

  isMyFrontier() {
    return this.isMyArea() && this.adjacent.some((_) => !_.isMyArea());
  }

  isEnemyFrontier() {
    return this.isEnemyArea() && this.adjacent.some((_) => !_.isEnemyArea());
  }

  isInnerBorder() {
    return (
      this.isMine() &&
      this.canMoveHere &&
      this.adjacent.some((_) => !_.isMine() && _.canMoveHere)
    );
  }

  isOuterBorder() {
    return (
      !this.isMine() &&
      this.canMoveHere &&
      this.adjacent.some((_) => _.isMine() && _.canMoveHere)
    );
  }

  /* Other */

  isOwnerChanged() {
    return this.owner !== this.prev.owner;
  }
}
