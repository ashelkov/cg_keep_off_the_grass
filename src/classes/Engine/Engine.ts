import { GameState } from '../Game/GameState';

export class Engine {
  state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  makeMove() {
    console.log('WAIT');
  }

  debugger() {
    const { cellsXY } = this.state.board;
    // console.error('cellsXY[0][0]', cellsXY[0][0]);
    // console.error('cellsXY[0][1]', cellsXY[0][1]);
  }
}
