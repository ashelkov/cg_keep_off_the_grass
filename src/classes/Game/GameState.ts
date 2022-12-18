import { Board } from '../Board/Board';
import { TurnData } from './TurnData';

export class GameState {
  turn: number;
  myMatter: number;
  oppMatter: number;
  board: Board;

  constructor(width: number, height: number) {
    this.turn = 0;
    this.myMatter = 0;
    this.oppMatter = 0;
    this.board = new Board(width, height);
  }

  update(turnData: TurnData) {
    this.turn = this.turn + 1;
    this.myMatter = turnData.myMatter;
    this.oppMatter = turnData.oppMatter;
    this.board.update(turnData);
  }
}
