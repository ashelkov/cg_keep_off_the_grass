import { TurnData } from '../Game/TurnData';
import { BoardCell } from './BoardCell';

export class Board {
  width: number;
  height: number;
  cells: BoardCell[];
  cellsXY: BoardCell[][];
  maxDistanceToSpawn: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = [];
    this.cellsXY = [];
    this.maxDistanceToSpawn = 0;

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
      this.calcDistanceToSpawnScore();
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
      // max distance to spawn
      if (cell.distanceToMySpawn > this.maxDistanceToSpawn) {
        this.maxDistanceToSpawn = cell.distanceToMySpawn;
      }
    });
  }

  calcDistanceToSpawnScore() {
    this.cells.forEach((cell) => {
      cell._distanceToMySpawn =
        Math.ceil((cell.distanceToMySpawn / this.maxDistanceToSpawn) * 100) /
        100;
      cell._distanceToOpponentSpawn =
        Math.ceil(
          (cell.distanceToOpponentSpawn / this.maxDistanceToSpawn) * 100
        ) / 100;
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
