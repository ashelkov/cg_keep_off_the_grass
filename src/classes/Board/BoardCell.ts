export class BoardCell {
  x: number;
  y: number;

  scrapAmount: number;
  owner: number;
  units: number;
  recycler: boolean;
  canBuild: boolean;
  canSpawn: boolean;
  inRangeOfRecycler: boolean;
  next: BoardCell[];
  prev?: BoardCell;

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
    this.next = [];
    this.prev = null;
  }

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

  distanceTo({ x, y }: Partial<BoardCell>) {
    return Math.abs(this.x - x) + Math.abs(this.y - y);
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
    clone.next = this.next;
    return clone;
  }
}
