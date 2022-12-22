import { TurnData } from '../Game/TurnData';
import { BoardCell } from './BoardCell';

export class Board {
  width: number;
  height: number;
  cells: BoardCell[];
  cellsXY: BoardCell[][];

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

  update({ board }: TurnData) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].update(board[y][x]);
      }
    }
  }

  updateAnalytics() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].updateAnalytics();
      }
    }
  }
}
