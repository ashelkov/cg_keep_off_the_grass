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

  update({ board, turn }: TurnData) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].update(board[y][x]);
      }
    }

    if (turn === 1) {
      this.calcDistanceToSpawns();
      this.calcDistanceCoef();
    }
  }

  calcDistanceToSpawns() {
    const mySpawnPoint = this.cells.find((_) => _.isMine() && !_.units);
    const oppSpawnPoint = this.cells.find((_) => _.isFoe() && !_.units);
    this.cells.forEach((cell) => {
      cell.distanceToMySpawn = cell.distanceTo(mySpawnPoint);
      cell.distanceToOpponentSpawn = cell.distanceTo(oppSpawnPoint);
      // area owner
      const delta = cell.distanceToMySpawn - cell.distanceToOpponentSpawn;
      cell.areaOwner = delta > 0 ? 0 : delta < 0 ? 1 : -1;
    });
  }

  calcDistanceCoef() {
    const mySpawnPoint = this.cells.find((_) => _.isMine() && !_.units);
    const oppSpawnPoint = this.cells.find((_) => _.isFoe() && !_.units);
    this.cells.forEach((cell) => {
      const oppDistX = Math.abs(cell.x - oppSpawnPoint.x);
      const oppDistY = Math.abs(cell.y - oppSpawnPoint.y);
      const myDistX = Math.abs(cell.x - mySpawnPoint.x);
      const myDistY = Math.abs(cell.y - mySpawnPoint.y);
      const distanceCoef =
        (0.75 * (myDistX + (this.width - oppDistX))) / this.width +
        (0.25 * (myDistY + (this.height - oppDistY))) / this.height;
      cell.distanceCoef = distanceCoef;
    });
  }

  updateAnalytics() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cellsXY[y][x].updateAnalytics();
      }
    }
  }
}
