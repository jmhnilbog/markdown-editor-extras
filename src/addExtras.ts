import markdownItAttrs from "markdown-it-attrs";
// import * as markdownItCheckbox from "markdown-it-checkbox";
import markdownItContainer from "markdown-it-container";
import markdownItDeflist from "markdown-it-deflist";
// import * as markdownItEmoji from "markdown-it-emoji";
// import * as markdownItFootnote from "markdown-it-footnote";
// import * as markdownItHTML5Embed from "markdown-it-html5-embed";
// import markdownItKbd from "markdown-it-kbd";
// import * as markdownItMark from "markdown-it-mark";
// import * as markdownItMultimdTable from "markdown-it-multimd-table";
// import * as markdownItSub from "markdown-it-sub";
// import * as markdownItSup from "markdown-it-sup";
// // import * as markdownItToc from "markdown-it-toc";
// import * as markdownItUnderline from "markdown-it-underline";
import MarkdownIt from "markdown-it";

export const addExtras = (markdownIt: MarkdownIt) => {
  // todo: get settings as well

  // Allow {.class #id data-other="foo"} tags
  markdownIt.use(markdownItAttrs, {
    leftDelimiter: "{",
    rightDelimiter: "}",
    allowedAttributes: ["class", "id", /^(?!on).*$/gim],
  });

  markdownIt.use(markdownItContainer, "any-class", {
    validate: () => true,

    render: (tokens, idx, options, _env, self) => {
      const m = tokens[idx].info.trim().match(/^(.*)$/);

      if (tokens[idx].nesting === 1) {
        tokens[idx].attrPush(["class", m[1]]);
      }

      return self.renderToken(tokens, idx, options);
    },
  });

  markdownIt.use(markdownItDeflist);

  return markdownIt;
};

export default addExtras;

// const { markdownIt } = window.MEME;

// // TODO: choose which plugins to include via settings

// const attrsConfig = {
//   leftDelimiter: "{",
//   rightDelimiter: "}",
//   allowedAttributes: ["class", "id", /^(?!on).*$/gim],
// };

// markdownIt.use(markdownItAttrs, attrsConfig);

// // This breaks a bit of the heading_open rule in MEME, which is addressed here.

// const originalHeadingOpenRule = markdownIt.renderer.rules["heading_open"];

// markdownIt.renderer.rules["heading_open"] = (
//   tokens,
//   idx,
//   options,
//   _env,
//   self
// ) => {
//   const token = tokens[idx];
//   const nextToken = tokens[idx + 1];
//   const link = nextToken?.content || "";

//   token.attrSet("name", `${token.markup}${link}`);

//   return self.renderToken(tokens, idx, options);
// };

//   let firstHeader = true;

//   // change the rule applied to write a custom name attr on headers in MEME
//   // AND...allow easy folding
//   markdownIt.renderer.rules["heading_open"] = (
//     tokens,
//     idx,
//     options,
//     _env,
//     self
//   ) => {
//     const token = tokens[idx];
//     const nextToken = tokens[idx + 1];
//     const link = nextToken?.content || "";

//     token.attrSet("name", `${token.markup}${link}`);

//     const headerOpen = self.renderToken(tokens, idx, options);

//     let wrapped = `<details open="1"><summary>${headerOpen}`;

//     if (firstHeader) {
//       firstHeader = false;
//     } else {
//       wrapped = `</details>${wrapped}`;
//     }

//     console.log("TOKEN:", wrapped);

//     return wrapped;
//   };

//   markdownIt.renderer.rules["heading_close"] = (
//     tokens,
//     idx,
//     options,
//     _env,
//     self
//   ) => {
//     const headerClose = self.renderToken(tokens, idx, options);

//     return `${headerClose}</summary>`;
//   };

//   markdownIt.use(markdownItCheckbox, {
//     divWrap: true,
//     divClass: "cb",
//     idPrefix: "cbx_",
//   });

//   markdownIt.use(markdownItContainer, "fold-closed", {
//     validate: (params) => {
//       return params.trim().match(/^fold-closed\s+(.*)$/);
//     },

//     render: (tokens, idx) => {
//       const m = tokens[idx].info.trim().match(/^fold-closed\s+(.*)$/);

//       if (tokens[idx].nesting === 1) {
//         return (
//           "<details><summary>" +
//           markdownIt.utils.escapeHtml(m[1]) +
//           "</summary>\n"
//         );
//       } else {
//         // closing tag
//         return "</details>\n";
//       }
//     },
//   });

//   markdownIt.use(markdownItContainer, "fold", {
//     validate: (params) => {
//       return params.trim().match(/^fold\s+(.*)$/);
//     },

//     render: (tokens, idx) => {
//       const m = tokens[idx].info.trim().match(/^fold\s+(.*)$/);

//       if (tokens[idx].nesting === 1) {
//         return (
//           "<details open='1'><summary>" +
//           markdownIt.utils.escapeHtml(m[1]) +
//           "</summary>\n"
//         );
//       } else {
//         // closing tag
//         return "</details>\n";
//       }
//     },
//   });

//   markdownIt.use(markdownItContainer, "any-class", {
//     validate: () => true,

//     render: (tokens, idx, options, _env, self) => {
//       const m = tokens[idx].info.trim().match(/^(.*)$/);

//       tokens[idx].attrPush(["class", m[1]]);

//       return self.renderToken(tokens, idx, options);
//     },
//   });

//   // // give any other containers an 'unknown' class
//   // markdownIt.use(markdownItContainer, "unknown", {
//   //   validate: (_params) => {
//   //     return true;
//   //   },
//   // });

//   markdownIt.use(markdownItDeflist);

//   markdownIt.use(markdownItEmoji);

//   markdownIt.use(markdownItFootnote);

//   markdownIt.use(markdownItHTML5Embed, {
//     html5embed: {
//       useImageSyntax: true, // Enables video/audio embed with ![]() syntax (default)
//       useLinkSyntax: true, // Enables video/audio embed with []() syntax
//     },
//   });

//   // TODO: check TS error
//   markdownIt.use(markdownItKbd);

//   markdownIt.use(markdownItMark);

//   markdownIt.use(markdownItMultimdTable);

//   markdownIt.use(markdownItSub);

//   markdownIt.use(markdownItSup);

//   // TODO: see if there's a way to link directly to a journal
//   // markdownIt.use(markdownItToc);

//   markdownIt.use(markdownItUnderline);

//   console.log("INIT markdownit extras wATTRS!", markdownIt);
