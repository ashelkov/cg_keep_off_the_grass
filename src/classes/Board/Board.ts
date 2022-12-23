import { TurnData } from '../Game/TurnData';
import { BoardCell } from './BoardCell';

export class Board {
  width: number;
  height: number;
  cells: BoardCell[];
  cellsXY: BoardCell[][];

  innerBorder: BoardCell[]; // mine cells adjacent with enemy or neutral cells
  outerBorder: BoardCell[]; // not mine cells adjacent with mine

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = [];
    this.cellsXY = [];

    this.createGrid();
    this.initialize();
  }

  createGrid() {
    for (let y = 0; y < this.height; y++) {
      const row: BoardCell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(new BoardCell(x, y));
      }
      this.cellsXY.push(row);
      this.cells.push(...row);
    }
  }

  initialize() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].initialize(this);
      }
    }
  }

  update({ board, turn }: TurnData) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].update(board[y][x]);
      }
    }

    if (turn === 1) {
      this.calcDistanceToSpawns();
    }
  }

  calcDistanceToSpawns() {
    const mySpawnPoint = this.cells.find((_) => _.isMine() && !_.units);
    const oppSpawnPoint = this.cells.find((_) => _.isFoe() && !_.units);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cellsXY[y][x];
        cell.distanceToMySpawn = cell.distanceTo(mySpawnPoint);
        cell.distanceToOpponentSpawn = cell.distanceTo(oppSpawnPoint);
      }
    }
  }

  updateAnalytics() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].updateAnalytics();
      }
    }
    this.innerBorder = this.getInnerBorder();
    this.outerBorder = this.getOuterBorder();
  }

  /* Analytical methods */

  getInnerBorder() {
    return this.cells.filter(
      (cell) =>
        cell.isMine() &&
        cell.canMoveHere &&
        cell.adjacent.some((_) => !_.isMine() && _.canMoveHere)
    );
  }

  getOuterBorder() {
    return this.cells.filter(
      (cell) =>
        !cell.isMine() &&
        cell.canMoveHere &&
        cell.adjacent.some((_) => _.isMine() && _.canMoveHere)
    );
  }
}
