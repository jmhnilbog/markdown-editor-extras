import markdownIt from "markdown-it";

declare global {
  interface Window {
    MEME: {
      BaseMeme: any;
      ChatMeme: any;
      markdownIt: markdownIt;
    };
  }
}
