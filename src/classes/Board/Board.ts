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
    this.cellsXY = [];

    this.initialize();
  }

  initialize() {
    // 1. Create 2 dimansional grid
    for (let y = 0; y < this.height; y++) {
      const row: BoardCell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(new BoardCell(x, y));
      }
      this.cellsXY.push(row);
    }

    // 2. Populate `next` prop with adjustent tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].next = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]
          .filter(
            ([x, y]) => !(x < 0 || y < 0 || x >= this.width || y >= this.height)
          )
          .map(([x, y]) => this.cellsXY[y][x]);
      }
    }

    // 3. Convert `cellsXY` to flat array
    this.cells = this.cellsXY.reduce((res, row) => res.concat(row), []);
  }

  update({ board }: TurnData) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].prev = this.cellsXY[y][x].clone();
        this.cellsXY[y][x].scrapAmount = board[y][x].scrapAmount;
        this.cellsXY[y][x].owner = board[y][x].owner;
        this.cellsXY[y][x].units = board[y][x].units;
        this.cellsXY[y][x].recycler = Boolean(board[y][x].recycler);
        this.cellsXY[y][x].canBuild = Boolean(board[y][x].canBuild);
        this.cellsXY[y][x].canSpawn = Boolean(board[y][x].canSpawn);
        this.cellsXY[y][x].inRangeOfRecycler = Boolean(
          board[y][x].inRangeOfRecycler
        );
      }
    }
  }
}
