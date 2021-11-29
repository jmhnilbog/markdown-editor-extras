import markdownIt from "markdown-it";
import Chatter from "./src/module/chatter";

declare global {
    interface Window {
        MEME: {
            BaseMeme: any;
            ChatMeme: any;
            markdownIt: markdownIt;
        };
    }

    interface Game {
        // constructor available at game.Chatter
      Chatter: ConstructorType<Chatter | null;
      npcChatter: Chatter | null;
    }
}
