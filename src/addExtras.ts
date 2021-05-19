import markdownItAttrs from "markdown-it-attrs";
import markdownItCheckbox from "markdown-it-checkbox";
import markdownItContainer from "markdown-it-container";
import markdownItDeflist from "markdown-it-deflist";
import markdownItEmoji from "markdown-it-emoji";
// import * as markdownItFootnote from "markdown-it-footnote";
// import markdownItHTML5Embed from "markdown-it-html5-embed";
// import markdownItKbd from "markdown-it-kbd";
import markdownItMark from "markdown-it-mark";
import markdownItMultimdTable from "markdown-it-multimd-table";
// import * as markdownItSub from "markdown-it-sub";
// import * as markdownItSup from "markdown-it-sup";
// // import * as markdownItToc from "markdown-it-toc";
import markdownItUnderline from "markdown-it-underline";
import MarkdownIt from "markdown-it";

const addAttr = (md: MarkdownIt) => {
  // Allow {.class #id data-other="foo"} tags
  md.use(markdownItAttrs, {
    leftDelimiter: "{",
    rightDelimiter: "}",
    allowedAttributes: ["class", "id", /^(?!on).*$/gim],
  });

  // change the rule applied to write a custom name attr on headers in MEME
  md.renderer.rules["heading_open"] = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const nextToken = tokens[idx + 1];
    const link = nextToken?.content || "";

    token.attrSet("name", `${token.markup}${link}`);

    return self.renderToken(tokens, idx, options);
  };

  return md;
};

export const addExtras = (md: MarkdownIt) => {
  // TODO: reference settings
  addAttr(md);

  md.use(markdownItCheckbox);

  md.use(markdownItDeflist);

  md.use(markdownItEmoji);

  md.use(markdownItDeflist);

  md.use(markdownItEmoji);

  // md.use(markdownItHTML5Embed);

  md.use(markdownItMark);

  md.use(markdownItMultimdTable);

  md.use(markdownItUnderline);

  /* ::: word starts a block with class .word; ::: ends it */
  md.use(markdownItContainer, "any", {
    validate: () => true,

    render: (tokens, idx, options, _env, self) => {
      const m = tokens[idx].info.trim().match(/^(.*)$/);

      if (tokens[idx].nesting === 1) {
        tokens[idx].attrPush(["class", m[1]]);
      }

      return self.renderToken(tokens, idx, options);
    },
  });

  return md;
};

export default addExtras;
