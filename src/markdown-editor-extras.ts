import "./module.scss";

import { TemplatePreloader } from "./module/helper/TemplatePreloader";

import * as markdownItAttrs from "markdown-it-attrs";
import * as markdownItCheckbox from "markdown-it-checkbox";
import * as markdownItContainer from "markdown-it-container";
import * as markdownItDeflist from "markdown-it-deflist";
import * as markdownItEmoji from "markdown-it-emoji";
import * as markdownItFootnote from "markdown-it-footnote";
import * as markdownItHTML5Embed from "markdown-it-html5-embed";
import markdownItKbd from "markdown-it-kbd";
import * as markdownItMark from "markdown-it-mark";
import * as markdownItMultimdTable from "markdown-it-multimd-table";
import * as markdownItSub from "markdown-it-sub";
import * as markdownItSup from "markdown-it-sup";
import * as markdownItToc from "markdown-it-toc";
import * as markdownItUnderline from "markdown-it-underline";

Hooks.once("init", async () => {
  const { markdownIt } = window.MEME;

  // TODO: choose which plugins to include via settings

  const attrsConfig = {
    leftDelimiter: "{",
    rightDelimiter: "}",
    allowedAttributes: ["class", "id", /^(?!on).*$/gim],
  };

  markdownIt.use(markdownItAttrs, attrsConfig);

  // change the rule applied to write a custom name attr on headers in MEME
  markdownIt.renderer.rules["heading_open"] = (
    tokens,
    idx,
    options,
    _env,
    self
  ) => {
    const token = tokens[idx];
    const nextToken = tokens[idx + 1];
    const link = nextToken?.content || "";

    token.attrSet("name", `${token.markup}${link}`);

    return self.renderToken(tokens, idx, options);
  };

  markdownIt.use(markdownItCheckbox, {
    divWrap: true,
    divClass: "cb",
    idPrefix: "cbx_",
  });

  markdownIt.use(markdownItContainer, "sensory-info", {});
  markdownIt.use(markdownItContainer, "hidden", {});
  markdownIt.use(markdownItContainer, "danger", {});
  markdownIt.use(markdownItContainer, "trap", {});
  markdownIt.use(markdownItContainer, "creature", {});

  // give any other containers an 'unknown' class
  markdownIt.use(markdownItContainer, "unknown", {
    validate: (_params) => {
      return true;
    },
  });

  markdownIt.use(markdownItDeflist);

  markdownIt.use(markdownItEmoji);

  markdownIt.use(markdownItFootnote);

  markdownIt.use(markdownItHTML5Embed, {
    html5embed: {
      useImageSyntax: true, // Enables video/audio embed with ![]() syntax (default)
      useLinkSyntax: true, // Enables video/audio embed with []() syntax
    },
  });

  // TODO: check TS error
  markdownIt.use(markdownItKbd);

  markdownIt.use(markdownItMark);

  markdownIt.use(markdownItMultimdTable);

  markdownIt.use(markdownItSub);

  markdownIt.use(markdownItSup);

  markdownIt.use(markdownItToc);

  markdownIt.use(markdownItUnderline);

  console.log("INIT markdownit extras wATTRS!", markdownIt);
});

Hooks.once("MemeRenderEditor", async (a, b) => {
  console.log("MEMERENDERENDITOR markdownit extras!", a, b);
});

Hooks.once("ready", async () => {
  console.log("Test");
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
