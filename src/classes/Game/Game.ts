import { Engine } from '../Engine/Engine';
import { GameState } from './GameState';
import { TurnData } from './TurnData';

export class Game {
  state: GameState;
  turnData: TurnData;
  engine: Engine;

  constructor() {
    // @ts-ignore
    const [width, height] = readline().split(' ').map(Number);

    this.state = new GameState(width, height);
    this.turnData = new TurnData(width, height);
    this.engine = new Engine(this.state);

    this.start();
  }

  start() {
    while (true) {
      // 1. Read turn data
      this.turnData.read();

      // 2. Update game state
      this.state.update(this.turnData);

      // 3. Debugger
      this.engine.debugger();

      // 4. Make a move
      this.engine.makeMove();
    }
  }
}
