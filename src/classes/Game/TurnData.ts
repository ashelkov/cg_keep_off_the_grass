export class TurnData {
  myMatter: number;
  oppMatter: number;
  board: ICellTurnData[][];
  width: number;
  height: number;
  turn: number;
  turnTimestamp: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.turn = 0;
  }

  read() {
    // @ts-ignore
    var inputs: string[] = readline().split(' ');
    const myMatter: number = parseInt(inputs[0]);
    const oppMatter: number = parseInt(inputs[1]);

    const board: ICellTurnData[][] = [];

    for (let y = 0; y < this.height; y++) {
      const cells: ICellTurnData[] = [];

      for (let x = 0; x < this.width; x++) {
        // @ts-ignore
        var inputs: string[] = readline().split(' ');
        const scrapAmount: number = parseInt(inputs[0]);
        const owner: number = parseInt(inputs[1]); // 1 = me, 0 = foe, -1 = neutral
        const units: number = parseInt(inputs[2]);
        const recycler: number = parseInt(inputs[3]);
        const canBuild: number = parseInt(inputs[4]);
        const canSpawn: number = parseInt(inputs[5]);
        const inRangeOfRecycler: number = parseInt(inputs[6]);

        cells.push({
          scrapAmount,
          owner,
          units,
          recycler,
          canBuild,
          canSpawn,
          inRangeOfRecycler,
          x,
          y,
        });
      }

      board.push(cells);
    }

    this.turn++;
    this.turnTimestamp = Number(new Date());
    this.myMatter = myMatter;
    this.oppMatter = oppMatter;
    this.board = board;
  }
}

export interface ICellTurnData {
  scrapAmount: number;
  owner: number;
  units: number;
  recycler: number;
  canBuild: number;
  canSpawn: number;
  inRangeOfRecycler: number;
  x: number;
  y: number;
}
