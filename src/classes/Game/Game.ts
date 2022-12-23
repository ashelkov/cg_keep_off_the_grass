import { Engine } from '../Engine/Engine';
import { GameState } from './GameState';
import { TurnData } from './TurnData';

export class Game {
  state: GameState;
  turnData: TurnData;
  engine: Engine;

  turnTimestamp: number;

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

      // 3. Update analytics
      this.state.updateAnalytics();

      // 4. Make analysis
      this.engine.analyze();

      // 5. Debug output
      this.engine.debugger();

      // 6. Make a move
      this.engine.printCommand();
    }
  }
}
