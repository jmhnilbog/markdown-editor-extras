// import "./module.scss";

import { TemplatePreloader } from "./module/helper/TemplatePreloader";

import MarkdownIt from "markdown-it";

import addExtras from "./addExtras";

// Use pretty quotes
Hooks.once("MemeActivateEditor", async (options: MarkdownIt.Options) => {
  options.typographer = true;
  return options;
});
Hooks.once("MemeActivateChat", async (options: MarkdownIt.Options) => {
  options.typographer = true;
  return options;
});
Hooks.once("init", async () => {
  const { markdownIt } = window.MEME;

  addExtras(markdownIt);
});

Hooks.once("MemeRenderEditor", async (a, b) => {
  console.log("markdown-editor-extras heard MemeRenderEditor event.", a, b);
});

Hooks.once("ready", async () => {
  console.log("markdown-editor-extras ready");
});

if (process.env.NODE_ENV === "development") {
  if (module.hot) {
    module.hot.accept();

    if (module.hot.status() === "apply") {
      for (const template in _templateCache) {
        if (Object.prototype.hasOwnProperty.call(_templateCache, template)) {
          delete _templateCache[template];
        }
      }

      TemplatePreloader.preloadHandlebarsTemplates().then(() => {
        for (const application in ui.windows) {
          if (Object.prototype.hasOwnProperty.call(ui.windows, application)) {
            ui.windows[application].render(true);
          }
        }
      });
    }
  }
}
