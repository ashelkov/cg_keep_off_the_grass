import { ICellTurnData } from '../Game/TurnData';
import { Board } from './Board';

export class BoardCell {
  x: number;
  y: number;
  board: Board;

  // received
  scrapAmount: number;
  owner: number;
  units: number;
  recycler: boolean;
  canBuild: boolean;
  canSpawn: boolean;
  inRangeOfRecycler: boolean;

  // computed
  adjacent: BoardCell[]; // 4 cells - up, down, left, right
  surround: BoardCell[]; // 8 surrounding cells
  distanceToCenter: number;
  prev?: BoardCell;

  // analyzed
  recycledByMe?: boolean;
  recycledByOpponent?: boolean;
  scrapToMine?: number;
  adjacentEnemies?: number;
  moveable?: boolean;
  targeted?: number;
  inFrontline?: boolean; // mine, adjacent with opponent cells
  inInnerline?: boolean; // mine, adjacent with opponent or neutral cells
  inOuterline?: boolean; // not mine, adjacent with mine

  // todo
  unitsNextTurn?: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
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
    this.recycledByMe = this.isRecycledByMe();
    this.recycledByOpponent = this.isRecycledByOpponent();
    this.scrapToMine = this.getScrapToMine();
    this.adjacentEnemies = this.getAdjacentEnemies();
    this.moveable = this.isMoveable();
    this.targeted = 0;
    this.inFrontline = this.isFrontline();
    this.inInnerline = this.isInnerline();
    this.inOuterline = this.isOuterline();
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
    clone.prev = this.prev;
    return clone;
  }

  distanceTo({ x, y }: Partial<BoardCell>) {
    return Math.abs(this.x - x) + Math.abs(this.y - y);
  }

  isMine() {
    return this.owner === 1;
  }

  isFoe() {
    return this.owner === 0;
  }

  isNeutral() {
    return this.owner === -1 && this.scrapAmount > 0;
  }

  isGrass() {
    return this.scrapAmount === 0;
  }

  isGrassNextTurn() {
    return this.scrapAmount === 1 && this.inRangeOfRecycler;
  }

  isMoveable() {
    return !(this.recycler || this.isGrass() || this.isGrassNextTurn());
  }

  isInnerline() {
    return this.isMine() && Boolean(this.adjacent.find((_) => !_.isMine()));
  }

  isOuterline() {
    return !this.isMine() && Boolean(this.adjacent.find((_) => _.isMine()));
  }

  isFrontline() {
    return this.isMine() && Boolean(this.adjacent.find((_) => !_.isFoe()));
  }

  isRecycledByMe() {
    return !!this.adjacent.find((_) => _.recycler && _.isMine());
  }

  isRecycledByOpponent() {
    return !!this.adjacent.find((_) => _.recycler && _.isFoe());
  }

  getScrapToMine() {
    if (!this.canBuild) return 0;

    return this.adjacent
      .map((_) => {
        if (_.recycledByMe) return 0;
        if (_.recycledByOpponent) return _.scrapAmount / 2;
        return _.scrapAmount;
      })
      .map((scrap) => Math.min(scrap, this.scrapAmount))
      .reduce((sum, scrap) => sum + scrap, this.scrapAmount);
  }

  getAdjacentEnemies() {
    return this.adjacent
      .map((_) => (_.isFoe() ? _.units : 0))
      .reduce((sum, units) => sum + units, 0);
  }

  hasEmptyEnemyAdjacent() {
    return !!this.adjacent.find(
      (_) => _.isFoe() && _.units === 0 && _.moveable
    );
  }

  getExpansionScore(): number {
    if (!this.moveable) return 0;
    if (this.isMine()) return -this.units;
    if (this.isFoe()) return this.units ? -this.units : 3;
    if (this.isNeutral()) return 5;
    return 0;
  }
}
