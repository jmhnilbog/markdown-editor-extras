/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/markdown-it-attrs/index.js":
/*!*************************************************!*\
  !*** ./node_modules/markdown-it-attrs/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


const patternsConfig = __webpack_require__(/*! ./patterns.js */ "./node_modules/markdown-it-attrs/patterns.js");

const defaultOptions = {
  leftDelimiter: '{',
  rightDelimiter: '}',
  allowedAttributes: []
};

module.exports = function attributes(md, options_) {
  let options = Object.assign({}, defaultOptions);
  options = Object.assign(options, options_);

  const patterns = patternsConfig(options);

  function curlyAttrs(state) {
    let tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      for (let p = 0; p < patterns.length; p++) {
        let pattern = patterns[p];
        let j = null; // position of child with offset 0
        let match = pattern.tests.every(t => {
          let res = test(tokens, i, t);
          if (res.j !== null) { j = res.j; }
          return res.match;
        });
        if (match) {
          pattern.transform(tokens, i, j);
          if (pattern.name === 'inline attributes' || pattern.name === 'inline nesting 0') {
            // retry, may be several inline attributes
            p--;
          }
        }
      }
    }
  }

  md.core.ruler.before('linkify', 'curly_attributes', curlyAttrs);
};

/**
 * Test if t matches token stream.
 *
 * @param {array} tokens
 * @param {number} i
 * @param {object} t Test to match.
 * @return {object} { match: true|false, j: null|number }
 */
function test(tokens, i, t) {
  let res = {
    match: false,
    j: null  // position of child
  };

  let ii = t.shift !== undefined
    ? i + t.shift
    : t.position;
  let token = get(tokens, ii);  // supports negative ii


  if (token === undefined) { return res; }

  for (let key in t) {
    if (key === 'shift' || key === 'position') { continue; }

    if (token[key] === undefined) { return res; }

    if (key === 'children' && isArrayOfObjects(t.children)) {
      if (token.children.length === 0) {
        return res;
      }
      let match;
      let childTests = t.children;
      let children = token.children;
      if (childTests.every(tt => tt.position !== undefined)) {
        // positions instead of shifts, do not loop all children
        match = childTests.every(tt => test(children, tt.position, tt).match);
        if (match) {
          // we may need position of child in transform
          let j = last(childTests).position;
          res.j = j >= 0 ? j : children.length + j;
        }
      } else {
        for (let j = 0; j < children.length; j++) {
          match = childTests.every(tt => test(children, j, tt).match);
          if (match) {
            res.j = j;
            // all tests true, continue with next key of pattern t
            break;
          }
        }
      }

      if (match === false) { return res; }

      continue;
    }

    switch (typeof t[key]) {
    case 'boolean':
    case 'number':
    case 'string':
      if (token[key] !== t[key]) { return res; }
      break;
    case 'function':
      if (!t[key](token[key])) { return res; }
      break;
    case 'object':
      if (isArrayOfFunctions(t[key])) {
        let r = t[key].every(tt => tt(token[key]));
        if (r === false) { return res; }
        break;
      }
    // fall through for objects !== arrays of functions
    default:
      throw new Error(`Unknown type of pattern test (key: ${key}). Test should be of type boolean, number, string, function or array of functions.`);
    }
  }

  // no tests returned false -> all tests returns true
  res.match = true;
  return res;
}

function isArrayOfObjects(arr) {
  return Array.isArray(arr) && arr.length && arr.every(i => typeof i === 'object');
}

function isArrayOfFunctions(arr) {
  return Array.isArray(arr) && arr.length && arr.every(i => typeof i === 'function');
}

/**
 * Get n item of array. Supports negative n, where -1 is last
 * element in array.
 * @param {array} arr
 * @param {number} n
 */
function get(arr, n) {
  return n >= 0 ? arr[n] : arr[arr.length + n];
}

// get last element of array, safe - returns {} if not found
function last(arr) {
  return arr.slice(-1)[0] || {};
}


/***/ }),

/***/ "./node_modules/markdown-it-attrs/patterns.js":
/*!****************************************************!*\
  !*** ./node_modules/markdown-it-attrs/patterns.js ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

/**
 * If a pattern matches the token stream,
 * then run transform.
 */

const utils = __webpack_require__(/*! ./utils.js */ "./node_modules/markdown-it-attrs/utils.js");

module.exports = options => {
  const __hr = new RegExp('^ {0,3}[-*_]{3,} ?'
                          + utils.escapeRegExp(options.leftDelimiter)
                          + '[^' + utils.escapeRegExp(options.rightDelimiter) + ']');

  return ([
    {
      /**
       * ```python {.cls}
       * for i in range(10):
       *     print(i)
       * ```
       */
      name: 'fenced code blocks',
      tests: [
        {
          shift: 0,
          block: true,
          info: utils.hasDelimiters('end', options)
        }
      ],
      transform: (tokens, i) => {
        let token = tokens[i];
        let start = token.info.lastIndexOf(options.leftDelimiter);
        let attrs = utils.getAttrs(token.info, start, options);
        utils.addAttrs(attrs, token);
        token.info = utils.removeDelimiter(token.info, options);
      }
    }, {
      /**
       * bla `click()`{.c} ![](img.png){.d}
       *
       * differs from 'inline attributes' as it does
       * not have a closing tag (nesting: -1)
       */
      name: 'inline nesting 0',
      tests: [
        {
          shift: 0,
          type: 'inline',
          children: [
            {
              shift: -1,
              type: (str) => str === 'image' || str === 'code_inline'
            }, {
              shift: 0,
              type: 'text',
              content: utils.hasDelimiters('start', options)
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let endChar = token.content.indexOf(options.rightDelimiter);
        let attrToken = tokens[i].children[j - 1];
        let attrs = utils.getAttrs(token.content, 0, options);
        utils.addAttrs(attrs, attrToken);
        if (token.content.length === (endChar + options.rightDelimiter.length)) {
          tokens[i].children.splice(j, 1);
        } else {
          token.content = token.content.slice(endChar + options.rightDelimiter.length);
        }
      }
    }, {
      /**
       * | h1 |
       * | -- |
       * | c1 |
       *
       * {.c}
       */
      name: 'tables',
      tests: [
        {
          // let this token be i, such that for-loop continues at
          // next token after tokens.splice
          shift: 0,
          type: 'table_close'
        }, {
          shift: 1,
          type: 'paragraph_open'
        }, {
          shift: 2,
          type: 'inline',
          content: utils.hasDelimiters('only', options)
        }
      ],
      transform: (tokens, i) => {
        let token = tokens[i + 2];
        let tableOpen = utils.getMatchingOpeningToken(tokens, i);
        let attrs = utils.getAttrs(token.content, 0, options);
        // add attributes
        utils.addAttrs(attrs, tableOpen);
        // remove <p>{.c}</p>
        tokens.splice(i + 1, 3);
      }
    }, {
      /**
       * *emphasis*{.with attrs=1}
       */
      name: 'inline attributes',
      tests: [
        {
          shift: 0,
          type: 'inline',
          children: [
            {
              shift: -1,
              nesting: -1  // closing inline tag, </em>{.a}
            }, {
              shift: 0,
              type: 'text',
              content: utils.hasDelimiters('start', options)
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let content = token.content;
        let attrs = utils.getAttrs(content, 0, options);
        let openingToken = utils.getMatchingOpeningToken(tokens[i].children, j - 1);
        utils.addAttrs(attrs, openingToken);
        token.content = content.slice(content.indexOf(options.rightDelimiter) + options.rightDelimiter.length);
      }
    }, {
      /**
       * - item
       * {.a}
       */
      name: 'list softbreak',
      tests: [
        {
          shift: -2,
          type: 'list_item_open'
        }, {
          shift: 0,
          type: 'inline',
          children: [
            {
              position: -2,
              type: 'softbreak'
            }, {
              position: -1,
              type: 'text',
              content: utils.hasDelimiters('only', options)
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let content = token.content;
        let attrs = utils.getAttrs(content, 0, options);
        let ii = i - 2;
        while (tokens[ii - 1] &&
          tokens[ii - 1].type !== 'ordered_list_open' &&
          tokens[ii - 1].type !== 'bullet_list_open') { ii--; }
        utils.addAttrs(attrs, tokens[ii - 1]);
        tokens[i].children = tokens[i].children.slice(0, -2);
      }
    }, {
      /**
       * - nested list
       *   - with double \n
       *   {.a} <-- apply to nested ul
       *
       * {.b} <-- apply to root <ul>
       */
      name: 'list double softbreak',
      tests: [
        {
          // let this token be i = 0 so that we can erase
          // the <p>{.a}</p> tokens below
          shift: 0,
          type: (str) =>
            str === 'bullet_list_close' ||
            str === 'ordered_list_close'
        }, {
          shift: 1,
          type: 'paragraph_open'
        }, {
          shift: 2,
          type: 'inline',
          content: utils.hasDelimiters('only', options),
          children: (arr) => arr.length === 1
        }, {
          shift: 3,
          type: 'paragraph_close'
        }
      ],
      transform: (tokens, i) => {
        let token = tokens[i + 2];
        let content = token.content;
        let attrs = utils.getAttrs(content, 0, options);
        let openingToken = utils.getMatchingOpeningToken(tokens, i);
        utils.addAttrs(attrs, openingToken);
        tokens.splice(i + 1, 3);
      }
    }, {
      /**
       * - end of {.list-item}
       */
      name: 'list item end',
      tests: [
        {
          shift: -2,
          type: 'list_item_open'
        }, {
          shift: 0,
          type: 'inline',
          children: [
            {
              position: -1,
              type: 'text',
              content: utils.hasDelimiters('end', options)
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let content = token.content;
        let attrs = utils.getAttrs(content, content.lastIndexOf(options.leftDelimiter), options);
        utils.addAttrs(attrs, tokens[i - 2]);
        let trimmed = content.slice(0, content.lastIndexOf(options.leftDelimiter));
        token.content = last(trimmed) !== ' ' ?
          trimmed : trimmed.slice(0, -1);
      }
    }, {
      /**
       * something with softbreak
       * {.cls}
       */
      name: '\n{.a} softbreak then curly in start',
      tests: [
        {
          shift: 0,
          type: 'inline',
          children: [
            {
              position: -2,
              type: 'softbreak'
            }, {
              position: -1,
              type: 'text',
              content: utils.hasDelimiters('only', options)
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let attrs = utils.getAttrs(token.content, 0, options);
        // find last closing tag
        let ii = i + 1;
        while (tokens[ii + 1] && tokens[ii + 1].nesting === -1) { ii++; }
        let openingToken = utils.getMatchingOpeningToken(tokens, ii);
        utils.addAttrs(attrs, openingToken);
        tokens[i].children = tokens[i].children.slice(0, -2);
      }
    }, {
      /**
       * horizontal rule --- {#id}
       */
      name: 'horizontal rule',
      tests: [
        {
          shift: 0,
          type: 'paragraph_open'
        },
        {
          shift: 1,
          type: 'inline',
          children: (arr) => arr.length === 1,
          content: (str) => str.match(__hr) !== null,
        },
        {
          shift: 2,
          type: 'paragraph_close'
        }
      ],
      transform: (tokens, i) => {
        let token = tokens[i];
        token.type = 'hr';
        token.tag = 'hr';
        token.nesting = 0;
        let content = tokens[i + 1].content;
        let start = content.lastIndexOf(options.leftDelimiter);
        token.attrs = utils.getAttrs(content, start, options);
        token.markup = content;
        tokens.splice(i + 1, 2);
      }
    }, {
      /**
       * end of {.block}
       */
      name: 'end of block',
      tests: [
        {
          shift: 0,
          type: 'inline',
          children: [
            {
              position: -1,
              content: utils.hasDelimiters('end', options),
              type: (t) => t !== 'code_inline'
            }
          ]
        }
      ],
      transform: (tokens, i, j) => {
        let token = tokens[i].children[j];
        let content = token.content;
        let attrs = utils.getAttrs(content, content.lastIndexOf(options.leftDelimiter), options);
        let ii = i + 1;
        while (tokens[ii + 1] && tokens[ii + 1].nesting === -1) { ii++; }
        let openingToken = utils.getMatchingOpeningToken(tokens, ii);
        utils.addAttrs(attrs, openingToken);
        let trimmed = content.slice(0, content.lastIndexOf(options.leftDelimiter));
        token.content = last(trimmed) !== ' ' ?
          trimmed : trimmed.slice(0, -1);
      }
    }
  ]);
};

// get last element of array or string
function last(arr) {
  return arr.slice(-1)[0];
}


/***/ }),

/***/ "./node_modules/markdown-it-attrs/utils.js":
/*!*************************************************!*\
  !*** ./node_modules/markdown-it-attrs/utils.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/**
 * parse {.class #id key=val} strings
 * @param {string} str: string to parse
 * @param {int} start: where to start parsing (including {)
 * @returns {2d array}: [['key', 'val'], ['class', 'red']]
 */
exports.getAttrs = function (str, start, options) {
  // not tab, line feed, form feed, space, solidus, greater than sign, quotation mark, apostrophe and equals sign
  const allowedKeyChars = /[^\t\n\f />"'=]/;
  const pairSeparator = ' ';
  const keySeparator = '=';
  const classChar = '.';
  const idChar = '#';

  const attrs = [];
  let key = '';
  let value = '';
  let parsingKey = true;
  let valueInsideQuotes = false;

  // read inside {}
  // start + left delimiter length to avoid beginning {
  // breaks when } is found or end of string
  for (let i = start + options.leftDelimiter.length; i < str.length; i++) {
    if (str.slice(i, i + options.rightDelimiter.length) === options.rightDelimiter) {
      if (key !== '') { attrs.push([key, value]); }
      break;
    }
    let char_ = str.charAt(i);

    // switch to reading value if equal sign
    if (char_ === keySeparator && parsingKey) {
      parsingKey = false;
      continue;
    }

    // {.class} {..css-module}
    if (char_ === classChar && key === '') {
      if (str.charAt(i + 1) === classChar) {
        key = 'css-module';
        i += 1;
      } else {
        key = 'class';
      }
      parsingKey = false;
      continue;
    }

    // {#id}
    if (char_ === idChar && key === '') {
      key = 'id';
      parsingKey = false;
      continue;
    }

    // {value="inside quotes"}
    if (char_ === '"' && value === '') {
      valueInsideQuotes = true;
      continue;
    }
    if (char_ === '"' && valueInsideQuotes) {
      valueInsideQuotes = false;
      continue;
    }

    // read next key/value pair
    if ((char_ === pairSeparator && !valueInsideQuotes)) {
      if (key === '') {
        // beginning or ending space: { .red } vs {.red}
        continue;
      }
      attrs.push([key, value]);
      key = '';
      value = '';
      parsingKey = true;
      continue;
    }

    // continue if character not allowed
    if (parsingKey && char_.search(allowedKeyChars) === -1) {
      continue;
    }

    // no other conditions met; append to key/value
    if (parsingKey) {
      key += char_;
      continue;
    }
    value += char_;
  }

  if (options.allowedAttributes && options.allowedAttributes.length) {
    let allowedAttributes = options.allowedAttributes;

    return attrs.filter(function (attrPair) {
      let attr = attrPair[0];

      function isAllowedAttribute (allowedAttribute) {
        return (attr === allowedAttribute
          || (allowedAttribute instanceof RegExp && allowedAttribute.test(attr))
        );
      }

      return allowedAttributes.some(isAllowedAttribute);
    });

  } else {
    return attrs;
  }
};

/**
 * add attributes from [['key', 'val']] list
 * @param {array} attrs: [['key', 'val']]
 * @param {token} token: which token to add attributes
 * @returns token
 */
exports.addAttrs = function (attrs, token) {
  for (let j = 0, l = attrs.length; j < l; ++j) {
    let key = attrs[j][0];
    if (key === 'class') {
      token.attrJoin('class', attrs[j][1]);
    } else if (key === 'css-module') {
      token.attrJoin('css-module', attrs[j][1]);
    } else {
      token.attrPush(attrs[j]);
    }
  }
  return token;
};

/**
 * Does string have properly formatted curly?
 *
 * start: '{.a} asdf'
 * middle: 'a{.b}c'
 * end: 'asdf {.a}'
 * only: '{.a}'
 *
 * @param {string} where to expect {} curly. start, middle, end or only.
 * @return {function(string)} Function which testes if string has curly.
 */
exports.hasDelimiters = function (where, options) {

  if (!where) {
    throw new Error('Parameter `where` not passed. Should be "start", "middle", "end" or "only".');
  }

  /**
   * @param {string} str
   * @return {boolean}
   */
  return function (str) {
    // we need minimum three chars, for example {b}
    let minCurlyLength = options.leftDelimiter.length + 1 + options.rightDelimiter.length;
    if (!str || typeof str !== 'string' || str.length < minCurlyLength) {
      return false;
    }

    function validCurlyLength (curly) {
      let isClass = curly.charAt(options.leftDelimiter.length) === '.';
      let isId = curly.charAt(options.leftDelimiter.length) === '#';
      return (isClass || isId)
        ? curly.length >= (minCurlyLength + 1)
        : curly.length >= minCurlyLength;
    }

    let start, end, slice, nextChar;
    let rightDelimiterMinimumShift = minCurlyLength - options.rightDelimiter.length;
    switch (where) {
    case 'start':
      // first char should be {, } found in char 2 or more
      slice = str.slice(0, options.leftDelimiter.length);
      start = slice === options.leftDelimiter ? 0 : -1;
      end = start === -1 ? -1 : str.indexOf(options.rightDelimiter, rightDelimiterMinimumShift);
      // check if next character is not one of the delimiters
      nextChar = str.charAt(end + options.rightDelimiter.length);
      if (nextChar && options.rightDelimiter.indexOf(nextChar) !== -1) {
        end = -1;
      }
      break;

    case 'end':
      // last char should be }
      start = str.lastIndexOf(options.leftDelimiter);
      end = start === -1 ? -1 : str.indexOf(options.rightDelimiter, start + rightDelimiterMinimumShift);
      end = end === str.length - options.rightDelimiter.length ? end : -1;
      break;

    case 'only':
      // '{.a}'
      slice = str.slice(0, options.leftDelimiter.length);
      start = slice === options.leftDelimiter ? 0 : -1;
      slice = str.slice(str.length - options.rightDelimiter.length);
      end = slice === options.rightDelimiter ? str.length - options.rightDelimiter.length : -1;
      break;
    }

    return start !== -1 && end !== -1 && validCurlyLength(str.substring(start, end + options.rightDelimiter.length));
  };
};

/**
 * Removes last curly from string.
 */
exports.removeDelimiter = function (str, options) {
  const start = escapeRegExp(options.leftDelimiter);
  const end = escapeRegExp(options.rightDelimiter);

  let curly = new RegExp(
    '[ \\n]?' + start + '[^' + start + end + ']+' + end + '$'
  );
  let pos = str.search(curly);

  return pos !== -1 ? str.slice(0, pos) : str;
};

/**
 * Escapes special characters in string s such that the string
 * can be used in `new RegExp`. For example "[" becomes "\\[".
 *
 * @param {string} s Regex string.
 * @return {string} Escaped string.
 */
function escapeRegExp (s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
exports.escapeRegExp = escapeRegExp;

/**
 * find corresponding opening block
 */
exports.getMatchingOpeningToken = function (tokens, i) {
  if (tokens[i].type === 'softbreak') {
    return false;
  }
  // non closing blocks, example img
  if (tokens[i].nesting === 0) {
    return tokens[i];
  }

  let level = tokens[i].level;
  let type = tokens[i].type.replace('_close', '_open');

  for (; i >= 0; --i) {
    if (tokens[i].type === type && tokens[i].level === level) {
      return tokens[i];
    }
  }
};


/**
 * from https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.js
 */
let HTML_ESCAPE_TEST_RE = /[&<>"]/;
let HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
let HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}

exports.escapeHtml = function (str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  }
  return str;
};


/***/ }),

/***/ "./node_modules/markdown-it-checkbox/index.js":
/*!****************************************************!*\
  !*** ./node_modules/markdown-it-checkbox/index.js ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var _, checkboxReplace;

_ = __webpack_require__(/*! underscore */ "./node_modules/underscore/underscore-umd.js");

checkboxReplace = function(md, options, Token) {
  "use strict";
  var arrayReplaceAt, createTokens, defaults, lastId, pattern, splitTextToken;
  arrayReplaceAt = md.utils.arrayReplaceAt;
  lastId = 0;
  defaults = {
    divWrap: false,
    divClass: 'checkbox',
    idPrefix: 'checkbox'
  };
  options = _.extend(defaults, options);
  pattern = /\[(X|\s|\_|\-)\]\s(.*)/i;
  createTokens = function(checked, label, Token) {
    var id, nodes, token;
    nodes = [];

    /**
     * <div class="checkbox">
     */
    if (options.divWrap) {
      token = new Token("checkbox_open", "div", 1);
      token.attrs = [["class", options.divClass]];
      nodes.push(token);
    }

    /**
     * <input type="checkbox" id="checkbox{n}" checked="true">
     */
    id = options.idPrefix + lastId;
    lastId += 1;
    token = new Token("checkbox_input", "input", 0);
    token.attrs = [["type", "checkbox"], ["id", id]];
    if (checked === true) {
      token.attrs.push(["checked", "true"]);
    }
    nodes.push(token);

    /**
     * <label for="checkbox{n}">
     */
    token = new Token("label_open", "label", 1);
    token.attrs = [["for", id]];
    nodes.push(token);

    /**
     * content of label tag
     */
    token = new Token("text", "", 0);
    token.content = label;
    nodes.push(token);

    /**
     * closing tags
     */
    nodes.push(new Token("label_close", "label", -1));
    if (options.divWrap) {
      nodes.push(new Token("checkbox_close", "div", -1));
    }
    return nodes;
  };
  splitTextToken = function(original, Token) {
    var checked, label, matches, text, value;
    text = original.content;
    matches = text.match(pattern);
    if (matches === null) {
      return original;
    }
    checked = false;
    value = matches[1];
    label = matches[2];
    if (value === "X" || value === "x") {
      checked = true;
    }
    return createTokens(checked, label, Token);
  };
  return function(state) {
    var blockTokens, i, j, l, token, tokens;
    blockTokens = state.tokens;
    j = 0;
    l = blockTokens.length;
    while (j < l) {
      if (blockTokens[j].type !== "inline") {
        j++;
        continue;
      }
      tokens = blockTokens[j].children;
      i = tokens.length - 1;
      while (i >= 0) {
        token = tokens[i];
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, splitTextToken(token, state.Token));
        i--;
      }
      j++;
    }
  };
};


/*global module */

module.exports = function(md, options) {
  "use strict";
  md.core.ruler.push("checkbox", checkboxReplace(md, options));
};


/***/ }),

/***/ "./node_modules/markdown-it-container/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/markdown-it-container/index.js ***!
  \*****************************************************/
/***/ ((module) => {

"use strict";
// Process block-level custom containers
//



module.exports = function container_plugin(md, name, options) {

  // Second param may be useful if you decide
  // to increase minimal allowed marker length
  function validateDefault(params/*, markup*/) {
    return params.trim().split(' ', 2)[0] === name;
  }

  function renderDefault(tokens, idx, _options, env, slf) {

    // add a class to the opening tag
    if (tokens[idx].nesting === 1) {
      tokens[idx].attrJoin('class', name);
    }

    return slf.renderToken(tokens, idx, _options, env, slf);
  }

  options = options || {};

  var min_markers = 3,
      marker_str  = options.marker || ':',
      marker_char = marker_str.charCodeAt(0),
      marker_len  = marker_str.length,
      validate    = options.validate || validateDefault,
      render      = options.render || renderDefault;

  function container(state, startLine, endLine, silent) {
    var pos, nextLine, marker_count, markup, params, token,
        old_parent, old_line_max,
        auto_closed = false,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // Check out the first character quickly,
    // this should filter out most of non-containers
    //
    if (marker_char !== state.src.charCodeAt(start)) { return false; }

    // Check out the rest of the marker string
    //
    for (pos = start + 1; pos <= max; pos++) {
      if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
        break;
      }
    }

    marker_count = Math.floor((pos - start) / marker_len);
    if (marker_count < min_markers) { return false; }
    pos -= (pos - start) % marker_len;

    markup = state.src.slice(start, pos);
    params = state.src.slice(pos, max);
    if (!validate(params, markup)) { return false; }

    // Since start is found, we can report success here in validation mode
    //
    if (silent) { return true; }

    // Search for the end of the block
    //
    nextLine = startLine;

    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      if (marker_char !== state.src.charCodeAt(start)) { continue; }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      for (pos = start + 1; pos <= max; pos++) {
        if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
          break;
        }
      }

      // closing code fence must be at least as long as the opening one
      if (Math.floor((pos - start) / marker_len) < marker_count) { continue; }

      // make sure tail has spaces only
      pos -= (pos - start) % marker_len;
      pos = state.skipSpaces(pos);

      if (pos < max) { continue; }

      // found!
      auto_closed = true;
      break;
    }

    old_parent = state.parentType;
    old_line_max = state.lineMax;
    state.parentType = 'container';

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = nextLine;

    token        = state.push('container_' + name + '_open', 'div', 1);
    token.markup = markup;
    token.block  = true;
    token.info   = params;
    token.map    = [ startLine, nextLine ];

    state.md.block.tokenize(state, startLine + 1, nextLine);

    token        = state.push('container_' + name + '_close', 'div', -1);
    token.markup = state.src.slice(start, pos);
    token.block  = true;

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  md.block.ruler.before('fence', 'container_' + name, container, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  });
  md.renderer.rules['container_' + name + '_open'] = render;
  md.renderer.rules['container_' + name + '_close'] = render;
};


/***/ }),

/***/ "./node_modules/markdown-it-deflist/index.js":
/*!***************************************************!*\
  !*** ./node_modules/markdown-it-deflist/index.js ***!
  \***************************************************/
/***/ ((module) => {

"use strict";
// Process definition lists
//



module.exports = function deflist_plugin(md) {
  var isSpace = md.utils.isSpace;

  // Search `[:~][\n ]`, returns next pos after marker on success
  // or -1 on fail.
  function skipMarker(state, line) {
    var pos, marker,
        start = state.bMarks[line] + state.tShift[line],
        max = state.eMarks[line];

    if (start >= max) { return -1; }

    // Check bullet
    marker = state.src.charCodeAt(start++);
    if (marker !== 0x7E/* ~ */ && marker !== 0x3A/* : */) { return -1; }

    pos = state.skipSpaces(start);

    // require space after ":"
    if (start === pos) { return -1; }

    // no empty definitions, e.g. "  : "
    if (pos >= max) { return -1; }

    return start;
  }

  function markTightParagraphs(state, idx) {
    var i, l,
        level = state.level + 2;

    for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
      if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
        state.tokens[i + 2].hidden = true;
        state.tokens[i].hidden = true;
        i += 2;
      }
    }
  }

  function deflist(state, startLine, endLine, silent) {
    var ch,
        contentStart,
        ddLine,
        dtLine,
        itemLines,
        listLines,
        listTokIdx,
        max,
        nextLine,
        offset,
        oldDDIndent,
        oldIndent,
        oldParentType,
        oldSCount,
        oldTShift,
        oldTight,
        pos,
        prevEmptyEnd,
        tight,
        token;

    if (silent) {
      // quirk: validation mode validates a dd block only, not a whole deflist
      if (state.ddIndent < 0) { return false; }
      return skipMarker(state, startLine) >= 0;
    }

    nextLine = startLine + 1;
    if (nextLine >= endLine) { return false; }

    if (state.isEmpty(nextLine)) {
      nextLine++;
      if (nextLine >= endLine) { return false; }
    }

    if (state.sCount[nextLine] < state.blkIndent) { return false; }
    contentStart = skipMarker(state, nextLine);
    if (contentStart < 0) { return false; }

    // Start list
    listTokIdx = state.tokens.length;
    tight = true;

    token     = state.push('dl_open', 'dl', 1);
    token.map = listLines = [ startLine, 0 ];

    //
    // Iterate list items
    //

    dtLine = startLine;
    ddLine = nextLine;

    // One definition list can contain multiple DTs,
    // and one DT can be followed by multiple DDs.
    //
    // Thus, there is two loops here, and label is
    // needed to break out of the second one
    //
    /*eslint no-labels:0,block-scoped-var:0*/
    OUTER:
    for (;;) {
      prevEmptyEnd = false;

      token          = state.push('dt_open', 'dt', 1);
      token.map      = [ dtLine, dtLine ];

      token          = state.push('inline', '', 0);
      token.map      = [ dtLine, dtLine ];
      token.content  = state.getLines(dtLine, dtLine + 1, state.blkIndent, false).trim();
      token.children = [];

      token          = state.push('dt_close', 'dt', -1);

      for (;;) {
        token     = state.push('dd_open', 'dd', 1);
        token.map = itemLines = [ nextLine, 0 ];

        pos = contentStart;
        max = state.eMarks[ddLine];
        offset = state.sCount[ddLine] + contentStart - (state.bMarks[ddLine] + state.tShift[ddLine]);

        while (pos < max) {
          ch = state.src.charCodeAt(pos);

          if (isSpace(ch)) {
            if (ch === 0x09) {
              offset += 4 - offset % 4;
            } else {
              offset++;
            }
          } else {
            break;
          }

          pos++;
        }

        contentStart = pos;

        oldTight = state.tight;
        oldDDIndent = state.ddIndent;
        oldIndent = state.blkIndent;
        oldTShift = state.tShift[ddLine];
        oldSCount = state.sCount[ddLine];
        oldParentType = state.parentType;
        state.blkIndent = state.ddIndent = state.sCount[ddLine] + 2;
        state.tShift[ddLine] = contentStart - state.bMarks[ddLine];
        state.sCount[ddLine] = offset;
        state.tight = true;
        state.parentType = 'deflist';

        state.md.block.tokenize(state, ddLine, endLine, true);

        // If any of list item is tight, mark list as tight
        if (!state.tight || prevEmptyEnd) {
          tight = false;
        }
        // Item become loose if finish with empty line,
        // but we should filter last element, because it means list finish
        prevEmptyEnd = (state.line - ddLine) > 1 && state.isEmpty(state.line - 1);

        state.tShift[ddLine] = oldTShift;
        state.sCount[ddLine] = oldSCount;
        state.tight = oldTight;
        state.parentType = oldParentType;
        state.blkIndent = oldIndent;
        state.ddIndent = oldDDIndent;

        token = state.push('dd_close', 'dd', -1);

        itemLines[1] = nextLine = state.line;

        if (nextLine >= endLine) { break OUTER; }

        if (state.sCount[nextLine] < state.blkIndent) { break OUTER; }
        contentStart = skipMarker(state, nextLine);
        if (contentStart < 0) { break; }

        ddLine = nextLine;

        // go to the next loop iteration:
        // insert DD tag and repeat checking
      }

      if (nextLine >= endLine) { break; }
      dtLine = nextLine;

      if (state.isEmpty(dtLine)) { break; }
      if (state.sCount[dtLine] < state.blkIndent) { break; }

      ddLine = dtLine + 1;
      if (ddLine >= endLine) { break; }
      if (state.isEmpty(ddLine)) { ddLine++; }
      if (ddLine >= endLine) { break; }

      if (state.sCount[ddLine] < state.blkIndent) { break; }
      contentStart = skipMarker(state, ddLine);
      if (contentStart < 0) { break; }

      // go to the next loop iteration:
      // insert DT and DD tags and repeat checking
    }

    // Finilize list
    token = state.push('dl_close', 'dl', -1);

    listLines[1] = nextLine;

    state.line = nextLine;

    // mark paragraphs tight if needed
    if (tight) {
      markTightParagraphs(state, listTokIdx);
    }

    return true;
  }


  md.block.ruler.before('paragraph', 'deflist', deflist, { alt: [ 'paragraph', 'reference', 'blockquote' ] });
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/bare.js":
/*!************************************************!*\
  !*** ./node_modules/markdown-it-emoji/bare.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";



var emoji_html        = __webpack_require__(/*! ./lib/render */ "./node_modules/markdown-it-emoji/lib/render.js");
var emoji_replace     = __webpack_require__(/*! ./lib/replace */ "./node_modules/markdown-it-emoji/lib/replace.js");
var normalize_opts    = __webpack_require__(/*! ./lib/normalize_opts */ "./node_modules/markdown-it-emoji/lib/normalize_opts.js");


module.exports = function emoji_plugin(md, options) {
  var defaults = {
    defs: {},
    shortcuts: {},
    enabled: []
  };

  var opts = normalize_opts(md.utils.assign({}, defaults, options || {}));

  md.renderer.rules.emoji = emoji_html;

  md.core.ruler.push('emoji', emoji_replace(md, opts.defs, opts.shortcuts, opts.scanRE, opts.replaceRE));
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/index.js":
/*!*************************************************!*\
  !*** ./node_modules/markdown-it-emoji/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";



var emojies_defs      = __webpack_require__(/*! ./lib/data/full.json */ "./node_modules/markdown-it-emoji/lib/data/full.json");
var emojies_shortcuts = __webpack_require__(/*! ./lib/data/shortcuts */ "./node_modules/markdown-it-emoji/lib/data/shortcuts.js");
var bare_emoji_plugin = __webpack_require__(/*! ./bare */ "./node_modules/markdown-it-emoji/bare.js");


module.exports = function emoji_plugin(md, options) {
  var defaults = {
    defs: emojies_defs,
    shortcuts: emojies_shortcuts,
    enabled: []
  };

  var opts = md.utils.assign({}, defaults, options || {});

  bare_emoji_plugin(md, opts);
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/lib/data/full.json":
/*!***********************************************************!*\
  !*** ./node_modules/markdown-it-emoji/lib/data/full.json ***!
  \***********************************************************/
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('{"100":"💯","1234":"🔢","grinning":"😀","smiley":"😃","smile":"😄","grin":"😁","laughing":"😆","satisfied":"😆","sweat_smile":"😅","rofl":"🤣","joy":"😂","slightly_smiling_face":"🙂","upside_down_face":"🙃","wink":"😉","blush":"😊","innocent":"😇","smiling_face_with_three_hearts":"🥰","heart_eyes":"😍","star_struck":"🤩","kissing_heart":"😘","kissing":"😗","relaxed":"☺️","kissing_closed_eyes":"😚","kissing_smiling_eyes":"😙","smiling_face_with_tear":"🥲","yum":"😋","stuck_out_tongue":"😛","stuck_out_tongue_winking_eye":"😜","zany_face":"🤪","stuck_out_tongue_closed_eyes":"😝","money_mouth_face":"🤑","hugs":"🤗","hand_over_mouth":"🤭","shushing_face":"🤫","thinking":"🤔","zipper_mouth_face":"🤐","raised_eyebrow":"🤨","neutral_face":"😐","expressionless":"😑","no_mouth":"😶","smirk":"😏","unamused":"😒","roll_eyes":"🙄","grimacing":"😬","lying_face":"🤥","relieved":"😌","pensive":"😔","sleepy":"😪","drooling_face":"🤤","sleeping":"😴","mask":"😷","face_with_thermometer":"🤒","face_with_head_bandage":"🤕","nauseated_face":"🤢","vomiting_face":"🤮","sneezing_face":"🤧","hot_face":"🥵","cold_face":"🥶","woozy_face":"🥴","dizzy_face":"😵","exploding_head":"🤯","cowboy_hat_face":"🤠","partying_face":"🥳","disguised_face":"🥸","sunglasses":"😎","nerd_face":"🤓","monocle_face":"🧐","confused":"😕","worried":"😟","slightly_frowning_face":"🙁","frowning_face":"☹️","open_mouth":"😮","hushed":"😯","astonished":"😲","flushed":"😳","pleading_face":"🥺","frowning":"😦","anguished":"😧","fearful":"😨","cold_sweat":"😰","disappointed_relieved":"😥","cry":"😢","sob":"😭","scream":"😱","confounded":"😖","persevere":"😣","disappointed":"😞","sweat":"😓","weary":"😩","tired_face":"😫","yawning_face":"🥱","triumph":"😤","rage":"😡","pout":"😡","angry":"😠","cursing_face":"🤬","smiling_imp":"😈","imp":"👿","skull":"💀","skull_and_crossbones":"☠️","hankey":"💩","poop":"💩","shit":"💩","clown_face":"🤡","japanese_ogre":"👹","japanese_goblin":"👺","ghost":"👻","alien":"👽","space_invader":"👾","robot":"🤖","smiley_cat":"😺","smile_cat":"😸","joy_cat":"😹","heart_eyes_cat":"😻","smirk_cat":"😼","kissing_cat":"😽","scream_cat":"🙀","crying_cat_face":"😿","pouting_cat":"😾","see_no_evil":"🙈","hear_no_evil":"🙉","speak_no_evil":"🙊","kiss":"💋","love_letter":"💌","cupid":"💘","gift_heart":"💝","sparkling_heart":"💖","heartpulse":"💗","heartbeat":"💓","revolving_hearts":"💞","two_hearts":"💕","heart_decoration":"💟","heavy_heart_exclamation":"❣️","broken_heart":"💔","heart":"❤️","orange_heart":"🧡","yellow_heart":"💛","green_heart":"💚","blue_heart":"💙","purple_heart":"💜","brown_heart":"🤎","black_heart":"🖤","white_heart":"🤍","anger":"💢","boom":"💥","collision":"💥","dizzy":"💫","sweat_drops":"💦","dash":"💨","hole":"🕳️","bomb":"💣","speech_balloon":"💬","eye_speech_bubble":"👁️‍🗨️","left_speech_bubble":"🗨️","right_anger_bubble":"🗯️","thought_balloon":"💭","zzz":"💤","wave":"👋","raised_back_of_hand":"🤚","raised_hand_with_fingers_splayed":"🖐️","hand":"✋","raised_hand":"✋","vulcan_salute":"🖖","ok_hand":"👌","pinched_fingers":"🤌","pinching_hand":"🤏","v":"✌️","crossed_fingers":"🤞","love_you_gesture":"🤟","metal":"🤘","call_me_hand":"🤙","point_left":"👈","point_right":"👉","point_up_2":"👆","middle_finger":"🖕","fu":"🖕","point_down":"👇","point_up":"☝️","+1":"👍","thumbsup":"👍","-1":"👎","thumbsdown":"👎","fist_raised":"✊","fist":"✊","fist_oncoming":"👊","facepunch":"👊","punch":"👊","fist_left":"🤛","fist_right":"🤜","clap":"👏","raised_hands":"🙌","open_hands":"👐","palms_up_together":"🤲","handshake":"🤝","pray":"🙏","writing_hand":"✍️","nail_care":"💅","selfie":"🤳","muscle":"💪","mechanical_arm":"🦾","mechanical_leg":"🦿","leg":"🦵","foot":"🦶","ear":"👂","ear_with_hearing_aid":"🦻","nose":"👃","brain":"🧠","anatomical_heart":"🫀","lungs":"🫁","tooth":"🦷","bone":"🦴","eyes":"👀","eye":"👁️","tongue":"👅","lips":"👄","baby":"👶","child":"🧒","boy":"👦","girl":"👧","adult":"🧑","blond_haired_person":"👱","man":"👨","bearded_person":"🧔","red_haired_man":"👨‍🦰","curly_haired_man":"👨‍🦱","white_haired_man":"👨‍🦳","bald_man":"👨‍🦲","woman":"👩","red_haired_woman":"👩‍🦰","person_red_hair":"🧑‍🦰","curly_haired_woman":"👩‍🦱","person_curly_hair":"🧑‍🦱","white_haired_woman":"👩‍🦳","person_white_hair":"🧑‍🦳","bald_woman":"👩‍🦲","person_bald":"🧑‍🦲","blond_haired_woman":"👱‍♀️","blonde_woman":"👱‍♀️","blond_haired_man":"👱‍♂️","older_adult":"🧓","older_man":"👴","older_woman":"👵","frowning_person":"🙍","frowning_man":"🙍‍♂️","frowning_woman":"🙍‍♀️","pouting_face":"🙎","pouting_man":"🙎‍♂️","pouting_woman":"🙎‍♀️","no_good":"🙅","no_good_man":"🙅‍♂️","ng_man":"🙅‍♂️","no_good_woman":"🙅‍♀️","ng_woman":"🙅‍♀️","ok_person":"🙆","ok_man":"🙆‍♂️","ok_woman":"🙆‍♀️","tipping_hand_person":"💁","information_desk_person":"💁","tipping_hand_man":"💁‍♂️","sassy_man":"💁‍♂️","tipping_hand_woman":"💁‍♀️","sassy_woman":"💁‍♀️","raising_hand":"🙋","raising_hand_man":"🙋‍♂️","raising_hand_woman":"🙋‍♀️","deaf_person":"🧏","deaf_man":"🧏‍♂️","deaf_woman":"🧏‍♀️","bow":"🙇","bowing_man":"🙇‍♂️","bowing_woman":"🙇‍♀️","facepalm":"🤦","man_facepalming":"🤦‍♂️","woman_facepalming":"🤦‍♀️","shrug":"🤷","man_shrugging":"🤷‍♂️","woman_shrugging":"🤷‍♀️","health_worker":"🧑‍⚕️","man_health_worker":"👨‍⚕️","woman_health_worker":"👩‍⚕️","student":"🧑‍🎓","man_student":"👨‍🎓","woman_student":"👩‍🎓","teacher":"🧑‍🏫","man_teacher":"👨‍🏫","woman_teacher":"👩‍🏫","judge":"🧑‍⚖️","man_judge":"👨‍⚖️","woman_judge":"👩‍⚖️","farmer":"🧑‍🌾","man_farmer":"👨‍🌾","woman_farmer":"👩‍🌾","cook":"🧑‍🍳","man_cook":"👨‍🍳","woman_cook":"👩‍🍳","mechanic":"🧑‍🔧","man_mechanic":"👨‍🔧","woman_mechanic":"👩‍🔧","factory_worker":"🧑‍🏭","man_factory_worker":"👨‍🏭","woman_factory_worker":"👩‍🏭","office_worker":"🧑‍💼","man_office_worker":"👨‍💼","woman_office_worker":"👩‍💼","scientist":"🧑‍🔬","man_scientist":"👨‍🔬","woman_scientist":"👩‍🔬","technologist":"🧑‍💻","man_technologist":"👨‍💻","woman_technologist":"👩‍💻","singer":"🧑‍🎤","man_singer":"👨‍🎤","woman_singer":"👩‍🎤","artist":"🧑‍🎨","man_artist":"👨‍🎨","woman_artist":"👩‍🎨","pilot":"🧑‍✈️","man_pilot":"👨‍✈️","woman_pilot":"👩‍✈️","astronaut":"🧑‍🚀","man_astronaut":"👨‍🚀","woman_astronaut":"👩‍🚀","firefighter":"🧑‍🚒","man_firefighter":"👨‍🚒","woman_firefighter":"👩‍🚒","police_officer":"👮","cop":"👮","policeman":"👮‍♂️","policewoman":"👮‍♀️","detective":"🕵️","male_detective":"🕵️‍♂️","female_detective":"🕵️‍♀️","guard":"💂","guardsman":"💂‍♂️","guardswoman":"💂‍♀️","ninja":"🥷","construction_worker":"👷","construction_worker_man":"👷‍♂️","construction_worker_woman":"👷‍♀️","prince":"🤴","princess":"👸","person_with_turban":"👳","man_with_turban":"👳‍♂️","woman_with_turban":"👳‍♀️","man_with_gua_pi_mao":"👲","woman_with_headscarf":"🧕","person_in_tuxedo":"🤵","man_in_tuxedo":"🤵‍♂️","woman_in_tuxedo":"🤵‍♀️","person_with_veil":"👰","man_with_veil":"👰‍♂️","woman_with_veil":"👰‍♀️","bride_with_veil":"👰‍♀️","pregnant_woman":"🤰","breast_feeding":"🤱","woman_feeding_baby":"👩‍🍼","man_feeding_baby":"👨‍🍼","person_feeding_baby":"🧑‍🍼","angel":"👼","santa":"🎅","mrs_claus":"🤶","mx_claus":"🧑‍🎄","superhero":"🦸","superhero_man":"🦸‍♂️","superhero_woman":"🦸‍♀️","supervillain":"🦹","supervillain_man":"🦹‍♂️","supervillain_woman":"🦹‍♀️","mage":"🧙","mage_man":"🧙‍♂️","mage_woman":"🧙‍♀️","fairy":"🧚","fairy_man":"🧚‍♂️","fairy_woman":"🧚‍♀️","vampire":"🧛","vampire_man":"🧛‍♂️","vampire_woman":"🧛‍♀️","merperson":"🧜","merman":"🧜‍♂️","mermaid":"🧜‍♀️","elf":"🧝","elf_man":"🧝‍♂️","elf_woman":"🧝‍♀️","genie":"🧞","genie_man":"🧞‍♂️","genie_woman":"🧞‍♀️","zombie":"🧟","zombie_man":"🧟‍♂️","zombie_woman":"🧟‍♀️","massage":"💆","massage_man":"💆‍♂️","massage_woman":"💆‍♀️","haircut":"💇","haircut_man":"💇‍♂️","haircut_woman":"💇‍♀️","walking":"🚶","walking_man":"🚶‍♂️","walking_woman":"🚶‍♀️","standing_person":"🧍","standing_man":"🧍‍♂️","standing_woman":"🧍‍♀️","kneeling_person":"🧎","kneeling_man":"🧎‍♂️","kneeling_woman":"🧎‍♀️","person_with_probing_cane":"🧑‍🦯","man_with_probing_cane":"👨‍🦯","woman_with_probing_cane":"👩‍🦯","person_in_motorized_wheelchair":"🧑‍🦼","man_in_motorized_wheelchair":"👨‍🦼","woman_in_motorized_wheelchair":"👩‍🦼","person_in_manual_wheelchair":"🧑‍🦽","man_in_manual_wheelchair":"👨‍🦽","woman_in_manual_wheelchair":"👩‍🦽","runner":"🏃","running":"🏃","running_man":"🏃‍♂️","running_woman":"🏃‍♀️","woman_dancing":"💃","dancer":"💃","man_dancing":"🕺","business_suit_levitating":"🕴️","dancers":"👯","dancing_men":"👯‍♂️","dancing_women":"👯‍♀️","sauna_person":"🧖","sauna_man":"🧖‍♂️","sauna_woman":"🧖‍♀️","climbing":"🧗","climbing_man":"🧗‍♂️","climbing_woman":"🧗‍♀️","person_fencing":"🤺","horse_racing":"🏇","skier":"⛷️","snowboarder":"🏂","golfing":"🏌️","golfing_man":"🏌️‍♂️","golfing_woman":"🏌️‍♀️","surfer":"🏄","surfing_man":"🏄‍♂️","surfing_woman":"🏄‍♀️","rowboat":"🚣","rowing_man":"🚣‍♂️","rowing_woman":"🚣‍♀️","swimmer":"🏊","swimming_man":"🏊‍♂️","swimming_woman":"🏊‍♀️","bouncing_ball_person":"⛹️","bouncing_ball_man":"⛹️‍♂️","basketball_man":"⛹️‍♂️","bouncing_ball_woman":"⛹️‍♀️","basketball_woman":"⛹️‍♀️","weight_lifting":"🏋️","weight_lifting_man":"🏋️‍♂️","weight_lifting_woman":"🏋️‍♀️","bicyclist":"🚴","biking_man":"🚴‍♂️","biking_woman":"🚴‍♀️","mountain_bicyclist":"🚵","mountain_biking_man":"🚵‍♂️","mountain_biking_woman":"🚵‍♀️","cartwheeling":"🤸","man_cartwheeling":"🤸‍♂️","woman_cartwheeling":"🤸‍♀️","wrestling":"🤼","men_wrestling":"🤼‍♂️","women_wrestling":"🤼‍♀️","water_polo":"🤽","man_playing_water_polo":"🤽‍♂️","woman_playing_water_polo":"🤽‍♀️","handball_person":"🤾","man_playing_handball":"🤾‍♂️","woman_playing_handball":"🤾‍♀️","juggling_person":"🤹","man_juggling":"🤹‍♂️","woman_juggling":"🤹‍♀️","lotus_position":"🧘","lotus_position_man":"🧘‍♂️","lotus_position_woman":"🧘‍♀️","bath":"🛀","sleeping_bed":"🛌","people_holding_hands":"🧑‍🤝‍🧑","two_women_holding_hands":"👭","couple":"👫","two_men_holding_hands":"👬","couplekiss":"💏","couplekiss_man_woman":"👩‍❤️‍💋‍👨","couplekiss_man_man":"👨‍❤️‍💋‍👨","couplekiss_woman_woman":"👩‍❤️‍💋‍👩","couple_with_heart":"💑","couple_with_heart_woman_man":"👩‍❤️‍👨","couple_with_heart_man_man":"👨‍❤️‍👨","couple_with_heart_woman_woman":"👩‍❤️‍👩","family":"👪","family_man_woman_boy":"👨‍👩‍👦","family_man_woman_girl":"👨‍👩‍👧","family_man_woman_girl_boy":"👨‍👩‍👧‍👦","family_man_woman_boy_boy":"👨‍👩‍👦‍👦","family_man_woman_girl_girl":"👨‍👩‍👧‍👧","family_man_man_boy":"👨‍👨‍👦","family_man_man_girl":"👨‍👨‍👧","family_man_man_girl_boy":"👨‍👨‍👧‍👦","family_man_man_boy_boy":"👨‍👨‍👦‍👦","family_man_man_girl_girl":"👨‍👨‍👧‍👧","family_woman_woman_boy":"👩‍👩‍👦","family_woman_woman_girl":"👩‍👩‍👧","family_woman_woman_girl_boy":"👩‍👩‍👧‍👦","family_woman_woman_boy_boy":"👩‍👩‍👦‍👦","family_woman_woman_girl_girl":"👩‍👩‍👧‍👧","family_man_boy":"👨‍👦","family_man_boy_boy":"👨‍👦‍👦","family_man_girl":"👨‍👧","family_man_girl_boy":"👨‍👧‍👦","family_man_girl_girl":"👨‍👧‍👧","family_woman_boy":"👩‍👦","family_woman_boy_boy":"👩‍👦‍👦","family_woman_girl":"👩‍👧","family_woman_girl_boy":"👩‍👧‍👦","family_woman_girl_girl":"👩‍👧‍👧","speaking_head":"🗣️","bust_in_silhouette":"👤","busts_in_silhouette":"👥","people_hugging":"🫂","footprints":"👣","monkey_face":"🐵","monkey":"🐒","gorilla":"🦍","orangutan":"🦧","dog":"🐶","dog2":"🐕","guide_dog":"🦮","service_dog":"🐕‍🦺","poodle":"🐩","wolf":"🐺","fox_face":"🦊","raccoon":"🦝","cat":"🐱","cat2":"🐈","black_cat":"🐈‍⬛","lion":"🦁","tiger":"🐯","tiger2":"🐅","leopard":"🐆","horse":"🐴","racehorse":"🐎","unicorn":"🦄","zebra":"🦓","deer":"🦌","bison":"🦬","cow":"🐮","ox":"🐂","water_buffalo":"🐃","cow2":"🐄","pig":"🐷","pig2":"🐖","boar":"🐗","pig_nose":"🐽","ram":"🐏","sheep":"🐑","goat":"🐐","dromedary_camel":"🐪","camel":"🐫","llama":"🦙","giraffe":"🦒","elephant":"🐘","mammoth":"🦣","rhinoceros":"🦏","hippopotamus":"🦛","mouse":"🐭","mouse2":"🐁","rat":"🐀","hamster":"🐹","rabbit":"🐰","rabbit2":"🐇","chipmunk":"🐿️","beaver":"🦫","hedgehog":"🦔","bat":"🦇","bear":"🐻","polar_bear":"🐻‍❄️","koala":"🐨","panda_face":"🐼","sloth":"🦥","otter":"🦦","skunk":"🦨","kangaroo":"🦘","badger":"🦡","feet":"🐾","paw_prints":"🐾","turkey":"🦃","chicken":"🐔","rooster":"🐓","hatching_chick":"🐣","baby_chick":"🐤","hatched_chick":"🐥","bird":"🐦","penguin":"🐧","dove":"🕊️","eagle":"🦅","duck":"🦆","swan":"🦢","owl":"🦉","dodo":"🦤","feather":"🪶","flamingo":"🦩","peacock":"🦚","parrot":"🦜","frog":"🐸","crocodile":"🐊","turtle":"🐢","lizard":"🦎","snake":"🐍","dragon_face":"🐲","dragon":"🐉","sauropod":"🦕","t-rex":"🦖","whale":"🐳","whale2":"🐋","dolphin":"🐬","flipper":"🐬","seal":"🦭","fish":"🐟","tropical_fish":"🐠","blowfish":"🐡","shark":"🦈","octopus":"🐙","shell":"🐚","snail":"🐌","butterfly":"🦋","bug":"🐛","ant":"🐜","bee":"🐝","honeybee":"🐝","beetle":"🪲","lady_beetle":"🐞","cricket":"🦗","cockroach":"🪳","spider":"🕷️","spider_web":"🕸️","scorpion":"🦂","mosquito":"🦟","fly":"🪰","worm":"🪱","microbe":"🦠","bouquet":"💐","cherry_blossom":"🌸","white_flower":"💮","rosette":"🏵️","rose":"🌹","wilted_flower":"🥀","hibiscus":"🌺","sunflower":"🌻","blossom":"🌼","tulip":"🌷","seedling":"🌱","potted_plant":"🪴","evergreen_tree":"🌲","deciduous_tree":"🌳","palm_tree":"🌴","cactus":"🌵","ear_of_rice":"🌾","herb":"🌿","shamrock":"☘️","four_leaf_clover":"🍀","maple_leaf":"🍁","fallen_leaf":"🍂","leaves":"🍃","grapes":"🍇","melon":"🍈","watermelon":"🍉","tangerine":"🍊","orange":"🍊","mandarin":"🍊","lemon":"🍋","banana":"🍌","pineapple":"🍍","mango":"🥭","apple":"🍎","green_apple":"🍏","pear":"🍐","peach":"🍑","cherries":"🍒","strawberry":"🍓","blueberries":"🫐","kiwi_fruit":"🥝","tomato":"🍅","olive":"🫒","coconut":"🥥","avocado":"🥑","eggplant":"🍆","potato":"🥔","carrot":"🥕","corn":"🌽","hot_pepper":"🌶️","bell_pepper":"🫑","cucumber":"🥒","leafy_green":"🥬","broccoli":"🥦","garlic":"🧄","onion":"🧅","mushroom":"🍄","peanuts":"🥜","chestnut":"🌰","bread":"🍞","croissant":"🥐","baguette_bread":"🥖","flatbread":"🫓","pretzel":"🥨","bagel":"🥯","pancakes":"🥞","waffle":"🧇","cheese":"🧀","meat_on_bone":"🍖","poultry_leg":"🍗","cut_of_meat":"🥩","bacon":"🥓","hamburger":"🍔","fries":"🍟","pizza":"🍕","hotdog":"🌭","sandwich":"🥪","taco":"🌮","burrito":"🌯","tamale":"🫔","stuffed_flatbread":"🥙","falafel":"🧆","egg":"🥚","fried_egg":"🍳","shallow_pan_of_food":"🥘","stew":"🍲","fondue":"🫕","bowl_with_spoon":"🥣","green_salad":"🥗","popcorn":"🍿","butter":"🧈","salt":"🧂","canned_food":"🥫","bento":"🍱","rice_cracker":"🍘","rice_ball":"🍙","rice":"🍚","curry":"🍛","ramen":"🍜","spaghetti":"🍝","sweet_potato":"🍠","oden":"🍢","sushi":"🍣","fried_shrimp":"🍤","fish_cake":"🍥","moon_cake":"🥮","dango":"🍡","dumpling":"🥟","fortune_cookie":"🥠","takeout_box":"🥡","crab":"🦀","lobster":"🦞","shrimp":"🦐","squid":"🦑","oyster":"🦪","icecream":"🍦","shaved_ice":"🍧","ice_cream":"🍨","doughnut":"🍩","cookie":"🍪","birthday":"🎂","cake":"🍰","cupcake":"🧁","pie":"🥧","chocolate_bar":"🍫","candy":"🍬","lollipop":"🍭","custard":"🍮","honey_pot":"🍯","baby_bottle":"🍼","milk_glass":"🥛","coffee":"☕","teapot":"🫖","tea":"🍵","sake":"🍶","champagne":"🍾","wine_glass":"🍷","cocktail":"🍸","tropical_drink":"🍹","beer":"🍺","beers":"🍻","clinking_glasses":"🥂","tumbler_glass":"🥃","cup_with_straw":"🥤","bubble_tea":"🧋","beverage_box":"🧃","mate":"🧉","ice_cube":"🧊","chopsticks":"🥢","plate_with_cutlery":"🍽️","fork_and_knife":"🍴","spoon":"🥄","hocho":"🔪","knife":"🔪","amphora":"🏺","earth_africa":"🌍","earth_americas":"🌎","earth_asia":"🌏","globe_with_meridians":"🌐","world_map":"🗺️","japan":"🗾","compass":"🧭","mountain_snow":"🏔️","mountain":"⛰️","volcano":"🌋","mount_fuji":"🗻","camping":"🏕️","beach_umbrella":"🏖️","desert":"🏜️","desert_island":"🏝️","national_park":"🏞️","stadium":"🏟️","classical_building":"🏛️","building_construction":"🏗️","bricks":"🧱","rock":"🪨","wood":"🪵","hut":"🛖","houses":"🏘️","derelict_house":"🏚️","house":"🏠","house_with_garden":"🏡","office":"🏢","post_office":"🏣","european_post_office":"🏤","hospital":"🏥","bank":"🏦","hotel":"🏨","love_hotel":"🏩","convenience_store":"🏪","school":"🏫","department_store":"🏬","factory":"🏭","japanese_castle":"🏯","european_castle":"🏰","wedding":"💒","tokyo_tower":"🗼","statue_of_liberty":"🗽","church":"⛪","mosque":"🕌","hindu_temple":"🛕","synagogue":"🕍","shinto_shrine":"⛩️","kaaba":"🕋","fountain":"⛲","tent":"⛺","foggy":"🌁","night_with_stars":"🌃","cityscape":"🏙️","sunrise_over_mountains":"🌄","sunrise":"🌅","city_sunset":"🌆","city_sunrise":"🌇","bridge_at_night":"🌉","hotsprings":"♨️","carousel_horse":"🎠","ferris_wheel":"🎡","roller_coaster":"🎢","barber":"💈","circus_tent":"🎪","steam_locomotive":"🚂","railway_car":"🚃","bullettrain_side":"🚄","bullettrain_front":"🚅","train2":"🚆","metro":"🚇","light_rail":"🚈","station":"🚉","tram":"🚊","monorail":"🚝","mountain_railway":"🚞","train":"🚋","bus":"🚌","oncoming_bus":"🚍","trolleybus":"🚎","minibus":"🚐","ambulance":"🚑","fire_engine":"🚒","police_car":"🚓","oncoming_police_car":"🚔","taxi":"🚕","oncoming_taxi":"🚖","car":"🚗","red_car":"🚗","oncoming_automobile":"🚘","blue_car":"🚙","pickup_truck":"🛻","truck":"🚚","articulated_lorry":"🚛","tractor":"🚜","racing_car":"🏎️","motorcycle":"🏍️","motor_scooter":"🛵","manual_wheelchair":"🦽","motorized_wheelchair":"🦼","auto_rickshaw":"🛺","bike":"🚲","kick_scooter":"🛴","skateboard":"🛹","roller_skate":"🛼","busstop":"🚏","motorway":"🛣️","railway_track":"🛤️","oil_drum":"🛢️","fuelpump":"⛽","rotating_light":"🚨","traffic_light":"🚥","vertical_traffic_light":"🚦","stop_sign":"🛑","construction":"🚧","anchor":"⚓","boat":"⛵","sailboat":"⛵","canoe":"🛶","speedboat":"🚤","passenger_ship":"🛳️","ferry":"⛴️","motor_boat":"🛥️","ship":"🚢","airplane":"✈️","small_airplane":"🛩️","flight_departure":"🛫","flight_arrival":"🛬","parachute":"🪂","seat":"💺","helicopter":"🚁","suspension_railway":"🚟","mountain_cableway":"🚠","aerial_tramway":"🚡","artificial_satellite":"🛰️","rocket":"🚀","flying_saucer":"🛸","bellhop_bell":"🛎️","luggage":"🧳","hourglass":"⌛","hourglass_flowing_sand":"⏳","watch":"⌚","alarm_clock":"⏰","stopwatch":"⏱️","timer_clock":"⏲️","mantelpiece_clock":"🕰️","clock12":"🕛","clock1230":"🕧","clock1":"🕐","clock130":"🕜","clock2":"🕑","clock230":"🕝","clock3":"🕒","clock330":"🕞","clock4":"🕓","clock430":"🕟","clock5":"🕔","clock530":"🕠","clock6":"🕕","clock630":"🕡","clock7":"🕖","clock730":"🕢","clock8":"🕗","clock830":"🕣","clock9":"🕘","clock930":"🕤","clock10":"🕙","clock1030":"🕥","clock11":"🕚","clock1130":"🕦","new_moon":"🌑","waxing_crescent_moon":"🌒","first_quarter_moon":"🌓","moon":"🌔","waxing_gibbous_moon":"🌔","full_moon":"🌕","waning_gibbous_moon":"🌖","last_quarter_moon":"🌗","waning_crescent_moon":"🌘","crescent_moon":"🌙","new_moon_with_face":"🌚","first_quarter_moon_with_face":"🌛","last_quarter_moon_with_face":"🌜","thermometer":"🌡️","sunny":"☀️","full_moon_with_face":"🌝","sun_with_face":"🌞","ringed_planet":"🪐","star":"⭐","star2":"🌟","stars":"🌠","milky_way":"🌌","cloud":"☁️","partly_sunny":"⛅","cloud_with_lightning_and_rain":"⛈️","sun_behind_small_cloud":"🌤️","sun_behind_large_cloud":"🌥️","sun_behind_rain_cloud":"🌦️","cloud_with_rain":"🌧️","cloud_with_snow":"🌨️","cloud_with_lightning":"🌩️","tornado":"🌪️","fog":"🌫️","wind_face":"🌬️","cyclone":"🌀","rainbow":"🌈","closed_umbrella":"🌂","open_umbrella":"☂️","umbrella":"☔","parasol_on_ground":"⛱️","zap":"⚡","snowflake":"❄️","snowman_with_snow":"☃️","snowman":"⛄","comet":"☄️","fire":"🔥","droplet":"💧","ocean":"🌊","jack_o_lantern":"🎃","christmas_tree":"🎄","fireworks":"🎆","sparkler":"🎇","firecracker":"🧨","sparkles":"✨","balloon":"🎈","tada":"🎉","confetti_ball":"🎊","tanabata_tree":"🎋","bamboo":"🎍","dolls":"🎎","flags":"🎏","wind_chime":"🎐","rice_scene":"🎑","red_envelope":"🧧","ribbon":"🎀","gift":"🎁","reminder_ribbon":"🎗️","tickets":"🎟️","ticket":"🎫","medal_military":"🎖️","trophy":"🏆","medal_sports":"🏅","1st_place_medal":"🥇","2nd_place_medal":"🥈","3rd_place_medal":"🥉","soccer":"⚽","baseball":"⚾","softball":"🥎","basketball":"🏀","volleyball":"🏐","football":"🏈","rugby_football":"🏉","tennis":"🎾","flying_disc":"🥏","bowling":"🎳","cricket_game":"🏏","field_hockey":"🏑","ice_hockey":"🏒","lacrosse":"🥍","ping_pong":"🏓","badminton":"🏸","boxing_glove":"🥊","martial_arts_uniform":"🥋","goal_net":"🥅","golf":"⛳","ice_skate":"⛸️","fishing_pole_and_fish":"🎣","diving_mask":"🤿","running_shirt_with_sash":"🎽","ski":"🎿","sled":"🛷","curling_stone":"🥌","dart":"🎯","yo_yo":"🪀","kite":"🪁","8ball":"🎱","crystal_ball":"🔮","magic_wand":"🪄","nazar_amulet":"🧿","video_game":"🎮","joystick":"🕹️","slot_machine":"🎰","game_die":"🎲","jigsaw":"🧩","teddy_bear":"🧸","pinata":"🪅","nesting_dolls":"🪆","spades":"♠️","hearts":"♥️","diamonds":"♦️","clubs":"♣️","chess_pawn":"♟️","black_joker":"🃏","mahjong":"🀄","flower_playing_cards":"🎴","performing_arts":"🎭","framed_picture":"🖼️","art":"🎨","thread":"🧵","sewing_needle":"🪡","yarn":"🧶","knot":"🪢","eyeglasses":"👓","dark_sunglasses":"🕶️","goggles":"🥽","lab_coat":"🥼","safety_vest":"🦺","necktie":"👔","shirt":"👕","tshirt":"👕","jeans":"👖","scarf":"🧣","gloves":"🧤","coat":"🧥","socks":"🧦","dress":"👗","kimono":"👘","sari":"🥻","one_piece_swimsuit":"🩱","swim_brief":"🩲","shorts":"🩳","bikini":"👙","womans_clothes":"👚","purse":"👛","handbag":"👜","pouch":"👝","shopping":"🛍️","school_satchel":"🎒","thong_sandal":"🩴","mans_shoe":"👞","shoe":"👞","athletic_shoe":"👟","hiking_boot":"🥾","flat_shoe":"🥿","high_heel":"👠","sandal":"👡","ballet_shoes":"🩰","boot":"👢","crown":"👑","womans_hat":"👒","tophat":"🎩","mortar_board":"🎓","billed_cap":"🧢","military_helmet":"🪖","rescue_worker_helmet":"⛑️","prayer_beads":"📿","lipstick":"💄","ring":"💍","gem":"💎","mute":"🔇","speaker":"🔈","sound":"🔉","loud_sound":"🔊","loudspeaker":"📢","mega":"📣","postal_horn":"📯","bell":"🔔","no_bell":"🔕","musical_score":"🎼","musical_note":"🎵","notes":"🎶","studio_microphone":"🎙️","level_slider":"🎚️","control_knobs":"🎛️","microphone":"🎤","headphones":"🎧","radio":"📻","saxophone":"🎷","accordion":"🪗","guitar":"🎸","musical_keyboard":"🎹","trumpet":"🎺","violin":"🎻","banjo":"🪕","drum":"🥁","long_drum":"🪘","iphone":"📱","calling":"📲","phone":"☎️","telephone":"☎️","telephone_receiver":"📞","pager":"📟","fax":"📠","battery":"🔋","electric_plug":"🔌","computer":"💻","desktop_computer":"🖥️","printer":"🖨️","keyboard":"⌨️","computer_mouse":"🖱️","trackball":"🖲️","minidisc":"💽","floppy_disk":"💾","cd":"💿","dvd":"📀","abacus":"🧮","movie_camera":"🎥","film_strip":"🎞️","film_projector":"📽️","clapper":"🎬","tv":"📺","camera":"📷","camera_flash":"📸","video_camera":"📹","vhs":"📼","mag":"🔍","mag_right":"🔎","candle":"🕯️","bulb":"💡","flashlight":"🔦","izakaya_lantern":"🏮","lantern":"🏮","diya_lamp":"🪔","notebook_with_decorative_cover":"📔","closed_book":"📕","book":"📖","open_book":"📖","green_book":"📗","blue_book":"📘","orange_book":"📙","books":"📚","notebook":"📓","ledger":"📒","page_with_curl":"📃","scroll":"📜","page_facing_up":"📄","newspaper":"📰","newspaper_roll":"🗞️","bookmark_tabs":"📑","bookmark":"🔖","label":"🏷️","moneybag":"💰","coin":"🪙","yen":"💴","dollar":"💵","euro":"💶","pound":"💷","money_with_wings":"💸","credit_card":"💳","receipt":"🧾","chart":"💹","envelope":"✉️","email":"📧","e-mail":"📧","incoming_envelope":"📨","envelope_with_arrow":"📩","outbox_tray":"📤","inbox_tray":"📥","package":"📦","mailbox":"📫","mailbox_closed":"📪","mailbox_with_mail":"📬","mailbox_with_no_mail":"📭","postbox":"📮","ballot_box":"🗳️","pencil2":"✏️","black_nib":"✒️","fountain_pen":"🖋️","pen":"🖊️","paintbrush":"🖌️","crayon":"🖍️","memo":"📝","pencil":"📝","briefcase":"💼","file_folder":"📁","open_file_folder":"📂","card_index_dividers":"🗂️","date":"📅","calendar":"📆","spiral_notepad":"🗒️","spiral_calendar":"🗓️","card_index":"📇","chart_with_upwards_trend":"📈","chart_with_downwards_trend":"📉","bar_chart":"📊","clipboard":"📋","pushpin":"📌","round_pushpin":"📍","paperclip":"📎","paperclips":"🖇️","straight_ruler":"📏","triangular_ruler":"📐","scissors":"✂️","card_file_box":"🗃️","file_cabinet":"🗄️","wastebasket":"🗑️","lock":"🔒","unlock":"🔓","lock_with_ink_pen":"🔏","closed_lock_with_key":"🔐","key":"🔑","old_key":"🗝️","hammer":"🔨","axe":"🪓","pick":"⛏️","hammer_and_pick":"⚒️","hammer_and_wrench":"🛠️","dagger":"🗡️","crossed_swords":"⚔️","gun":"🔫","boomerang":"🪃","bow_and_arrow":"🏹","shield":"🛡️","carpentry_saw":"🪚","wrench":"🔧","screwdriver":"🪛","nut_and_bolt":"🔩","gear":"⚙️","clamp":"🗜️","balance_scale":"⚖️","probing_cane":"🦯","link":"🔗","chains":"⛓️","hook":"🪝","toolbox":"🧰","magnet":"🧲","ladder":"🪜","alembic":"⚗️","test_tube":"🧪","petri_dish":"🧫","dna":"🧬","microscope":"🔬","telescope":"🔭","satellite":"📡","syringe":"💉","drop_of_blood":"🩸","pill":"💊","adhesive_bandage":"🩹","stethoscope":"🩺","door":"🚪","elevator":"🛗","mirror":"🪞","window":"🪟","bed":"🛏️","couch_and_lamp":"🛋️","chair":"🪑","toilet":"🚽","plunger":"🪠","shower":"🚿","bathtub":"🛁","mouse_trap":"🪤","razor":"🪒","lotion_bottle":"🧴","safety_pin":"🧷","broom":"🧹","basket":"🧺","roll_of_paper":"🧻","bucket":"🪣","soap":"🧼","toothbrush":"🪥","sponge":"🧽","fire_extinguisher":"🧯","shopping_cart":"🛒","smoking":"🚬","coffin":"⚰️","headstone":"🪦","funeral_urn":"⚱️","moyai":"🗿","placard":"🪧","atm":"🏧","put_litter_in_its_place":"🚮","potable_water":"🚰","wheelchair":"♿","mens":"🚹","womens":"🚺","restroom":"🚻","baby_symbol":"🚼","wc":"🚾","passport_control":"🛂","customs":"🛃","baggage_claim":"🛄","left_luggage":"🛅","warning":"⚠️","children_crossing":"🚸","no_entry":"⛔","no_entry_sign":"🚫","no_bicycles":"🚳","no_smoking":"🚭","do_not_litter":"🚯","non-potable_water":"🚱","no_pedestrians":"🚷","no_mobile_phones":"📵","underage":"🔞","radioactive":"☢️","biohazard":"☣️","arrow_up":"⬆️","arrow_upper_right":"↗️","arrow_right":"➡️","arrow_lower_right":"↘️","arrow_down":"⬇️","arrow_lower_left":"↙️","arrow_left":"⬅️","arrow_upper_left":"↖️","arrow_up_down":"↕️","left_right_arrow":"↔️","leftwards_arrow_with_hook":"↩️","arrow_right_hook":"↪️","arrow_heading_up":"⤴️","arrow_heading_down":"⤵️","arrows_clockwise":"🔃","arrows_counterclockwise":"🔄","back":"🔙","end":"🔚","on":"🔛","soon":"🔜","top":"🔝","place_of_worship":"🛐","atom_symbol":"⚛️","om":"🕉️","star_of_david":"✡️","wheel_of_dharma":"☸️","yin_yang":"☯️","latin_cross":"✝️","orthodox_cross":"☦️","star_and_crescent":"☪️","peace_symbol":"☮️","menorah":"🕎","six_pointed_star":"🔯","aries":"♈","taurus":"♉","gemini":"♊","cancer":"♋","leo":"♌","virgo":"♍","libra":"♎","scorpius":"♏","sagittarius":"♐","capricorn":"♑","aquarius":"♒","pisces":"♓","ophiuchus":"⛎","twisted_rightwards_arrows":"🔀","repeat":"🔁","repeat_one":"🔂","arrow_forward":"▶️","fast_forward":"⏩","next_track_button":"⏭️","play_or_pause_button":"⏯️","arrow_backward":"◀️","rewind":"⏪","previous_track_button":"⏮️","arrow_up_small":"🔼","arrow_double_up":"⏫","arrow_down_small":"🔽","arrow_double_down":"⏬","pause_button":"⏸️","stop_button":"⏹️","record_button":"⏺️","eject_button":"⏏️","cinema":"🎦","low_brightness":"🔅","high_brightness":"🔆","signal_strength":"📶","vibration_mode":"📳","mobile_phone_off":"📴","female_sign":"♀️","male_sign":"♂️","transgender_symbol":"⚧️","heavy_multiplication_x":"✖️","heavy_plus_sign":"➕","heavy_minus_sign":"➖","heavy_division_sign":"➗","infinity":"♾️","bangbang":"‼️","interrobang":"⁉️","question":"❓","grey_question":"❔","grey_exclamation":"❕","exclamation":"❗","heavy_exclamation_mark":"❗","wavy_dash":"〰️","currency_exchange":"💱","heavy_dollar_sign":"💲","medical_symbol":"⚕️","recycle":"♻️","fleur_de_lis":"⚜️","trident":"🔱","name_badge":"📛","beginner":"🔰","o":"⭕","white_check_mark":"✅","ballot_box_with_check":"☑️","heavy_check_mark":"✔️","x":"❌","negative_squared_cross_mark":"❎","curly_loop":"➰","loop":"➿","part_alternation_mark":"〽️","eight_spoked_asterisk":"✳️","eight_pointed_black_star":"✴️","sparkle":"❇️","copyright":"©️","registered":"®️","tm":"™️","hash":"#️⃣","asterisk":"*️⃣","zero":"0️⃣","one":"1️⃣","two":"2️⃣","three":"3️⃣","four":"4️⃣","five":"5️⃣","six":"6️⃣","seven":"7️⃣","eight":"8️⃣","nine":"9️⃣","keycap_ten":"🔟","capital_abcd":"🔠","abcd":"🔡","symbols":"🔣","abc":"🔤","a":"🅰️","ab":"🆎","b":"🅱️","cl":"🆑","cool":"🆒","free":"🆓","information_source":"ℹ️","id":"🆔","m":"Ⓜ️","new":"🆕","ng":"🆖","o2":"🅾️","ok":"🆗","parking":"🅿️","sos":"🆘","up":"🆙","vs":"🆚","koko":"🈁","sa":"🈂️","ideograph_advantage":"🉐","accept":"🉑","congratulations":"㊗️","secret":"㊙️","u6e80":"🈵","red_circle":"🔴","orange_circle":"🟠","yellow_circle":"🟡","green_circle":"🟢","large_blue_circle":"🔵","purple_circle":"🟣","brown_circle":"🟤","black_circle":"⚫","white_circle":"⚪","red_square":"🟥","orange_square":"🟧","yellow_square":"🟨","green_square":"🟩","blue_square":"🟦","purple_square":"🟪","brown_square":"🟫","black_large_square":"⬛","white_large_square":"⬜","black_medium_square":"◼️","white_medium_square":"◻️","black_medium_small_square":"◾","white_medium_small_square":"◽","black_small_square":"▪️","white_small_square":"▫️","large_orange_diamond":"🔶","large_blue_diamond":"🔷","small_orange_diamond":"🔸","small_blue_diamond":"🔹","small_red_triangle":"🔺","small_red_triangle_down":"🔻","diamond_shape_with_a_dot_inside":"💠","radio_button":"🔘","white_square_button":"🔳","black_square_button":"🔲","checkered_flag":"🏁","triangular_flag_on_post":"🚩","crossed_flags":"🎌","black_flag":"🏴","white_flag":"🏳️","rainbow_flag":"🏳️‍🌈","transgender_flag":"🏳️‍⚧️","pirate_flag":"🏴‍☠️","ascension_island":"🇦🇨","andorra":"🇦🇩","united_arab_emirates":"🇦🇪","afghanistan":"🇦🇫","antigua_barbuda":"🇦🇬","anguilla":"🇦🇮","albania":"🇦🇱","armenia":"🇦🇲","angola":"🇦🇴","antarctica":"🇦🇶","argentina":"🇦🇷","american_samoa":"🇦🇸","austria":"🇦🇹","australia":"🇦🇺","aruba":"🇦🇼","aland_islands":"🇦🇽","azerbaijan":"🇦🇿","bosnia_herzegovina":"🇧🇦","barbados":"🇧🇧","bangladesh":"🇧🇩","belgium":"🇧🇪","burkina_faso":"🇧🇫","bulgaria":"🇧🇬","bahrain":"🇧🇭","burundi":"🇧🇮","benin":"🇧🇯","st_barthelemy":"🇧🇱","bermuda":"🇧🇲","brunei":"🇧🇳","bolivia":"🇧🇴","caribbean_netherlands":"🇧🇶","brazil":"🇧🇷","bahamas":"🇧🇸","bhutan":"🇧🇹","bouvet_island":"🇧🇻","botswana":"🇧🇼","belarus":"🇧🇾","belize":"🇧🇿","canada":"🇨🇦","cocos_islands":"🇨🇨","congo_kinshasa":"🇨🇩","central_african_republic":"🇨🇫","congo_brazzaville":"🇨🇬","switzerland":"🇨🇭","cote_divoire":"🇨🇮","cook_islands":"🇨🇰","chile":"🇨🇱","cameroon":"🇨🇲","cn":"🇨🇳","colombia":"🇨🇴","clipperton_island":"🇨🇵","costa_rica":"🇨🇷","cuba":"🇨🇺","cape_verde":"🇨🇻","curacao":"🇨🇼","christmas_island":"🇨🇽","cyprus":"🇨🇾","czech_republic":"🇨🇿","de":"🇩🇪","diego_garcia":"🇩🇬","djibouti":"🇩🇯","denmark":"🇩🇰","dominica":"🇩🇲","dominican_republic":"🇩🇴","algeria":"🇩🇿","ceuta_melilla":"🇪🇦","ecuador":"🇪🇨","estonia":"🇪🇪","egypt":"🇪🇬","western_sahara":"🇪🇭","eritrea":"🇪🇷","es":"🇪🇸","ethiopia":"🇪🇹","eu":"🇪🇺","european_union":"🇪🇺","finland":"🇫🇮","fiji":"🇫🇯","falkland_islands":"🇫🇰","micronesia":"🇫🇲","faroe_islands":"🇫🇴","fr":"🇫🇷","gabon":"🇬🇦","gb":"🇬🇧","uk":"🇬🇧","grenada":"🇬🇩","georgia":"🇬🇪","french_guiana":"🇬🇫","guernsey":"🇬🇬","ghana":"🇬🇭","gibraltar":"🇬🇮","greenland":"🇬🇱","gambia":"🇬🇲","guinea":"🇬🇳","guadeloupe":"🇬🇵","equatorial_guinea":"🇬🇶","greece":"🇬🇷","south_georgia_south_sandwich_islands":"🇬🇸","guatemala":"🇬🇹","guam":"🇬🇺","guinea_bissau":"🇬🇼","guyana":"🇬🇾","hong_kong":"🇭🇰","heard_mcdonald_islands":"🇭🇲","honduras":"🇭🇳","croatia":"🇭🇷","haiti":"🇭🇹","hungary":"🇭🇺","canary_islands":"🇮🇨","indonesia":"🇮🇩","ireland":"🇮🇪","israel":"🇮🇱","isle_of_man":"🇮🇲","india":"🇮🇳","british_indian_ocean_territory":"🇮🇴","iraq":"🇮🇶","iran":"🇮🇷","iceland":"🇮🇸","it":"🇮🇹","jersey":"🇯🇪","jamaica":"🇯🇲","jordan":"🇯🇴","jp":"🇯🇵","kenya":"🇰🇪","kyrgyzstan":"🇰🇬","cambodia":"🇰🇭","kiribati":"🇰🇮","comoros":"🇰🇲","st_kitts_nevis":"🇰🇳","north_korea":"🇰🇵","kr":"🇰🇷","kuwait":"🇰🇼","cayman_islands":"🇰🇾","kazakhstan":"🇰🇿","laos":"🇱🇦","lebanon":"🇱🇧","st_lucia":"🇱🇨","liechtenstein":"🇱🇮","sri_lanka":"🇱🇰","liberia":"🇱🇷","lesotho":"🇱🇸","lithuania":"🇱🇹","luxembourg":"🇱🇺","latvia":"🇱🇻","libya":"🇱🇾","morocco":"🇲🇦","monaco":"🇲🇨","moldova":"🇲🇩","montenegro":"🇲🇪","st_martin":"🇲🇫","madagascar":"🇲🇬","marshall_islands":"🇲🇭","macedonia":"🇲🇰","mali":"🇲🇱","myanmar":"🇲🇲","mongolia":"🇲🇳","macau":"🇲🇴","northern_mariana_islands":"🇲🇵","martinique":"🇲🇶","mauritania":"🇲🇷","montserrat":"🇲🇸","malta":"🇲🇹","mauritius":"🇲🇺","maldives":"🇲🇻","malawi":"🇲🇼","mexico":"🇲🇽","malaysia":"🇲🇾","mozambique":"🇲🇿","namibia":"🇳🇦","new_caledonia":"🇳🇨","niger":"🇳🇪","norfolk_island":"🇳🇫","nigeria":"🇳🇬","nicaragua":"🇳🇮","netherlands":"🇳🇱","norway":"🇳🇴","nepal":"🇳🇵","nauru":"🇳🇷","niue":"🇳🇺","new_zealand":"🇳🇿","oman":"🇴🇲","panama":"🇵🇦","peru":"🇵🇪","french_polynesia":"🇵🇫","papua_new_guinea":"🇵🇬","philippines":"🇵🇭","pakistan":"🇵🇰","poland":"🇵🇱","st_pierre_miquelon":"🇵🇲","pitcairn_islands":"🇵🇳","puerto_rico":"🇵🇷","palestinian_territories":"🇵🇸","portugal":"🇵🇹","palau":"🇵🇼","paraguay":"🇵🇾","qatar":"🇶🇦","reunion":"🇷🇪","romania":"🇷🇴","serbia":"🇷🇸","ru":"🇷🇺","rwanda":"🇷🇼","saudi_arabia":"🇸🇦","solomon_islands":"🇸🇧","seychelles":"🇸🇨","sudan":"🇸🇩","sweden":"🇸🇪","singapore":"🇸🇬","st_helena":"🇸🇭","slovenia":"🇸🇮","svalbard_jan_mayen":"🇸🇯","slovakia":"🇸🇰","sierra_leone":"🇸🇱","san_marino":"🇸🇲","senegal":"🇸🇳","somalia":"🇸🇴","suriname":"🇸🇷","south_sudan":"🇸🇸","sao_tome_principe":"🇸🇹","el_salvador":"🇸🇻","sint_maarten":"🇸🇽","syria":"🇸🇾","swaziland":"🇸🇿","tristan_da_cunha":"🇹🇦","turks_caicos_islands":"🇹🇨","chad":"🇹🇩","french_southern_territories":"🇹🇫","togo":"🇹🇬","thailand":"🇹🇭","tajikistan":"🇹🇯","tokelau":"🇹🇰","timor_leste":"🇹🇱","turkmenistan":"🇹🇲","tunisia":"🇹🇳","tonga":"🇹🇴","tr":"🇹🇷","trinidad_tobago":"🇹🇹","tuvalu":"🇹🇻","taiwan":"🇹🇼","tanzania":"🇹🇿","ukraine":"🇺🇦","uganda":"🇺🇬","us_outlying_islands":"🇺🇲","united_nations":"🇺🇳","us":"🇺🇸","uruguay":"🇺🇾","uzbekistan":"🇺🇿","vatican_city":"🇻🇦","st_vincent_grenadines":"🇻🇨","venezuela":"🇻🇪","british_virgin_islands":"🇻🇬","us_virgin_islands":"🇻🇮","vietnam":"🇻🇳","vanuatu":"🇻🇺","wallis_futuna":"🇼🇫","samoa":"🇼🇸","kosovo":"🇽🇰","yemen":"🇾🇪","mayotte":"🇾🇹","south_africa":"🇿🇦","zambia":"🇿🇲","zimbabwe":"🇿🇼","england":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿"}');

/***/ }),

/***/ "./node_modules/markdown-it-emoji/lib/data/shortcuts.js":
/*!**************************************************************!*\
  !*** ./node_modules/markdown-it-emoji/lib/data/shortcuts.js ***!
  \**************************************************************/
/***/ ((module) => {

"use strict";
// Emoticons -> Emoji mapping.
//
// (!) Some patterns skipped, to avoid collisions
// without increase matcher complicity. Than can change in future.
//
// Places to look for more emoticons info:
//
// - http://en.wikipedia.org/wiki/List_of_emoticons#Western
// - https://github.com/wooorm/emoticon/blob/master/Support.md
// - http://factoryjoe.com/projects/emoticons/
//


module.exports = {
  angry:            [ '>:(', '>:-(' ],
  blush:            [ ':")', ':-")' ],
  broken_heart:     [ '</3', '<\\3' ],
  // :\ and :-\ not used because of conflict with markdown escaping
  confused:         [ ':/', ':-/' ], // twemoji shows question
  cry:              [ ":'(", ":'-(", ':,(', ':,-(' ],
  frowning:         [ ':(', ':-(' ],
  heart:            [ '<3' ],
  imp:              [ ']:(', ']:-(' ],
  innocent:         [ 'o:)', 'O:)', 'o:-)', 'O:-)', '0:)', '0:-)' ],
  joy:              [ ":')", ":'-)", ':,)', ':,-)', ":'D", ":'-D", ':,D', ':,-D' ],
  kissing:          [ ':*', ':-*' ],
  laughing:         [ 'x-)', 'X-)' ],
  neutral_face:     [ ':|', ':-|' ],
  open_mouth:       [ ':o', ':-o', ':O', ':-O' ],
  rage:             [ ':@', ':-@' ],
  smile:            [ ':D', ':-D' ],
  smiley:           [ ':)', ':-)' ],
  smiling_imp:      [ ']:)', ']:-)' ],
  sob:              [ ":,'(", ":,'-(", ';(', ';-(' ],
  stuck_out_tongue: [ ':P', ':-P' ],
  sunglasses:       [ '8-)', 'B-)' ],
  sweat:            [ ',:(', ',:-(' ],
  sweat_smile:      [ ',:)', ',:-)' ],
  unamused:         [ ':s', ':-S', ':z', ':-Z', ':$', ':-$' ],
  wink:             [ ';)', ';-)' ]
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/lib/normalize_opts.js":
/*!**************************************************************!*\
  !*** ./node_modules/markdown-it-emoji/lib/normalize_opts.js ***!
  \**************************************************************/
/***/ ((module) => {

"use strict";
// Convert input options to more useable format
// and compile search regexp




function quoteRE(str) {
  return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}


module.exports = function normalize_opts(options) {
  var emojies = options.defs,
      shortcuts;

  // Filter emojies by whitelist, if needed
  if (options.enabled.length) {
    emojies = Object.keys(emojies).reduce(function (acc, key) {
      if (options.enabled.indexOf(key) >= 0) {
        acc[key] = emojies[key];
      }
      return acc;
    }, {});
  }

  // Flatten shortcuts to simple object: { alias: emoji_name }
  shortcuts = Object.keys(options.shortcuts).reduce(function (acc, key) {
    // Skip aliases for filtered emojies, to reduce regexp
    if (!emojies[key]) { return acc; }

    if (Array.isArray(options.shortcuts[key])) {
      options.shortcuts[key].forEach(function (alias) {
        acc[alias] = key;
      });
      return acc;
    }

    acc[options.shortcuts[key]] = key;
    return acc;
  }, {});

  var keys = Object.keys(emojies),
      names;

  // If no definitions are given, return empty regex to avoid replacements with 'undefined'.
  if (keys.length === 0) {
    names = '^$';
  } else {
    // Compile regexp
    names = keys
      .map(function (name) { return ':' + name + ':'; })
      .concat(Object.keys(shortcuts))
      .sort()
      .reverse()
      .map(function (name) { return quoteRE(name); })
      .join('|');
  }
  var scanRE = RegExp(names);
  var replaceRE = RegExp(names, 'g');

  return {
    defs: emojies,
    shortcuts: shortcuts,
    scanRE: scanRE,
    replaceRE: replaceRE
  };
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/lib/render.js":
/*!******************************************************!*\
  !*** ./node_modules/markdown-it-emoji/lib/render.js ***!
  \******************************************************/
/***/ ((module) => {

"use strict";


module.exports = function emoji_html(tokens, idx /*, options, env */) {
  return tokens[idx].content;
};


/***/ }),

/***/ "./node_modules/markdown-it-emoji/lib/replace.js":
/*!*******************************************************!*\
  !*** ./node_modules/markdown-it-emoji/lib/replace.js ***!
  \*******************************************************/
/***/ ((module) => {

"use strict";
// Emojies & shortcuts replacement logic.
//
// Note: In theory, it could be faster to parse :smile: in inline chain and
// leave only shortcuts here. But, who care...
//




module.exports = function create_rule(md, emojies, shortcuts, scanRE, replaceRE) {
  var arrayReplaceAt = md.utils.arrayReplaceAt,
      ucm = md.utils.lib.ucmicro,
      ZPCc = new RegExp([ ucm.Z.source, ucm.P.source, ucm.Cc.source ].join('|'));

  function splitTextToken(text, level, Token) {
    var token, last_pos = 0, nodes = [];

    text.replace(replaceRE, function (match, offset, src) {
      var emoji_name;
      // Validate emoji name
      if (shortcuts.hasOwnProperty(match)) {
        // replace shortcut with full name
        emoji_name = shortcuts[match];

        // Don't allow letters before any shortcut (as in no ":/" in http://)
        if (offset > 0 && !ZPCc.test(src[offset - 1])) {
          return;
        }

        // Don't allow letters after any shortcut
        if (offset + match.length < src.length && !ZPCc.test(src[offset + match.length])) {
          return;
        }
      } else {
        emoji_name = match.slice(1, -1);
      }

      // Add new tokens to pending list
      if (offset > last_pos) {
        token         = new Token('text', '', 0);
        token.content = text.slice(last_pos, offset);
        nodes.push(token);
      }

      token         = new Token('emoji', '', 0);
      token.markup  = emoji_name;
      token.content = emojies[emoji_name];
      nodes.push(token);

      last_pos = offset + match.length;
    });

    if (last_pos < text.length) {
      token         = new Token('text', '', 0);
      token.content = text.slice(last_pos);
      nodes.push(token);
    }

    return nodes;
  }

  return function emoji_replace(state) {
    var i, j, l, tokens, token,
        blockTokens = state.tokens,
        autolinkLevel = 0;

    for (j = 0, l = blockTokens.length; j < l; j++) {
      if (blockTokens[j].type !== 'inline') { continue; }
      tokens = blockTokens[j].children;

      // We scan from the end, to keep position when new tags added.
      // Use reversed logic in links start/end match
      for (i = tokens.length - 1; i >= 0; i--) {
        token = tokens[i];

        if (token.type === 'link_open' || token.type === 'link_close') {
          if (token.info === 'auto') { autolinkLevel -= token.nesting; }
        }

        if (token.type === 'text' && autolinkLevel === 0 && scanRE.test(token.content)) {
          // replace current node
          blockTokens[j].children = tokens = arrayReplaceAt(
            tokens, i, splitTextToken(token.content, token.level, state.Token)
          );
        }
      }
    }
  };
};


/***/ }),

/***/ "./node_modules/markdown-it-html5-embed/lib/index.js":
/*!***********************************************************!*\
  !*** ./node_modules/markdown-it-html5-embed/lib/index.js ***!
  \***********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/*! markdown-it-html5-embed https://github.com/cmrd-senya/markdown-it-html5-embed @license MPLv2 */
// This is a plugin for markdown-it which adds support for embedding audio/video in the HTML5 way.



var Mimoza = __webpack_require__(/*! mimoza */ "./node_modules/mimoza/index.js");

// Default UI messages. You can customize and add simple translations via
// options.messages. The language has to be provided via the markdown-it
// environment, e.g.:
//
// md.render('some text', { language: 'some code' })
//
// It will default to English if not provided. To use your own i18n framework,
// you have to provide a translation function via options.translateFn.
//
// The "untitled video" / "untitled audio" messages are only relevant to usage
// inside alternative render functions, where you can access the title between [] as
// {{title}}, and this text is used if no title is provided.
var messages = {
  en: {
    'video not supported': 'Your browser does not support playing HTML5 video. ' +
      'You can <a href="%s" download>download a copy of the video file</a> instead.',
    'audio not supported': 'Your browser does not support playing HTML5 audio. ' +
      'You can <a href="%s" download>download a copy of the audio file</a> instead.',
    'content description': 'Here is a description of the content: %s',
    'untitled video': 'Untitled video',
    'untitled audio': 'Untitled audio'
  }
};

function clearTokens(tokens, idx) {
  for (var i = idx; i < tokens.length; i++) {
    switch (tokens[i].type) {
      case 'link_close':
        tokens[i].hidden = true;
        break;
      case 'text':
        tokens[i].content = '';
        break;
      default:
        throw "Unexpected token: " + tokens[i].type;
    }
  }
}

function parseToken(tokens, idx, env) {
  var parsed = {};
  var token = tokens[idx];
  var description = '';

  var aIndex = token.attrIndex('src');
  parsed.isLink = aIndex < 0;
  if (parsed.isLink) {
    aIndex = token.attrIndex('href');
    description = tokens[idx + 1].content;
  } else {
    description = token.content;
  }

  parsed.url = token.attrs[aIndex][1];
  parsed.mimeType = Mimoza.getMimeType(parsed.url);
  var RE = /^(audio|video)\/.*/gi;
  var mimetype_matches = RE.exec(parsed.mimeType);
  if (mimetype_matches === null) {
    parsed.mediaType = null;
  } else {
    parsed.mediaType = mimetype_matches[1];
  }

  if (parsed.mediaType !== null) {
    // For use as titles in alternative render functions, we store the description
    // in parsed.title. For use as fallback text, we store it in parsed.fallback
    // alongside the standard fallback text.
    parsed.fallback = translate({
      messageKey: parsed.mediaType + ' not supported',
      messageParam: parsed.url,
      language: env.language
    });
    if (description.trim().length) {
      parsed.fallback += '\n' + translate({
        messageKey: 'content description',
        messageParam: description,
        language: env.language
      });
      parsed.title = description;
    } else {
      parsed.title = translate({
        messageKey: 'untitled ' + parsed.mediaType,
        language: env.language
      });
    }
  }
  return parsed;
}

function isAllowedMimeType(parsed, options) {
  return parsed.mediaType !== null &&
    (!options.isAllowedMimeType || options.isAllowedMimeType([parsed.mimeType, parsed.mediaType]));
}

function isAllowedSchema(parsed, options) {
  if (!options.isAllowedHttp && parsed.url.match('^http://')) {
    return false;
  }
  return true;
}

function isAllowedToEmbed(parsed, options) {
  return isAllowedMimeType(parsed, options) && isAllowedSchema(parsed, options);
}

function renderMediaEmbed(parsed, mediaAttributes) {
  var attributes = mediaAttributes[parsed.mediaType];

  return ['<' + parsed.mediaType + ' ' + attributes + '>',
    '<source type="' + parsed.mimeType + '" src="' + parsed.url + '"></source>',
    parsed.fallback,
    '</' + parsed.mediaType + '>'
  ].join('\n');
}

function html5EmbedRenderer(tokens, idx, options, env, renderer, defaultRender) {
  var parsed = parseToken(tokens, idx, env);

  if (!isAllowedToEmbed(parsed, options.html5embed)) {
    return defaultRender(tokens, idx, options, env, renderer);
  }

  if (parsed.isLink) {
    clearTokens(tokens, idx + 1);
  }

  return renderMediaEmbed(parsed, options.html5embed.attributes);
}

function forEachLinkOpen(state, action) {
  state.tokens.forEach(function(token, _idx, _tokens) {
    if (token.type === "inline") {
      token.children.forEach(function(token, idx, tokens) {
        if (token.type === "link_open") {
          action(tokens, idx);
        }
      });
    }
  });
}

function findDirective(state, startLine, _endLine, silent, regexp, build_token) {
  var pos = state.bMarks[startLine] + state.tShift[startLine];
  var max = state.eMarks[startLine];

  // Detect directive markdown
  var currentLine = state.src.substring(pos, max);
  var match = regexp.exec(currentLine);
  if (match === null || match.length < 1) {
    return false;
  }

  if (silent) {
    return true;
  }

  state.line = startLine + 1;

  // Build content
  var token = build_token();
  token.map = [startLine, state.line];
  token.markup = currentLine;

  return true;
}

/**
 * Very basic translation function. To translate or customize the UI messages,
 * set options.messages. To also customize the translation function itself, set
 * option.translateFn to a function that handles the same message object format.
 *
 * @param {Object} messageObj
 *  the message object
 * @param {String} messageObj.messageKey
 *  an identifier used for looking up the message in i18n files
 * @param {String} messageObj.messageParam
 *  for substitution of %s for filename and description in the respective
 *  messages
 * @param {String} [messageObj.language='en']
 *  a language code, ignored in the default implementation
 * @this {Object}
 *  the built-in default messages, or options.messages if set
 */
function translate(messageObj) {
  // Default to English if we don't have this message, or don't support this
  // language at all
  var language = messageObj.language && this[messageObj.language] &&
    this[messageObj.language][messageObj.messageKey] ?
    messageObj.language :
    'en';
  var rv = this[language][messageObj.messageKey];

  if (messageObj.messageParam) {
    rv = rv.replace('%s', messageObj.messageParam);
  }
  return rv;
}

module.exports = function html5_embed_plugin(md, options) {
  var gstate;
  var defaults = {
    attributes: {
      audio: 'controls preload="metadata"',
      video: 'controls preload="metadata"'
    },
    useImageSyntax: true,
    inline: true,
    autoAppend: false,
    embedPlaceDirectiveRegexp: /^\[\[html5media\]\]/im,
    messages: messages
  };
  var options = md.utils.assign({}, defaults, options.html5embed);

  if (!options.inline) {
    md.block.ruler.before("paragraph", "html5embed", function(state, startLine, endLine, silent) {
      return findDirective(state, startLine, endLine, silent, options.embedPlaceDirectiveRegexp, function() {
        return state.push("html5media", "html5media", 0);
      });
    });

    md.renderer.rules.html5media = function(tokens, index, _, env) {
      var result = "";
      forEachLinkOpen(gstate, function(tokens, idx) {
        var parsed = parseToken(tokens, idx, env);

        if (!isAllowedToEmbed(parsed, options)) {
          return;
        }

        result += renderMediaEmbed(parsed, options.attributes);
      });
      if (result.length) {
        result += "\n";
      }
      return result;
    };

    // Catch all the tokens for iteration later
    md.core.ruler.push("grab_state", function(state) {
      gstate = state;

      if (options.autoAppend) {
        var token = new state.Token("html5media", "", 0);
        state.tokens.push(token);
      }
    });
  }

  if (typeof options.isAllowedMimeType === "undefined") {
    options.isAllowedMimeType = options.is_allowed_mime_type;
  }

  if (options.inline && options.useImageSyntax) {
    var defaultRender = md.renderer.rules.image;
    md.renderer.rules.image = function(tokens, idx, opt, env, self) {
      opt.html5embed = options;
      return html5EmbedRenderer(tokens, idx, opt, env, self, defaultRender);
    }
  }

  if (options.inline && options.useLinkSyntax) {
    var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    md.renderer.rules.link_open = function(tokens, idx, opt, env, self) {
      opt.html5embed = options;
      return html5EmbedRenderer(tokens, idx, opt, env, self, defaultRender);
    };
  }

  // options.messages will be set to built-in messages at the beginning of this
  // file if not configured
  translate = typeof options.translateFn == 'function' ?
    options.translateFn.bind(options.messages) :
    translate.bind(options.messages);

  if (typeof options.renderFn == 'function') {
    renderMediaEmbed = options.renderFn;
  }
};


/***/ }),

/***/ "./node_modules/markdown-it-mark/index.js":
/*!************************************************!*\
  !*** ./node_modules/markdown-it-mark/index.js ***!
  \************************************************/
/***/ ((module) => {

"use strict";



module.exports = function ins_plugin(md) {
  // Insert each marker as a separate text token, and add it to delimiter list
  //
  function tokenize(state, silent) {
    var i, scanned, token, len, ch,
        start = state.pos,
        marker = state.src.charCodeAt(start);

    if (silent) { return false; }

    if (marker !== 0x3D/* = */) { return false; }

    scanned = state.scanDelims(state.pos, true);
    len = scanned.length;
    ch = String.fromCharCode(marker);

    if (len < 2) { return false; }

    if (len % 2) {
      token         = state.push('text', '', 0);
      token.content = ch;
      len--;
    }

    for (i = 0; i < len; i += 2) {
      token         = state.push('text', '', 0);
      token.content = ch + ch;

      if (!scanned.can_open && !scanned.can_close) { continue; }

      state.delimiters.push({
        marker: marker,
        length: 0,     // disable "rule of 3" length checks meant for emphasis
        jump:   i / 2, // 1 delimiter = 2 characters
        token:  state.tokens.length - 1,
        end:    -1,
        open:   scanned.can_open,
        close:  scanned.can_close
      });
    }

    state.pos += scanned.length;

    return true;
  }


  // Walk through delimiter list and replace text tokens with tags
  //
  function postProcess(state, delimiters) {
    var i, j,
        startDelim,
        endDelim,
        token,
        loneMarkers = [],
        max = delimiters.length;

    for (i = 0; i < max; i++) {
      startDelim = delimiters[i];

      if (startDelim.marker !== 0x3D/* = */) {
        continue;
      }

      if (startDelim.end === -1) {
        continue;
      }

      endDelim = delimiters[startDelim.end];

      token         = state.tokens[startDelim.token];
      token.type    = 'mark_open';
      token.tag     = 'mark';
      token.nesting = 1;
      token.markup  = '==';
      token.content = '';

      token         = state.tokens[endDelim.token];
      token.type    = 'mark_close';
      token.tag     = 'mark';
      token.nesting = -1;
      token.markup  = '==';
      token.content = '';

      if (state.tokens[endDelim.token - 1].type === 'text' &&
          state.tokens[endDelim.token - 1].content === '=') {

        loneMarkers.push(endDelim.token - 1);
      }
    }

    // If a marker sequence has an odd number of characters, it's splitted
    // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
    // start of the sequence.
    //
    // So, we have to move all those markers after subsequent s_close tags.
    //
    while (loneMarkers.length) {
      i = loneMarkers.pop();
      j = i + 1;

      while (j < state.tokens.length && state.tokens[j].type === 'mark_close') {
        j++;
      }

      j--;

      if (i !== j) {
        token = state.tokens[j];
        state.tokens[j] = state.tokens[i];
        state.tokens[i] = token;
      }
    }
  }

  md.inline.ruler.before('emphasis', 'mark', tokenize);
  md.inline.ruler2.before('emphasis', 'mark', function (state) {
    var curr,
        tokens_meta = state.tokens_meta,
        max = (state.tokens_meta || []).length;

    postProcess(state, state.delimiters);

    for (curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess(state, tokens_meta[curr].delimiters);
      }
    }
  });
};


/***/ }),

/***/ "./node_modules/markdown-it-multimd-table/index.js":
/*!*********************************************************!*\
  !*** ./node_modules/markdown-it-multimd-table/index.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

var DFA = __webpack_require__(/*! ./lib/dfa.js */ "./node_modules/markdown-it-multimd-table/lib/dfa.js");

module.exports = function multimd_table_plugin(md, options) {
  var defaults = {
    multiline:  false,
    rowspan:    false,
    headerless: false,
    multibody:  true
  };
  options = md.utils.assign({}, defaults, options || {});

  function scan_bound_indices(state, line) {
    /**
     * Naming convention of positional variables
     * - list-item
     * ·········longtext······\n
     *   ^head  ^start  ^end  ^max
     */
    var start = state.bMarks[line] + state.sCount[line],
        head = state.bMarks[line] + state.blkIndent,
        end = state.skipSpacesBack(state.eMarks[line], head),
        bounds = [], pos, posjump,
        escape = false, code = false;

    /* Scan for valid pipe character position */
    for (pos = start; pos < end; pos++) {
      switch (state.src.charCodeAt(pos)) {
        case 0x5c /* \ */:
          escape = true; break;
        case 0x60 /* ` */:
          posjump = state.skipChars(pos, 0x60) - 1;
          /* make \` closes the code sequence, but not open it;
             the reason is that `\` is correct code block */
          /* eslint-disable-next-line brace-style */
          if (posjump > pos) { pos = posjump; }
          else if (code || !escape) { code = !code; }
          escape = false; break;
        case 0x7c /* | */:
          if (!code && !escape) { bounds.push(pos); }
          escape = false; break;
        default:
          escape = false; break;
      }
    }
    if (bounds.length === 0) return bounds;

    /* Pad in newline characters on last and this line */
    if (bounds[0] > head) { bounds.unshift(head - 1); }
    if (bounds[bounds.length - 1] < end - 1) { bounds.push(end); }

    return bounds;
  }

  function table_caption(state, silent, line) {
    var meta = { text: null, label: null },
        start = state.bMarks[line] + state.sCount[line],
        max = state.eMarks[line],
        capRE = /^\[([^\[\]]+)\](\[([^\[\]]+)\])?\s*$/,
        matches = state.src.slice(start, max).match(capRE);

    if (!matches) { return false; }
    if (silent)  { return true; }
    // TODO eliminate capRE by simple checking

    meta.text  = matches[1];
    meta.label = matches[2] || matches[1];
    meta.label = meta.label.toLowerCase().replace(/\W+/g, '');

    return meta;
  }

  function table_row(state, silent, line) {
    var meta = { bounds: null, multiline: null },
        bounds = scan_bound_indices(state, line),
        start, pos, oldMax;

    if (bounds.length < 2) { return false; }
    if (silent) { return true; }

    meta.bounds = bounds;

    /* Multiline. Scan boundaries again since it's very complicated */
    if (options.multiline) {
      start = state.bMarks[line] + state.sCount[line];
      pos = state.eMarks[line] - 1; /* where backslash should be */
      meta.multiline = (state.src.charCodeAt(pos) === 0x5C/* \ */);
      if (meta.multiline) {
        oldMax = state.eMarks[line];
        state.eMarks[line] = state.skipSpacesBack(pos, start);
        meta.bounds = scan_bound_indices(state, line);
        state.eMarks[line] = oldMax;
      }
    }

    return meta;
  }

  function table_separator(state, silent, line) {
    var meta = { aligns: [], wraps: [] },
        bounds = scan_bound_indices(state, line),
        sepRE = /^:?(-+|=+):?\+?$/,
        c, text, align;

    /* Only separator needs to check indents */
    if (state.sCount[line] - state.blkIndent >= 4) { return false; }
    if (bounds.length === 0) { return false; }

    for (c = 0; c < bounds.length - 1; c++) {
      text = state.src.slice(bounds[c] + 1, bounds[c + 1]).trim();
      if (!sepRE.test(text)) { return false; }

      meta.wraps.push(text.charCodeAt(text.length - 1) === 0x2B/* + */);
      align = ((text.charCodeAt(0) === 0x3A/* : */) << 4) |
               (text.charCodeAt(text.length - 1 - meta.wraps[c]) === 0x3A);
      switch (align) {
        case 0x00: meta.aligns.push('');       break;
        case 0x01: meta.aligns.push('right');  break;
        case 0x10: meta.aligns.push('left');   break;
        case 0x11: meta.aligns.push('center'); break;
      }
    }
    if (silent) { return true; }
    return meta;
  }

  function table_empty(state, silent, line) {
    return state.isEmpty(line);
  }

  function table(state, startLine, endLine, silent) {
    /**
     * Regex pseudo code for table:
     *     caption? header+ separator (data+ empty)* data+ caption?
     *
     * We use DFA to emulate this plugin. Types with lower precedence are
     * set-minus from all the formers.  Noted that separator should have higher
     * precedence than header or data.
     *   |  state  | caption separator header data empty | --> lower precedence
     *   | 0x10100 |    1        0       1     0     0   |
     */
    var tableDFA = new DFA(),
        grp = 0x10, mtr = -1,
        token, tableToken, trToken,
        colspan, leftToken,
        rowspan, upTokens = [],
        tableLines, tgroupLines,
        tag, text, range, r, c, b;

    if (startLine + 2 > endLine) { return false; }

    /**
     * First pass: validate and collect info into table token. IR is stored in
     * markdown-it `token.meta` to be pushed later. table/tr open tokens are
     * generated here.
     */
    tableToken       = new state.Token('table_open', 'table', 1);
    tableToken.meta  = { sep: null, cap: null, tr: [] };

    tableDFA.set_highest_alphabet(0x10000);
    tableDFA.set_initial_state(0x10100);
    tableDFA.set_accept_states([ 0x10010, 0x10011, 0x00000 ]);
    tableDFA.set_match_alphabets({
      0x10000: table_caption.bind(this, state, true),
      0x01000: table_separator.bind(this, state, true),
      0x00100: table_row.bind(this, state, true),
      0x00010: table_row.bind(this, state, true),
      0x00001: table_empty.bind(this, state, true)
    });
    tableDFA.set_transitions({
      0x10100: { 0x10000: 0x00100, 0x00100: 0x01100 },
      0x00100: { 0x00100: 0x01100 },
      0x01100: { 0x01000: 0x10010, 0x00100: 0x01100 },
      0x10010: { 0x10000: 0x00000, 0x00010: 0x10011 },
      0x10011: { 0x10000: 0x00000, 0x00010: 0x10011, 0x00001: 0x10010 }
    });
    if (options.headerless) {
      tableDFA.set_initial_state(0x11100);
      tableDFA.update_transition(0x11100,
        { 0x10000: 0x01100, 0x01000: 0x10010, 0x00100: 0x01100 }
      );
      trToken      = new state.Token('table_fake_header_row', 'tr', 1);
      trToken.meta = Object();  // avoid trToken.meta.grp throws exception
    }
    if (!options.multibody) {
      tableDFA.update_transition(0x10010,
        { 0x10000: 0x00000, 0x00010: 0x10010 }  // 0x10011 is never reached
      );
    }
    /* Don't mix up DFA `_state` and markdown-it `state` */
    tableDFA.set_actions(function (_line, _state, _type) {
      // console.log(_line, _state.toString(16), _type.toString(16))  // for test
      switch (_type) {
        case 0x10000:
          if (tableToken.meta.cap) { break; }
          tableToken.meta.cap       = table_caption(state, false, _line);
          tableToken.meta.cap.map   = [ _line, _line + 1 ];
          tableToken.meta.cap.first = (_line === startLine);
          break;
        case 0x01000:
          tableToken.meta.sep     = table_separator(state, false, _line);
          tableToken.meta.sep.map = [ _line, _line + 1 ];
          trToken.meta.grp |= 0x01;  // previously assigned at case 0x00110
          grp               = 0x10;
          break;
        case 0x00100:
        case 0x00010:
          trToken           = new state.Token('tr_open', 'tr', 1);
          trToken.map       = [ _line, _line + 1 ];
          trToken.meta      = table_row(state, false, _line);
          trToken.meta.type = _type;
          trToken.meta.grp  = grp;
          grp               = 0x00;
          tableToken.meta.tr.push(trToken);
          /* Multiline. Merge trTokens as an entire multiline trToken */
          if (options.multiline) {
            if (trToken.meta.multiline && mtr < 0) {
              /* Start line of multiline row. mark this trToken */
              mtr = tableToken.meta.tr.length - 1;
            } else if (!trToken.meta.multiline && mtr >= 0) {
              /* End line of multiline row. merge forward until the marked trToken */
              token               = tableToken.meta.tr[mtr];
              token.meta.mbounds  = tableToken.meta.tr
                .slice(mtr).map(function (tk) { return tk.meta.bounds; });
              token.map[1]        = trToken.map[1];
              tableToken.meta.tr  = tableToken.meta.tr.slice(0, mtr + 1);
              mtr = -1;
            }
          }
          break;
        case 0x00001:
          trToken.meta.grp |= 0x01;
          grp               = 0x10;
          break;
      }
    });

    if (tableDFA.execute(startLine, endLine) === false) { return false; }
    // if (!tableToken.meta.sep) { return false; } // always evaluated true
    if (!tableToken.meta.tr.length) { return false; } // false under headerless corner case
    if (silent) { return true; }

    /* Last data row cannot be detected. not stored to trToken outside? */
    tableToken.meta.tr[tableToken.meta.tr.length - 1].meta.grp |= 0x01;


    /**
     * Second pass: actually push the tokens into `state.tokens`.
     * thead/tbody/th/td open tokens and all closed tokens are generated here;
     * thead/tbody are generally called tgroup; td/th are generally called tcol.
     */
    tableToken.map   = tableLines = [ startLine, 0 ];
    tableToken.block = true;
    tableToken.level = state.level++;
    state.tokens.push(tableToken);

    if (tableToken.meta.cap) {
      token          = state.push('caption_open', 'caption', 1);
      token.map      = tableToken.meta.cap.map;
      token.attrs    = [ [ 'id', tableToken.meta.cap.label ] ];

      token          = state.push('inline', '', 0);
      token.content  = tableToken.meta.cap.text;
      token.map      = tableToken.meta.cap.map;
      token.children = [];

      token          = state.push('caption_close', 'caption', -1);
    }

    for (r = 0; r < tableToken.meta.tr.length; r++) {
      leftToken = new state.Token('table_fake_tcol_open', '', 1);

      /* Push in thead/tbody and tr open tokens */
      trToken = tableToken.meta.tr[r];
      // console.log(trToken.meta); // for test
      if (trToken.meta.grp & 0x10) {
        tag = (trToken.meta.type === 0x00100) ? 'thead' : 'tbody';
        token     = state.push(tag + '_open', tag, 1);
        token.map = tgroupLines = [ trToken.map[0], 0 ];  // array ref
        upTokens  = [];
      }
      trToken.block = true;
      trToken.level = state.level++;
      state.tokens.push(trToken);

      /* Push in th/td tokens */
      for (c = 0; c < trToken.meta.bounds.length - 1; c++) {
        range = [ trToken.meta.bounds[c] + 1, trToken.meta.bounds[c + 1] ];
        text = state.src.slice.apply(state.src, range);

        if (text === '') {
          colspan = leftToken.attrGet('colspan');
          leftToken.attrSet('colspan', colspan === null ? 2 : colspan + 1);
          continue;
        }
        if (options.rowspan && upTokens[c] && text.trim() === '^^') {
          rowspan = upTokens[c].attrGet('rowspan');
          upTokens[c].attrSet('rowspan', rowspan === null ? 2 : rowspan + 1);
          continue;
        }

        tag = (trToken.meta.type === 0x00100) ? 'th' : 'td';
        token       = state.push(tag + '_open', tag, 1);
        token.map   = trToken.map;
        token.attrs = [];
        if (tableToken.meta.sep.aligns[c]) {
          token.attrs.push([ 'style', 'text-align:' + tableToken.meta.sep.aligns[c] ]);
        }
        if (tableToken.meta.sep.wraps[c]) {
          token.attrs.push([ 'class', 'extend' ]);
        }
        leftToken = upTokens[c] = token;

        /* Multiline. Join the text and feed into markdown-it blockParser. */
        if (options.multiline && trToken.meta.multiline && trToken.meta.mbounds) {
          text = [ text.trimRight() ];
          for (b = 1; b < trToken.meta.mbounds.length; b++) {
            /* Line with N bounds has cells indexed from 0 to N-2 */
            if (c > trToken.meta.mbounds[b].length - 2) { continue; }
            range = [ trToken.meta.mbounds[b][c] + 1, trToken.meta.mbounds[b][c + 1] ];
            text.push(state.src.slice.apply(state.src, range).trimRight());
          }
          state.md.block.parse(text.join('\n'), state.md, state.env, state.tokens);
        } else {
          token          = state.push('inline', '', 0);
          token.content  = text.trim();
          token.map      = trToken.map;
          token.children = [];
        }

        token = state.push(tag + '_close', tag, -1);
      }

      /* Push in tr and thead/tbody closed tokens */
      state.push('tr_close', 'tr', -1);
      if (trToken.meta.grp & 0x01) {
        tag = (trToken.meta.type === 0x00100) ? 'thead' : 'tbody';
        token = state.push(tag + '_close', tag, -1);
        tgroupLines[1] = trToken.map[1];
      }
    }

    tableLines[1] = Math.max(
      tgroupLines[1],
      tableToken.meta.sep.map[1],
      tableToken.meta.cap ? tableToken.meta.cap.map[1] : -1
    );
    token = state.push('table_close', 'table', -1);

    state.line = tableLines[1];
    return true;
  }

  md.block.ruler.at('table', table, { alt: [ 'paragraph', 'reference' ] });
};

/* vim: set ts=2 sw=2 et: */


/***/ }),

/***/ "./node_modules/markdown-it-multimd-table/lib/dfa.js":
/*!***********************************************************!*\
  !*** ./node_modules/markdown-it-multimd-table/lib/dfa.js ***!
  \***********************************************************/
/***/ ((module) => {

"use strict";


// constructor

function DFA() {
  // alphabets are encoded by numbers in 16^N form, presenting its precedence
  this.__highest_alphabet__ = 0x0;
  this.__match_alphabets__ = {};
  // states are union (bitwise OR) of its accepted alphabets
  this.__initial_state__ = 0x0;
  this.__accept_states__ = {};
  // transitions are in the form: {prev_state: {alphabet: next_state}}
  this.__transitions__ = {};
  // actions take two parameters: step (line number), prev_state and alphabet
  this.__actions__ = {};
}

// setters

DFA.prototype.set_highest_alphabet = function (alphabet) {
  this.__highest_alphabet__ = alphabet;
};

DFA.prototype.set_match_alphabets = function (matches) {
  this.__match_alphabets__ = matches;
};

DFA.prototype.set_initial_state = function (initial) {
  this.__initial_state__ = initial;
};

DFA.prototype.set_accept_states = function (accepts) {
  for (var i = 0; i < accepts.length; i++) {
    this.__accept_states__[accepts[i]] = true;
  }
};

DFA.prototype.set_transitions = function (transitions) {
  this.__transitions__ = transitions;
};

DFA.prototype.set_actions = function (actions) {
  this.__actions__ = actions;
};

DFA.prototype.update_transition = function (state, alphabets) {
  this.__transitions__[state] = Object.assign(
    this.__transitions__[state] || Object(), alphabets
  );
};

// methods

DFA.prototype.execute = function (start, end) {
  var state, step, alphabet;
  for (state = this.__initial_state__, step = start; state && step < end; step++) {
    for (alphabet = this.__highest_alphabet__; alphabet > 0x0; alphabet >>= 4) {
      if ((state & alphabet)
          && this.__match_alphabets__[alphabet].call(this, step, state, alphabet)) { break; }
    }

    this.__actions__(step, state, alphabet);

    if (alphabet === 0x0) { break; }
    state = this.__transitions__[state][alphabet] || 0x0;
  }
  return !!this.__accept_states__[state];
};

module.exports = DFA;

/* vim: set ts=2 sw=2 et: */


/***/ }),

/***/ "./node_modules/markdown-it-underline/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/markdown-it-underline/index.js ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = function markdownItUnderline (md) {

  function renderEm (tokens, idx, opts, _, slf) {
    var token = tokens[idx];
    if (token.markup === '_') {
      token.tag = 'u';
    }
    return slf.renderToken(tokens, idx, opts);
  }

  md.renderer.rules.em_open = renderEm;
  md.renderer.rules.em_close = renderEm;
};


/***/ }),

/***/ "./node_modules/mime-db/db.json":
/*!**************************************!*\
  !*** ./node_modules/mime-db/db.json ***!
  \**************************************/
/***/ ((module) => {

"use strict";
module.exports = JSON.parse('{"application/1d-interleaved-parityfec":{"source":"iana"},"application/3gpdash-qoe-report+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/3gpp-ims+xml":{"source":"iana","compressible":true},"application/a2l":{"source":"iana"},"application/activemessage":{"source":"iana"},"application/activity+json":{"source":"iana","compressible":true},"application/alto-costmap+json":{"source":"iana","compressible":true},"application/alto-costmapfilter+json":{"source":"iana","compressible":true},"application/alto-directory+json":{"source":"iana","compressible":true},"application/alto-endpointcost+json":{"source":"iana","compressible":true},"application/alto-endpointcostparams+json":{"source":"iana","compressible":true},"application/alto-endpointprop+json":{"source":"iana","compressible":true},"application/alto-endpointpropparams+json":{"source":"iana","compressible":true},"application/alto-error+json":{"source":"iana","compressible":true},"application/alto-networkmap+json":{"source":"iana","compressible":true},"application/alto-networkmapfilter+json":{"source":"iana","compressible":true},"application/alto-updatestreamcontrol+json":{"source":"iana","compressible":true},"application/alto-updatestreamparams+json":{"source":"iana","compressible":true},"application/aml":{"source":"iana"},"application/andrew-inset":{"source":"iana","extensions":["ez"]},"application/applefile":{"source":"iana"},"application/applixware":{"source":"apache","extensions":["aw"]},"application/atf":{"source":"iana"},"application/atfx":{"source":"iana"},"application/atom+xml":{"source":"iana","compressible":true,"extensions":["atom"]},"application/atomcat+xml":{"source":"iana","compressible":true,"extensions":["atomcat"]},"application/atomdeleted+xml":{"source":"iana","compressible":true,"extensions":["atomdeleted"]},"application/atomicmail":{"source":"iana"},"application/atomsvc+xml":{"source":"iana","compressible":true,"extensions":["atomsvc"]},"application/atsc-dwd+xml":{"source":"iana","compressible":true,"extensions":["dwd"]},"application/atsc-dynamic-event-message":{"source":"iana"},"application/atsc-held+xml":{"source":"iana","compressible":true,"extensions":["held"]},"application/atsc-rdt+json":{"source":"iana","compressible":true},"application/atsc-rsat+xml":{"source":"iana","compressible":true,"extensions":["rsat"]},"application/atxml":{"source":"iana"},"application/auth-policy+xml":{"source":"iana","compressible":true},"application/bacnet-xdd+zip":{"source":"iana","compressible":false},"application/batch-smtp":{"source":"iana"},"application/bdoc":{"compressible":false,"extensions":["bdoc"]},"application/beep+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/calendar+json":{"source":"iana","compressible":true},"application/calendar+xml":{"source":"iana","compressible":true,"extensions":["xcs"]},"application/call-completion":{"source":"iana"},"application/cals-1840":{"source":"iana"},"application/captive+json":{"source":"iana","compressible":true},"application/cbor":{"source":"iana"},"application/cbor-seq":{"source":"iana"},"application/cccex":{"source":"iana"},"application/ccmp+xml":{"source":"iana","compressible":true},"application/ccxml+xml":{"source":"iana","compressible":true,"extensions":["ccxml"]},"application/cdfx+xml":{"source":"iana","compressible":true,"extensions":["cdfx"]},"application/cdmi-capability":{"source":"iana","extensions":["cdmia"]},"application/cdmi-container":{"source":"iana","extensions":["cdmic"]},"application/cdmi-domain":{"source":"iana","extensions":["cdmid"]},"application/cdmi-object":{"source":"iana","extensions":["cdmio"]},"application/cdmi-queue":{"source":"iana","extensions":["cdmiq"]},"application/cdni":{"source":"iana"},"application/cea":{"source":"iana"},"application/cea-2018+xml":{"source":"iana","compressible":true},"application/cellml+xml":{"source":"iana","compressible":true},"application/cfw":{"source":"iana"},"application/clr":{"source":"iana"},"application/clue+xml":{"source":"iana","compressible":true},"application/clue_info+xml":{"source":"iana","compressible":true},"application/cms":{"source":"iana"},"application/cnrp+xml":{"source":"iana","compressible":true},"application/coap-group+json":{"source":"iana","compressible":true},"application/coap-payload":{"source":"iana"},"application/commonground":{"source":"iana"},"application/conference-info+xml":{"source":"iana","compressible":true},"application/cose":{"source":"iana"},"application/cose-key":{"source":"iana"},"application/cose-key-set":{"source":"iana"},"application/cpl+xml":{"source":"iana","compressible":true},"application/csrattrs":{"source":"iana"},"application/csta+xml":{"source":"iana","compressible":true},"application/cstadata+xml":{"source":"iana","compressible":true},"application/csvm+json":{"source":"iana","compressible":true},"application/cu-seeme":{"source":"apache","extensions":["cu"]},"application/cwt":{"source":"iana"},"application/cybercash":{"source":"iana"},"application/dart":{"compressible":true},"application/dash+xml":{"source":"iana","compressible":true,"extensions":["mpd"]},"application/dashdelta":{"source":"iana"},"application/davmount+xml":{"source":"iana","compressible":true,"extensions":["davmount"]},"application/dca-rft":{"source":"iana"},"application/dcd":{"source":"iana"},"application/dec-dx":{"source":"iana"},"application/dialog-info+xml":{"source":"iana","compressible":true},"application/dicom":{"source":"iana"},"application/dicom+json":{"source":"iana","compressible":true},"application/dicom+xml":{"source":"iana","compressible":true},"application/dii":{"source":"iana"},"application/dit":{"source":"iana"},"application/dns":{"source":"iana"},"application/dns+json":{"source":"iana","compressible":true},"application/dns-message":{"source":"iana"},"application/docbook+xml":{"source":"apache","compressible":true,"extensions":["dbk"]},"application/dots+cbor":{"source":"iana"},"application/dskpp+xml":{"source":"iana","compressible":true},"application/dssc+der":{"source":"iana","extensions":["dssc"]},"application/dssc+xml":{"source":"iana","compressible":true,"extensions":["xdssc"]},"application/dvcs":{"source":"iana"},"application/ecmascript":{"source":"iana","compressible":true,"extensions":["es","ecma"]},"application/edi-consent":{"source":"iana"},"application/edi-x12":{"source":"iana","compressible":false},"application/edifact":{"source":"iana","compressible":false},"application/efi":{"source":"iana"},"application/elm+json":{"source":"iana","charset":"UTF-8","compressible":true},"application/elm+xml":{"source":"iana","compressible":true},"application/emergencycalldata.cap+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/emergencycalldata.comment+xml":{"source":"iana","compressible":true},"application/emergencycalldata.control+xml":{"source":"iana","compressible":true},"application/emergencycalldata.deviceinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.ecall.msd":{"source":"iana"},"application/emergencycalldata.providerinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.serviceinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.subscriberinfo+xml":{"source":"iana","compressible":true},"application/emergencycalldata.veds+xml":{"source":"iana","compressible":true},"application/emma+xml":{"source":"iana","compressible":true,"extensions":["emma"]},"application/emotionml+xml":{"source":"iana","compressible":true,"extensions":["emotionml"]},"application/encaprtp":{"source":"iana"},"application/epp+xml":{"source":"iana","compressible":true},"application/epub+zip":{"source":"iana","compressible":false,"extensions":["epub"]},"application/eshop":{"source":"iana"},"application/exi":{"source":"iana","extensions":["exi"]},"application/expect-ct-report+json":{"source":"iana","compressible":true},"application/fastinfoset":{"source":"iana"},"application/fastsoap":{"source":"iana"},"application/fdt+xml":{"source":"iana","compressible":true,"extensions":["fdt"]},"application/fhir+json":{"source":"iana","charset":"UTF-8","compressible":true},"application/fhir+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/fido.trusted-apps+json":{"compressible":true},"application/fits":{"source":"iana"},"application/flexfec":{"source":"iana"},"application/font-sfnt":{"source":"iana"},"application/font-tdpfr":{"source":"iana","extensions":["pfr"]},"application/font-woff":{"source":"iana","compressible":false},"application/framework-attributes+xml":{"source":"iana","compressible":true},"application/geo+json":{"source":"iana","compressible":true,"extensions":["geojson"]},"application/geo+json-seq":{"source":"iana"},"application/geopackage+sqlite3":{"source":"iana"},"application/geoxacml+xml":{"source":"iana","compressible":true},"application/gltf-buffer":{"source":"iana"},"application/gml+xml":{"source":"iana","compressible":true,"extensions":["gml"]},"application/gpx+xml":{"source":"apache","compressible":true,"extensions":["gpx"]},"application/gxf":{"source":"apache","extensions":["gxf"]},"application/gzip":{"source":"iana","compressible":false,"extensions":["gz"]},"application/h224":{"source":"iana"},"application/held+xml":{"source":"iana","compressible":true},"application/hjson":{"extensions":["hjson"]},"application/http":{"source":"iana"},"application/hyperstudio":{"source":"iana","extensions":["stk"]},"application/ibe-key-request+xml":{"source":"iana","compressible":true},"application/ibe-pkg-reply+xml":{"source":"iana","compressible":true},"application/ibe-pp-data":{"source":"iana"},"application/iges":{"source":"iana"},"application/im-iscomposing+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/index":{"source":"iana"},"application/index.cmd":{"source":"iana"},"application/index.obj":{"source":"iana"},"application/index.response":{"source":"iana"},"application/index.vnd":{"source":"iana"},"application/inkml+xml":{"source":"iana","compressible":true,"extensions":["ink","inkml"]},"application/iotp":{"source":"iana"},"application/ipfix":{"source":"iana","extensions":["ipfix"]},"application/ipp":{"source":"iana"},"application/isup":{"source":"iana"},"application/its+xml":{"source":"iana","compressible":true,"extensions":["its"]},"application/java-archive":{"source":"apache","compressible":false,"extensions":["jar","war","ear"]},"application/java-serialized-object":{"source":"apache","compressible":false,"extensions":["ser"]},"application/java-vm":{"source":"apache","compressible":false,"extensions":["class"]},"application/javascript":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["js","mjs"]},"application/jf2feed+json":{"source":"iana","compressible":true},"application/jose":{"source":"iana"},"application/jose+json":{"source":"iana","compressible":true},"application/jrd+json":{"source":"iana","compressible":true},"application/jscalendar+json":{"source":"iana","compressible":true},"application/json":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["json","map"]},"application/json-patch+json":{"source":"iana","compressible":true},"application/json-seq":{"source":"iana"},"application/json5":{"extensions":["json5"]},"application/jsonml+json":{"source":"apache","compressible":true,"extensions":["jsonml"]},"application/jwk+json":{"source":"iana","compressible":true},"application/jwk-set+json":{"source":"iana","compressible":true},"application/jwt":{"source":"iana"},"application/kpml-request+xml":{"source":"iana","compressible":true},"application/kpml-response+xml":{"source":"iana","compressible":true},"application/ld+json":{"source":"iana","compressible":true,"extensions":["jsonld"]},"application/lgr+xml":{"source":"iana","compressible":true,"extensions":["lgr"]},"application/link-format":{"source":"iana"},"application/load-control+xml":{"source":"iana","compressible":true},"application/lost+xml":{"source":"iana","compressible":true,"extensions":["lostxml"]},"application/lostsync+xml":{"source":"iana","compressible":true},"application/lpf+zip":{"source":"iana","compressible":false},"application/lxf":{"source":"iana"},"application/mac-binhex40":{"source":"iana","extensions":["hqx"]},"application/mac-compactpro":{"source":"apache","extensions":["cpt"]},"application/macwriteii":{"source":"iana"},"application/mads+xml":{"source":"iana","compressible":true,"extensions":["mads"]},"application/manifest+json":{"charset":"UTF-8","compressible":true,"extensions":["webmanifest"]},"application/marc":{"source":"iana","extensions":["mrc"]},"application/marcxml+xml":{"source":"iana","compressible":true,"extensions":["mrcx"]},"application/mathematica":{"source":"iana","extensions":["ma","nb","mb"]},"application/mathml+xml":{"source":"iana","compressible":true,"extensions":["mathml"]},"application/mathml-content+xml":{"source":"iana","compressible":true},"application/mathml-presentation+xml":{"source":"iana","compressible":true},"application/mbms-associated-procedure-description+xml":{"source":"iana","compressible":true},"application/mbms-deregister+xml":{"source":"iana","compressible":true},"application/mbms-envelope+xml":{"source":"iana","compressible":true},"application/mbms-msk+xml":{"source":"iana","compressible":true},"application/mbms-msk-response+xml":{"source":"iana","compressible":true},"application/mbms-protection-description+xml":{"source":"iana","compressible":true},"application/mbms-reception-report+xml":{"source":"iana","compressible":true},"application/mbms-register+xml":{"source":"iana","compressible":true},"application/mbms-register-response+xml":{"source":"iana","compressible":true},"application/mbms-schedule+xml":{"source":"iana","compressible":true},"application/mbms-user-service-description+xml":{"source":"iana","compressible":true},"application/mbox":{"source":"iana","extensions":["mbox"]},"application/media-policy-dataset+xml":{"source":"iana","compressible":true},"application/media_control+xml":{"source":"iana","compressible":true},"application/mediaservercontrol+xml":{"source":"iana","compressible":true,"extensions":["mscml"]},"application/merge-patch+json":{"source":"iana","compressible":true},"application/metalink+xml":{"source":"apache","compressible":true,"extensions":["metalink"]},"application/metalink4+xml":{"source":"iana","compressible":true,"extensions":["meta4"]},"application/mets+xml":{"source":"iana","compressible":true,"extensions":["mets"]},"application/mf4":{"source":"iana"},"application/mikey":{"source":"iana"},"application/mipc":{"source":"iana"},"application/mmt-aei+xml":{"source":"iana","compressible":true,"extensions":["maei"]},"application/mmt-usd+xml":{"source":"iana","compressible":true,"extensions":["musd"]},"application/mods+xml":{"source":"iana","compressible":true,"extensions":["mods"]},"application/moss-keys":{"source":"iana"},"application/moss-signature":{"source":"iana"},"application/mosskey-data":{"source":"iana"},"application/mosskey-request":{"source":"iana"},"application/mp21":{"source":"iana","extensions":["m21","mp21"]},"application/mp4":{"source":"iana","extensions":["mp4s","m4p"]},"application/mpeg4-generic":{"source":"iana"},"application/mpeg4-iod":{"source":"iana"},"application/mpeg4-iod-xmt":{"source":"iana"},"application/mrb-consumer+xml":{"source":"iana","compressible":true},"application/mrb-publish+xml":{"source":"iana","compressible":true},"application/msc-ivr+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/msc-mixer+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/msword":{"source":"iana","compressible":false,"extensions":["doc","dot"]},"application/mud+json":{"source":"iana","compressible":true},"application/multipart-core":{"source":"iana"},"application/mxf":{"source":"iana","extensions":["mxf"]},"application/n-quads":{"source":"iana","extensions":["nq"]},"application/n-triples":{"source":"iana","extensions":["nt"]},"application/nasdata":{"source":"iana"},"application/news-checkgroups":{"source":"iana","charset":"US-ASCII"},"application/news-groupinfo":{"source":"iana","charset":"US-ASCII"},"application/news-transmission":{"source":"iana"},"application/nlsml+xml":{"source":"iana","compressible":true},"application/node":{"source":"iana","extensions":["cjs"]},"application/nss":{"source":"iana"},"application/ocsp-request":{"source":"iana"},"application/ocsp-response":{"source":"iana"},"application/octet-stream":{"source":"iana","compressible":false,"extensions":["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","exe","dll","deb","dmg","iso","img","msi","msp","msm","buffer"]},"application/oda":{"source":"iana","extensions":["oda"]},"application/odm+xml":{"source":"iana","compressible":true},"application/odx":{"source":"iana"},"application/oebps-package+xml":{"source":"iana","compressible":true,"extensions":["opf"]},"application/ogg":{"source":"iana","compressible":false,"extensions":["ogx"]},"application/omdoc+xml":{"source":"apache","compressible":true,"extensions":["omdoc"]},"application/onenote":{"source":"apache","extensions":["onetoc","onetoc2","onetmp","onepkg"]},"application/opc-nodeset+xml":{"source":"iana","compressible":true},"application/oscore":{"source":"iana"},"application/oxps":{"source":"iana","extensions":["oxps"]},"application/p2p-overlay+xml":{"source":"iana","compressible":true,"extensions":["relo"]},"application/parityfec":{"source":"iana"},"application/passport":{"source":"iana"},"application/patch-ops-error+xml":{"source":"iana","compressible":true,"extensions":["xer"]},"application/pdf":{"source":"iana","compressible":false,"extensions":["pdf"]},"application/pdx":{"source":"iana"},"application/pem-certificate-chain":{"source":"iana"},"application/pgp-encrypted":{"source":"iana","compressible":false,"extensions":["pgp"]},"application/pgp-keys":{"source":"iana"},"application/pgp-signature":{"source":"iana","extensions":["asc","sig"]},"application/pics-rules":{"source":"apache","extensions":["prf"]},"application/pidf+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/pidf-diff+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/pkcs10":{"source":"iana","extensions":["p10"]},"application/pkcs12":{"source":"iana"},"application/pkcs7-mime":{"source":"iana","extensions":["p7m","p7c"]},"application/pkcs7-signature":{"source":"iana","extensions":["p7s"]},"application/pkcs8":{"source":"iana","extensions":["p8"]},"application/pkcs8-encrypted":{"source":"iana"},"application/pkix-attr-cert":{"source":"iana","extensions":["ac"]},"application/pkix-cert":{"source":"iana","extensions":["cer"]},"application/pkix-crl":{"source":"iana","extensions":["crl"]},"application/pkix-pkipath":{"source":"iana","extensions":["pkipath"]},"application/pkixcmp":{"source":"iana","extensions":["pki"]},"application/pls+xml":{"source":"iana","compressible":true,"extensions":["pls"]},"application/poc-settings+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/postscript":{"source":"iana","compressible":true,"extensions":["ai","eps","ps"]},"application/ppsp-tracker+json":{"source":"iana","compressible":true},"application/problem+json":{"source":"iana","compressible":true},"application/problem+xml":{"source":"iana","compressible":true},"application/provenance+xml":{"source":"iana","compressible":true,"extensions":["provx"]},"application/prs.alvestrand.titrax-sheet":{"source":"iana"},"application/prs.cww":{"source":"iana","extensions":["cww"]},"application/prs.cyn":{"source":"iana","charset":"7-BIT"},"application/prs.hpub+zip":{"source":"iana","compressible":false},"application/prs.nprend":{"source":"iana"},"application/prs.plucker":{"source":"iana"},"application/prs.rdf-xml-crypt":{"source":"iana"},"application/prs.xsf+xml":{"source":"iana","compressible":true},"application/pskc+xml":{"source":"iana","compressible":true,"extensions":["pskcxml"]},"application/pvd+json":{"source":"iana","compressible":true},"application/qsig":{"source":"iana"},"application/raml+yaml":{"compressible":true,"extensions":["raml"]},"application/raptorfec":{"source":"iana"},"application/rdap+json":{"source":"iana","compressible":true},"application/rdf+xml":{"source":"iana","compressible":true,"extensions":["rdf","owl"]},"application/reginfo+xml":{"source":"iana","compressible":true,"extensions":["rif"]},"application/relax-ng-compact-syntax":{"source":"iana","extensions":["rnc"]},"application/remote-printing":{"source":"iana"},"application/reputon+json":{"source":"iana","compressible":true},"application/resource-lists+xml":{"source":"iana","compressible":true,"extensions":["rl"]},"application/resource-lists-diff+xml":{"source":"iana","compressible":true,"extensions":["rld"]},"application/rfc+xml":{"source":"iana","compressible":true},"application/riscos":{"source":"iana"},"application/rlmi+xml":{"source":"iana","compressible":true},"application/rls-services+xml":{"source":"iana","compressible":true,"extensions":["rs"]},"application/route-apd+xml":{"source":"iana","compressible":true,"extensions":["rapd"]},"application/route-s-tsid+xml":{"source":"iana","compressible":true,"extensions":["sls"]},"application/route-usd+xml":{"source":"iana","compressible":true,"extensions":["rusd"]},"application/rpki-ghostbusters":{"source":"iana","extensions":["gbr"]},"application/rpki-manifest":{"source":"iana","extensions":["mft"]},"application/rpki-publication":{"source":"iana"},"application/rpki-roa":{"source":"iana","extensions":["roa"]},"application/rpki-updown":{"source":"iana"},"application/rsd+xml":{"source":"apache","compressible":true,"extensions":["rsd"]},"application/rss+xml":{"source":"apache","compressible":true,"extensions":["rss"]},"application/rtf":{"source":"iana","compressible":true,"extensions":["rtf"]},"application/rtploopback":{"source":"iana"},"application/rtx":{"source":"iana"},"application/samlassertion+xml":{"source":"iana","compressible":true},"application/samlmetadata+xml":{"source":"iana","compressible":true},"application/sarif+json":{"source":"iana","compressible":true},"application/sbe":{"source":"iana"},"application/sbml+xml":{"source":"iana","compressible":true,"extensions":["sbml"]},"application/scaip+xml":{"source":"iana","compressible":true},"application/scim+json":{"source":"iana","compressible":true},"application/scvp-cv-request":{"source":"iana","extensions":["scq"]},"application/scvp-cv-response":{"source":"iana","extensions":["scs"]},"application/scvp-vp-request":{"source":"iana","extensions":["spq"]},"application/scvp-vp-response":{"source":"iana","extensions":["spp"]},"application/sdp":{"source":"iana","extensions":["sdp"]},"application/secevent+jwt":{"source":"iana"},"application/senml+cbor":{"source":"iana"},"application/senml+json":{"source":"iana","compressible":true},"application/senml+xml":{"source":"iana","compressible":true,"extensions":["senmlx"]},"application/senml-etch+cbor":{"source":"iana"},"application/senml-etch+json":{"source":"iana","compressible":true},"application/senml-exi":{"source":"iana"},"application/sensml+cbor":{"source":"iana"},"application/sensml+json":{"source":"iana","compressible":true},"application/sensml+xml":{"source":"iana","compressible":true,"extensions":["sensmlx"]},"application/sensml-exi":{"source":"iana"},"application/sep+xml":{"source":"iana","compressible":true},"application/sep-exi":{"source":"iana"},"application/session-info":{"source":"iana"},"application/set-payment":{"source":"iana"},"application/set-payment-initiation":{"source":"iana","extensions":["setpay"]},"application/set-registration":{"source":"iana"},"application/set-registration-initiation":{"source":"iana","extensions":["setreg"]},"application/sgml":{"source":"iana"},"application/sgml-open-catalog":{"source":"iana"},"application/shf+xml":{"source":"iana","compressible":true,"extensions":["shf"]},"application/sieve":{"source":"iana","extensions":["siv","sieve"]},"application/simple-filter+xml":{"source":"iana","compressible":true},"application/simple-message-summary":{"source":"iana"},"application/simplesymbolcontainer":{"source":"iana"},"application/sipc":{"source":"iana"},"application/slate":{"source":"iana"},"application/smil":{"source":"iana"},"application/smil+xml":{"source":"iana","compressible":true,"extensions":["smi","smil"]},"application/smpte336m":{"source":"iana"},"application/soap+fastinfoset":{"source":"iana"},"application/soap+xml":{"source":"iana","compressible":true},"application/sparql-query":{"source":"iana","extensions":["rq"]},"application/sparql-results+xml":{"source":"iana","compressible":true,"extensions":["srx"]},"application/spirits-event+xml":{"source":"iana","compressible":true},"application/sql":{"source":"iana"},"application/srgs":{"source":"iana","extensions":["gram"]},"application/srgs+xml":{"source":"iana","compressible":true,"extensions":["grxml"]},"application/sru+xml":{"source":"iana","compressible":true,"extensions":["sru"]},"application/ssdl+xml":{"source":"apache","compressible":true,"extensions":["ssdl"]},"application/ssml+xml":{"source":"iana","compressible":true,"extensions":["ssml"]},"application/stix+json":{"source":"iana","compressible":true},"application/swid+xml":{"source":"iana","compressible":true,"extensions":["swidtag"]},"application/tamp-apex-update":{"source":"iana"},"application/tamp-apex-update-confirm":{"source":"iana"},"application/tamp-community-update":{"source":"iana"},"application/tamp-community-update-confirm":{"source":"iana"},"application/tamp-error":{"source":"iana"},"application/tamp-sequence-adjust":{"source":"iana"},"application/tamp-sequence-adjust-confirm":{"source":"iana"},"application/tamp-status-query":{"source":"iana"},"application/tamp-status-response":{"source":"iana"},"application/tamp-update":{"source":"iana"},"application/tamp-update-confirm":{"source":"iana"},"application/tar":{"compressible":true},"application/taxii+json":{"source":"iana","compressible":true},"application/td+json":{"source":"iana","compressible":true},"application/tei+xml":{"source":"iana","compressible":true,"extensions":["tei","teicorpus"]},"application/tetra_isi":{"source":"iana"},"application/thraud+xml":{"source":"iana","compressible":true,"extensions":["tfi"]},"application/timestamp-query":{"source":"iana"},"application/timestamp-reply":{"source":"iana"},"application/timestamped-data":{"source":"iana","extensions":["tsd"]},"application/tlsrpt+gzip":{"source":"iana"},"application/tlsrpt+json":{"source":"iana","compressible":true},"application/tnauthlist":{"source":"iana"},"application/toml":{"compressible":true,"extensions":["toml"]},"application/trickle-ice-sdpfrag":{"source":"iana"},"application/trig":{"source":"iana"},"application/ttml+xml":{"source":"iana","compressible":true,"extensions":["ttml"]},"application/tve-trigger":{"source":"iana"},"application/tzif":{"source":"iana"},"application/tzif-leap":{"source":"iana"},"application/ubjson":{"compressible":false,"extensions":["ubj"]},"application/ulpfec":{"source":"iana"},"application/urc-grpsheet+xml":{"source":"iana","compressible":true},"application/urc-ressheet+xml":{"source":"iana","compressible":true,"extensions":["rsheet"]},"application/urc-targetdesc+xml":{"source":"iana","compressible":true,"extensions":["td"]},"application/urc-uisocketdesc+xml":{"source":"iana","compressible":true},"application/vcard+json":{"source":"iana","compressible":true},"application/vcard+xml":{"source":"iana","compressible":true},"application/vemmi":{"source":"iana"},"application/vividence.scriptfile":{"source":"apache"},"application/vnd.1000minds.decision-model+xml":{"source":"iana","compressible":true,"extensions":["1km"]},"application/vnd.3gpp-prose+xml":{"source":"iana","compressible":true},"application/vnd.3gpp-prose-pc3ch+xml":{"source":"iana","compressible":true},"application/vnd.3gpp-v2x-local-service-information":{"source":"iana"},"application/vnd.3gpp.access-transfer-events+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.bsf+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.gmop+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.interworking-data":{"source":"iana"},"application/vnd.3gpp.mc-signalling-ear":{"source":"iana"},"application/vnd.3gpp.mcdata-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-payload":{"source":"iana"},"application/vnd.3gpp.mcdata-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-signalling":{"source":"iana"},"application/vnd.3gpp.mcdata-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcdata-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-floor-request+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-location-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-mbms-usage-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-signed+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-ue-init-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcptt-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-affiliation-command+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-affiliation-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-location-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-mbms-usage-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-service-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-transmission-request+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-ue-config+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mcvideo-user-profile+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.mid-call+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.pic-bw-large":{"source":"iana","extensions":["plb"]},"application/vnd.3gpp.pic-bw-small":{"source":"iana","extensions":["psb"]},"application/vnd.3gpp.pic-bw-var":{"source":"iana","extensions":["pvb"]},"application/vnd.3gpp.sms":{"source":"iana"},"application/vnd.3gpp.sms+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.srvcc-ext+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.srvcc-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.state-and-event-info+xml":{"source":"iana","compressible":true},"application/vnd.3gpp.ussd+xml":{"source":"iana","compressible":true},"application/vnd.3gpp2.bcmcsinfo+xml":{"source":"iana","compressible":true},"application/vnd.3gpp2.sms":{"source":"iana"},"application/vnd.3gpp2.tcap":{"source":"iana","extensions":["tcap"]},"application/vnd.3lightssoftware.imagescal":{"source":"iana"},"application/vnd.3m.post-it-notes":{"source":"iana","extensions":["pwn"]},"application/vnd.accpac.simply.aso":{"source":"iana","extensions":["aso"]},"application/vnd.accpac.simply.imp":{"source":"iana","extensions":["imp"]},"application/vnd.acucobol":{"source":"iana","extensions":["acu"]},"application/vnd.acucorp":{"source":"iana","extensions":["atc","acutc"]},"application/vnd.adobe.air-application-installer-package+zip":{"source":"apache","compressible":false,"extensions":["air"]},"application/vnd.adobe.flash.movie":{"source":"iana"},"application/vnd.adobe.formscentral.fcdt":{"source":"iana","extensions":["fcdt"]},"application/vnd.adobe.fxp":{"source":"iana","extensions":["fxp","fxpl"]},"application/vnd.adobe.partial-upload":{"source":"iana"},"application/vnd.adobe.xdp+xml":{"source":"iana","compressible":true,"extensions":["xdp"]},"application/vnd.adobe.xfdf":{"source":"iana","extensions":["xfdf"]},"application/vnd.aether.imp":{"source":"iana"},"application/vnd.afpc.afplinedata":{"source":"iana"},"application/vnd.afpc.afplinedata-pagedef":{"source":"iana"},"application/vnd.afpc.cmoca-cmresource":{"source":"iana"},"application/vnd.afpc.foca-charset":{"source":"iana"},"application/vnd.afpc.foca-codedfont":{"source":"iana"},"application/vnd.afpc.foca-codepage":{"source":"iana"},"application/vnd.afpc.modca":{"source":"iana"},"application/vnd.afpc.modca-cmtable":{"source":"iana"},"application/vnd.afpc.modca-formdef":{"source":"iana"},"application/vnd.afpc.modca-mediummap":{"source":"iana"},"application/vnd.afpc.modca-objectcontainer":{"source":"iana"},"application/vnd.afpc.modca-overlay":{"source":"iana"},"application/vnd.afpc.modca-pagesegment":{"source":"iana"},"application/vnd.ah-barcode":{"source":"iana"},"application/vnd.ahead.space":{"source":"iana","extensions":["ahead"]},"application/vnd.airzip.filesecure.azf":{"source":"iana","extensions":["azf"]},"application/vnd.airzip.filesecure.azs":{"source":"iana","extensions":["azs"]},"application/vnd.amadeus+json":{"source":"iana","compressible":true},"application/vnd.amazon.ebook":{"source":"apache","extensions":["azw"]},"application/vnd.amazon.mobi8-ebook":{"source":"iana"},"application/vnd.americandynamics.acc":{"source":"iana","extensions":["acc"]},"application/vnd.amiga.ami":{"source":"iana","extensions":["ami"]},"application/vnd.amundsen.maze+xml":{"source":"iana","compressible":true},"application/vnd.android.ota":{"source":"iana"},"application/vnd.android.package-archive":{"source":"apache","compressible":false,"extensions":["apk"]},"application/vnd.anki":{"source":"iana"},"application/vnd.anser-web-certificate-issue-initiation":{"source":"iana","extensions":["cii"]},"application/vnd.anser-web-funds-transfer-initiation":{"source":"apache","extensions":["fti"]},"application/vnd.antix.game-component":{"source":"iana","extensions":["atx"]},"application/vnd.apache.thrift.binary":{"source":"iana"},"application/vnd.apache.thrift.compact":{"source":"iana"},"application/vnd.apache.thrift.json":{"source":"iana"},"application/vnd.api+json":{"source":"iana","compressible":true},"application/vnd.aplextor.warrp+json":{"source":"iana","compressible":true},"application/vnd.apothekende.reservation+json":{"source":"iana","compressible":true},"application/vnd.apple.installer+xml":{"source":"iana","compressible":true,"extensions":["mpkg"]},"application/vnd.apple.keynote":{"source":"iana","extensions":["key"]},"application/vnd.apple.mpegurl":{"source":"iana","extensions":["m3u8"]},"application/vnd.apple.numbers":{"source":"iana","extensions":["numbers"]},"application/vnd.apple.pages":{"source":"iana","extensions":["pages"]},"application/vnd.apple.pkpass":{"compressible":false,"extensions":["pkpass"]},"application/vnd.arastra.swi":{"source":"iana"},"application/vnd.aristanetworks.swi":{"source":"iana","extensions":["swi"]},"application/vnd.artisan+json":{"source":"iana","compressible":true},"application/vnd.artsquare":{"source":"iana"},"application/vnd.astraea-software.iota":{"source":"iana","extensions":["iota"]},"application/vnd.audiograph":{"source":"iana","extensions":["aep"]},"application/vnd.autopackage":{"source":"iana"},"application/vnd.avalon+json":{"source":"iana","compressible":true},"application/vnd.avistar+xml":{"source":"iana","compressible":true},"application/vnd.balsamiq.bmml+xml":{"source":"iana","compressible":true,"extensions":["bmml"]},"application/vnd.balsamiq.bmpr":{"source":"iana"},"application/vnd.banana-accounting":{"source":"iana"},"application/vnd.bbf.usp.error":{"source":"iana"},"application/vnd.bbf.usp.msg":{"source":"iana"},"application/vnd.bbf.usp.msg+json":{"source":"iana","compressible":true},"application/vnd.bekitzur-stech+json":{"source":"iana","compressible":true},"application/vnd.bint.med-content":{"source":"iana"},"application/vnd.biopax.rdf+xml":{"source":"iana","compressible":true},"application/vnd.blink-idb-value-wrapper":{"source":"iana"},"application/vnd.blueice.multipass":{"source":"iana","extensions":["mpm"]},"application/vnd.bluetooth.ep.oob":{"source":"iana"},"application/vnd.bluetooth.le.oob":{"source":"iana"},"application/vnd.bmi":{"source":"iana","extensions":["bmi"]},"application/vnd.bpf":{"source":"iana"},"application/vnd.bpf3":{"source":"iana"},"application/vnd.businessobjects":{"source":"iana","extensions":["rep"]},"application/vnd.byu.uapi+json":{"source":"iana","compressible":true},"application/vnd.cab-jscript":{"source":"iana"},"application/vnd.canon-cpdl":{"source":"iana"},"application/vnd.canon-lips":{"source":"iana"},"application/vnd.capasystems-pg+json":{"source":"iana","compressible":true},"application/vnd.cendio.thinlinc.clientconf":{"source":"iana"},"application/vnd.century-systems.tcp_stream":{"source":"iana"},"application/vnd.chemdraw+xml":{"source":"iana","compressible":true,"extensions":["cdxml"]},"application/vnd.chess-pgn":{"source":"iana"},"application/vnd.chipnuts.karaoke-mmd":{"source":"iana","extensions":["mmd"]},"application/vnd.ciedi":{"source":"iana"},"application/vnd.cinderella":{"source":"iana","extensions":["cdy"]},"application/vnd.cirpack.isdn-ext":{"source":"iana"},"application/vnd.citationstyles.style+xml":{"source":"iana","compressible":true,"extensions":["csl"]},"application/vnd.claymore":{"source":"iana","extensions":["cla"]},"application/vnd.cloanto.rp9":{"source":"iana","extensions":["rp9"]},"application/vnd.clonk.c4group":{"source":"iana","extensions":["c4g","c4d","c4f","c4p","c4u"]},"application/vnd.cluetrust.cartomobile-config":{"source":"iana","extensions":["c11amc"]},"application/vnd.cluetrust.cartomobile-config-pkg":{"source":"iana","extensions":["c11amz"]},"application/vnd.coffeescript":{"source":"iana"},"application/vnd.collabio.xodocuments.document":{"source":"iana"},"application/vnd.collabio.xodocuments.document-template":{"source":"iana"},"application/vnd.collabio.xodocuments.presentation":{"source":"iana"},"application/vnd.collabio.xodocuments.presentation-template":{"source":"iana"},"application/vnd.collabio.xodocuments.spreadsheet":{"source":"iana"},"application/vnd.collabio.xodocuments.spreadsheet-template":{"source":"iana"},"application/vnd.collection+json":{"source":"iana","compressible":true},"application/vnd.collection.doc+json":{"source":"iana","compressible":true},"application/vnd.collection.next+json":{"source":"iana","compressible":true},"application/vnd.comicbook+zip":{"source":"iana","compressible":false},"application/vnd.comicbook-rar":{"source":"iana"},"application/vnd.commerce-battelle":{"source":"iana"},"application/vnd.commonspace":{"source":"iana","extensions":["csp"]},"application/vnd.contact.cmsg":{"source":"iana","extensions":["cdbcmsg"]},"application/vnd.coreos.ignition+json":{"source":"iana","compressible":true},"application/vnd.cosmocaller":{"source":"iana","extensions":["cmc"]},"application/vnd.crick.clicker":{"source":"iana","extensions":["clkx"]},"application/vnd.crick.clicker.keyboard":{"source":"iana","extensions":["clkk"]},"application/vnd.crick.clicker.palette":{"source":"iana","extensions":["clkp"]},"application/vnd.crick.clicker.template":{"source":"iana","extensions":["clkt"]},"application/vnd.crick.clicker.wordbank":{"source":"iana","extensions":["clkw"]},"application/vnd.criticaltools.wbs+xml":{"source":"iana","compressible":true,"extensions":["wbs"]},"application/vnd.cryptii.pipe+json":{"source":"iana","compressible":true},"application/vnd.crypto-shade-file":{"source":"iana"},"application/vnd.cryptomator.encrypted":{"source":"iana"},"application/vnd.ctc-posml":{"source":"iana","extensions":["pml"]},"application/vnd.ctct.ws+xml":{"source":"iana","compressible":true},"application/vnd.cups-pdf":{"source":"iana"},"application/vnd.cups-postscript":{"source":"iana"},"application/vnd.cups-ppd":{"source":"iana","extensions":["ppd"]},"application/vnd.cups-raster":{"source":"iana"},"application/vnd.cups-raw":{"source":"iana"},"application/vnd.curl":{"source":"iana"},"application/vnd.curl.car":{"source":"apache","extensions":["car"]},"application/vnd.curl.pcurl":{"source":"apache","extensions":["pcurl"]},"application/vnd.cyan.dean.root+xml":{"source":"iana","compressible":true},"application/vnd.cybank":{"source":"iana"},"application/vnd.cyclonedx+json":{"source":"iana","compressible":true},"application/vnd.cyclonedx+xml":{"source":"iana","compressible":true},"application/vnd.d2l.coursepackage1p0+zip":{"source":"iana","compressible":false},"application/vnd.d3m-dataset":{"source":"iana"},"application/vnd.d3m-problem":{"source":"iana"},"application/vnd.dart":{"source":"iana","compressible":true,"extensions":["dart"]},"application/vnd.data-vision.rdz":{"source":"iana","extensions":["rdz"]},"application/vnd.datapackage+json":{"source":"iana","compressible":true},"application/vnd.dataresource+json":{"source":"iana","compressible":true},"application/vnd.dbf":{"source":"iana","extensions":["dbf"]},"application/vnd.debian.binary-package":{"source":"iana"},"application/vnd.dece.data":{"source":"iana","extensions":["uvf","uvvf","uvd","uvvd"]},"application/vnd.dece.ttml+xml":{"source":"iana","compressible":true,"extensions":["uvt","uvvt"]},"application/vnd.dece.unspecified":{"source":"iana","extensions":["uvx","uvvx"]},"application/vnd.dece.zip":{"source":"iana","extensions":["uvz","uvvz"]},"application/vnd.denovo.fcselayout-link":{"source":"iana","extensions":["fe_launch"]},"application/vnd.desmume.movie":{"source":"iana"},"application/vnd.dir-bi.plate-dl-nosuffix":{"source":"iana"},"application/vnd.dm.delegation+xml":{"source":"iana","compressible":true},"application/vnd.dna":{"source":"iana","extensions":["dna"]},"application/vnd.document+json":{"source":"iana","compressible":true},"application/vnd.dolby.mlp":{"source":"apache","extensions":["mlp"]},"application/vnd.dolby.mobile.1":{"source":"iana"},"application/vnd.dolby.mobile.2":{"source":"iana"},"application/vnd.doremir.scorecloud-binary-document":{"source":"iana"},"application/vnd.dpgraph":{"source":"iana","extensions":["dpg"]},"application/vnd.dreamfactory":{"source":"iana","extensions":["dfac"]},"application/vnd.drive+json":{"source":"iana","compressible":true},"application/vnd.ds-keypoint":{"source":"apache","extensions":["kpxx"]},"application/vnd.dtg.local":{"source":"iana"},"application/vnd.dtg.local.flash":{"source":"iana"},"application/vnd.dtg.local.html":{"source":"iana"},"application/vnd.dvb.ait":{"source":"iana","extensions":["ait"]},"application/vnd.dvb.dvbisl+xml":{"source":"iana","compressible":true},"application/vnd.dvb.dvbj":{"source":"iana"},"application/vnd.dvb.esgcontainer":{"source":"iana"},"application/vnd.dvb.ipdcdftnotifaccess":{"source":"iana"},"application/vnd.dvb.ipdcesgaccess":{"source":"iana"},"application/vnd.dvb.ipdcesgaccess2":{"source":"iana"},"application/vnd.dvb.ipdcesgpdd":{"source":"iana"},"application/vnd.dvb.ipdcroaming":{"source":"iana"},"application/vnd.dvb.iptv.alfec-base":{"source":"iana"},"application/vnd.dvb.iptv.alfec-enhancement":{"source":"iana"},"application/vnd.dvb.notif-aggregate-root+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-container+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-generic+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-msglist+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-registration-request+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-ia-registration-response+xml":{"source":"iana","compressible":true},"application/vnd.dvb.notif-init+xml":{"source":"iana","compressible":true},"application/vnd.dvb.pfr":{"source":"iana"},"application/vnd.dvb.service":{"source":"iana","extensions":["svc"]},"application/vnd.dxr":{"source":"iana"},"application/vnd.dynageo":{"source":"iana","extensions":["geo"]},"application/vnd.dzr":{"source":"iana"},"application/vnd.easykaraoke.cdgdownload":{"source":"iana"},"application/vnd.ecdis-update":{"source":"iana"},"application/vnd.ecip.rlp":{"source":"iana"},"application/vnd.ecowin.chart":{"source":"iana","extensions":["mag"]},"application/vnd.ecowin.filerequest":{"source":"iana"},"application/vnd.ecowin.fileupdate":{"source":"iana"},"application/vnd.ecowin.series":{"source":"iana"},"application/vnd.ecowin.seriesrequest":{"source":"iana"},"application/vnd.ecowin.seriesupdate":{"source":"iana"},"application/vnd.efi.img":{"source":"iana"},"application/vnd.efi.iso":{"source":"iana"},"application/vnd.emclient.accessrequest+xml":{"source":"iana","compressible":true},"application/vnd.enliven":{"source":"iana","extensions":["nml"]},"application/vnd.enphase.envoy":{"source":"iana"},"application/vnd.eprints.data+xml":{"source":"iana","compressible":true},"application/vnd.epson.esf":{"source":"iana","extensions":["esf"]},"application/vnd.epson.msf":{"source":"iana","extensions":["msf"]},"application/vnd.epson.quickanime":{"source":"iana","extensions":["qam"]},"application/vnd.epson.salt":{"source":"iana","extensions":["slt"]},"application/vnd.epson.ssf":{"source":"iana","extensions":["ssf"]},"application/vnd.ericsson.quickcall":{"source":"iana"},"application/vnd.espass-espass+zip":{"source":"iana","compressible":false},"application/vnd.eszigno3+xml":{"source":"iana","compressible":true,"extensions":["es3","et3"]},"application/vnd.etsi.aoc+xml":{"source":"iana","compressible":true},"application/vnd.etsi.asic-e+zip":{"source":"iana","compressible":false},"application/vnd.etsi.asic-s+zip":{"source":"iana","compressible":false},"application/vnd.etsi.cug+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvcommand+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvdiscovery+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvprofile+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-bc+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-cod+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsad-npvr+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvservice+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvsync+xml":{"source":"iana","compressible":true},"application/vnd.etsi.iptvueprofile+xml":{"source":"iana","compressible":true},"application/vnd.etsi.mcid+xml":{"source":"iana","compressible":true},"application/vnd.etsi.mheg5":{"source":"iana"},"application/vnd.etsi.overload-control-policy-dataset+xml":{"source":"iana","compressible":true},"application/vnd.etsi.pstn+xml":{"source":"iana","compressible":true},"application/vnd.etsi.sci+xml":{"source":"iana","compressible":true},"application/vnd.etsi.simservs+xml":{"source":"iana","compressible":true},"application/vnd.etsi.timestamp-token":{"source":"iana"},"application/vnd.etsi.tsl+xml":{"source":"iana","compressible":true},"application/vnd.etsi.tsl.der":{"source":"iana"},"application/vnd.eudora.data":{"source":"iana"},"application/vnd.evolv.ecig.profile":{"source":"iana"},"application/vnd.evolv.ecig.settings":{"source":"iana"},"application/vnd.evolv.ecig.theme":{"source":"iana"},"application/vnd.exstream-empower+zip":{"source":"iana","compressible":false},"application/vnd.exstream-package":{"source":"iana"},"application/vnd.ezpix-album":{"source":"iana","extensions":["ez2"]},"application/vnd.ezpix-package":{"source":"iana","extensions":["ez3"]},"application/vnd.f-secure.mobile":{"source":"iana"},"application/vnd.fastcopy-disk-image":{"source":"iana"},"application/vnd.fdf":{"source":"iana","extensions":["fdf"]},"application/vnd.fdsn.mseed":{"source":"iana","extensions":["mseed"]},"application/vnd.fdsn.seed":{"source":"iana","extensions":["seed","dataless"]},"application/vnd.ffsns":{"source":"iana"},"application/vnd.ficlab.flb+zip":{"source":"iana","compressible":false},"application/vnd.filmit.zfc":{"source":"iana"},"application/vnd.fints":{"source":"iana"},"application/vnd.firemonkeys.cloudcell":{"source":"iana"},"application/vnd.flographit":{"source":"iana","extensions":["gph"]},"application/vnd.fluxtime.clip":{"source":"iana","extensions":["ftc"]},"application/vnd.font-fontforge-sfd":{"source":"iana"},"application/vnd.framemaker":{"source":"iana","extensions":["fm","frame","maker","book"]},"application/vnd.frogans.fnc":{"source":"iana","extensions":["fnc"]},"application/vnd.frogans.ltf":{"source":"iana","extensions":["ltf"]},"application/vnd.fsc.weblaunch":{"source":"iana","extensions":["fsc"]},"application/vnd.fujitsu.oasys":{"source":"iana","extensions":["oas"]},"application/vnd.fujitsu.oasys2":{"source":"iana","extensions":["oa2"]},"application/vnd.fujitsu.oasys3":{"source":"iana","extensions":["oa3"]},"application/vnd.fujitsu.oasysgp":{"source":"iana","extensions":["fg5"]},"application/vnd.fujitsu.oasysprs":{"source":"iana","extensions":["bh2"]},"application/vnd.fujixerox.art-ex":{"source":"iana"},"application/vnd.fujixerox.art4":{"source":"iana"},"application/vnd.fujixerox.ddd":{"source":"iana","extensions":["ddd"]},"application/vnd.fujixerox.docuworks":{"source":"iana","extensions":["xdw"]},"application/vnd.fujixerox.docuworks.binder":{"source":"iana","extensions":["xbd"]},"application/vnd.fujixerox.docuworks.container":{"source":"iana"},"application/vnd.fujixerox.hbpl":{"source":"iana"},"application/vnd.fut-misnet":{"source":"iana"},"application/vnd.futoin+cbor":{"source":"iana"},"application/vnd.futoin+json":{"source":"iana","compressible":true},"application/vnd.fuzzysheet":{"source":"iana","extensions":["fzs"]},"application/vnd.genomatix.tuxedo":{"source":"iana","extensions":["txd"]},"application/vnd.gentics.grd+json":{"source":"iana","compressible":true},"application/vnd.geo+json":{"source":"iana","compressible":true},"application/vnd.geocube+xml":{"source":"iana","compressible":true},"application/vnd.geogebra.file":{"source":"iana","extensions":["ggb"]},"application/vnd.geogebra.slides":{"source":"iana"},"application/vnd.geogebra.tool":{"source":"iana","extensions":["ggt"]},"application/vnd.geometry-explorer":{"source":"iana","extensions":["gex","gre"]},"application/vnd.geonext":{"source":"iana","extensions":["gxt"]},"application/vnd.geoplan":{"source":"iana","extensions":["g2w"]},"application/vnd.geospace":{"source":"iana","extensions":["g3w"]},"application/vnd.gerber":{"source":"iana"},"application/vnd.globalplatform.card-content-mgt":{"source":"iana"},"application/vnd.globalplatform.card-content-mgt-response":{"source":"iana"},"application/vnd.gmx":{"source":"iana","extensions":["gmx"]},"application/vnd.google-apps.document":{"compressible":false,"extensions":["gdoc"]},"application/vnd.google-apps.presentation":{"compressible":false,"extensions":["gslides"]},"application/vnd.google-apps.spreadsheet":{"compressible":false,"extensions":["gsheet"]},"application/vnd.google-earth.kml+xml":{"source":"iana","compressible":true,"extensions":["kml"]},"application/vnd.google-earth.kmz":{"source":"iana","compressible":false,"extensions":["kmz"]},"application/vnd.gov.sk.e-form+xml":{"source":"iana","compressible":true},"application/vnd.gov.sk.e-form+zip":{"source":"iana","compressible":false},"application/vnd.gov.sk.xmldatacontainer+xml":{"source":"iana","compressible":true},"application/vnd.grafeq":{"source":"iana","extensions":["gqf","gqs"]},"application/vnd.gridmp":{"source":"iana"},"application/vnd.groove-account":{"source":"iana","extensions":["gac"]},"application/vnd.groove-help":{"source":"iana","extensions":["ghf"]},"application/vnd.groove-identity-message":{"source":"iana","extensions":["gim"]},"application/vnd.groove-injector":{"source":"iana","extensions":["grv"]},"application/vnd.groove-tool-message":{"source":"iana","extensions":["gtm"]},"application/vnd.groove-tool-template":{"source":"iana","extensions":["tpl"]},"application/vnd.groove-vcard":{"source":"iana","extensions":["vcg"]},"application/vnd.hal+json":{"source":"iana","compressible":true},"application/vnd.hal+xml":{"source":"iana","compressible":true,"extensions":["hal"]},"application/vnd.handheld-entertainment+xml":{"source":"iana","compressible":true,"extensions":["zmm"]},"application/vnd.hbci":{"source":"iana","extensions":["hbci"]},"application/vnd.hc+json":{"source":"iana","compressible":true},"application/vnd.hcl-bireports":{"source":"iana"},"application/vnd.hdt":{"source":"iana"},"application/vnd.heroku+json":{"source":"iana","compressible":true},"application/vnd.hhe.lesson-player":{"source":"iana","extensions":["les"]},"application/vnd.hp-hpgl":{"source":"iana","extensions":["hpgl"]},"application/vnd.hp-hpid":{"source":"iana","extensions":["hpid"]},"application/vnd.hp-hps":{"source":"iana","extensions":["hps"]},"application/vnd.hp-jlyt":{"source":"iana","extensions":["jlt"]},"application/vnd.hp-pcl":{"source":"iana","extensions":["pcl"]},"application/vnd.hp-pclxl":{"source":"iana","extensions":["pclxl"]},"application/vnd.httphone":{"source":"iana"},"application/vnd.hydrostatix.sof-data":{"source":"iana","extensions":["sfd-hdstx"]},"application/vnd.hyper+json":{"source":"iana","compressible":true},"application/vnd.hyper-item+json":{"source":"iana","compressible":true},"application/vnd.hyperdrive+json":{"source":"iana","compressible":true},"application/vnd.hzn-3d-crossword":{"source":"iana"},"application/vnd.ibm.afplinedata":{"source":"iana"},"application/vnd.ibm.electronic-media":{"source":"iana"},"application/vnd.ibm.minipay":{"source":"iana","extensions":["mpy"]},"application/vnd.ibm.modcap":{"source":"iana","extensions":["afp","listafp","list3820"]},"application/vnd.ibm.rights-management":{"source":"iana","extensions":["irm"]},"application/vnd.ibm.secure-container":{"source":"iana","extensions":["sc"]},"application/vnd.iccprofile":{"source":"iana","extensions":["icc","icm"]},"application/vnd.ieee.1905":{"source":"iana"},"application/vnd.igloader":{"source":"iana","extensions":["igl"]},"application/vnd.imagemeter.folder+zip":{"source":"iana","compressible":false},"application/vnd.imagemeter.image+zip":{"source":"iana","compressible":false},"application/vnd.immervision-ivp":{"source":"iana","extensions":["ivp"]},"application/vnd.immervision-ivu":{"source":"iana","extensions":["ivu"]},"application/vnd.ims.imsccv1p1":{"source":"iana"},"application/vnd.ims.imsccv1p2":{"source":"iana"},"application/vnd.ims.imsccv1p3":{"source":"iana"},"application/vnd.ims.lis.v2.result+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolconsumerprofile+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolproxy+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolproxy.id+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolsettings+json":{"source":"iana","compressible":true},"application/vnd.ims.lti.v2.toolsettings.simple+json":{"source":"iana","compressible":true},"application/vnd.informedcontrol.rms+xml":{"source":"iana","compressible":true},"application/vnd.informix-visionary":{"source":"iana"},"application/vnd.infotech.project":{"source":"iana"},"application/vnd.infotech.project+xml":{"source":"iana","compressible":true},"application/vnd.innopath.wamp.notification":{"source":"iana"},"application/vnd.insors.igm":{"source":"iana","extensions":["igm"]},"application/vnd.intercon.formnet":{"source":"iana","extensions":["xpw","xpx"]},"application/vnd.intergeo":{"source":"iana","extensions":["i2g"]},"application/vnd.intertrust.digibox":{"source":"iana"},"application/vnd.intertrust.nncp":{"source":"iana"},"application/vnd.intu.qbo":{"source":"iana","extensions":["qbo"]},"application/vnd.intu.qfx":{"source":"iana","extensions":["qfx"]},"application/vnd.iptc.g2.catalogitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.conceptitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.knowledgeitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.newsitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.newsmessage+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.packageitem+xml":{"source":"iana","compressible":true},"application/vnd.iptc.g2.planningitem+xml":{"source":"iana","compressible":true},"application/vnd.ipunplugged.rcprofile":{"source":"iana","extensions":["rcprofile"]},"application/vnd.irepository.package+xml":{"source":"iana","compressible":true,"extensions":["irp"]},"application/vnd.is-xpr":{"source":"iana","extensions":["xpr"]},"application/vnd.isac.fcs":{"source":"iana","extensions":["fcs"]},"application/vnd.iso11783-10+zip":{"source":"iana","compressible":false},"application/vnd.jam":{"source":"iana","extensions":["jam"]},"application/vnd.japannet-directory-service":{"source":"iana"},"application/vnd.japannet-jpnstore-wakeup":{"source":"iana"},"application/vnd.japannet-payment-wakeup":{"source":"iana"},"application/vnd.japannet-registration":{"source":"iana"},"application/vnd.japannet-registration-wakeup":{"source":"iana"},"application/vnd.japannet-setstore-wakeup":{"source":"iana"},"application/vnd.japannet-verification":{"source":"iana"},"application/vnd.japannet-verification-wakeup":{"source":"iana"},"application/vnd.jcp.javame.midlet-rms":{"source":"iana","extensions":["rms"]},"application/vnd.jisp":{"source":"iana","extensions":["jisp"]},"application/vnd.joost.joda-archive":{"source":"iana","extensions":["joda"]},"application/vnd.jsk.isdn-ngn":{"source":"iana"},"application/vnd.kahootz":{"source":"iana","extensions":["ktz","ktr"]},"application/vnd.kde.karbon":{"source":"iana","extensions":["karbon"]},"application/vnd.kde.kchart":{"source":"iana","extensions":["chrt"]},"application/vnd.kde.kformula":{"source":"iana","extensions":["kfo"]},"application/vnd.kde.kivio":{"source":"iana","extensions":["flw"]},"application/vnd.kde.kontour":{"source":"iana","extensions":["kon"]},"application/vnd.kde.kpresenter":{"source":"iana","extensions":["kpr","kpt"]},"application/vnd.kde.kspread":{"source":"iana","extensions":["ksp"]},"application/vnd.kde.kword":{"source":"iana","extensions":["kwd","kwt"]},"application/vnd.kenameaapp":{"source":"iana","extensions":["htke"]},"application/vnd.kidspiration":{"source":"iana","extensions":["kia"]},"application/vnd.kinar":{"source":"iana","extensions":["kne","knp"]},"application/vnd.koan":{"source":"iana","extensions":["skp","skd","skt","skm"]},"application/vnd.kodak-descriptor":{"source":"iana","extensions":["sse"]},"application/vnd.las":{"source":"iana"},"application/vnd.las.las+json":{"source":"iana","compressible":true},"application/vnd.las.las+xml":{"source":"iana","compressible":true,"extensions":["lasxml"]},"application/vnd.laszip":{"source":"iana"},"application/vnd.leap+json":{"source":"iana","compressible":true},"application/vnd.liberty-request+xml":{"source":"iana","compressible":true},"application/vnd.llamagraphics.life-balance.desktop":{"source":"iana","extensions":["lbd"]},"application/vnd.llamagraphics.life-balance.exchange+xml":{"source":"iana","compressible":true,"extensions":["lbe"]},"application/vnd.logipipe.circuit+zip":{"source":"iana","compressible":false},"application/vnd.loom":{"source":"iana"},"application/vnd.lotus-1-2-3":{"source":"iana","extensions":["123"]},"application/vnd.lotus-approach":{"source":"iana","extensions":["apr"]},"application/vnd.lotus-freelance":{"source":"iana","extensions":["pre"]},"application/vnd.lotus-notes":{"source":"iana","extensions":["nsf"]},"application/vnd.lotus-organizer":{"source":"iana","extensions":["org"]},"application/vnd.lotus-screencam":{"source":"iana","extensions":["scm"]},"application/vnd.lotus-wordpro":{"source":"iana","extensions":["lwp"]},"application/vnd.macports.portpkg":{"source":"iana","extensions":["portpkg"]},"application/vnd.mapbox-vector-tile":{"source":"iana"},"application/vnd.marlin.drm.actiontoken+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.conftoken+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.license+xml":{"source":"iana","compressible":true},"application/vnd.marlin.drm.mdcf":{"source":"iana"},"application/vnd.mason+json":{"source":"iana","compressible":true},"application/vnd.maxmind.maxmind-db":{"source":"iana"},"application/vnd.mcd":{"source":"iana","extensions":["mcd"]},"application/vnd.medcalcdata":{"source":"iana","extensions":["mc1"]},"application/vnd.mediastation.cdkey":{"source":"iana","extensions":["cdkey"]},"application/vnd.meridian-slingshot":{"source":"iana"},"application/vnd.mfer":{"source":"iana","extensions":["mwf"]},"application/vnd.mfmp":{"source":"iana","extensions":["mfm"]},"application/vnd.micro+json":{"source":"iana","compressible":true},"application/vnd.micrografx.flo":{"source":"iana","extensions":["flo"]},"application/vnd.micrografx.igx":{"source":"iana","extensions":["igx"]},"application/vnd.microsoft.portable-executable":{"source":"iana"},"application/vnd.microsoft.windows.thumbnail-cache":{"source":"iana"},"application/vnd.miele+json":{"source":"iana","compressible":true},"application/vnd.mif":{"source":"iana","extensions":["mif"]},"application/vnd.minisoft-hp3000-save":{"source":"iana"},"application/vnd.mitsubishi.misty-guard.trustweb":{"source":"iana"},"application/vnd.mobius.daf":{"source":"iana","extensions":["daf"]},"application/vnd.mobius.dis":{"source":"iana","extensions":["dis"]},"application/vnd.mobius.mbk":{"source":"iana","extensions":["mbk"]},"application/vnd.mobius.mqy":{"source":"iana","extensions":["mqy"]},"application/vnd.mobius.msl":{"source":"iana","extensions":["msl"]},"application/vnd.mobius.plc":{"source":"iana","extensions":["plc"]},"application/vnd.mobius.txf":{"source":"iana","extensions":["txf"]},"application/vnd.mophun.application":{"source":"iana","extensions":["mpn"]},"application/vnd.mophun.certificate":{"source":"iana","extensions":["mpc"]},"application/vnd.motorola.flexsuite":{"source":"iana"},"application/vnd.motorola.flexsuite.adsi":{"source":"iana"},"application/vnd.motorola.flexsuite.fis":{"source":"iana"},"application/vnd.motorola.flexsuite.gotap":{"source":"iana"},"application/vnd.motorola.flexsuite.kmr":{"source":"iana"},"application/vnd.motorola.flexsuite.ttc":{"source":"iana"},"application/vnd.motorola.flexsuite.wem":{"source":"iana"},"application/vnd.motorola.iprm":{"source":"iana"},"application/vnd.mozilla.xul+xml":{"source":"iana","compressible":true,"extensions":["xul"]},"application/vnd.ms-3mfdocument":{"source":"iana"},"application/vnd.ms-artgalry":{"source":"iana","extensions":["cil"]},"application/vnd.ms-asf":{"source":"iana"},"application/vnd.ms-cab-compressed":{"source":"iana","extensions":["cab"]},"application/vnd.ms-color.iccprofile":{"source":"apache"},"application/vnd.ms-excel":{"source":"iana","compressible":false,"extensions":["xls","xlm","xla","xlc","xlt","xlw"]},"application/vnd.ms-excel.addin.macroenabled.12":{"source":"iana","extensions":["xlam"]},"application/vnd.ms-excel.sheet.binary.macroenabled.12":{"source":"iana","extensions":["xlsb"]},"application/vnd.ms-excel.sheet.macroenabled.12":{"source":"iana","extensions":["xlsm"]},"application/vnd.ms-excel.template.macroenabled.12":{"source":"iana","extensions":["xltm"]},"application/vnd.ms-fontobject":{"source":"iana","compressible":true,"extensions":["eot"]},"application/vnd.ms-htmlhelp":{"source":"iana","extensions":["chm"]},"application/vnd.ms-ims":{"source":"iana","extensions":["ims"]},"application/vnd.ms-lrm":{"source":"iana","extensions":["lrm"]},"application/vnd.ms-office.activex+xml":{"source":"iana","compressible":true},"application/vnd.ms-officetheme":{"source":"iana","extensions":["thmx"]},"application/vnd.ms-opentype":{"source":"apache","compressible":true},"application/vnd.ms-outlook":{"compressible":false,"extensions":["msg"]},"application/vnd.ms-package.obfuscated-opentype":{"source":"apache"},"application/vnd.ms-pki.seccat":{"source":"apache","extensions":["cat"]},"application/vnd.ms-pki.stl":{"source":"apache","extensions":["stl"]},"application/vnd.ms-playready.initiator+xml":{"source":"iana","compressible":true},"application/vnd.ms-powerpoint":{"source":"iana","compressible":false,"extensions":["ppt","pps","pot"]},"application/vnd.ms-powerpoint.addin.macroenabled.12":{"source":"iana","extensions":["ppam"]},"application/vnd.ms-powerpoint.presentation.macroenabled.12":{"source":"iana","extensions":["pptm"]},"application/vnd.ms-powerpoint.slide.macroenabled.12":{"source":"iana","extensions":["sldm"]},"application/vnd.ms-powerpoint.slideshow.macroenabled.12":{"source":"iana","extensions":["ppsm"]},"application/vnd.ms-powerpoint.template.macroenabled.12":{"source":"iana","extensions":["potm"]},"application/vnd.ms-printdevicecapabilities+xml":{"source":"iana","compressible":true},"application/vnd.ms-printing.printticket+xml":{"source":"apache","compressible":true},"application/vnd.ms-printschematicket+xml":{"source":"iana","compressible":true},"application/vnd.ms-project":{"source":"iana","extensions":["mpp","mpt"]},"application/vnd.ms-tnef":{"source":"iana"},"application/vnd.ms-windows.devicepairing":{"source":"iana"},"application/vnd.ms-windows.nwprinting.oob":{"source":"iana"},"application/vnd.ms-windows.printerpairing":{"source":"iana"},"application/vnd.ms-windows.wsd.oob":{"source":"iana"},"application/vnd.ms-wmdrm.lic-chlg-req":{"source":"iana"},"application/vnd.ms-wmdrm.lic-resp":{"source":"iana"},"application/vnd.ms-wmdrm.meter-chlg-req":{"source":"iana"},"application/vnd.ms-wmdrm.meter-resp":{"source":"iana"},"application/vnd.ms-word.document.macroenabled.12":{"source":"iana","extensions":["docm"]},"application/vnd.ms-word.template.macroenabled.12":{"source":"iana","extensions":["dotm"]},"application/vnd.ms-works":{"source":"iana","extensions":["wps","wks","wcm","wdb"]},"application/vnd.ms-wpl":{"source":"iana","extensions":["wpl"]},"application/vnd.ms-xpsdocument":{"source":"iana","compressible":false,"extensions":["xps"]},"application/vnd.msa-disk-image":{"source":"iana"},"application/vnd.mseq":{"source":"iana","extensions":["mseq"]},"application/vnd.msign":{"source":"iana"},"application/vnd.multiad.creator":{"source":"iana"},"application/vnd.multiad.creator.cif":{"source":"iana"},"application/vnd.music-niff":{"source":"iana"},"application/vnd.musician":{"source":"iana","extensions":["mus"]},"application/vnd.muvee.style":{"source":"iana","extensions":["msty"]},"application/vnd.mynfc":{"source":"iana","extensions":["taglet"]},"application/vnd.ncd.control":{"source":"iana"},"application/vnd.ncd.reference":{"source":"iana"},"application/vnd.nearst.inv+json":{"source":"iana","compressible":true},"application/vnd.nebumind.line":{"source":"iana"},"application/vnd.nervana":{"source":"iana"},"application/vnd.netfpx":{"source":"iana"},"application/vnd.neurolanguage.nlu":{"source":"iana","extensions":["nlu"]},"application/vnd.nimn":{"source":"iana"},"application/vnd.nintendo.nitro.rom":{"source":"iana"},"application/vnd.nintendo.snes.rom":{"source":"iana"},"application/vnd.nitf":{"source":"iana","extensions":["ntf","nitf"]},"application/vnd.noblenet-directory":{"source":"iana","extensions":["nnd"]},"application/vnd.noblenet-sealer":{"source":"iana","extensions":["nns"]},"application/vnd.noblenet-web":{"source":"iana","extensions":["nnw"]},"application/vnd.nokia.catalogs":{"source":"iana"},"application/vnd.nokia.conml+wbxml":{"source":"iana"},"application/vnd.nokia.conml+xml":{"source":"iana","compressible":true},"application/vnd.nokia.iptv.config+xml":{"source":"iana","compressible":true},"application/vnd.nokia.isds-radio-presets":{"source":"iana"},"application/vnd.nokia.landmark+wbxml":{"source":"iana"},"application/vnd.nokia.landmark+xml":{"source":"iana","compressible":true},"application/vnd.nokia.landmarkcollection+xml":{"source":"iana","compressible":true},"application/vnd.nokia.n-gage.ac+xml":{"source":"iana","compressible":true,"extensions":["ac"]},"application/vnd.nokia.n-gage.data":{"source":"iana","extensions":["ngdat"]},"application/vnd.nokia.n-gage.symbian.install":{"source":"iana","extensions":["n-gage"]},"application/vnd.nokia.ncd":{"source":"iana"},"application/vnd.nokia.pcd+wbxml":{"source":"iana"},"application/vnd.nokia.pcd+xml":{"source":"iana","compressible":true},"application/vnd.nokia.radio-preset":{"source":"iana","extensions":["rpst"]},"application/vnd.nokia.radio-presets":{"source":"iana","extensions":["rpss"]},"application/vnd.novadigm.edm":{"source":"iana","extensions":["edm"]},"application/vnd.novadigm.edx":{"source":"iana","extensions":["edx"]},"application/vnd.novadigm.ext":{"source":"iana","extensions":["ext"]},"application/vnd.ntt-local.content-share":{"source":"iana"},"application/vnd.ntt-local.file-transfer":{"source":"iana"},"application/vnd.ntt-local.ogw_remote-access":{"source":"iana"},"application/vnd.ntt-local.sip-ta_remote":{"source":"iana"},"application/vnd.ntt-local.sip-ta_tcp_stream":{"source":"iana"},"application/vnd.oasis.opendocument.chart":{"source":"iana","extensions":["odc"]},"application/vnd.oasis.opendocument.chart-template":{"source":"iana","extensions":["otc"]},"application/vnd.oasis.opendocument.database":{"source":"iana","extensions":["odb"]},"application/vnd.oasis.opendocument.formula":{"source":"iana","extensions":["odf"]},"application/vnd.oasis.opendocument.formula-template":{"source":"iana","extensions":["odft"]},"application/vnd.oasis.opendocument.graphics":{"source":"iana","compressible":false,"extensions":["odg"]},"application/vnd.oasis.opendocument.graphics-template":{"source":"iana","extensions":["otg"]},"application/vnd.oasis.opendocument.image":{"source":"iana","extensions":["odi"]},"application/vnd.oasis.opendocument.image-template":{"source":"iana","extensions":["oti"]},"application/vnd.oasis.opendocument.presentation":{"source":"iana","compressible":false,"extensions":["odp"]},"application/vnd.oasis.opendocument.presentation-template":{"source":"iana","extensions":["otp"]},"application/vnd.oasis.opendocument.spreadsheet":{"source":"iana","compressible":false,"extensions":["ods"]},"application/vnd.oasis.opendocument.spreadsheet-template":{"source":"iana","extensions":["ots"]},"application/vnd.oasis.opendocument.text":{"source":"iana","compressible":false,"extensions":["odt"]},"application/vnd.oasis.opendocument.text-master":{"source":"iana","extensions":["odm"]},"application/vnd.oasis.opendocument.text-template":{"source":"iana","extensions":["ott"]},"application/vnd.oasis.opendocument.text-web":{"source":"iana","extensions":["oth"]},"application/vnd.obn":{"source":"iana"},"application/vnd.ocf+cbor":{"source":"iana"},"application/vnd.oci.image.manifest.v1+json":{"source":"iana","compressible":true},"application/vnd.oftn.l10n+json":{"source":"iana","compressible":true},"application/vnd.oipf.contentaccessdownload+xml":{"source":"iana","compressible":true},"application/vnd.oipf.contentaccessstreaming+xml":{"source":"iana","compressible":true},"application/vnd.oipf.cspg-hexbinary":{"source":"iana"},"application/vnd.oipf.dae.svg+xml":{"source":"iana","compressible":true},"application/vnd.oipf.dae.xhtml+xml":{"source":"iana","compressible":true},"application/vnd.oipf.mippvcontrolmessage+xml":{"source":"iana","compressible":true},"application/vnd.oipf.pae.gem":{"source":"iana"},"application/vnd.oipf.spdiscovery+xml":{"source":"iana","compressible":true},"application/vnd.oipf.spdlist+xml":{"source":"iana","compressible":true},"application/vnd.oipf.ueprofile+xml":{"source":"iana","compressible":true},"application/vnd.oipf.userprofile+xml":{"source":"iana","compressible":true},"application/vnd.olpc-sugar":{"source":"iana","extensions":["xo"]},"application/vnd.oma-scws-config":{"source":"iana"},"application/vnd.oma-scws-http-request":{"source":"iana"},"application/vnd.oma-scws-http-response":{"source":"iana"},"application/vnd.oma.bcast.associated-procedure-parameter+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.drm-trigger+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.imd+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.ltkm":{"source":"iana"},"application/vnd.oma.bcast.notification+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.provisioningtrigger":{"source":"iana"},"application/vnd.oma.bcast.sgboot":{"source":"iana"},"application/vnd.oma.bcast.sgdd+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.sgdu":{"source":"iana"},"application/vnd.oma.bcast.simple-symbol-container":{"source":"iana"},"application/vnd.oma.bcast.smartcard-trigger+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.sprov+xml":{"source":"iana","compressible":true},"application/vnd.oma.bcast.stkm":{"source":"iana"},"application/vnd.oma.cab-address-book+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-feature-handler+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-pcc+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-subs-invite+xml":{"source":"iana","compressible":true},"application/vnd.oma.cab-user-prefs+xml":{"source":"iana","compressible":true},"application/vnd.oma.dcd":{"source":"iana"},"application/vnd.oma.dcdc":{"source":"iana"},"application/vnd.oma.dd2+xml":{"source":"iana","compressible":true,"extensions":["dd2"]},"application/vnd.oma.drm.risd+xml":{"source":"iana","compressible":true},"application/vnd.oma.group-usage-list+xml":{"source":"iana","compressible":true},"application/vnd.oma.lwm2m+cbor":{"source":"iana"},"application/vnd.oma.lwm2m+json":{"source":"iana","compressible":true},"application/vnd.oma.lwm2m+tlv":{"source":"iana"},"application/vnd.oma.pal+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.detailed-progress-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.final-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.groups+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.invocation-descriptor+xml":{"source":"iana","compressible":true},"application/vnd.oma.poc.optimized-progress-report+xml":{"source":"iana","compressible":true},"application/vnd.oma.push":{"source":"iana"},"application/vnd.oma.scidm.messages+xml":{"source":"iana","compressible":true},"application/vnd.oma.xcap-directory+xml":{"source":"iana","compressible":true},"application/vnd.omads-email+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omads-file+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omads-folder+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.omaloc-supl-init":{"source":"iana"},"application/vnd.onepager":{"source":"iana"},"application/vnd.onepagertamp":{"source":"iana"},"application/vnd.onepagertamx":{"source":"iana"},"application/vnd.onepagertat":{"source":"iana"},"application/vnd.onepagertatp":{"source":"iana"},"application/vnd.onepagertatx":{"source":"iana"},"application/vnd.openblox.game+xml":{"source":"iana","compressible":true,"extensions":["obgx"]},"application/vnd.openblox.game-binary":{"source":"iana"},"application/vnd.openeye.oeb":{"source":"iana"},"application/vnd.openofficeorg.extension":{"source":"apache","extensions":["oxt"]},"application/vnd.openstreetmap.data+xml":{"source":"iana","compressible":true,"extensions":["osm"]},"application/vnd.openxmlformats-officedocument.custom-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.customxmlproperties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawing+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.chart+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.extended-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.presentation":{"source":"iana","compressible":false,"extensions":["pptx"]},"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.presprops+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slide":{"source":"iana","extensions":["sldx"]},"application/vnd.openxmlformats-officedocument.presentationml.slide+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slideshow":{"source":"iana","extensions":["ppsx"]},"application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.tags+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.template":{"source":"iana","extensions":["potx"]},"application/vnd.openxmlformats-officedocument.presentationml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":{"source":"iana","compressible":false,"extensions":["xlsx"]},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.template":{"source":"iana","extensions":["xltx"]},"application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.theme+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.themeoverride+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.vmldrawing":{"source":"iana"},"application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.document":{"source":"iana","compressible":false,"extensions":["docx"]},"application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.template":{"source":"iana","extensions":["dotx"]},"application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.core-properties+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml":{"source":"iana","compressible":true},"application/vnd.openxmlformats-package.relationships+xml":{"source":"iana","compressible":true},"application/vnd.oracle.resource+json":{"source":"iana","compressible":true},"application/vnd.orange.indata":{"source":"iana"},"application/vnd.osa.netdeploy":{"source":"iana"},"application/vnd.osgeo.mapguide.package":{"source":"iana","extensions":["mgp"]},"application/vnd.osgi.bundle":{"source":"iana"},"application/vnd.osgi.dp":{"source":"iana","extensions":["dp"]},"application/vnd.osgi.subsystem":{"source":"iana","extensions":["esa"]},"application/vnd.otps.ct-kip+xml":{"source":"iana","compressible":true},"application/vnd.oxli.countgraph":{"source":"iana"},"application/vnd.pagerduty+json":{"source":"iana","compressible":true},"application/vnd.palm":{"source":"iana","extensions":["pdb","pqa","oprc"]},"application/vnd.panoply":{"source":"iana"},"application/vnd.paos.xml":{"source":"iana"},"application/vnd.patentdive":{"source":"iana"},"application/vnd.patientecommsdoc":{"source":"iana"},"application/vnd.pawaafile":{"source":"iana","extensions":["paw"]},"application/vnd.pcos":{"source":"iana"},"application/vnd.pg.format":{"source":"iana","extensions":["str"]},"application/vnd.pg.osasli":{"source":"iana","extensions":["ei6"]},"application/vnd.piaccess.application-licence":{"source":"iana"},"application/vnd.picsel":{"source":"iana","extensions":["efif"]},"application/vnd.pmi.widget":{"source":"iana","extensions":["wg"]},"application/vnd.poc.group-advertisement+xml":{"source":"iana","compressible":true},"application/vnd.pocketlearn":{"source":"iana","extensions":["plf"]},"application/vnd.powerbuilder6":{"source":"iana","extensions":["pbd"]},"application/vnd.powerbuilder6-s":{"source":"iana"},"application/vnd.powerbuilder7":{"source":"iana"},"application/vnd.powerbuilder7-s":{"source":"iana"},"application/vnd.powerbuilder75":{"source":"iana"},"application/vnd.powerbuilder75-s":{"source":"iana"},"application/vnd.preminet":{"source":"iana"},"application/vnd.previewsystems.box":{"source":"iana","extensions":["box"]},"application/vnd.proteus.magazine":{"source":"iana","extensions":["mgz"]},"application/vnd.psfs":{"source":"iana"},"application/vnd.publishare-delta-tree":{"source":"iana","extensions":["qps"]},"application/vnd.pvi.ptid1":{"source":"iana","extensions":["ptid"]},"application/vnd.pwg-multiplexed":{"source":"iana"},"application/vnd.pwg-xhtml-print+xml":{"source":"iana","compressible":true},"application/vnd.qualcomm.brew-app-res":{"source":"iana"},"application/vnd.quarantainenet":{"source":"iana"},"application/vnd.quark.quarkxpress":{"source":"iana","extensions":["qxd","qxt","qwd","qwt","qxl","qxb"]},"application/vnd.quobject-quoxdocument":{"source":"iana"},"application/vnd.radisys.moml+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-conf+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-conn+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-dialog+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-audit-stream+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-conf+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-base+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-fax-detect+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-fax-sendrecv+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-group+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-speech+xml":{"source":"iana","compressible":true},"application/vnd.radisys.msml-dialog-transform+xml":{"source":"iana","compressible":true},"application/vnd.rainstor.data":{"source":"iana"},"application/vnd.rapid":{"source":"iana"},"application/vnd.rar":{"source":"iana","extensions":["rar"]},"application/vnd.realvnc.bed":{"source":"iana","extensions":["bed"]},"application/vnd.recordare.musicxml":{"source":"iana","extensions":["mxl"]},"application/vnd.recordare.musicxml+xml":{"source":"iana","compressible":true,"extensions":["musicxml"]},"application/vnd.renlearn.rlprint":{"source":"iana"},"application/vnd.restful+json":{"source":"iana","compressible":true},"application/vnd.rig.cryptonote":{"source":"iana","extensions":["cryptonote"]},"application/vnd.rim.cod":{"source":"apache","extensions":["cod"]},"application/vnd.rn-realmedia":{"source":"apache","extensions":["rm"]},"application/vnd.rn-realmedia-vbr":{"source":"apache","extensions":["rmvb"]},"application/vnd.route66.link66+xml":{"source":"iana","compressible":true,"extensions":["link66"]},"application/vnd.rs-274x":{"source":"iana"},"application/vnd.ruckus.download":{"source":"iana"},"application/vnd.s3sms":{"source":"iana"},"application/vnd.sailingtracker.track":{"source":"iana","extensions":["st"]},"application/vnd.sar":{"source":"iana"},"application/vnd.sbm.cid":{"source":"iana"},"application/vnd.sbm.mid2":{"source":"iana"},"application/vnd.scribus":{"source":"iana"},"application/vnd.sealed.3df":{"source":"iana"},"application/vnd.sealed.csf":{"source":"iana"},"application/vnd.sealed.doc":{"source":"iana"},"application/vnd.sealed.eml":{"source":"iana"},"application/vnd.sealed.mht":{"source":"iana"},"application/vnd.sealed.net":{"source":"iana"},"application/vnd.sealed.ppt":{"source":"iana"},"application/vnd.sealed.tiff":{"source":"iana"},"application/vnd.sealed.xls":{"source":"iana"},"application/vnd.sealedmedia.softseal.html":{"source":"iana"},"application/vnd.sealedmedia.softseal.pdf":{"source":"iana"},"application/vnd.seemail":{"source":"iana","extensions":["see"]},"application/vnd.seis+json":{"source":"iana","compressible":true},"application/vnd.sema":{"source":"iana","extensions":["sema"]},"application/vnd.semd":{"source":"iana","extensions":["semd"]},"application/vnd.semf":{"source":"iana","extensions":["semf"]},"application/vnd.shade-save-file":{"source":"iana"},"application/vnd.shana.informed.formdata":{"source":"iana","extensions":["ifm"]},"application/vnd.shana.informed.formtemplate":{"source":"iana","extensions":["itp"]},"application/vnd.shana.informed.interchange":{"source":"iana","extensions":["iif"]},"application/vnd.shana.informed.package":{"source":"iana","extensions":["ipk"]},"application/vnd.shootproof+json":{"source":"iana","compressible":true},"application/vnd.shopkick+json":{"source":"iana","compressible":true},"application/vnd.shp":{"source":"iana"},"application/vnd.shx":{"source":"iana"},"application/vnd.sigrok.session":{"source":"iana"},"application/vnd.simtech-mindmapper":{"source":"iana","extensions":["twd","twds"]},"application/vnd.siren+json":{"source":"iana","compressible":true},"application/vnd.smaf":{"source":"iana","extensions":["mmf"]},"application/vnd.smart.notebook":{"source":"iana"},"application/vnd.smart.teacher":{"source":"iana","extensions":["teacher"]},"application/vnd.snesdev-page-table":{"source":"iana"},"application/vnd.software602.filler.form+xml":{"source":"iana","compressible":true,"extensions":["fo"]},"application/vnd.software602.filler.form-xml-zip":{"source":"iana"},"application/vnd.solent.sdkm+xml":{"source":"iana","compressible":true,"extensions":["sdkm","sdkd"]},"application/vnd.spotfire.dxp":{"source":"iana","extensions":["dxp"]},"application/vnd.spotfire.sfs":{"source":"iana","extensions":["sfs"]},"application/vnd.sqlite3":{"source":"iana"},"application/vnd.sss-cod":{"source":"iana"},"application/vnd.sss-dtf":{"source":"iana"},"application/vnd.sss-ntf":{"source":"iana"},"application/vnd.stardivision.calc":{"source":"apache","extensions":["sdc"]},"application/vnd.stardivision.draw":{"source":"apache","extensions":["sda"]},"application/vnd.stardivision.impress":{"source":"apache","extensions":["sdd"]},"application/vnd.stardivision.math":{"source":"apache","extensions":["smf"]},"application/vnd.stardivision.writer":{"source":"apache","extensions":["sdw","vor"]},"application/vnd.stardivision.writer-global":{"source":"apache","extensions":["sgl"]},"application/vnd.stepmania.package":{"source":"iana","extensions":["smzip"]},"application/vnd.stepmania.stepchart":{"source":"iana","extensions":["sm"]},"application/vnd.street-stream":{"source":"iana"},"application/vnd.sun.wadl+xml":{"source":"iana","compressible":true,"extensions":["wadl"]},"application/vnd.sun.xml.calc":{"source":"apache","extensions":["sxc"]},"application/vnd.sun.xml.calc.template":{"source":"apache","extensions":["stc"]},"application/vnd.sun.xml.draw":{"source":"apache","extensions":["sxd"]},"application/vnd.sun.xml.draw.template":{"source":"apache","extensions":["std"]},"application/vnd.sun.xml.impress":{"source":"apache","extensions":["sxi"]},"application/vnd.sun.xml.impress.template":{"source":"apache","extensions":["sti"]},"application/vnd.sun.xml.math":{"source":"apache","extensions":["sxm"]},"application/vnd.sun.xml.writer":{"source":"apache","extensions":["sxw"]},"application/vnd.sun.xml.writer.global":{"source":"apache","extensions":["sxg"]},"application/vnd.sun.xml.writer.template":{"source":"apache","extensions":["stw"]},"application/vnd.sus-calendar":{"source":"iana","extensions":["sus","susp"]},"application/vnd.svd":{"source":"iana","extensions":["svd"]},"application/vnd.swiftview-ics":{"source":"iana"},"application/vnd.sycle+xml":{"source":"iana","compressible":true},"application/vnd.symbian.install":{"source":"apache","extensions":["sis","sisx"]},"application/vnd.syncml+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["xsm"]},"application/vnd.syncml.dm+wbxml":{"source":"iana","charset":"UTF-8","extensions":["bdm"]},"application/vnd.syncml.dm+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["xdm"]},"application/vnd.syncml.dm.notification":{"source":"iana"},"application/vnd.syncml.dmddf+wbxml":{"source":"iana"},"application/vnd.syncml.dmddf+xml":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["ddf"]},"application/vnd.syncml.dmtnds+wbxml":{"source":"iana"},"application/vnd.syncml.dmtnds+xml":{"source":"iana","charset":"UTF-8","compressible":true},"application/vnd.syncml.ds.notification":{"source":"iana"},"application/vnd.tableschema+json":{"source":"iana","compressible":true},"application/vnd.tao.intent-module-archive":{"source":"iana","extensions":["tao"]},"application/vnd.tcpdump.pcap":{"source":"iana","extensions":["pcap","cap","dmp"]},"application/vnd.think-cell.ppttc+json":{"source":"iana","compressible":true},"application/vnd.tmd.mediaflex.api+xml":{"source":"iana","compressible":true},"application/vnd.tml":{"source":"iana"},"application/vnd.tmobile-livetv":{"source":"iana","extensions":["tmo"]},"application/vnd.tri.onesource":{"source":"iana"},"application/vnd.trid.tpt":{"source":"iana","extensions":["tpt"]},"application/vnd.triscape.mxs":{"source":"iana","extensions":["mxs"]},"application/vnd.trueapp":{"source":"iana","extensions":["tra"]},"application/vnd.truedoc":{"source":"iana"},"application/vnd.ubisoft.webplayer":{"source":"iana"},"application/vnd.ufdl":{"source":"iana","extensions":["ufd","ufdl"]},"application/vnd.uiq.theme":{"source":"iana","extensions":["utz"]},"application/vnd.umajin":{"source":"iana","extensions":["umj"]},"application/vnd.unity":{"source":"iana","extensions":["unityweb"]},"application/vnd.uoml+xml":{"source":"iana","compressible":true,"extensions":["uoml"]},"application/vnd.uplanet.alert":{"source":"iana"},"application/vnd.uplanet.alert-wbxml":{"source":"iana"},"application/vnd.uplanet.bearer-choice":{"source":"iana"},"application/vnd.uplanet.bearer-choice-wbxml":{"source":"iana"},"application/vnd.uplanet.cacheop":{"source":"iana"},"application/vnd.uplanet.cacheop-wbxml":{"source":"iana"},"application/vnd.uplanet.channel":{"source":"iana"},"application/vnd.uplanet.channel-wbxml":{"source":"iana"},"application/vnd.uplanet.list":{"source":"iana"},"application/vnd.uplanet.list-wbxml":{"source":"iana"},"application/vnd.uplanet.listcmd":{"source":"iana"},"application/vnd.uplanet.listcmd-wbxml":{"source":"iana"},"application/vnd.uplanet.signal":{"source":"iana"},"application/vnd.uri-map":{"source":"iana"},"application/vnd.valve.source.material":{"source":"iana"},"application/vnd.vcx":{"source":"iana","extensions":["vcx"]},"application/vnd.vd-study":{"source":"iana"},"application/vnd.vectorworks":{"source":"iana"},"application/vnd.vel+json":{"source":"iana","compressible":true},"application/vnd.verimatrix.vcas":{"source":"iana"},"application/vnd.veryant.thin":{"source":"iana"},"application/vnd.ves.encrypted":{"source":"iana"},"application/vnd.vidsoft.vidconference":{"source":"iana"},"application/vnd.visio":{"source":"iana","extensions":["vsd","vst","vss","vsw"]},"application/vnd.visionary":{"source":"iana","extensions":["vis"]},"application/vnd.vividence.scriptfile":{"source":"iana"},"application/vnd.vsf":{"source":"iana","extensions":["vsf"]},"application/vnd.wap.sic":{"source":"iana"},"application/vnd.wap.slc":{"source":"iana"},"application/vnd.wap.wbxml":{"source":"iana","charset":"UTF-8","extensions":["wbxml"]},"application/vnd.wap.wmlc":{"source":"iana","extensions":["wmlc"]},"application/vnd.wap.wmlscriptc":{"source":"iana","extensions":["wmlsc"]},"application/vnd.webturbo":{"source":"iana","extensions":["wtb"]},"application/vnd.wfa.dpp":{"source":"iana"},"application/vnd.wfa.p2p":{"source":"iana"},"application/vnd.wfa.wsc":{"source":"iana"},"application/vnd.windows.devicepairing":{"source":"iana"},"application/vnd.wmc":{"source":"iana"},"application/vnd.wmf.bootstrap":{"source":"iana"},"application/vnd.wolfram.mathematica":{"source":"iana"},"application/vnd.wolfram.mathematica.package":{"source":"iana"},"application/vnd.wolfram.player":{"source":"iana","extensions":["nbp"]},"application/vnd.wordperfect":{"source":"iana","extensions":["wpd"]},"application/vnd.wqd":{"source":"iana","extensions":["wqd"]},"application/vnd.wrq-hp3000-labelled":{"source":"iana"},"application/vnd.wt.stf":{"source":"iana","extensions":["stf"]},"application/vnd.wv.csp+wbxml":{"source":"iana"},"application/vnd.wv.csp+xml":{"source":"iana","compressible":true},"application/vnd.wv.ssp+xml":{"source":"iana","compressible":true},"application/vnd.xacml+json":{"source":"iana","compressible":true},"application/vnd.xara":{"source":"iana","extensions":["xar"]},"application/vnd.xfdl":{"source":"iana","extensions":["xfdl"]},"application/vnd.xfdl.webform":{"source":"iana"},"application/vnd.xmi+xml":{"source":"iana","compressible":true},"application/vnd.xmpie.cpkg":{"source":"iana"},"application/vnd.xmpie.dpkg":{"source":"iana"},"application/vnd.xmpie.plan":{"source":"iana"},"application/vnd.xmpie.ppkg":{"source":"iana"},"application/vnd.xmpie.xlim":{"source":"iana"},"application/vnd.yamaha.hv-dic":{"source":"iana","extensions":["hvd"]},"application/vnd.yamaha.hv-script":{"source":"iana","extensions":["hvs"]},"application/vnd.yamaha.hv-voice":{"source":"iana","extensions":["hvp"]},"application/vnd.yamaha.openscoreformat":{"source":"iana","extensions":["osf"]},"application/vnd.yamaha.openscoreformat.osfpvg+xml":{"source":"iana","compressible":true,"extensions":["osfpvg"]},"application/vnd.yamaha.remote-setup":{"source":"iana"},"application/vnd.yamaha.smaf-audio":{"source":"iana","extensions":["saf"]},"application/vnd.yamaha.smaf-phrase":{"source":"iana","extensions":["spf"]},"application/vnd.yamaha.through-ngn":{"source":"iana"},"application/vnd.yamaha.tunnel-udpencap":{"source":"iana"},"application/vnd.yaoweme":{"source":"iana"},"application/vnd.yellowriver-custom-menu":{"source":"iana","extensions":["cmp"]},"application/vnd.youtube.yt":{"source":"iana"},"application/vnd.zul":{"source":"iana","extensions":["zir","zirz"]},"application/vnd.zzazz.deck+xml":{"source":"iana","compressible":true,"extensions":["zaz"]},"application/voicexml+xml":{"source":"iana","compressible":true,"extensions":["vxml"]},"application/voucher-cms+json":{"source":"iana","compressible":true},"application/vq-rtcpxr":{"source":"iana"},"application/wasm":{"compressible":true,"extensions":["wasm"]},"application/watcherinfo+xml":{"source":"iana","compressible":true},"application/webpush-options+json":{"source":"iana","compressible":true},"application/whoispp-query":{"source":"iana"},"application/whoispp-response":{"source":"iana"},"application/widget":{"source":"iana","extensions":["wgt"]},"application/winhlp":{"source":"apache","extensions":["hlp"]},"application/wita":{"source":"iana"},"application/wordperfect5.1":{"source":"iana"},"application/wsdl+xml":{"source":"iana","compressible":true,"extensions":["wsdl"]},"application/wspolicy+xml":{"source":"iana","compressible":true,"extensions":["wspolicy"]},"application/x-7z-compressed":{"source":"apache","compressible":false,"extensions":["7z"]},"application/x-abiword":{"source":"apache","extensions":["abw"]},"application/x-ace-compressed":{"source":"apache","extensions":["ace"]},"application/x-amf":{"source":"apache"},"application/x-apple-diskimage":{"source":"apache","extensions":["dmg"]},"application/x-arj":{"compressible":false,"extensions":["arj"]},"application/x-authorware-bin":{"source":"apache","extensions":["aab","x32","u32","vox"]},"application/x-authorware-map":{"source":"apache","extensions":["aam"]},"application/x-authorware-seg":{"source":"apache","extensions":["aas"]},"application/x-bcpio":{"source":"apache","extensions":["bcpio"]},"application/x-bdoc":{"compressible":false,"extensions":["bdoc"]},"application/x-bittorrent":{"source":"apache","extensions":["torrent"]},"application/x-blorb":{"source":"apache","extensions":["blb","blorb"]},"application/x-bzip":{"source":"apache","compressible":false,"extensions":["bz"]},"application/x-bzip2":{"source":"apache","compressible":false,"extensions":["bz2","boz"]},"application/x-cbr":{"source":"apache","extensions":["cbr","cba","cbt","cbz","cb7"]},"application/x-cdlink":{"source":"apache","extensions":["vcd"]},"application/x-cfs-compressed":{"source":"apache","extensions":["cfs"]},"application/x-chat":{"source":"apache","extensions":["chat"]},"application/x-chess-pgn":{"source":"apache","extensions":["pgn"]},"application/x-chrome-extension":{"extensions":["crx"]},"application/x-cocoa":{"source":"nginx","extensions":["cco"]},"application/x-compress":{"source":"apache"},"application/x-conference":{"source":"apache","extensions":["nsc"]},"application/x-cpio":{"source":"apache","extensions":["cpio"]},"application/x-csh":{"source":"apache","extensions":["csh"]},"application/x-deb":{"compressible":false},"application/x-debian-package":{"source":"apache","extensions":["deb","udeb"]},"application/x-dgc-compressed":{"source":"apache","extensions":["dgc"]},"application/x-director":{"source":"apache","extensions":["dir","dcr","dxr","cst","cct","cxt","w3d","fgd","swa"]},"application/x-doom":{"source":"apache","extensions":["wad"]},"application/x-dtbncx+xml":{"source":"apache","compressible":true,"extensions":["ncx"]},"application/x-dtbook+xml":{"source":"apache","compressible":true,"extensions":["dtb"]},"application/x-dtbresource+xml":{"source":"apache","compressible":true,"extensions":["res"]},"application/x-dvi":{"source":"apache","compressible":false,"extensions":["dvi"]},"application/x-envoy":{"source":"apache","extensions":["evy"]},"application/x-eva":{"source":"apache","extensions":["eva"]},"application/x-font-bdf":{"source":"apache","extensions":["bdf"]},"application/x-font-dos":{"source":"apache"},"application/x-font-framemaker":{"source":"apache"},"application/x-font-ghostscript":{"source":"apache","extensions":["gsf"]},"application/x-font-libgrx":{"source":"apache"},"application/x-font-linux-psf":{"source":"apache","extensions":["psf"]},"application/x-font-pcf":{"source":"apache","extensions":["pcf"]},"application/x-font-snf":{"source":"apache","extensions":["snf"]},"application/x-font-speedo":{"source":"apache"},"application/x-font-sunos-news":{"source":"apache"},"application/x-font-type1":{"source":"apache","extensions":["pfa","pfb","pfm","afm"]},"application/x-font-vfont":{"source":"apache"},"application/x-freearc":{"source":"apache","extensions":["arc"]},"application/x-futuresplash":{"source":"apache","extensions":["spl"]},"application/x-gca-compressed":{"source":"apache","extensions":["gca"]},"application/x-glulx":{"source":"apache","extensions":["ulx"]},"application/x-gnumeric":{"source":"apache","extensions":["gnumeric"]},"application/x-gramps-xml":{"source":"apache","extensions":["gramps"]},"application/x-gtar":{"source":"apache","extensions":["gtar"]},"application/x-gzip":{"source":"apache"},"application/x-hdf":{"source":"apache","extensions":["hdf"]},"application/x-httpd-php":{"compressible":true,"extensions":["php"]},"application/x-install-instructions":{"source":"apache","extensions":["install"]},"application/x-iso9660-image":{"source":"apache","extensions":["iso"]},"application/x-java-archive-diff":{"source":"nginx","extensions":["jardiff"]},"application/x-java-jnlp-file":{"source":"apache","compressible":false,"extensions":["jnlp"]},"application/x-javascript":{"compressible":true},"application/x-keepass2":{"extensions":["kdbx"]},"application/x-latex":{"source":"apache","compressible":false,"extensions":["latex"]},"application/x-lua-bytecode":{"extensions":["luac"]},"application/x-lzh-compressed":{"source":"apache","extensions":["lzh","lha"]},"application/x-makeself":{"source":"nginx","extensions":["run"]},"application/x-mie":{"source":"apache","extensions":["mie"]},"application/x-mobipocket-ebook":{"source":"apache","extensions":["prc","mobi"]},"application/x-mpegurl":{"compressible":false},"application/x-ms-application":{"source":"apache","extensions":["application"]},"application/x-ms-shortcut":{"source":"apache","extensions":["lnk"]},"application/x-ms-wmd":{"source":"apache","extensions":["wmd"]},"application/x-ms-wmz":{"source":"apache","extensions":["wmz"]},"application/x-ms-xbap":{"source":"apache","extensions":["xbap"]},"application/x-msaccess":{"source":"apache","extensions":["mdb"]},"application/x-msbinder":{"source":"apache","extensions":["obd"]},"application/x-mscardfile":{"source":"apache","extensions":["crd"]},"application/x-msclip":{"source":"apache","extensions":["clp"]},"application/x-msdos-program":{"extensions":["exe"]},"application/x-msdownload":{"source":"apache","extensions":["exe","dll","com","bat","msi"]},"application/x-msmediaview":{"source":"apache","extensions":["mvb","m13","m14"]},"application/x-msmetafile":{"source":"apache","extensions":["wmf","wmz","emf","emz"]},"application/x-msmoney":{"source":"apache","extensions":["mny"]},"application/x-mspublisher":{"source":"apache","extensions":["pub"]},"application/x-msschedule":{"source":"apache","extensions":["scd"]},"application/x-msterminal":{"source":"apache","extensions":["trm"]},"application/x-mswrite":{"source":"apache","extensions":["wri"]},"application/x-netcdf":{"source":"apache","extensions":["nc","cdf"]},"application/x-ns-proxy-autoconfig":{"compressible":true,"extensions":["pac"]},"application/x-nzb":{"source":"apache","extensions":["nzb"]},"application/x-perl":{"source":"nginx","extensions":["pl","pm"]},"application/x-pilot":{"source":"nginx","extensions":["prc","pdb"]},"application/x-pkcs12":{"source":"apache","compressible":false,"extensions":["p12","pfx"]},"application/x-pkcs7-certificates":{"source":"apache","extensions":["p7b","spc"]},"application/x-pkcs7-certreqresp":{"source":"apache","extensions":["p7r"]},"application/x-pki-message":{"source":"iana"},"application/x-rar-compressed":{"source":"apache","compressible":false,"extensions":["rar"]},"application/x-redhat-package-manager":{"source":"nginx","extensions":["rpm"]},"application/x-research-info-systems":{"source":"apache","extensions":["ris"]},"application/x-sea":{"source":"nginx","extensions":["sea"]},"application/x-sh":{"source":"apache","compressible":true,"extensions":["sh"]},"application/x-shar":{"source":"apache","extensions":["shar"]},"application/x-shockwave-flash":{"source":"apache","compressible":false,"extensions":["swf"]},"application/x-silverlight-app":{"source":"apache","extensions":["xap"]},"application/x-sql":{"source":"apache","extensions":["sql"]},"application/x-stuffit":{"source":"apache","compressible":false,"extensions":["sit"]},"application/x-stuffitx":{"source":"apache","extensions":["sitx"]},"application/x-subrip":{"source":"apache","extensions":["srt"]},"application/x-sv4cpio":{"source":"apache","extensions":["sv4cpio"]},"application/x-sv4crc":{"source":"apache","extensions":["sv4crc"]},"application/x-t3vm-image":{"source":"apache","extensions":["t3"]},"application/x-tads":{"source":"apache","extensions":["gam"]},"application/x-tar":{"source":"apache","compressible":true,"extensions":["tar"]},"application/x-tcl":{"source":"apache","extensions":["tcl","tk"]},"application/x-tex":{"source":"apache","extensions":["tex"]},"application/x-tex-tfm":{"source":"apache","extensions":["tfm"]},"application/x-texinfo":{"source":"apache","extensions":["texinfo","texi"]},"application/x-tgif":{"source":"apache","extensions":["obj"]},"application/x-ustar":{"source":"apache","extensions":["ustar"]},"application/x-virtualbox-hdd":{"compressible":true,"extensions":["hdd"]},"application/x-virtualbox-ova":{"compressible":true,"extensions":["ova"]},"application/x-virtualbox-ovf":{"compressible":true,"extensions":["ovf"]},"application/x-virtualbox-vbox":{"compressible":true,"extensions":["vbox"]},"application/x-virtualbox-vbox-extpack":{"compressible":false,"extensions":["vbox-extpack"]},"application/x-virtualbox-vdi":{"compressible":true,"extensions":["vdi"]},"application/x-virtualbox-vhd":{"compressible":true,"extensions":["vhd"]},"application/x-virtualbox-vmdk":{"compressible":true,"extensions":["vmdk"]},"application/x-wais-source":{"source":"apache","extensions":["src"]},"application/x-web-app-manifest+json":{"compressible":true,"extensions":["webapp"]},"application/x-www-form-urlencoded":{"source":"iana","compressible":true},"application/x-x509-ca-cert":{"source":"iana","extensions":["der","crt","pem"]},"application/x-x509-ca-ra-cert":{"source":"iana"},"application/x-x509-next-ca-cert":{"source":"iana"},"application/x-xfig":{"source":"apache","extensions":["fig"]},"application/x-xliff+xml":{"source":"apache","compressible":true,"extensions":["xlf"]},"application/x-xpinstall":{"source":"apache","compressible":false,"extensions":["xpi"]},"application/x-xz":{"source":"apache","extensions":["xz"]},"application/x-zmachine":{"source":"apache","extensions":["z1","z2","z3","z4","z5","z6","z7","z8"]},"application/x400-bp":{"source":"iana"},"application/xacml+xml":{"source":"iana","compressible":true},"application/xaml+xml":{"source":"apache","compressible":true,"extensions":["xaml"]},"application/xcap-att+xml":{"source":"iana","compressible":true,"extensions":["xav"]},"application/xcap-caps+xml":{"source":"iana","compressible":true,"extensions":["xca"]},"application/xcap-diff+xml":{"source":"iana","compressible":true,"extensions":["xdf"]},"application/xcap-el+xml":{"source":"iana","compressible":true,"extensions":["xel"]},"application/xcap-error+xml":{"source":"iana","compressible":true},"application/xcap-ns+xml":{"source":"iana","compressible":true,"extensions":["xns"]},"application/xcon-conference-info+xml":{"source":"iana","compressible":true},"application/xcon-conference-info-diff+xml":{"source":"iana","compressible":true},"application/xenc+xml":{"source":"iana","compressible":true,"extensions":["xenc"]},"application/xhtml+xml":{"source":"iana","compressible":true,"extensions":["xhtml","xht"]},"application/xhtml-voice+xml":{"source":"apache","compressible":true},"application/xliff+xml":{"source":"iana","compressible":true,"extensions":["xlf"]},"application/xml":{"source":"iana","compressible":true,"extensions":["xml","xsl","xsd","rng"]},"application/xml-dtd":{"source":"iana","compressible":true,"extensions":["dtd"]},"application/xml-external-parsed-entity":{"source":"iana"},"application/xml-patch+xml":{"source":"iana","compressible":true},"application/xmpp+xml":{"source":"iana","compressible":true},"application/xop+xml":{"source":"iana","compressible":true,"extensions":["xop"]},"application/xproc+xml":{"source":"apache","compressible":true,"extensions":["xpl"]},"application/xslt+xml":{"source":"iana","compressible":true,"extensions":["xsl","xslt"]},"application/xspf+xml":{"source":"apache","compressible":true,"extensions":["xspf"]},"application/xv+xml":{"source":"iana","compressible":true,"extensions":["mxml","xhvml","xvml","xvm"]},"application/yang":{"source":"iana","extensions":["yang"]},"application/yang-data+json":{"source":"iana","compressible":true},"application/yang-data+xml":{"source":"iana","compressible":true},"application/yang-patch+json":{"source":"iana","compressible":true},"application/yang-patch+xml":{"source":"iana","compressible":true},"application/yin+xml":{"source":"iana","compressible":true,"extensions":["yin"]},"application/zip":{"source":"iana","compressible":false,"extensions":["zip"]},"application/zlib":{"source":"iana"},"application/zstd":{"source":"iana"},"audio/1d-interleaved-parityfec":{"source":"iana"},"audio/32kadpcm":{"source":"iana"},"audio/3gpp":{"source":"iana","compressible":false,"extensions":["3gpp"]},"audio/3gpp2":{"source":"iana"},"audio/aac":{"source":"iana"},"audio/ac3":{"source":"iana"},"audio/adpcm":{"source":"apache","extensions":["adp"]},"audio/amr":{"source":"iana","extensions":["amr"]},"audio/amr-wb":{"source":"iana"},"audio/amr-wb+":{"source":"iana"},"audio/aptx":{"source":"iana"},"audio/asc":{"source":"iana"},"audio/atrac-advanced-lossless":{"source":"iana"},"audio/atrac-x":{"source":"iana"},"audio/atrac3":{"source":"iana"},"audio/basic":{"source":"iana","compressible":false,"extensions":["au","snd"]},"audio/bv16":{"source":"iana"},"audio/bv32":{"source":"iana"},"audio/clearmode":{"source":"iana"},"audio/cn":{"source":"iana"},"audio/dat12":{"source":"iana"},"audio/dls":{"source":"iana"},"audio/dsr-es201108":{"source":"iana"},"audio/dsr-es202050":{"source":"iana"},"audio/dsr-es202211":{"source":"iana"},"audio/dsr-es202212":{"source":"iana"},"audio/dv":{"source":"iana"},"audio/dvi4":{"source":"iana"},"audio/eac3":{"source":"iana"},"audio/encaprtp":{"source":"iana"},"audio/evrc":{"source":"iana"},"audio/evrc-qcp":{"source":"iana"},"audio/evrc0":{"source":"iana"},"audio/evrc1":{"source":"iana"},"audio/evrcb":{"source":"iana"},"audio/evrcb0":{"source":"iana"},"audio/evrcb1":{"source":"iana"},"audio/evrcnw":{"source":"iana"},"audio/evrcnw0":{"source":"iana"},"audio/evrcnw1":{"source":"iana"},"audio/evrcwb":{"source":"iana"},"audio/evrcwb0":{"source":"iana"},"audio/evrcwb1":{"source":"iana"},"audio/evs":{"source":"iana"},"audio/flexfec":{"source":"iana"},"audio/fwdred":{"source":"iana"},"audio/g711-0":{"source":"iana"},"audio/g719":{"source":"iana"},"audio/g722":{"source":"iana"},"audio/g7221":{"source":"iana"},"audio/g723":{"source":"iana"},"audio/g726-16":{"source":"iana"},"audio/g726-24":{"source":"iana"},"audio/g726-32":{"source":"iana"},"audio/g726-40":{"source":"iana"},"audio/g728":{"source":"iana"},"audio/g729":{"source":"iana"},"audio/g7291":{"source":"iana"},"audio/g729d":{"source":"iana"},"audio/g729e":{"source":"iana"},"audio/gsm":{"source":"iana"},"audio/gsm-efr":{"source":"iana"},"audio/gsm-hr-08":{"source":"iana"},"audio/ilbc":{"source":"iana"},"audio/ip-mr_v2.5":{"source":"iana"},"audio/isac":{"source":"apache"},"audio/l16":{"source":"iana"},"audio/l20":{"source":"iana"},"audio/l24":{"source":"iana","compressible":false},"audio/l8":{"source":"iana"},"audio/lpc":{"source":"iana"},"audio/melp":{"source":"iana"},"audio/melp1200":{"source":"iana"},"audio/melp2400":{"source":"iana"},"audio/melp600":{"source":"iana"},"audio/mhas":{"source":"iana"},"audio/midi":{"source":"apache","extensions":["mid","midi","kar","rmi"]},"audio/mobile-xmf":{"source":"iana","extensions":["mxmf"]},"audio/mp3":{"compressible":false,"extensions":["mp3"]},"audio/mp4":{"source":"iana","compressible":false,"extensions":["m4a","mp4a"]},"audio/mp4a-latm":{"source":"iana"},"audio/mpa":{"source":"iana"},"audio/mpa-robust":{"source":"iana"},"audio/mpeg":{"source":"iana","compressible":false,"extensions":["mpga","mp2","mp2a","mp3","m2a","m3a"]},"audio/mpeg4-generic":{"source":"iana"},"audio/musepack":{"source":"apache"},"audio/ogg":{"source":"iana","compressible":false,"extensions":["oga","ogg","spx","opus"]},"audio/opus":{"source":"iana"},"audio/parityfec":{"source":"iana"},"audio/pcma":{"source":"iana"},"audio/pcma-wb":{"source":"iana"},"audio/pcmu":{"source":"iana"},"audio/pcmu-wb":{"source":"iana"},"audio/prs.sid":{"source":"iana"},"audio/qcelp":{"source":"iana"},"audio/raptorfec":{"source":"iana"},"audio/red":{"source":"iana"},"audio/rtp-enc-aescm128":{"source":"iana"},"audio/rtp-midi":{"source":"iana"},"audio/rtploopback":{"source":"iana"},"audio/rtx":{"source":"iana"},"audio/s3m":{"source":"apache","extensions":["s3m"]},"audio/scip":{"source":"iana"},"audio/silk":{"source":"apache","extensions":["sil"]},"audio/smv":{"source":"iana"},"audio/smv-qcp":{"source":"iana"},"audio/smv0":{"source":"iana"},"audio/sofa":{"source":"iana"},"audio/sp-midi":{"source":"iana"},"audio/speex":{"source":"iana"},"audio/t140c":{"source":"iana"},"audio/t38":{"source":"iana"},"audio/telephone-event":{"source":"iana"},"audio/tetra_acelp":{"source":"iana"},"audio/tetra_acelp_bb":{"source":"iana"},"audio/tone":{"source":"iana"},"audio/tsvcis":{"source":"iana"},"audio/uemclip":{"source":"iana"},"audio/ulpfec":{"source":"iana"},"audio/usac":{"source":"iana"},"audio/vdvi":{"source":"iana"},"audio/vmr-wb":{"source":"iana"},"audio/vnd.3gpp.iufp":{"source":"iana"},"audio/vnd.4sb":{"source":"iana"},"audio/vnd.audiokoz":{"source":"iana"},"audio/vnd.celp":{"source":"iana"},"audio/vnd.cisco.nse":{"source":"iana"},"audio/vnd.cmles.radio-events":{"source":"iana"},"audio/vnd.cns.anp1":{"source":"iana"},"audio/vnd.cns.inf1":{"source":"iana"},"audio/vnd.dece.audio":{"source":"iana","extensions":["uva","uvva"]},"audio/vnd.digital-winds":{"source":"iana","extensions":["eol"]},"audio/vnd.dlna.adts":{"source":"iana"},"audio/vnd.dolby.heaac.1":{"source":"iana"},"audio/vnd.dolby.heaac.2":{"source":"iana"},"audio/vnd.dolby.mlp":{"source":"iana"},"audio/vnd.dolby.mps":{"source":"iana"},"audio/vnd.dolby.pl2":{"source":"iana"},"audio/vnd.dolby.pl2x":{"source":"iana"},"audio/vnd.dolby.pl2z":{"source":"iana"},"audio/vnd.dolby.pulse.1":{"source":"iana"},"audio/vnd.dra":{"source":"iana","extensions":["dra"]},"audio/vnd.dts":{"source":"iana","extensions":["dts"]},"audio/vnd.dts.hd":{"source":"iana","extensions":["dtshd"]},"audio/vnd.dts.uhd":{"source":"iana"},"audio/vnd.dvb.file":{"source":"iana"},"audio/vnd.everad.plj":{"source":"iana"},"audio/vnd.hns.audio":{"source":"iana"},"audio/vnd.lucent.voice":{"source":"iana","extensions":["lvp"]},"audio/vnd.ms-playready.media.pya":{"source":"iana","extensions":["pya"]},"audio/vnd.nokia.mobile-xmf":{"source":"iana"},"audio/vnd.nortel.vbk":{"source":"iana"},"audio/vnd.nuera.ecelp4800":{"source":"iana","extensions":["ecelp4800"]},"audio/vnd.nuera.ecelp7470":{"source":"iana","extensions":["ecelp7470"]},"audio/vnd.nuera.ecelp9600":{"source":"iana","extensions":["ecelp9600"]},"audio/vnd.octel.sbc":{"source":"iana"},"audio/vnd.presonus.multitrack":{"source":"iana"},"audio/vnd.qcelp":{"source":"iana"},"audio/vnd.rhetorex.32kadpcm":{"source":"iana"},"audio/vnd.rip":{"source":"iana","extensions":["rip"]},"audio/vnd.rn-realaudio":{"compressible":false},"audio/vnd.sealedmedia.softseal.mpeg":{"source":"iana"},"audio/vnd.vmx.cvsd":{"source":"iana"},"audio/vnd.wave":{"compressible":false},"audio/vorbis":{"source":"iana","compressible":false},"audio/vorbis-config":{"source":"iana"},"audio/wav":{"compressible":false,"extensions":["wav"]},"audio/wave":{"compressible":false,"extensions":["wav"]},"audio/webm":{"source":"apache","compressible":false,"extensions":["weba"]},"audio/x-aac":{"source":"apache","compressible":false,"extensions":["aac"]},"audio/x-aiff":{"source":"apache","extensions":["aif","aiff","aifc"]},"audio/x-caf":{"source":"apache","compressible":false,"extensions":["caf"]},"audio/x-flac":{"source":"apache","extensions":["flac"]},"audio/x-m4a":{"source":"nginx","extensions":["m4a"]},"audio/x-matroska":{"source":"apache","extensions":["mka"]},"audio/x-mpegurl":{"source":"apache","extensions":["m3u"]},"audio/x-ms-wax":{"source":"apache","extensions":["wax"]},"audio/x-ms-wma":{"source":"apache","extensions":["wma"]},"audio/x-pn-realaudio":{"source":"apache","extensions":["ram","ra"]},"audio/x-pn-realaudio-plugin":{"source":"apache","extensions":["rmp"]},"audio/x-realaudio":{"source":"nginx","extensions":["ra"]},"audio/x-tta":{"source":"apache"},"audio/x-wav":{"source":"apache","extensions":["wav"]},"audio/xm":{"source":"apache","extensions":["xm"]},"chemical/x-cdx":{"source":"apache","extensions":["cdx"]},"chemical/x-cif":{"source":"apache","extensions":["cif"]},"chemical/x-cmdf":{"source":"apache","extensions":["cmdf"]},"chemical/x-cml":{"source":"apache","extensions":["cml"]},"chemical/x-csml":{"source":"apache","extensions":["csml"]},"chemical/x-pdb":{"source":"apache"},"chemical/x-xyz":{"source":"apache","extensions":["xyz"]},"font/collection":{"source":"iana","extensions":["ttc"]},"font/otf":{"source":"iana","compressible":true,"extensions":["otf"]},"font/sfnt":{"source":"iana"},"font/ttf":{"source":"iana","compressible":true,"extensions":["ttf"]},"font/woff":{"source":"iana","extensions":["woff"]},"font/woff2":{"source":"iana","extensions":["woff2"]},"image/aces":{"source":"iana","extensions":["exr"]},"image/apng":{"compressible":false,"extensions":["apng"]},"image/avci":{"source":"iana"},"image/avcs":{"source":"iana"},"image/avif":{"source":"iana","compressible":false,"extensions":["avif"]},"image/bmp":{"source":"iana","compressible":true,"extensions":["bmp"]},"image/cgm":{"source":"iana","extensions":["cgm"]},"image/dicom-rle":{"source":"iana","extensions":["drle"]},"image/emf":{"source":"iana","extensions":["emf"]},"image/fits":{"source":"iana","extensions":["fits"]},"image/g3fax":{"source":"iana","extensions":["g3"]},"image/gif":{"source":"iana","compressible":false,"extensions":["gif"]},"image/heic":{"source":"iana","extensions":["heic"]},"image/heic-sequence":{"source":"iana","extensions":["heics"]},"image/heif":{"source":"iana","extensions":["heif"]},"image/heif-sequence":{"source":"iana","extensions":["heifs"]},"image/hej2k":{"source":"iana","extensions":["hej2"]},"image/hsj2":{"source":"iana","extensions":["hsj2"]},"image/ief":{"source":"iana","extensions":["ief"]},"image/jls":{"source":"iana","extensions":["jls"]},"image/jp2":{"source":"iana","compressible":false,"extensions":["jp2","jpg2"]},"image/jpeg":{"source":"iana","compressible":false,"extensions":["jpeg","jpg","jpe"]},"image/jph":{"source":"iana","extensions":["jph"]},"image/jphc":{"source":"iana","extensions":["jhc"]},"image/jpm":{"source":"iana","compressible":false,"extensions":["jpm"]},"image/jpx":{"source":"iana","compressible":false,"extensions":["jpx","jpf"]},"image/jxr":{"source":"iana","extensions":["jxr"]},"image/jxra":{"source":"iana","extensions":["jxra"]},"image/jxrs":{"source":"iana","extensions":["jxrs"]},"image/jxs":{"source":"iana","extensions":["jxs"]},"image/jxsc":{"source":"iana","extensions":["jxsc"]},"image/jxsi":{"source":"iana","extensions":["jxsi"]},"image/jxss":{"source":"iana","extensions":["jxss"]},"image/ktx":{"source":"iana","extensions":["ktx"]},"image/ktx2":{"source":"iana","extensions":["ktx2"]},"image/naplps":{"source":"iana"},"image/pjpeg":{"compressible":false},"image/png":{"source":"iana","compressible":false,"extensions":["png"]},"image/prs.btif":{"source":"iana","extensions":["btif"]},"image/prs.pti":{"source":"iana","extensions":["pti"]},"image/pwg-raster":{"source":"iana"},"image/sgi":{"source":"apache","extensions":["sgi"]},"image/svg+xml":{"source":"iana","compressible":true,"extensions":["svg","svgz"]},"image/t38":{"source":"iana","extensions":["t38"]},"image/tiff":{"source":"iana","compressible":false,"extensions":["tif","tiff"]},"image/tiff-fx":{"source":"iana","extensions":["tfx"]},"image/vnd.adobe.photoshop":{"source":"iana","compressible":true,"extensions":["psd"]},"image/vnd.airzip.accelerator.azv":{"source":"iana","extensions":["azv"]},"image/vnd.cns.inf2":{"source":"iana"},"image/vnd.dece.graphic":{"source":"iana","extensions":["uvi","uvvi","uvg","uvvg"]},"image/vnd.djvu":{"source":"iana","extensions":["djvu","djv"]},"image/vnd.dvb.subtitle":{"source":"iana","extensions":["sub"]},"image/vnd.dwg":{"source":"iana","extensions":["dwg"]},"image/vnd.dxf":{"source":"iana","extensions":["dxf"]},"image/vnd.fastbidsheet":{"source":"iana","extensions":["fbs"]},"image/vnd.fpx":{"source":"iana","extensions":["fpx"]},"image/vnd.fst":{"source":"iana","extensions":["fst"]},"image/vnd.fujixerox.edmics-mmr":{"source":"iana","extensions":["mmr"]},"image/vnd.fujixerox.edmics-rlc":{"source":"iana","extensions":["rlc"]},"image/vnd.globalgraphics.pgb":{"source":"iana"},"image/vnd.microsoft.icon":{"source":"iana","extensions":["ico"]},"image/vnd.mix":{"source":"iana"},"image/vnd.mozilla.apng":{"source":"iana"},"image/vnd.ms-dds":{"extensions":["dds"]},"image/vnd.ms-modi":{"source":"iana","extensions":["mdi"]},"image/vnd.ms-photo":{"source":"apache","extensions":["wdp"]},"image/vnd.net-fpx":{"source":"iana","extensions":["npx"]},"image/vnd.pco.b16":{"source":"iana","extensions":["b16"]},"image/vnd.radiance":{"source":"iana"},"image/vnd.sealed.png":{"source":"iana"},"image/vnd.sealedmedia.softseal.gif":{"source":"iana"},"image/vnd.sealedmedia.softseal.jpg":{"source":"iana"},"image/vnd.svf":{"source":"iana"},"image/vnd.tencent.tap":{"source":"iana","extensions":["tap"]},"image/vnd.valve.source.texture":{"source":"iana","extensions":["vtf"]},"image/vnd.wap.wbmp":{"source":"iana","extensions":["wbmp"]},"image/vnd.xiff":{"source":"iana","extensions":["xif"]},"image/vnd.zbrush.pcx":{"source":"iana","extensions":["pcx"]},"image/webp":{"source":"apache","extensions":["webp"]},"image/wmf":{"source":"iana","extensions":["wmf"]},"image/x-3ds":{"source":"apache","extensions":["3ds"]},"image/x-cmu-raster":{"source":"apache","extensions":["ras"]},"image/x-cmx":{"source":"apache","extensions":["cmx"]},"image/x-freehand":{"source":"apache","extensions":["fh","fhc","fh4","fh5","fh7"]},"image/x-icon":{"source":"apache","compressible":true,"extensions":["ico"]},"image/x-jng":{"source":"nginx","extensions":["jng"]},"image/x-mrsid-image":{"source":"apache","extensions":["sid"]},"image/x-ms-bmp":{"source":"nginx","compressible":true,"extensions":["bmp"]},"image/x-pcx":{"source":"apache","extensions":["pcx"]},"image/x-pict":{"source":"apache","extensions":["pic","pct"]},"image/x-portable-anymap":{"source":"apache","extensions":["pnm"]},"image/x-portable-bitmap":{"source":"apache","extensions":["pbm"]},"image/x-portable-graymap":{"source":"apache","extensions":["pgm"]},"image/x-portable-pixmap":{"source":"apache","extensions":["ppm"]},"image/x-rgb":{"source":"apache","extensions":["rgb"]},"image/x-tga":{"source":"apache","extensions":["tga"]},"image/x-xbitmap":{"source":"apache","extensions":["xbm"]},"image/x-xcf":{"compressible":false},"image/x-xpixmap":{"source":"apache","extensions":["xpm"]},"image/x-xwindowdump":{"source":"apache","extensions":["xwd"]},"message/cpim":{"source":"iana"},"message/delivery-status":{"source":"iana"},"message/disposition-notification":{"source":"iana","extensions":["disposition-notification"]},"message/external-body":{"source":"iana"},"message/feedback-report":{"source":"iana"},"message/global":{"source":"iana","extensions":["u8msg"]},"message/global-delivery-status":{"source":"iana","extensions":["u8dsn"]},"message/global-disposition-notification":{"source":"iana","extensions":["u8mdn"]},"message/global-headers":{"source":"iana","extensions":["u8hdr"]},"message/http":{"source":"iana","compressible":false},"message/imdn+xml":{"source":"iana","compressible":true},"message/news":{"source":"iana"},"message/partial":{"source":"iana","compressible":false},"message/rfc822":{"source":"iana","compressible":true,"extensions":["eml","mime"]},"message/s-http":{"source":"iana"},"message/sip":{"source":"iana"},"message/sipfrag":{"source":"iana"},"message/tracking-status":{"source":"iana"},"message/vnd.si.simp":{"source":"iana"},"message/vnd.wfa.wsc":{"source":"iana","extensions":["wsc"]},"model/3mf":{"source":"iana","extensions":["3mf"]},"model/e57":{"source":"iana"},"model/gltf+json":{"source":"iana","compressible":true,"extensions":["gltf"]},"model/gltf-binary":{"source":"iana","compressible":true,"extensions":["glb"]},"model/iges":{"source":"iana","compressible":false,"extensions":["igs","iges"]},"model/mesh":{"source":"iana","compressible":false,"extensions":["msh","mesh","silo"]},"model/mtl":{"source":"iana","extensions":["mtl"]},"model/obj":{"source":"iana","extensions":["obj"]},"model/stl":{"source":"iana","extensions":["stl"]},"model/vnd.collada+xml":{"source":"iana","compressible":true,"extensions":["dae"]},"model/vnd.dwf":{"source":"iana","extensions":["dwf"]},"model/vnd.flatland.3dml":{"source":"iana"},"model/vnd.gdl":{"source":"iana","extensions":["gdl"]},"model/vnd.gs-gdl":{"source":"apache"},"model/vnd.gs.gdl":{"source":"iana"},"model/vnd.gtw":{"source":"iana","extensions":["gtw"]},"model/vnd.moml+xml":{"source":"iana","compressible":true},"model/vnd.mts":{"source":"iana","extensions":["mts"]},"model/vnd.opengex":{"source":"iana","extensions":["ogex"]},"model/vnd.parasolid.transmit.binary":{"source":"iana","extensions":["x_b"]},"model/vnd.parasolid.transmit.text":{"source":"iana","extensions":["x_t"]},"model/vnd.rosette.annotated-data-model":{"source":"iana"},"model/vnd.sap.vds":{"source":"iana","extensions":["vds"]},"model/vnd.usdz+zip":{"source":"iana","compressible":false,"extensions":["usdz"]},"model/vnd.valve.source.compiled-map":{"source":"iana","extensions":["bsp"]},"model/vnd.vtu":{"source":"iana","extensions":["vtu"]},"model/vrml":{"source":"iana","compressible":false,"extensions":["wrl","vrml"]},"model/x3d+binary":{"source":"apache","compressible":false,"extensions":["x3db","x3dbz"]},"model/x3d+fastinfoset":{"source":"iana","extensions":["x3db"]},"model/x3d+vrml":{"source":"apache","compressible":false,"extensions":["x3dv","x3dvz"]},"model/x3d+xml":{"source":"iana","compressible":true,"extensions":["x3d","x3dz"]},"model/x3d-vrml":{"source":"iana","extensions":["x3dv"]},"multipart/alternative":{"source":"iana","compressible":false},"multipart/appledouble":{"source":"iana"},"multipart/byteranges":{"source":"iana"},"multipart/digest":{"source":"iana"},"multipart/encrypted":{"source":"iana","compressible":false},"multipart/form-data":{"source":"iana","compressible":false},"multipart/header-set":{"source":"iana"},"multipart/mixed":{"source":"iana"},"multipart/multilingual":{"source":"iana"},"multipart/parallel":{"source":"iana"},"multipart/related":{"source":"iana","compressible":false},"multipart/report":{"source":"iana"},"multipart/signed":{"source":"iana","compressible":false},"multipart/vnd.bint.med-plus":{"source":"iana"},"multipart/voice-message":{"source":"iana"},"multipart/x-mixed-replace":{"source":"iana"},"text/1d-interleaved-parityfec":{"source":"iana"},"text/cache-manifest":{"source":"iana","compressible":true,"extensions":["appcache","manifest"]},"text/calendar":{"source":"iana","extensions":["ics","ifb"]},"text/calender":{"compressible":true},"text/cmd":{"compressible":true},"text/coffeescript":{"extensions":["coffee","litcoffee"]},"text/cql":{"source":"iana"},"text/cql-expression":{"source":"iana"},"text/cql-identifier":{"source":"iana"},"text/css":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["css"]},"text/csv":{"source":"iana","compressible":true,"extensions":["csv"]},"text/csv-schema":{"source":"iana"},"text/directory":{"source":"iana"},"text/dns":{"source":"iana"},"text/ecmascript":{"source":"iana"},"text/encaprtp":{"source":"iana"},"text/enriched":{"source":"iana"},"text/fhirpath":{"source":"iana"},"text/flexfec":{"source":"iana"},"text/fwdred":{"source":"iana"},"text/gff3":{"source":"iana"},"text/grammar-ref-list":{"source":"iana"},"text/html":{"source":"iana","compressible":true,"extensions":["html","htm","shtml"]},"text/jade":{"extensions":["jade"]},"text/javascript":{"source":"iana","compressible":true},"text/jcr-cnd":{"source":"iana"},"text/jsx":{"compressible":true,"extensions":["jsx"]},"text/less":{"compressible":true,"extensions":["less"]},"text/markdown":{"source":"iana","compressible":true,"extensions":["markdown","md"]},"text/mathml":{"source":"nginx","extensions":["mml"]},"text/mdx":{"compressible":true,"extensions":["mdx"]},"text/mizar":{"source":"iana"},"text/n3":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["n3"]},"text/parameters":{"source":"iana","charset":"UTF-8"},"text/parityfec":{"source":"iana"},"text/plain":{"source":"iana","compressible":true,"extensions":["txt","text","conf","def","list","log","in","ini"]},"text/provenance-notation":{"source":"iana","charset":"UTF-8"},"text/prs.fallenstein.rst":{"source":"iana"},"text/prs.lines.tag":{"source":"iana","extensions":["dsc"]},"text/prs.prop.logic":{"source":"iana"},"text/raptorfec":{"source":"iana"},"text/red":{"source":"iana"},"text/rfc822-headers":{"source":"iana"},"text/richtext":{"source":"iana","compressible":true,"extensions":["rtx"]},"text/rtf":{"source":"iana","compressible":true,"extensions":["rtf"]},"text/rtp-enc-aescm128":{"source":"iana"},"text/rtploopback":{"source":"iana"},"text/rtx":{"source":"iana"},"text/sgml":{"source":"iana","extensions":["sgml","sgm"]},"text/shaclc":{"source":"iana"},"text/shex":{"extensions":["shex"]},"text/slim":{"extensions":["slim","slm"]},"text/spdx":{"source":"iana","extensions":["spdx"]},"text/strings":{"source":"iana"},"text/stylus":{"extensions":["stylus","styl"]},"text/t140":{"source":"iana"},"text/tab-separated-values":{"source":"iana","compressible":true,"extensions":["tsv"]},"text/troff":{"source":"iana","extensions":["t","tr","roff","man","me","ms"]},"text/turtle":{"source":"iana","charset":"UTF-8","extensions":["ttl"]},"text/ulpfec":{"source":"iana"},"text/uri-list":{"source":"iana","compressible":true,"extensions":["uri","uris","urls"]},"text/vcard":{"source":"iana","compressible":true,"extensions":["vcard"]},"text/vnd.a":{"source":"iana"},"text/vnd.abc":{"source":"iana"},"text/vnd.ascii-art":{"source":"iana"},"text/vnd.curl":{"source":"iana","extensions":["curl"]},"text/vnd.curl.dcurl":{"source":"apache","extensions":["dcurl"]},"text/vnd.curl.mcurl":{"source":"apache","extensions":["mcurl"]},"text/vnd.curl.scurl":{"source":"apache","extensions":["scurl"]},"text/vnd.debian.copyright":{"source":"iana","charset":"UTF-8"},"text/vnd.dmclientscript":{"source":"iana"},"text/vnd.dvb.subtitle":{"source":"iana","extensions":["sub"]},"text/vnd.esmertec.theme-descriptor":{"source":"iana","charset":"UTF-8"},"text/vnd.ficlab.flt":{"source":"iana"},"text/vnd.fly":{"source":"iana","extensions":["fly"]},"text/vnd.fmi.flexstor":{"source":"iana","extensions":["flx"]},"text/vnd.gml":{"source":"iana"},"text/vnd.graphviz":{"source":"iana","extensions":["gv"]},"text/vnd.hans":{"source":"iana"},"text/vnd.hgl":{"source":"iana"},"text/vnd.in3d.3dml":{"source":"iana","extensions":["3dml"]},"text/vnd.in3d.spot":{"source":"iana","extensions":["spot"]},"text/vnd.iptc.newsml":{"source":"iana"},"text/vnd.iptc.nitf":{"source":"iana"},"text/vnd.latex-z":{"source":"iana"},"text/vnd.motorola.reflex":{"source":"iana"},"text/vnd.ms-mediapackage":{"source":"iana"},"text/vnd.net2phone.commcenter.command":{"source":"iana"},"text/vnd.radisys.msml-basic-layout":{"source":"iana"},"text/vnd.senx.warpscript":{"source":"iana"},"text/vnd.si.uricatalogue":{"source":"iana"},"text/vnd.sosi":{"source":"iana"},"text/vnd.sun.j2me.app-descriptor":{"source":"iana","charset":"UTF-8","extensions":["jad"]},"text/vnd.trolltech.linguist":{"source":"iana","charset":"UTF-8"},"text/vnd.wap.si":{"source":"iana"},"text/vnd.wap.sl":{"source":"iana"},"text/vnd.wap.wml":{"source":"iana","extensions":["wml"]},"text/vnd.wap.wmlscript":{"source":"iana","extensions":["wmls"]},"text/vtt":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["vtt"]},"text/x-asm":{"source":"apache","extensions":["s","asm"]},"text/x-c":{"source":"apache","extensions":["c","cc","cxx","cpp","h","hh","dic"]},"text/x-component":{"source":"nginx","extensions":["htc"]},"text/x-fortran":{"source":"apache","extensions":["f","for","f77","f90"]},"text/x-gwt-rpc":{"compressible":true},"text/x-handlebars-template":{"extensions":["hbs"]},"text/x-java-source":{"source":"apache","extensions":["java"]},"text/x-jquery-tmpl":{"compressible":true},"text/x-lua":{"extensions":["lua"]},"text/x-markdown":{"compressible":true,"extensions":["mkd"]},"text/x-nfo":{"source":"apache","extensions":["nfo"]},"text/x-opml":{"source":"apache","extensions":["opml"]},"text/x-org":{"compressible":true,"extensions":["org"]},"text/x-pascal":{"source":"apache","extensions":["p","pas"]},"text/x-processing":{"compressible":true,"extensions":["pde"]},"text/x-sass":{"extensions":["sass"]},"text/x-scss":{"extensions":["scss"]},"text/x-setext":{"source":"apache","extensions":["etx"]},"text/x-sfv":{"source":"apache","extensions":["sfv"]},"text/x-suse-ymp":{"compressible":true,"extensions":["ymp"]},"text/x-uuencode":{"source":"apache","extensions":["uu"]},"text/x-vcalendar":{"source":"apache","extensions":["vcs"]},"text/x-vcard":{"source":"apache","extensions":["vcf"]},"text/xml":{"source":"iana","compressible":true,"extensions":["xml"]},"text/xml-external-parsed-entity":{"source":"iana"},"text/yaml":{"extensions":["yaml","yml"]},"video/1d-interleaved-parityfec":{"source":"iana"},"video/3gpp":{"source":"iana","extensions":["3gp","3gpp"]},"video/3gpp-tt":{"source":"iana"},"video/3gpp2":{"source":"iana","extensions":["3g2"]},"video/av1":{"source":"iana"},"video/bmpeg":{"source":"iana"},"video/bt656":{"source":"iana"},"video/celb":{"source":"iana"},"video/dv":{"source":"iana"},"video/encaprtp":{"source":"iana"},"video/ffv1":{"source":"iana"},"video/flexfec":{"source":"iana"},"video/h261":{"source":"iana","extensions":["h261"]},"video/h263":{"source":"iana","extensions":["h263"]},"video/h263-1998":{"source":"iana"},"video/h263-2000":{"source":"iana"},"video/h264":{"source":"iana","extensions":["h264"]},"video/h264-rcdo":{"source":"iana"},"video/h264-svc":{"source":"iana"},"video/h265":{"source":"iana"},"video/iso.segment":{"source":"iana","extensions":["m4s"]},"video/jpeg":{"source":"iana","extensions":["jpgv"]},"video/jpeg2000":{"source":"iana"},"video/jpm":{"source":"apache","extensions":["jpm","jpgm"]},"video/mj2":{"source":"iana","extensions":["mj2","mjp2"]},"video/mp1s":{"source":"iana"},"video/mp2p":{"source":"iana"},"video/mp2t":{"source":"iana","extensions":["ts"]},"video/mp4":{"source":"iana","compressible":false,"extensions":["mp4","mp4v","mpg4"]},"video/mp4v-es":{"source":"iana"},"video/mpeg":{"source":"iana","compressible":false,"extensions":["mpeg","mpg","mpe","m1v","m2v"]},"video/mpeg4-generic":{"source":"iana"},"video/mpv":{"source":"iana"},"video/nv":{"source":"iana"},"video/ogg":{"source":"iana","compressible":false,"extensions":["ogv"]},"video/parityfec":{"source":"iana"},"video/pointer":{"source":"iana"},"video/quicktime":{"source":"iana","compressible":false,"extensions":["qt","mov"]},"video/raptorfec":{"source":"iana"},"video/raw":{"source":"iana"},"video/rtp-enc-aescm128":{"source":"iana"},"video/rtploopback":{"source":"iana"},"video/rtx":{"source":"iana"},"video/scip":{"source":"iana"},"video/smpte291":{"source":"iana"},"video/smpte292m":{"source":"iana"},"video/ulpfec":{"source":"iana"},"video/vc1":{"source":"iana"},"video/vc2":{"source":"iana"},"video/vnd.cctv":{"source":"iana"},"video/vnd.dece.hd":{"source":"iana","extensions":["uvh","uvvh"]},"video/vnd.dece.mobile":{"source":"iana","extensions":["uvm","uvvm"]},"video/vnd.dece.mp4":{"source":"iana"},"video/vnd.dece.pd":{"source":"iana","extensions":["uvp","uvvp"]},"video/vnd.dece.sd":{"source":"iana","extensions":["uvs","uvvs"]},"video/vnd.dece.video":{"source":"iana","extensions":["uvv","uvvv"]},"video/vnd.directv.mpeg":{"source":"iana"},"video/vnd.directv.mpeg-tts":{"source":"iana"},"video/vnd.dlna.mpeg-tts":{"source":"iana"},"video/vnd.dvb.file":{"source":"iana","extensions":["dvb"]},"video/vnd.fvt":{"source":"iana","extensions":["fvt"]},"video/vnd.hns.video":{"source":"iana"},"video/vnd.iptvforum.1dparityfec-1010":{"source":"iana"},"video/vnd.iptvforum.1dparityfec-2005":{"source":"iana"},"video/vnd.iptvforum.2dparityfec-1010":{"source":"iana"},"video/vnd.iptvforum.2dparityfec-2005":{"source":"iana"},"video/vnd.iptvforum.ttsavc":{"source":"iana"},"video/vnd.iptvforum.ttsmpeg2":{"source":"iana"},"video/vnd.motorola.video":{"source":"iana"},"video/vnd.motorola.videop":{"source":"iana"},"video/vnd.mpegurl":{"source":"iana","extensions":["mxu","m4u"]},"video/vnd.ms-playready.media.pyv":{"source":"iana","extensions":["pyv"]},"video/vnd.nokia.interleaved-multimedia":{"source":"iana"},"video/vnd.nokia.mp4vr":{"source":"iana"},"video/vnd.nokia.videovoip":{"source":"iana"},"video/vnd.objectvideo":{"source":"iana"},"video/vnd.radgamettools.bink":{"source":"iana"},"video/vnd.radgamettools.smacker":{"source":"iana"},"video/vnd.sealed.mpeg1":{"source":"iana"},"video/vnd.sealed.mpeg4":{"source":"iana"},"video/vnd.sealed.swf":{"source":"iana"},"video/vnd.sealedmedia.softseal.mov":{"source":"iana"},"video/vnd.uvvu.mp4":{"source":"iana","extensions":["uvu","uvvu"]},"video/vnd.vivo":{"source":"iana","extensions":["viv"]},"video/vnd.youtube.yt":{"source":"iana"},"video/vp8":{"source":"iana"},"video/webm":{"source":"apache","compressible":false,"extensions":["webm"]},"video/x-f4v":{"source":"apache","extensions":["f4v"]},"video/x-fli":{"source":"apache","extensions":["fli"]},"video/x-flv":{"source":"apache","compressible":false,"extensions":["flv"]},"video/x-m4v":{"source":"apache","extensions":["m4v"]},"video/x-matroska":{"source":"apache","compressible":false,"extensions":["mkv","mk3d","mks"]},"video/x-mng":{"source":"apache","extensions":["mng"]},"video/x-ms-asf":{"source":"apache","extensions":["asf","asx"]},"video/x-ms-vob":{"source":"apache","extensions":["vob"]},"video/x-ms-wm":{"source":"apache","extensions":["wm"]},"video/x-ms-wmv":{"source":"apache","compressible":false,"extensions":["wmv"]},"video/x-ms-wmx":{"source":"apache","extensions":["wmx"]},"video/x-ms-wvx":{"source":"apache","extensions":["wvx"]},"video/x-msvideo":{"source":"apache","extensions":["avi"]},"video/x-sgi-movie":{"source":"apache","extensions":["movie"]},"video/x-smv":{"source":"apache","extensions":["smv"]},"x-conference/x-cooltalk":{"source":"apache","extensions":["ice"]},"x-shader/x-fragment":{"compressible":true},"x-shader/x-vertex":{"compressible":true}}');

/***/ }),

/***/ "./node_modules/mime-db/index.js":
/*!***************************************!*\
  !*** ./node_modules/mime-db/index.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * mime-db
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */

/**
 * Module exports.
 */

module.exports = __webpack_require__(/*! ./db.json */ "./node_modules/mime-db/db.json")


/***/ }),

/***/ "./node_modules/mimoza/index.js":
/*!**************************************!*\
  !*** ./node_modules/mimoza/index.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";



// mime files data
var db = __webpack_require__(/*! mime-db */ "./node_modules/mime-db/index.js");


// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}


// leaves only extension from the given string
//   normalize('foo/bar.js')  // -> '.js'
//   normalize('bar.js')      // -> '.js'
//   normalize('.js')         // -> '.js'
//   normalize('js')          // -> '.js'
function normalize(path) {
  // edge case: '/txt' & '\txt' are not resolveable
  if (/[\\/][^\\/.]+$/.test(path)) { return ''; }

  return '.' + path.replace(/.*[\.\/\\]/, '').toLowerCase();
}

// Remove charset/types/spaces, convenent for external data check
// " tExt/htMl ; charset=UTF-8 ; type=foo " -> "text/html"
function clearMime(mimeType) {
  if (!mimeType || (String(mimeType) !== mimeType)) { return ''; }
  return mimeType.split(';')[0].trim().toLowerCase();
}


/**
 * class Mimoza
 **/

/**
 *  new Mimoza([options])
 *
 *  Initiates new instance of Mimoza.
 *
 *  ##### Options
 *
 *  - **defaultType** _(String):_ Default mime type used as last-resort
 *    for [[Mimoza#getMimeType]]. By default: `undefined`.
 *  - **preloaded** _(Boolean):_ Init instance with default mime rules
 **/
var Mimoza = module.exports = function Mimoza(options) {
  options = options || {};

  // Map of `extension -> mimeType` pairs.
  Object.defineProperty(this, 'types',          { value: Object.create(null) });

  // Map of `mimeType -> extensions` pairs.
  Object.defineProperty(this, 'extensions',     { value: Object.create(null) });

  // Used as last-resort for [[Mimoza#getMimeType]].
  Object.defineProperty(this, 'defaultType',    { value: options.defaultType });


  if (options.preloaded) {
    Object.keys(db).forEach(function (mime) {
      var val = db[mime];

      if (val.extensions) {
        this.register(mime, val.extensions);
      }
    }, this);
  }
};


/**
 *  Mimoza#clone() -> Object
 *
 *  Creates copy of current Mimoza instanse
 **/
Mimoza.prototype.clone = function clone() {
  var m = new Mimoza({ defaultType: this.defaultType });

  assign(m.types, this.types);
  assign(m.extensions, this.extensions);

  return m;
};


/**
 *  Mimoza#register(mimeType, extensions[, overrideDefault = false]) -> Void
 *  - mimeType (String):
 *  - extensions (String|Array):
 *  - overrideDefault (Boolean):
 *
 *  Register given `extensions` as representatives of `mimeType` and register
 *  first element of `extensions` as default extension for the `mimeType`.
 *
 *
 *  ##### Example
 *
 *  ```javascript
 *  mime.register('audio/ogg', ['oga', 'ogg', 'spx']);
 *
 *  mime.getMimeType('.oga');       // -> 'audio/ogg'
 *  mime.getMimeType('.ogg');       // -> 'audio/ogg'
 *  mime.getExtension('audio/ogg'); // -> '.oga'
 *  ```
 *
 *  ##### Overriding default extension
 *
 *  `mimeType -> extension` is set only once, if you wnt to override it,
 *  pass `overrideDefault` flag as true. See example below:
 *
 *  ```javascript
 *  mime.register('audio/ogg', ['oga']);
 *  mime.getExtension('audio/ogg');
 *  // -> '.oga'
 *
 *  mime.register('audio/ogg', ['spx']);
 *  mime.getExtension('audio/ogg');
 *  // -> '.oga'
 *
 *  mime.register('audio/ogg', ['ogg'], true);
 *  mime.getExtension('audio/ogg');
 *  // -> '.ogg'
 *  ```
 **/
Mimoza.prototype.register = function register(mimeType, extensions, overrideDefault) {
  extensions = Array.isArray(extensions) ? extensions : [ extensions ];

  // pollute `extension -> mimeType` map
  extensions.forEach(function (ext) {
    this.types[normalize(ext)] = mimeType;
  }, this);

  // use case insensitive mime types for extention resolve
  if (overrideDefault || typeof this.extensions[mimeType.toLowerCase()] === 'undefined') {
    this.extensions[mimeType.toLowerCase()] = normalize(extensions[0]);
  }
};


/**
 *  Mimoza#getMimeType(path[, fallback]) -> String
 *
 *  Lookup a mime type based on extension
 **/
Mimoza.prototype.getMimeType = function getMimeType(path, fallback) {
  return this.types[normalize(path)] || fallback || this.defaultType;
};


/**
 *  Mimoza#getExtension(mimeType) -> String
 *
 *  Return file extension associated with a mime type.
 **/
Mimoza.prototype.getExtension = function getExtension(mimeType) {
  return this.extensions[clearMime(mimeType)];
};


// Returns whenever an asset is text or not
var TEXT_MIME_RE = new RegExp([
  '^text/',
  '/json$',
  '/javascript$'
].join('|'));

/**
 *  Mimoza#isText(mimeType) -> Boolean
 *
 *  Check if mime type provides text content. Can be used to add encoding.
 **/
Mimoza.prototype.isText = function isText(mimeType) {
  return TEXT_MIME_RE.test(clearMime(mimeType));
};


////////////////////////////////////////////////////////////////////////////////
//
// Public methods to work with module without creating new instance, if default
// configs are ok for you.
//


// builtin instance of mimoza
var builtin = new Mimoza({ preloaded: true });

/**
 *  Mimoza.getMimeType(path, fallback) -> String
 *
 *  Proxy to [[Mimoza#getMimeType]] of internal, built-in instance of [[Mimoza]]
 *  filled with some default types.
 **/
Mimoza.getMimeType = function _getMimeType(path, fallback) {
  return builtin.getMimeType(path, fallback);
};

/**
 *  Mimoza.getExtension(mimeType) -> String
 *
 *  Proxy to [[Mimoza#getExtension]] of internal, built-in instance of [[Mimoza]]
 *  filled with some default types.
 **/
Mimoza.getExtension = function _getExtension(mimeType) {
  return builtin.getExtension(mimeType);
};

/**
 *  Mimoza.isText(mimeType) -> Boolean
 *
 *  Proxy to [[Mimoza#isText]] of internal, built-in instance
 *  of [[Mimoza]].
 **/
Mimoza.isText = function _isText(mimeType) {
  return builtin.isText(mimeType);
};


/***/ }),

/***/ "./static/templates/blank.html":
/*!*************************************!*\
  !*** ./static/templates/blank.html ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ("");

/***/ }),

/***/ "./src/addExtras.ts":
/*!**************************!*\
  !*** ./src/addExtras.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addExtras": () => (/* binding */ addExtras),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! markdown-it-attrs */ "./node_modules/markdown-it-attrs/index.js");
/* harmony import */ var markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var markdown_it_checkbox__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! markdown-it-checkbox */ "./node_modules/markdown-it-checkbox/index.js");
/* harmony import */ var markdown_it_checkbox__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(markdown_it_checkbox__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var markdown_it_container__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! markdown-it-container */ "./node_modules/markdown-it-container/index.js");
/* harmony import */ var markdown_it_container__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(markdown_it_container__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var markdown_it_deflist__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! markdown-it-deflist */ "./node_modules/markdown-it-deflist/index.js");
/* harmony import */ var markdown_it_deflist__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(markdown_it_deflist__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var markdown_it_emoji__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! markdown-it-emoji */ "./node_modules/markdown-it-emoji/index.js");
/* harmony import */ var markdown_it_emoji__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(markdown_it_emoji__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var markdown_it_html5_embed__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! markdown-it-html5-embed */ "./node_modules/markdown-it-html5-embed/lib/index.js");
/* harmony import */ var markdown_it_html5_embed__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(markdown_it_html5_embed__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var markdown_it_mark__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! markdown-it-mark */ "./node_modules/markdown-it-mark/index.js");
/* harmony import */ var markdown_it_mark__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(markdown_it_mark__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! markdown-it-multimd-table */ "./node_modules/markdown-it-multimd-table/index.js");
/* harmony import */ var markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var markdown_it_underline__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! markdown-it-underline */ "./node_modules/markdown-it-underline/index.js");
/* harmony import */ var markdown_it_underline__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(markdown_it_underline__WEBPACK_IMPORTED_MODULE_8__);





// import * as markdownItFootnote from "markdown-it-footnote";

// import markdownItKbd from "markdown-it-kbd";


// import * as markdownItSub from "markdown-it-sub";
// import * as markdownItSup from "markdown-it-sup";
// // import * as markdownItToc from "markdown-it-toc";

const addAttr = (md) => {
    // Allow {.class #id data-other="foo"} tags
    md.use((markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0___default()), {
        leftDelimiter: "{",
        rightDelimiter: "}",
        allowedAttributes: ["class", "id", /^(?!on).*$/gim],
    });
    // change the rule applied to write a custom name attr on headers in MEME
    md.renderer.rules["heading_open"] = (tokens, idx, options, _env, self) => {
        const token = tokens[idx];
        const nextToken = tokens[idx + 1];
        const link = (nextToken === null || nextToken === void 0 ? void 0 : nextToken.content) || "";
        token.attrSet("name", `${token.markup}${link}`);
        return self.renderToken(tokens, idx, options);
    };
    return md;
};
const addExtras = (md) => {
    // TODO: reference settings
    addAttr(md);
    md.use((markdown_it_checkbox__WEBPACK_IMPORTED_MODULE_1___default()));
    md.use((markdown_it_deflist__WEBPACK_IMPORTED_MODULE_3___default()));
    md.use((markdown_it_emoji__WEBPACK_IMPORTED_MODULE_4___default()));
    md.use((markdown_it_deflist__WEBPACK_IMPORTED_MODULE_3___default()));
    md.use((markdown_it_emoji__WEBPACK_IMPORTED_MODULE_4___default()));
    md.use((markdown_it_html5_embed__WEBPACK_IMPORTED_MODULE_5___default()));
    md.use((markdown_it_mark__WEBPACK_IMPORTED_MODULE_6___default()));
    md.use((markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_7___default()));
    md.use((markdown_it_underline__WEBPACK_IMPORTED_MODULE_8___default()));
    /* ::: word starts a block with class .word; ::: ends it */
    md.use((markdown_it_container__WEBPACK_IMPORTED_MODULE_2___default()), "any", {
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
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (addExtras);


/***/ }),

/***/ "./src/module/helper/TemplatePreloader.ts":
/*!************************************************!*\
  !*** ./src/module/helper/TemplatePreloader.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TemplatePreloader": () => (/* binding */ TemplatePreloader)
/* harmony export */ });
/* harmony import */ var _static_templates_blank_html__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../static/templates/blank.html */ "./static/templates/blank.html");

class TemplatePreloader {
    /**
     * Preload a set of templates to compile and cache them for fast access during rendering
     */
    static async preloadHandlebarsTemplates() {
        const templatePaths = ["modules/template/templates/blank.html"];
        return loadTemplates(templatePaths);
    }
}


/***/ }),

/***/ "./node_modules/underscore/underscore-umd.js":
/*!***************************************************!*\
  !*** ./node_modules/underscore/underscore-umd.js ***!
  \***************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

(function (global, factory) {
   true ? module.exports = factory() :
  0;
}(this, (function () {
  //     Underscore.js 1.13.1
  //     https://underscorejs.org
  //     (c) 2009-2021 Jeremy Ashkenas, Julian Gonggrijp, and DocumentCloud and Investigative Reporters & Editors
  //     Underscore may be freely distributed under the MIT license.

  // Current version.
  var VERSION = '1.13.1';

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self == 'object' && self.self === self && self ||
            typeof __webpack_require__.g == 'object' && __webpack_require__.g.global === __webpack_require__.g && __webpack_require__.g ||
            Function('return this')() ||
            {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // Modern feature detection.
  var supportsArrayBuffer = typeof ArrayBuffer !== 'undefined',
      supportsDataView = typeof DataView !== 'undefined';

  // All **ECMAScript 5+** native function implementations that we hope to use
  // are declared here.
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create,
      nativeIsView = supportsArrayBuffer && ArrayBuffer.isView;

  // Create references to these builtin functions because we override them.
  var _isNaN = isNaN,
      _isFinite = isFinite;

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  // The largest integer that can be represented exactly.
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  function restArguments(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  }

  // Is a given variable an object?
  function isObject(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  }

  // Is a given value equal to null?
  function isNull(obj) {
    return obj === null;
  }

  // Is a given variable undefined?
  function isUndefined(obj) {
    return obj === void 0;
  }

  // Is a given value a boolean?
  function isBoolean(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  }

  // Is a given value a DOM element?
  function isElement(obj) {
    return !!(obj && obj.nodeType === 1);
  }

  // Internal function for creating a `toString`-based type tester.
  function tagTester(name) {
    var tag = '[object ' + name + ']';
    return function(obj) {
      return toString.call(obj) === tag;
    };
  }

  var isString = tagTester('String');

  var isNumber = tagTester('Number');

  var isDate = tagTester('Date');

  var isRegExp = tagTester('RegExp');

  var isError = tagTester('Error');

  var isSymbol = tagTester('Symbol');

  var isArrayBuffer = tagTester('ArrayBuffer');

  var isFunction = tagTester('Function');

  // Optimize `isFunction` if appropriate. Work around some `typeof` bugs in old
  // v8, IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if ( true && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  var isFunction$1 = isFunction;

  var hasObjectTag = tagTester('Object');

  // In IE 10 - Edge 13, `DataView` has string tag `'[object Object]'`.
  // In IE 11, the most common among them, this problem also applies to
  // `Map`, `WeakMap` and `Set`.
  var hasStringTagBug = (
        supportsDataView && hasObjectTag(new DataView(new ArrayBuffer(8)))
      ),
      isIE11 = (typeof Map !== 'undefined' && hasObjectTag(new Map));

  var isDataView = tagTester('DataView');

  // In IE 10 - Edge 13, we need a different heuristic
  // to determine whether an object is a `DataView`.
  function ie10IsDataView(obj) {
    return obj != null && isFunction$1(obj.getInt8) && isArrayBuffer(obj.buffer);
  }

  var isDataView$1 = (hasStringTagBug ? ie10IsDataView : isDataView);

  // Is a given value an array?
  // Delegates to ECMA5's native `Array.isArray`.
  var isArray = nativeIsArray || tagTester('Array');

  // Internal function to check whether `key` is an own property name of `obj`.
  function has$1(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  }

  var isArguments = tagTester('Arguments');

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  (function() {
    if (!isArguments(arguments)) {
      isArguments = function(obj) {
        return has$1(obj, 'callee');
      };
    }
  }());

  var isArguments$1 = isArguments;

  // Is a given object a finite number?
  function isFinite$1(obj) {
    return !isSymbol(obj) && _isFinite(obj) && !isNaN(parseFloat(obj));
  }

  // Is the given value `NaN`?
  function isNaN$1(obj) {
    return isNumber(obj) && _isNaN(obj);
  }

  // Predicate-generating function. Often useful outside of Underscore.
  function constant(value) {
    return function() {
      return value;
    };
  }

  // Common internal logic for `isArrayLike` and `isBufferLike`.
  function createSizePropertyCheck(getSizeProperty) {
    return function(collection) {
      var sizeProperty = getSizeProperty(collection);
      return typeof sizeProperty == 'number' && sizeProperty >= 0 && sizeProperty <= MAX_ARRAY_INDEX;
    }
  }

  // Internal helper to generate a function to obtain property `key` from `obj`.
  function shallowProperty(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  }

  // Internal helper to obtain the `byteLength` property of an object.
  var getByteLength = shallowProperty('byteLength');

  // Internal helper to determine whether we should spend extensive checks against
  // `ArrayBuffer` et al.
  var isBufferLike = createSizePropertyCheck(getByteLength);

  // Is a given value a typed array?
  var typedArrayPattern = /\[object ((I|Ui)nt(8|16|32)|Float(32|64)|Uint8Clamped|Big(I|Ui)nt64)Array\]/;
  function isTypedArray(obj) {
    // `ArrayBuffer.isView` is the most future-proof, so use it when available.
    // Otherwise, fall back on the above regular expression.
    return nativeIsView ? (nativeIsView(obj) && !isDataView$1(obj)) :
                  isBufferLike(obj) && typedArrayPattern.test(toString.call(obj));
  }

  var isTypedArray$1 = supportsArrayBuffer ? isTypedArray : constant(false);

  // Internal helper to obtain the `length` property of an object.
  var getLength = shallowProperty('length');

  // Internal helper to create a simple lookup structure.
  // `collectNonEnumProps` used to depend on `_.contains`, but this led to
  // circular imports. `emulatedSet` is a one-off solution that only works for
  // arrays of strings.
  function emulatedSet(keys) {
    var hash = {};
    for (var l = keys.length, i = 0; i < l; ++i) hash[keys[i]] = true;
    return {
      contains: function(key) { return hash[key]; },
      push: function(key) {
        hash[key] = true;
        return keys.push(key);
      }
    };
  }

  // Internal helper. Checks `keys` for the presence of keys in IE < 9 that won't
  // be iterated by `for key in ...` and thus missed. Extends `keys` in place if
  // needed.
  function collectNonEnumProps(obj, keys) {
    keys = emulatedSet(keys);
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = isFunction$1(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (has$1(obj, prop) && !keys.contains(prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !keys.contains(prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  function keys(obj) {
    if (!isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (has$1(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  }

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  function isEmpty(obj) {
    if (obj == null) return true;
    // Skip the more expensive `toString`-based type checks if `obj` has no
    // `.length`.
    var length = getLength(obj);
    if (typeof length == 'number' && (
      isArray(obj) || isString(obj) || isArguments$1(obj)
    )) return length === 0;
    return getLength(keys(obj)) === 0;
  }

  // Returns whether an object has a given set of `key:value` pairs.
  function isMatch(object, attrs) {
    var _keys = keys(attrs), length = _keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = _keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  }

  // If Underscore is called as a function, it returns a wrapped object that can
  // be used OO-style. This wrapper holds altered versions of all functions added
  // through `_.mixin`. Wrapped objects may be chained.
  function _$1(obj) {
    if (obj instanceof _$1) return obj;
    if (!(this instanceof _$1)) return new _$1(obj);
    this._wrapped = obj;
  }

  _$1.VERSION = VERSION;

  // Extracts the result from a wrapped and chained object.
  _$1.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxies for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _$1.prototype.valueOf = _$1.prototype.toJSON = _$1.prototype.value;

  _$1.prototype.toString = function() {
    return String(this._wrapped);
  };

  // Internal function to wrap or shallow-copy an ArrayBuffer,
  // typed array or DataView to a new view, reusing the buffer.
  function toBufferView(bufferSource) {
    return new Uint8Array(
      bufferSource.buffer || bufferSource,
      bufferSource.byteOffset || 0,
      getByteLength(bufferSource)
    );
  }

  // We use this string twice, so give it a name for minification.
  var tagDataView = '[object DataView]';

  // Internal recursive comparison function for `_.isEqual`.
  function eq(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](https://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // `null` or `undefined` only equal to itself (strict comparison).
    if (a == null || b == null) return false;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  }

  // Internal recursive comparison function for `_.isEqual`.
  function deepEq(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _$1) a = a._wrapped;
    if (b instanceof _$1) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    // Work around a bug in IE 10 - Edge 13.
    if (hasStringTagBug && className == '[object Object]' && isDataView$1(a)) {
      if (!isDataView$1(b)) return false;
      className = tagDataView;
    }
    switch (className) {
      // These types are compared by value.
      case '[object RegExp]':
        // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
      case '[object ArrayBuffer]':
      case tagDataView:
        // Coerce to typed array so we can fall through.
        return deepEq(toBufferView(a), toBufferView(b), aStack, bStack);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays && isTypedArray$1(a)) {
        var byteLength = getByteLength(a);
        if (byteLength !== getByteLength(b)) return false;
        if (a.buffer === b.buffer && a.byteOffset === b.byteOffset) return true;
        areArrays = true;
    }
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(isFunction$1(aCtor) && aCtor instanceof aCtor &&
                               isFunction$1(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var _keys = keys(a), key;
      length = _keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = _keys[length];
        if (!(has$1(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  }

  // Perform a deep comparison to check if two objects are equal.
  function isEqual(a, b) {
    return eq(a, b);
  }

  // Retrieve all the enumerable property names of an object.
  function allKeys(obj) {
    if (!isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  }

  // Since the regular `Object.prototype.toString` type tests don't work for
  // some types in IE 11, we use a fingerprinting heuristic instead, based
  // on the methods. It's not great, but it's the best we got.
  // The fingerprint method lists are defined below.
  function ie11fingerprint(methods) {
    var length = getLength(methods);
    return function(obj) {
      if (obj == null) return false;
      // `Map`, `WeakMap` and `Set` have no enumerable keys.
      var keys = allKeys(obj);
      if (getLength(keys)) return false;
      for (var i = 0; i < length; i++) {
        if (!isFunction$1(obj[methods[i]])) return false;
      }
      // If we are testing against `WeakMap`, we need to ensure that
      // `obj` doesn't have a `forEach` method in order to distinguish
      // it from a regular `Map`.
      return methods !== weakMapMethods || !isFunction$1(obj[forEachName]);
    };
  }

  // In the interest of compact minification, we write
  // each string in the fingerprints only once.
  var forEachName = 'forEach',
      hasName = 'has',
      commonInit = ['clear', 'delete'],
      mapTail = ['get', hasName, 'set'];

  // `Map`, `WeakMap` and `Set` each have slightly different
  // combinations of the above sublists.
  var mapMethods = commonInit.concat(forEachName, mapTail),
      weakMapMethods = commonInit.concat(mapTail),
      setMethods = ['add'].concat(commonInit, forEachName, hasName);

  var isMap = isIE11 ? ie11fingerprint(mapMethods) : tagTester('Map');

  var isWeakMap = isIE11 ? ie11fingerprint(weakMapMethods) : tagTester('WeakMap');

  var isSet = isIE11 ? ie11fingerprint(setMethods) : tagTester('Set');

  var isWeakSet = tagTester('WeakSet');

  // Retrieve the values of an object's properties.
  function values(obj) {
    var _keys = keys(obj);
    var length = _keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[_keys[i]];
    }
    return values;
  }

  // Convert an object into a list of `[key, value]` pairs.
  // The opposite of `_.object` with one argument.
  function pairs(obj) {
    var _keys = keys(obj);
    var length = _keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [_keys[i], obj[_keys[i]]];
    }
    return pairs;
  }

  // Invert the keys and values of an object. The values must be serializable.
  function invert(obj) {
    var result = {};
    var _keys = keys(obj);
    for (var i = 0, length = _keys.length; i < length; i++) {
      result[obj[_keys[i]]] = _keys[i];
    }
    return result;
  }

  // Return a sorted list of the function names available on the object.
  function functions(obj) {
    var names = [];
    for (var key in obj) {
      if (isFunction$1(obj[key])) names.push(key);
    }
    return names.sort();
  }

  // An internal function for creating assigner functions.
  function createAssigner(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  }

  // Extend a given object with all the properties in passed-in object(s).
  var extend = createAssigner(allKeys);

  // Assigns a given object with all the own properties in the passed-in
  // object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  var extendOwn = createAssigner(keys);

  // Fill in a given object with default properties.
  var defaults = createAssigner(allKeys, true);

  // Create a naked function reference for surrogate-prototype-swapping.
  function ctor() {
    return function(){};
  }

  // An internal function for creating a new object that inherits from another.
  function baseCreate(prototype) {
    if (!isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    var Ctor = ctor();
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  }

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  function create(prototype, props) {
    var result = baseCreate(prototype);
    if (props) extendOwn(result, props);
    return result;
  }

  // Create a (shallow-cloned) duplicate of an object.
  function clone(obj) {
    if (!isObject(obj)) return obj;
    return isArray(obj) ? obj.slice() : extend({}, obj);
  }

  // Invokes `interceptor` with the `obj` and then returns `obj`.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  function tap(obj, interceptor) {
    interceptor(obj);
    return obj;
  }

  // Normalize a (deep) property `path` to array.
  // Like `_.iteratee`, this function can be customized.
  function toPath$1(path) {
    return isArray(path) ? path : [path];
  }
  _$1.toPath = toPath$1;

  // Internal wrapper for `_.toPath` to enable minification.
  // Similar to `cb` for `_.iteratee`.
  function toPath(path) {
    return _$1.toPath(path);
  }

  // Internal function to obtain a nested property in `obj` along `path`.
  function deepGet(obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  }

  // Get the value of the (deep) property on `path` from `object`.
  // If any property in `path` does not exist or if the value is
  // `undefined`, return `defaultValue` instead.
  // The `path` is normalized through `_.toPath`.
  function get(object, path, defaultValue) {
    var value = deepGet(object, toPath(path));
    return isUndefined(value) ? defaultValue : value;
  }

  // Shortcut function for checking if an object has a given property directly on
  // itself (in other words, not on a prototype). Unlike the internal `has`
  // function, this public version can also traverse nested properties.
  function has(obj, path) {
    path = toPath(path);
    var length = path.length;
    for (var i = 0; i < length; i++) {
      var key = path[i];
      if (!has$1(obj, key)) return false;
      obj = obj[key];
    }
    return !!length;
  }

  // Keep the identity function around for default iteratees.
  function identity(value) {
    return value;
  }

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  function matcher(attrs) {
    attrs = extendOwn({}, attrs);
    return function(obj) {
      return isMatch(obj, attrs);
    };
  }

  // Creates a function that, when passed an object, will traverse that object’s
  // properties down the given `path`, specified as an array of keys or indices.
  function property(path) {
    path = toPath(path);
    return function(obj) {
      return deepGet(obj, path);
    };
  }

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  function optimizeCb(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-argument case is omitted because we’re not using it.
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  }

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `_.identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  function baseIteratee(value, context, argCount) {
    if (value == null) return identity;
    if (isFunction$1(value)) return optimizeCb(value, context, argCount);
    if (isObject(value) && !isArray(value)) return matcher(value);
    return property(value);
  }

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only `argCount` argument.
  function iteratee(value, context) {
    return baseIteratee(value, context, Infinity);
  }
  _$1.iteratee = iteratee;

  // The function we call internally to generate a callback. It invokes
  // `_.iteratee` if overridden, otherwise `baseIteratee`.
  function cb(value, context, argCount) {
    if (_$1.iteratee !== iteratee) return _$1.iteratee(value, context);
    return baseIteratee(value, context, argCount);
  }

  // Returns the results of applying the `iteratee` to each element of `obj`.
  // In contrast to `_.map` it returns an object.
  function mapObject(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var _keys = keys(obj),
        length = _keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = _keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  }

  // Predicate-generating function. Often useful outside of Underscore.
  function noop(){}

  // Generates a function for a given object that returns a given property.
  function propertyOf(obj) {
    if (obj == null) return noop;
    return function(path) {
      return get(obj, path);
    };
  }

  // Run a function **n** times.
  function times(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  }

  // Return a random integer between `min` and `max` (inclusive).
  function random(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // A (possibly faster) way to get the current timestamp as an integer.
  var now = Date.now || function() {
    return new Date().getTime();
  };

  // Internal helper to generate functions for escaping and unescaping strings
  // to/from HTML interpolation.
  function createEscaper(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  }

  // Internal list of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };

  // Function for escaping strings to HTML interpolation.
  var _escape = createEscaper(escapeMap);

  // Internal list of HTML entities for unescaping.
  var unescapeMap = invert(escapeMap);

  // Function for unescaping strings from HTML interpolation.
  var _unescape = createEscaper(unescapeMap);

  // By default, Underscore uses ERB-style template delimiters. Change the
  // following template settings to use alternative delimiters.
  var templateSettings = _$1.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `_.templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  function escapeChar(match) {
    return '\\' + escapes[match];
  }

  // In order to prevent third-party code injection through
  // `_.templateSettings.variable`, we test it against the following regular
  // expression. It is intentionally a bit more liberal than just matching valid
  // identifiers, but still prevents possible loopholes through defaults or
  // destructuring assignment.
  var bareIdentifier = /^\s*(\w|\$)+\s*$/;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  function template(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = defaults({}, settings, _$1.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    var argument = settings.variable;
    if (argument) {
      // Insure against third-party code injection. (CVE-2021-23358)
      if (!bareIdentifier.test(argument)) throw new Error(
        'variable is not a bare identifier: ' + argument
      );
    } else {
      // If a variable is not specified, place data values in local scope.
      source = 'with(obj||{}){\n' + source + '}\n';
      argument = 'obj';
    }

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(argument, '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _$1);
    };

    // Provide the compiled source as a convenience for precompilation.
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  }

  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  function result(obj, path, fallback) {
    path = toPath(path);
    var length = path.length;
    if (!length) {
      return isFunction$1(fallback) ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length; // Ensure we don't continue iterating.
      }
      obj = isFunction$1(prop) ? prop.call(obj) : prop;
    }
    return obj;
  }

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  function uniqueId(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  }

  // Start chaining a wrapped Underscore object.
  function chain(obj) {
    var instance = _$1(obj);
    instance._chain = true;
    return instance;
  }

  // Internal function to execute `sourceFunc` bound to `context` with optional
  // `args`. Determines whether to execute a function as a constructor or as a
  // normal function.
  function executeBound(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (isObject(result)) return result;
    return self;
  }

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. `_` acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  var partial = restArguments(function(func, boundArgs) {
    var placeholder = partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  partial.placeholder = _$1;

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally).
  var bind = restArguments(function(func, context, args) {
    if (!isFunction$1(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArguments(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Internal helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var isArrayLike = createSizePropertyCheck(getLength);

  // Internal implementation of a recursive `flatten` function.
  function flatten$1(input, depth, strict, output) {
    output = output || [];
    if (!depth && depth !== 0) {
      depth = Infinity;
    } else if (depth <= 0) {
      return output.concat(input);
    }
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (isArray(value) || isArguments$1(value))) {
        // Flatten current level of array or arguments object.
        if (depth > 1) {
          flatten$1(value, depth - 1, strict, output);
          idx = output.length;
        } else {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  }

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  var bindAll = restArguments(function(obj, keys) {
    keys = flatten$1(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = bind(obj[key], obj);
    }
    return obj;
  });

  // Memoize an expensive function by storing its results.
  function memoize(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!has$1(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  }

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  var delay = restArguments(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  var defer = partial(delay, _$1, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  function throttle(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var _now = now();
      if (!previous && options.leading === false) previous = _now;
      var remaining = wait - (_now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = _now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  }

  // When a sequence of calls of the returned function ends, the argument
  // function is triggered. The end of a sequence is defined by the `wait`
  // parameter. If `immediate` is passed, the argument function will be
  // triggered at the beginning of the sequence instead of at the end.
  function debounce(func, wait, immediate) {
    var timeout, previous, args, result, context;

    var later = function() {
      var passed = now() - previous;
      if (wait > passed) {
        timeout = setTimeout(later, wait - passed);
      } else {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
        // This check is needed because `func` can recursively invoke `debounced`.
        if (!timeout) args = context = null;
      }
    };

    var debounced = restArguments(function(_args) {
      context = this;
      args = _args;
      previous = now();
      if (!timeout) {
        timeout = setTimeout(later, wait);
        if (immediate) result = func.apply(context, args);
      }
      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = args = context = null;
    };

    return debounced;
  }

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  function wrap(func, wrapper) {
    return partial(wrapper, func);
  }

  // Returns a negated version of the passed-in predicate.
  function negate(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  }

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  function compose() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  }

  // Returns a function that will only be executed on and after the Nth call.
  function after(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  }

  // Returns a function that will only be executed up to (but not including) the
  // Nth call.
  function before(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  }

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  var once = partial(before, 2);

  // Returns the first key on an object that passes a truth test.
  function findKey(obj, predicate, context) {
    predicate = cb(predicate, context);
    var _keys = keys(obj), key;
    for (var i = 0, length = _keys.length; i < length; i++) {
      key = _keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  }

  // Internal function to generate `_.findIndex` and `_.findLastIndex`.
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a truth test.
  var findIndex = createPredicateIndexFinder(1);

  // Returns the last index on an array-like that passes a truth test.
  var findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  function sortedIndex(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  }

  // Internal function to generate the `_.indexOf` and `_.lastIndexOf` functions.
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), isNaN$1);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  var indexOf = createIndexFinder(1, findIndex, sortedIndex);

  // Return the position of the last occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  var lastIndexOf = createIndexFinder(-1, findLastIndex);

  // Return the first value which passes a truth test.
  function find(obj, predicate, context) {
    var keyFinder = isArrayLike(obj) ? findIndex : findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  }

  // Convenience version of a common use case of `_.find`: getting the first
  // object containing specific `key:value` pairs.
  function findWhere(obj, attrs) {
    return find(obj, matcher(attrs));
  }

  // The cornerstone for collection functions, an `each`
  // implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  function each(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var _keys = keys(obj);
      for (i = 0, length = _keys.length; i < length; i++) {
        iteratee(obj[_keys[i]], _keys[i], obj);
      }
    }
    return obj;
  }

  // Return the results of applying the iteratee to each element.
  function map(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var _keys = !isArrayLike(obj) && keys(obj),
        length = (_keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = _keys ? _keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  }

  // Internal helper to create a reducing function, iterating left or right.
  function createReduce(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      var _keys = !isArrayLike(obj) && keys(obj),
          length = (_keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[_keys ? _keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = _keys ? _keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  var reduce = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  var reduceRight = createReduce(-1);

  // Return all the elements that pass a truth test.
  function filter(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  }

  // Return all the elements for which a truth test fails.
  function reject(obj, predicate, context) {
    return filter(obj, negate(cb(predicate)), context);
  }

  // Determine whether all of the elements pass a truth test.
  function every(obj, predicate, context) {
    predicate = cb(predicate, context);
    var _keys = !isArrayLike(obj) && keys(obj),
        length = (_keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = _keys ? _keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  }

  // Determine if at least one element in the object passes a truth test.
  function some(obj, predicate, context) {
    predicate = cb(predicate, context);
    var _keys = !isArrayLike(obj) && keys(obj),
        length = (_keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = _keys ? _keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  }

  // Determine if the array or object contains a given item (using `===`).
  function contains(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return indexOf(obj, item, fromIndex) >= 0;
  }

  // Invoke a method (with arguments) on every item in a collection.
  var invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    if (isFunction$1(path)) {
      func = path;
    } else {
      path = toPath(path);
      contextPath = path.slice(0, -1);
      path = path[path.length - 1];
    }
    return map(obj, function(context) {
      var method = func;
      if (!method) {
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        method = context[path];
      }
      return method == null ? method : method.apply(context, args);
    });
  });

  // Convenience version of a common use case of `_.map`: fetching a property.
  function pluck(obj, key) {
    return map(obj, property(key));
  }

  // Convenience version of a common use case of `_.filter`: selecting only
  // objects containing specific `key:value` pairs.
  function where(obj, attrs) {
    return filter(obj, matcher(attrs));
  }

  // Return the maximum element (or element-based computation).
  function max(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  }

  // Return the minimum element (or element-based computation).
  function min(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  }

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `_.map`.
  function sample(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = values(obj);
      return obj[random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? clone(obj) : values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      var rand = random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    return sample.slice(0, n);
  }

  // Shuffle a collection.
  function shuffle(obj) {
    return sample(obj, Infinity);
  }

  // Sort the object's values by a criterion produced by an iteratee.
  function sortBy(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return pluck(map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  }

  // An internal function used for aggregate "group by" operations.
  function group(behavior, partition) {
    return function(obj, iteratee, context) {
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  }

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  var groupBy = group(function(result, value, key) {
    if (has$1(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `_.groupBy`, but for
  // when you know that your index values will be unique.
  var indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  var countBy = group(function(result, value, key) {
    if (has$1(result, key)) result[key]++; else result[key] = 1;
  });

  // Split a collection into two arrays: one whose elements all pass the given
  // truth test, and one whose elements all do not pass the truth test.
  var partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Safely create a real, live array from anything iterable.
  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  function toArray(obj) {
    if (!obj) return [];
    if (isArray(obj)) return slice.call(obj);
    if (isString(obj)) {
      // Keep surrogate pair characters together.
      return obj.match(reStrSymbol);
    }
    if (isArrayLike(obj)) return map(obj, identity);
    return values(obj);
  }

  // Return the number of elements in a collection.
  function size(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : keys(obj).length;
  }

  // Internal `_.pick` helper function to determine whether `key` is an enumerable
  // property name of `obj`.
  function keyInObj(value, key, obj) {
    return key in obj;
  }

  // Return a copy of the object only containing the allowed properties.
  var pick = restArguments(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (isFunction$1(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten$1(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the disallowed properties.
  var omit = restArguments(function(obj, keys) {
    var iteratee = keys[0], context;
    if (isFunction$1(iteratee)) {
      iteratee = negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = map(flatten$1(keys, false, false), String);
      iteratee = function(value, key) {
        return !contains(keys, key);
      };
    }
    return pick(obj, iteratee, context);
  });

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  function initial(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  }

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. The **guard** check allows it to work with `_.map`.
  function first(array, n, guard) {
    if (array == null || array.length < 1) return n == null || guard ? void 0 : [];
    if (n == null || guard) return array[0];
    return initial(array, array.length - n);
  }

  // Returns everything but the first entry of the `array`. Especially useful on
  // the `arguments` object. Passing an **n** will return the rest N values in the
  // `array`.
  function rest(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  }

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  function last(array, n, guard) {
    if (array == null || array.length < 1) return n == null || guard ? void 0 : [];
    if (n == null || guard) return array[array.length - 1];
    return rest(array, Math.max(0, array.length - n));
  }

  // Trim out all falsy values from an array.
  function compact(array) {
    return filter(array, Boolean);
  }

  // Flatten out an array, either recursively (by default), or up to `depth`.
  // Passing `true` or `false` as `depth` means `1` or `Infinity`, respectively.
  function flatten(array, depth) {
    return flatten$1(array, depth, false);
  }

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  var difference = restArguments(function(array, rest) {
    rest = flatten$1(rest, true, true);
    return filter(array, function(value){
      return !contains(rest, value);
    });
  });

  // Return a version of the array that does not contain the specified value(s).
  var without = restArguments(function(array, otherArrays) {
    return difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // The faster algorithm will not work with an iteratee if the iteratee
  // is not a one-to-one function, so providing an iteratee will disable
  // the faster algorithm.
  function uniq(array, isSorted, iteratee, context) {
    if (!isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted && !iteratee) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  }

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  var union = restArguments(function(arrays) {
    return uniq(flatten$1(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  function intersection(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  }

  // Complement of zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  function unzip(array) {
    var length = array && max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = pluck(array, index);
    }
    return result;
  }

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  var zip = restArguments(unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values. Passing by pairs is the reverse of `_.pairs`.
  function object(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  }

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](https://docs.python.org/library/functions.html#range).
  function range(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    if (!step) {
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  }

  // Chunk a single array into multiple arrays, each containing `count` or fewer
  // items.
  function chunk(array, count) {
    if (count == null || count < 1) return [];
    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  }

  // Helper function to continue chaining intermediate results.
  function chainResult(instance, obj) {
    return instance._chain ? _$1(obj).chain() : obj;
  }

  // Add your own custom functions to the Underscore object.
  function mixin(obj) {
    each(functions(obj), function(name) {
      var func = _$1[name] = obj[name];
      _$1.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_$1, args));
      };
    });
    return _$1;
  }

  // Add all mutator `Array` functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _$1.prototype[name] = function() {
      var obj = this._wrapped;
      if (obj != null) {
        method.apply(obj, arguments);
        if ((name === 'shift' || name === 'splice') && obj.length === 0) {
          delete obj[0];
        }
      }
      return chainResult(this, obj);
    };
  });

  // Add all accessor `Array` functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _$1.prototype[name] = function() {
      var obj = this._wrapped;
      if (obj != null) obj = method.apply(obj, arguments);
      return chainResult(this, obj);
    };
  });

  // Named Exports

  var allExports = {
    __proto__: null,
    VERSION: VERSION,
    restArguments: restArguments,
    isObject: isObject,
    isNull: isNull,
    isUndefined: isUndefined,
    isBoolean: isBoolean,
    isElement: isElement,
    isString: isString,
    isNumber: isNumber,
    isDate: isDate,
    isRegExp: isRegExp,
    isError: isError,
    isSymbol: isSymbol,
    isArrayBuffer: isArrayBuffer,
    isDataView: isDataView$1,
    isArray: isArray,
    isFunction: isFunction$1,
    isArguments: isArguments$1,
    isFinite: isFinite$1,
    isNaN: isNaN$1,
    isTypedArray: isTypedArray$1,
    isEmpty: isEmpty,
    isMatch: isMatch,
    isEqual: isEqual,
    isMap: isMap,
    isWeakMap: isWeakMap,
    isSet: isSet,
    isWeakSet: isWeakSet,
    keys: keys,
    allKeys: allKeys,
    values: values,
    pairs: pairs,
    invert: invert,
    functions: functions,
    methods: functions,
    extend: extend,
    extendOwn: extendOwn,
    assign: extendOwn,
    defaults: defaults,
    create: create,
    clone: clone,
    tap: tap,
    get: get,
    has: has,
    mapObject: mapObject,
    identity: identity,
    constant: constant,
    noop: noop,
    toPath: toPath$1,
    property: property,
    propertyOf: propertyOf,
    matcher: matcher,
    matches: matcher,
    times: times,
    random: random,
    now: now,
    escape: _escape,
    unescape: _unescape,
    templateSettings: templateSettings,
    template: template,
    result: result,
    uniqueId: uniqueId,
    chain: chain,
    iteratee: iteratee,
    partial: partial,
    bind: bind,
    bindAll: bindAll,
    memoize: memoize,
    delay: delay,
    defer: defer,
    throttle: throttle,
    debounce: debounce,
    wrap: wrap,
    negate: negate,
    compose: compose,
    after: after,
    before: before,
    once: once,
    findKey: findKey,
    findIndex: findIndex,
    findLastIndex: findLastIndex,
    sortedIndex: sortedIndex,
    indexOf: indexOf,
    lastIndexOf: lastIndexOf,
    find: find,
    detect: find,
    findWhere: findWhere,
    each: each,
    forEach: each,
    map: map,
    collect: map,
    reduce: reduce,
    foldl: reduce,
    inject: reduce,
    reduceRight: reduceRight,
    foldr: reduceRight,
    filter: filter,
    select: filter,
    reject: reject,
    every: every,
    all: every,
    some: some,
    any: some,
    contains: contains,
    includes: contains,
    include: contains,
    invoke: invoke,
    pluck: pluck,
    where: where,
    max: max,
    min: min,
    shuffle: shuffle,
    sample: sample,
    sortBy: sortBy,
    groupBy: groupBy,
    indexBy: indexBy,
    countBy: countBy,
    partition: partition,
    toArray: toArray,
    size: size,
    pick: pick,
    omit: omit,
    first: first,
    head: first,
    take: first,
    initial: initial,
    last: last,
    rest: rest,
    tail: rest,
    drop: rest,
    compact: compact,
    flatten: flatten,
    without: without,
    uniq: uniq,
    unique: uniq,
    union: union,
    intersection: intersection,
    difference: difference,
    unzip: unzip,
    transpose: unzip,
    zip: zip,
    object: object,
    range: range,
    chunk: chunk,
    mixin: mixin,
    'default': _$1
  };

  // Default Export

  // Add all of the Underscore functions to the wrapper object.
  var _ = mixin(allExports);
  // Legacy Node.js API.
  _._ = _;

  return _;

})));
//# sourceMappingURL=underscore-umd.js.map


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!***************************************!*\
  !*** ./src/markdown-editor-extras.ts ***!
  \***************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _module_helper_TemplatePreloader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./module/helper/TemplatePreloader */ "./src/module/helper/TemplatePreloader.ts");
/* harmony import */ var _addExtras__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./addExtras */ "./src/addExtras.ts");
// import "./module.scss";


// Use pretty quotes
Hooks.once("MemeActivateEditor", async (options) => {
    options.typographer = true;
    return options;
});
Hooks.once("MemeActivateChat", async (options) => {
    options.typographer = true;
    return options;
});
Hooks.once("init", async () => {
    const { markdownIt } = window.MEME;
    (0,_addExtras__WEBPACK_IMPORTED_MODULE_1__.default)(markdownIt);
});
Hooks.once("MemeRenderEditor", async (a, b) => {
    console.log("markdown-editor-extras heard MemeRenderEditor event.", a, b);
});
Hooks.once("ready", async () => {
    console.log("markdown-editor-extras ready");
});
if (true) {
    if (false) {}
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWF0dHJzL2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtYXR0cnMvcGF0dGVybnMuanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1hdHRycy91dGlscy5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWNoZWNrYm94L2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtY29udGFpbmVyL2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtZGVmbGlzdC9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWVtb2ppL2JhcmUuanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1lbW9qaS9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWVtb2ppL2xpYi9kYXRhL3Nob3J0Y3V0cy5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWVtb2ppL2xpYi9ub3JtYWxpemVfb3B0cy5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWVtb2ppL2xpYi9yZW5kZXIuanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1lbW9qaS9saWIvcmVwbGFjZS5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWh0bWw1LWVtYmVkL2xpYi9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LW1hcmsvaW5kZXguanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1tdWx0aW1kLXRhYmxlL2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtbXVsdGltZC10YWJsZS9saWIvZGZhLmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtdW5kZXJsaW5lL2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWltZS1kYi9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21pbW96YS9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vc3RhdGljL3RlbXBsYXRlcy9ibGFuay5odG1sIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9zcmMvYWRkRXh0cmFzLnRzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9zcmMvbW9kdWxlL2hlbHBlci9UZW1wbGF0ZVByZWxvYWRlci50cyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL3VuZGVyc2NvcmUvdW5kZXJzY29yZS11bWQuanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvd2VicGFjay9ydW50aW1lL2dsb2JhbCIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9zcmMvbWFya2Rvd24tZWRpdG9yLWV4dHJhcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQWE7O0FBRWIsdUJBQXVCLG1CQUFPLENBQUMsbUVBQWU7O0FBRTlDO0FBQ0EsbUJBQW1CO0FBQ25CLG9CQUFvQjtBQUNwQjtBQUNBOztBQUVBO0FBQ0EsZ0NBQWdDO0FBQ2hDOztBQUVBOztBQUVBO0FBQ0E7O0FBRUEsbUJBQW1CLG1CQUFtQjtBQUN0QyxxQkFBcUIscUJBQXFCO0FBQzFDO0FBQ0EscUJBQXFCO0FBQ3JCO0FBQ0E7QUFDQSwrQkFBK0IsV0FBVztBQUMxQztBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFdBQVcsTUFBTTtBQUNqQixXQUFXLE9BQU87QUFDbEIsV0FBVyxPQUFPO0FBQ2xCLFlBQVksT0FBTyxFQUFFO0FBQ3JCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEI7OztBQUc5Qiw0QkFBNEIsWUFBWTs7QUFFeEM7QUFDQSxnREFBZ0QsVUFBVTs7QUFFMUQsbUNBQW1DLFlBQVk7O0FBRS9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUCx1QkFBdUIscUJBQXFCO0FBQzVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsNEJBQTRCLFlBQVk7O0FBRXhDO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0MsWUFBWTtBQUM5QztBQUNBO0FBQ0EsZ0NBQWdDLFlBQVk7QUFDNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwQkFBMEIsWUFBWTtBQUN0QztBQUNBO0FBQ0E7QUFDQTtBQUNBLDREQUE0RCxJQUFJO0FBQ2hFO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtDQUErQztBQUMvQztBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQ25KYTtBQUNiO0FBQ0E7QUFDQTtBQUNBOztBQUVBLGNBQWMsbUJBQU8sQ0FBQyw2REFBWTs7QUFFbEM7QUFDQSw4QkFBOEIsSUFBSSxNQUFNLEdBQUc7QUFDM0M7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxvQkFBb0I7QUFDcEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSx1QkFBdUIsR0FBRyxjQUFjO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQixHQUFHO0FBQ3pCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxvQkFBb0I7QUFDcEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0RBQXdEO0FBQ3hELGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1REFBdUQsTUFBTTtBQUM3RDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsWUFBWSxHQUFHO0FBQ2Y7QUFDQSxVQUFVLEdBQUc7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUJBQXFCLEdBQUc7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxtQkFBbUI7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBLGdCQUFnQixHQUFHO0FBQ25CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUVBQWlFLE1BQU07QUFDdkU7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlFQUFpRSxNQUFNO0FBQ3ZFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7O0FDblZhO0FBQ2I7QUFDQSxVQUFVLG1CQUFtQjtBQUM3QixXQUFXLE9BQU87QUFDbEIsV0FBVyxJQUFJLDJDQUEyQztBQUMxRCxhQUFhLFNBQVM7QUFDdEI7QUFDQSxnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQixvREFBb0QsZ0JBQWdCO0FBQ3BFO0FBQ0EsdUJBQXVCLDBCQUEwQjtBQUNqRDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxRQUFRLE9BQU8sRUFBRTtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFFBQVE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHVDQUF1QyxPQUFPLEtBQUs7QUFDbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSwrQkFBK0I7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsS0FBSzs7QUFFTCxHQUFHO0FBQ0g7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxNQUFNO0FBQ2pCO0FBQ0E7QUFDQSxnQkFBZ0I7QUFDaEIsbUNBQW1DLE9BQU87QUFDMUM7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBWSxHQUFHO0FBQ2YsY0FBYyxHQUFHO0FBQ2pCLGVBQWUsR0FBRztBQUNsQixXQUFXLEdBQUc7QUFDZDtBQUNBLFdBQVcsT0FBTyxtQkFBbUI7QUFDckMsWUFBWSxpQkFBaUI7QUFDN0I7QUFDQSxxQkFBcUI7O0FBRXJCO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLGFBQWEsT0FBTztBQUNwQixjQUFjO0FBQ2Q7QUFDQTtBQUNBLGlEQUFpRDtBQUNqRDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLCtCQUErQixHQUFHO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxXQUFXLEdBQUc7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QjtBQUN2QjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE9BQU87QUFDbEIsWUFBWSxPQUFPO0FBQ25CO0FBQ0E7QUFDQSx1Q0FBdUM7QUFDdkM7QUFDQSxvQkFBb0I7O0FBRXBCO0FBQ0E7QUFDQTtBQUNBLCtCQUErQjtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBLFFBQVEsUUFBUTtBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2IsWUFBWTtBQUNaLFlBQVk7QUFDWixjQUFjO0FBQ2Q7O0FBRUE7QUFDQTtBQUNBOztBQUVBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQ2xSQTs7QUFFQSxJQUFJLG1CQUFPLENBQUMsK0RBQVk7O0FBRXhCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsMkNBQTJDLEVBQUU7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTRCLEVBQUU7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQzNHQTtBQUNBO0FBQ2E7OztBQUdiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHNEQUFzRCxjQUFjOztBQUVwRTtBQUNBO0FBQ0EseUJBQXlCLFlBQVk7QUFDckM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxxQ0FBcUMsY0FBYztBQUNuRDs7QUFFQTtBQUNBO0FBQ0Esb0NBQW9DLGNBQWM7O0FBRWxEO0FBQ0E7QUFDQSxpQkFBaUIsYUFBYTs7QUFFOUI7QUFDQTtBQUNBOztBQUVBLFdBQVc7QUFDWDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsd0RBQXdELFVBQVU7O0FBRWxFO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDJCQUEyQixZQUFZO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0Esa0VBQWtFLFVBQVU7O0FBRTVFO0FBQ0E7QUFDQTs7QUFFQSxzQkFBc0IsVUFBVTs7QUFFaEM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQ2hKQTtBQUNBO0FBQ2E7OztBQUdiO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHVCQUF1QixXQUFXOztBQUVsQztBQUNBO0FBQ0EsMkRBQTJELFdBQVc7O0FBRXRFOztBQUVBO0FBQ0Esd0JBQXdCLFdBQVc7O0FBRW5DO0FBQ0EscUJBQXFCLFdBQVc7O0FBRWhDO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBLGtEQUFrRCxPQUFPO0FBQ3pEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsK0JBQStCLGNBQWM7QUFDN0M7QUFDQTs7QUFFQTtBQUNBLDhCQUE4QixjQUFjOztBQUU1QztBQUNBO0FBQ0EsZ0NBQWdDLGNBQWM7QUFDOUM7O0FBRUEsbURBQW1ELGNBQWM7QUFDakU7QUFDQSwyQkFBMkIsY0FBYzs7QUFFekM7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQVc7QUFDWDs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBLGFBQWE7QUFDYjtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQSxrQ0FBa0MsYUFBYTs7QUFFL0MsdURBQXVELGFBQWE7QUFDcEU7QUFDQSwrQkFBK0IsT0FBTzs7QUFFdEM7O0FBRUE7QUFDQTtBQUNBOztBQUVBLGdDQUFnQyxPQUFPO0FBQ3ZDOztBQUVBLGtDQUFrQyxPQUFPO0FBQ3pDLG1EQUFtRCxPQUFPOztBQUUxRDtBQUNBLDhCQUE4QixPQUFPO0FBQ3JDLGtDQUFrQyxVQUFVO0FBQzVDLDhCQUE4QixPQUFPOztBQUVyQyxtREFBbUQsT0FBTztBQUMxRDtBQUNBLDZCQUE2QixPQUFPOztBQUVwQztBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOzs7QUFHQSwwREFBMEQsa0RBQWtEO0FBQzVHOzs7Ozs7Ozs7Ozs7QUNuT2E7OztBQUdiLHdCQUF3QixtQkFBTyxDQUFDLG9FQUFjO0FBQzlDLHdCQUF3QixtQkFBTyxDQUFDLHNFQUFlO0FBQy9DLHdCQUF3QixtQkFBTyxDQUFDLG9GQUFzQjs7O0FBR3REO0FBQ0E7QUFDQSxZQUFZO0FBQ1osaUJBQWlCO0FBQ2pCO0FBQ0E7O0FBRUEsOENBQThDLHlCQUF5Qjs7QUFFdkU7O0FBRUE7QUFDQTs7Ozs7Ozs7Ozs7O0FDcEJhOzs7QUFHYix3QkFBd0IsbUJBQU8sQ0FBQyxpRkFBc0I7QUFDdEQsd0JBQXdCLG1CQUFPLENBQUMsb0ZBQXNCO0FBQ3RELHdCQUF3QixtQkFBTyxDQUFDLHdEQUFROzs7QUFHeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLCtCQUErQix5QkFBeUI7O0FBRXhEO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDYTs7QUFFYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUNBQXlDLE1BQU07QUFDL0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixNQUFNO0FBQzlCOzs7Ozs7Ozs7Ozs7QUN4Q0E7QUFDQTs7QUFFYTs7O0FBR2I7QUFDQSxzQ0FBc0M7QUFDdEM7OztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUssSUFBSTtBQUNUOztBQUVBLDBDQUEwQztBQUMxQztBQUNBO0FBQ0Esd0JBQXdCLFlBQVk7O0FBRXBDO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBOztBQUVBO0FBQ0E7QUFDQSxHQUFHLElBQUk7O0FBRVA7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBLDRCQUE0Qix5QkFBeUIsRUFBRTtBQUN2RDtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsc0JBQXNCLEVBQUU7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQ2xFYTs7QUFFYjtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRWE7OztBQUdiO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsdUNBQXVDLE9BQU87QUFDOUMsNkNBQTZDLFVBQVU7QUFDdkQ7O0FBRUE7QUFDQTtBQUNBLGlDQUFpQyxRQUFRO0FBQ3pDOztBQUVBO0FBQ0Esc0NBQXNDLGdDQUFnQztBQUN0RTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7O0FDeEZBO0FBQ0E7O0FBRWE7O0FBRWIsYUFBYSxtQkFBTyxDQUFDLDhDQUFROztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQix3QkFBd0I7QUFDbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSyxPQUFPO0FBQ1o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLG1CQUFtQixtQkFBbUI7QUFDdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQSxHQUFHO0FBQ0g7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVyxPQUFPO0FBQ2xCO0FBQ0EsV0FBVyxPQUFPO0FBQ2xCO0FBQ0EsV0FBVyxPQUFPO0FBQ2xCO0FBQ0E7QUFDQSxXQUFXLE9BQU87QUFDbEI7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0NBQWtDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUCxLQUFLOztBQUVMO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7OztBQzlSYTs7O0FBR2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTSxLQUF3QjtBQUM5QjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQ0FBb0MsT0FBTztBQUMzQztBQUNBLCtCQUErQixrQkFBa0IsRUFBRTtBQUNuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQixZQUFZO0FBQy9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkVBQTZFO0FBQzdFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwQ0FBMEMsWUFBWTtBQUN0RDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxZQUFZLDhCQUE4QjtBQUMxQztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0RBQXNEO0FBQ3REO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMENBQTBDLDBCQUEwQjtBQUNwRTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0MsWUFBWTtBQUNsRDtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0Esd0NBQXdDLFlBQVk7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsZ0JBQWdCO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsWUFBWSw4QkFBOEI7QUFDMUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsZ0JBQWdCO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QixnQkFBZ0I7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwQ0FBMEMsWUFBWTtBQUN0RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwwQ0FBMEMsWUFBWTtBQUN0RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QixXQUFXO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRDtBQUNwRCxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLDBDQUEwQztBQUMxQyxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxtQkFBbUI7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5Q0FBeUMsWUFBWTtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOENBQThDLFlBQVk7QUFDMUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOENBQThDLFlBQVk7QUFDMUQ7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCLGdCQUFnQjtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSx1QkFBdUIsZ0JBQWdCO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkNBQTZDLFlBQVk7QUFDekQ7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxxQkFBcUIsY0FBYztBQUNuQztBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQSxDQUFDO0FBQ0Q7Ozs7Ozs7VUN6L0RBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7O1dDdEJBO1dBQ0E7V0FDQTtXQUNBO1dBQ0E7V0FDQSxnQ0FBZ0MsWUFBWTtXQUM1QztXQUNBLEU7Ozs7O1dDUEE7V0FDQTtXQUNBO1dBQ0E7V0FDQSx3Q0FBd0MseUNBQXlDO1dBQ2pGO1dBQ0E7V0FDQSxFOzs7OztXQ1BBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EsRUFBRTtXQUNGO1dBQ0E7V0FDQSxDQUFDLEk7Ozs7O1dDUEQsd0Y7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0Esc0RBQXNELGtCQUFrQjtXQUN4RTtXQUNBLCtDQUErQyxjQUFjO1dBQzdELEU7Ozs7Ozs7Ozs7Ozs7O0FDTkEsMEJBQTBCO0FBRTRDO0FBSWxDO0FBRXBDLG9CQUFvQjtBQUNwQixLQUFLLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEtBQUssRUFBRSxPQUEyQixFQUFFLEVBQUU7SUFDckUsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDM0IsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyxDQUFDLENBQUM7QUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEtBQUssRUFBRSxPQUEyQixFQUFFLEVBQUU7SUFDbkUsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDM0IsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyxDQUFDLENBQUM7QUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLElBQUksRUFBRTtJQUM1QixNQUFNLEVBQUUsVUFBVSxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztJQUVuQyxtREFBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3hCLENBQUMsQ0FBQyxDQUFDO0FBRUgsS0FBSyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQzVDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0RBQXNELEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVFLENBQUMsQ0FBQyxDQUFDO0FBRUgsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxJQUFJLEVBQUU7SUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO0FBQzlDLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxJQUFzQyxFQUFFO0lBQzFDLElBQUksS0FBVSxFQUFFLEVBa0JmO0NBQ0YiLCJmaWxlIjoibW9kdWxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBwYXR0ZXJuc0NvbmZpZyA9IHJlcXVpcmUoJy4vcGF0dGVybnMuanMnKTtcblxuY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gIGxlZnREZWxpbWl0ZXI6ICd7JyxcbiAgcmlnaHREZWxpbWl0ZXI6ICd9JyxcbiAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtdXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGF0dHJpYnV0ZXMobWQsIG9wdGlvbnNfKSB7XG4gIGxldCBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMpO1xuICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihvcHRpb25zLCBvcHRpb25zXyk7XG5cbiAgY29uc3QgcGF0dGVybnMgPSBwYXR0ZXJuc0NvbmZpZyhvcHRpb25zKTtcblxuICBmdW5jdGlvbiBjdXJseUF0dHJzKHN0YXRlKSB7XG4gICAgbGV0IHRva2VucyA9IHN0YXRlLnRva2VucztcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBwID0gMDsgcCA8IHBhdHRlcm5zLmxlbmd0aDsgcCsrKSB7XG4gICAgICAgIGxldCBwYXR0ZXJuID0gcGF0dGVybnNbcF07XG4gICAgICAgIGxldCBqID0gbnVsbDsgLy8gcG9zaXRpb24gb2YgY2hpbGQgd2l0aCBvZmZzZXQgMFxuICAgICAgICBsZXQgbWF0Y2ggPSBwYXR0ZXJuLnRlc3RzLmV2ZXJ5KHQgPT4ge1xuICAgICAgICAgIGxldCByZXMgPSB0ZXN0KHRva2VucywgaSwgdCk7XG4gICAgICAgICAgaWYgKHJlcy5qICE9PSBudWxsKSB7IGogPSByZXMuajsgfVxuICAgICAgICAgIHJldHVybiByZXMubWF0Y2g7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICBwYXR0ZXJuLnRyYW5zZm9ybSh0b2tlbnMsIGksIGopO1xuICAgICAgICAgIGlmIChwYXR0ZXJuLm5hbWUgPT09ICdpbmxpbmUgYXR0cmlidXRlcycgfHwgcGF0dGVybi5uYW1lID09PSAnaW5saW5lIG5lc3RpbmcgMCcpIHtcbiAgICAgICAgICAgIC8vIHJldHJ5LCBtYXkgYmUgc2V2ZXJhbCBpbmxpbmUgYXR0cmlidXRlc1xuICAgICAgICAgICAgcC0tO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG1kLmNvcmUucnVsZXIuYmVmb3JlKCdsaW5raWZ5JywgJ2N1cmx5X2F0dHJpYnV0ZXMnLCBjdXJseUF0dHJzKTtcbn07XG5cbi8qKlxuICogVGVzdCBpZiB0IG1hdGNoZXMgdG9rZW4gc3RyZWFtLlxuICpcbiAqIEBwYXJhbSB7YXJyYXl9IHRva2Vuc1xuICogQHBhcmFtIHtudW1iZXJ9IGlcbiAqIEBwYXJhbSB7b2JqZWN0fSB0IFRlc3QgdG8gbWF0Y2guXG4gKiBAcmV0dXJuIHtvYmplY3R9IHsgbWF0Y2g6IHRydWV8ZmFsc2UsIGo6IG51bGx8bnVtYmVyIH1cbiAqL1xuZnVuY3Rpb24gdGVzdCh0b2tlbnMsIGksIHQpIHtcbiAgbGV0IHJlcyA9IHtcbiAgICBtYXRjaDogZmFsc2UsXG4gICAgajogbnVsbCAgLy8gcG9zaXRpb24gb2YgY2hpbGRcbiAgfTtcblxuICBsZXQgaWkgPSB0LnNoaWZ0ICE9PSB1bmRlZmluZWRcbiAgICA/IGkgKyB0LnNoaWZ0XG4gICAgOiB0LnBvc2l0aW9uO1xuICBsZXQgdG9rZW4gPSBnZXQodG9rZW5zLCBpaSk7ICAvLyBzdXBwb3J0cyBuZWdhdGl2ZSBpaVxuXG5cbiAgaWYgKHRva2VuID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHJlczsgfVxuXG4gIGZvciAobGV0IGtleSBpbiB0KSB7XG4gICAgaWYgKGtleSA9PT0gJ3NoaWZ0JyB8fCBrZXkgPT09ICdwb3NpdGlvbicpIHsgY29udGludWU7IH1cblxuICAgIGlmICh0b2tlbltrZXldID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHJlczsgfVxuXG4gICAgaWYgKGtleSA9PT0gJ2NoaWxkcmVuJyAmJiBpc0FycmF5T2ZPYmplY3RzKHQuY2hpbGRyZW4pKSB7XG4gICAgICBpZiAodG9rZW4uY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgICB9XG4gICAgICBsZXQgbWF0Y2g7XG4gICAgICBsZXQgY2hpbGRUZXN0cyA9IHQuY2hpbGRyZW47XG4gICAgICBsZXQgY2hpbGRyZW4gPSB0b2tlbi5jaGlsZHJlbjtcbiAgICAgIGlmIChjaGlsZFRlc3RzLmV2ZXJ5KHR0ID0+IHR0LnBvc2l0aW9uICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIC8vIHBvc2l0aW9ucyBpbnN0ZWFkIG9mIHNoaWZ0cywgZG8gbm90IGxvb3AgYWxsIGNoaWxkcmVuXG4gICAgICAgIG1hdGNoID0gY2hpbGRUZXN0cy5ldmVyeSh0dCA9PiB0ZXN0KGNoaWxkcmVuLCB0dC5wb3NpdGlvbiwgdHQpLm1hdGNoKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgLy8gd2UgbWF5IG5lZWQgcG9zaXRpb24gb2YgY2hpbGQgaW4gdHJhbnNmb3JtXG4gICAgICAgICAgbGV0IGogPSBsYXN0KGNoaWxkVGVzdHMpLnBvc2l0aW9uO1xuICAgICAgICAgIHJlcy5qID0gaiA+PSAwID8gaiA6IGNoaWxkcmVuLmxlbmd0aCArIGo7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgY2hpbGRyZW4ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBtYXRjaCA9IGNoaWxkVGVzdHMuZXZlcnkodHQgPT4gdGVzdChjaGlsZHJlbiwgaiwgdHQpLm1hdGNoKTtcbiAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIHJlcy5qID0gajtcbiAgICAgICAgICAgIC8vIGFsbCB0ZXN0cyB0cnVlLCBjb250aW51ZSB3aXRoIG5leHQga2V5IG9mIHBhdHRlcm4gdFxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXRjaCA9PT0gZmFsc2UpIHsgcmV0dXJuIHJlczsgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHR5cGVvZiB0W2tleV0pIHtcbiAgICBjYXNlICdib29sZWFuJzpcbiAgICBjYXNlICdudW1iZXInOlxuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICBpZiAodG9rZW5ba2V5XSAhPT0gdFtrZXldKSB7IHJldHVybiByZXM7IH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgIGlmICghdFtrZXldKHRva2VuW2tleV0pKSB7IHJldHVybiByZXM7IH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICBpZiAoaXNBcnJheU9mRnVuY3Rpb25zKHRba2V5XSkpIHtcbiAgICAgICAgbGV0IHIgPSB0W2tleV0uZXZlcnkodHQgPT4gdHQodG9rZW5ba2V5XSkpO1xuICAgICAgICBpZiAociA9PT0gZmFsc2UpIHsgcmV0dXJuIHJlczsgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAvLyBmYWxsIHRocm91Z2ggZm9yIG9iamVjdHMgIT09IGFycmF5cyBvZiBmdW5jdGlvbnNcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHR5cGUgb2YgcGF0dGVybiB0ZXN0IChrZXk6ICR7a2V5fSkuIFRlc3Qgc2hvdWxkIGJlIG9mIHR5cGUgYm9vbGVhbiwgbnVtYmVyLCBzdHJpbmcsIGZ1bmN0aW9uIG9yIGFycmF5IG9mIGZ1bmN0aW9ucy5gKTtcbiAgICB9XG4gIH1cblxuICAvLyBubyB0ZXN0cyByZXR1cm5lZCBmYWxzZSAtPiBhbGwgdGVzdHMgcmV0dXJucyB0cnVlXG4gIHJlcy5tYXRjaCA9IHRydWU7XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPZk9iamVjdHMoYXJyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFycikgJiYgYXJyLmxlbmd0aCAmJiBhcnIuZXZlcnkoaSA9PiB0eXBlb2YgaSA9PT0gJ29iamVjdCcpO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5T2ZGdW5jdGlvbnMoYXJyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFycikgJiYgYXJyLmxlbmd0aCAmJiBhcnIuZXZlcnkoaSA9PiB0eXBlb2YgaSA9PT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogR2V0IG4gaXRlbSBvZiBhcnJheS4gU3VwcG9ydHMgbmVnYXRpdmUgbiwgd2hlcmUgLTEgaXMgbGFzdFxuICogZWxlbWVudCBpbiBhcnJheS5cbiAqIEBwYXJhbSB7YXJyYXl9IGFyclxuICogQHBhcmFtIHtudW1iZXJ9IG5cbiAqL1xuZnVuY3Rpb24gZ2V0KGFyciwgbikge1xuICByZXR1cm4gbiA+PSAwID8gYXJyW25dIDogYXJyW2Fyci5sZW5ndGggKyBuXTtcbn1cblxuLy8gZ2V0IGxhc3QgZWxlbWVudCBvZiBhcnJheSwgc2FmZSAtIHJldHVybnMge30gaWYgbm90IGZvdW5kXG5mdW5jdGlvbiBsYXN0KGFycikge1xuICByZXR1cm4gYXJyLnNsaWNlKC0xKVswXSB8fCB7fTtcbn1cbiIsIid1c2Ugc3RyaWN0Jztcbi8qKlxuICogSWYgYSBwYXR0ZXJuIG1hdGNoZXMgdGhlIHRva2VuIHN0cmVhbSxcbiAqIHRoZW4gcnVuIHRyYW5zZm9ybS5cbiAqL1xuXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBvcHRpb25zID0+IHtcbiAgY29uc3QgX19ociA9IG5ldyBSZWdFeHAoJ14gezAsM31bLSpfXXszLH0gPydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKyB1dGlscy5lc2NhcGVSZWdFeHAob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICArICdbXicgKyB1dGlscy5lc2NhcGVSZWdFeHAob3B0aW9ucy5yaWdodERlbGltaXRlcikgKyAnXScpO1xuXG4gIHJldHVybiAoW1xuICAgIHtcbiAgICAgIC8qKlxuICAgICAgICogYGBgcHl0aG9uIHsuY2xzfVxuICAgICAgICogZm9yIGkgaW4gcmFuZ2UoMTApOlxuICAgICAgICogICAgIHByaW50KGkpXG4gICAgICAgKiBgYGBcbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2ZlbmNlZCBjb2RlIGJsb2NrcycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgYmxvY2s6IHRydWUsXG4gICAgICAgICAgaW5mbzogdXRpbHMuaGFzRGVsaW1pdGVycygnZW5kJywgb3B0aW9ucylcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSkgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICAgIGxldCBzdGFydCA9IHRva2VuLmluZm8ubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKTtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnModG9rZW4uaW5mbywgc3RhcnQsIG9wdGlvbnMpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdG9rZW4pO1xuICAgICAgICB0b2tlbi5pbmZvID0gdXRpbHMucmVtb3ZlRGVsaW1pdGVyKHRva2VuLmluZm8sIG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogYmxhIGBjbGljaygpYHsuY30gIVtdKGltZy5wbmcpey5kfVxuICAgICAgICpcbiAgICAgICAqIGRpZmZlcnMgZnJvbSAnaW5saW5lIGF0dHJpYnV0ZXMnIGFzIGl0IGRvZXNcbiAgICAgICAqIG5vdCBoYXZlIGEgY2xvc2luZyB0YWcgKG5lc3Rpbmc6IC0xKVxuICAgICAgICovXG4gICAgICBuYW1lOiAnaW5saW5lIG5lc3RpbmcgMCcsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2hpZnQ6IC0xLFxuICAgICAgICAgICAgICB0eXBlOiAoc3RyKSA9PiBzdHIgPT09ICdpbWFnZScgfHwgc3RyID09PSAnY29kZV9pbmxpbmUnXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ3N0YXJ0Jywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgZW5kQ2hhciA9IHRva2VuLmNvbnRlbnQuaW5kZXhPZihvcHRpb25zLnJpZ2h0RGVsaW1pdGVyKTtcbiAgICAgICAgbGV0IGF0dHJUb2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqIC0gMV07XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKHRva2VuLmNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgYXR0clRva2VuKTtcbiAgICAgICAgaWYgKHRva2VuLmNvbnRlbnQubGVuZ3RoID09PSAoZW5kQ2hhciArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKSkge1xuICAgICAgICAgIHRva2Vuc1tpXS5jaGlsZHJlbi5zcGxpY2UoaiwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9rZW4uY29udGVudCA9IHRva2VuLmNvbnRlbnQuc2xpY2UoZW5kQ2hhciArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogfCBoMSB8XG4gICAgICAgKiB8IC0tIHxcbiAgICAgICAqIHwgYzEgfFxuICAgICAgICpcbiAgICAgICAqIHsuY31cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ3RhYmxlcycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gbGV0IHRoaXMgdG9rZW4gYmUgaSwgc3VjaCB0aGF0IGZvci1sb29wIGNvbnRpbnVlcyBhdFxuICAgICAgICAgIC8vIG5leHQgdG9rZW4gYWZ0ZXIgdG9rZW5zLnNwbGljZVxuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6ICd0YWJsZV9jbG9zZSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIHNoaWZ0OiAxLFxuICAgICAgICAgIHR5cGU6ICdwYXJhZ3JhcGhfb3BlbidcbiAgICAgICAgfSwge1xuICAgICAgICAgIHNoaWZ0OiAyLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ29ubHknLCBvcHRpb25zKVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpICsgMl07XG4gICAgICAgIGxldCB0YWJsZU9wZW4gPSB1dGlscy5nZXRNYXRjaGluZ09wZW5pbmdUb2tlbih0b2tlbnMsIGkpO1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyh0b2tlbi5jb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgLy8gYWRkIGF0dHJpYnV0ZXNcbiAgICAgICAgdXRpbHMuYWRkQXR0cnMoYXR0cnMsIHRhYmxlT3Blbik7XG4gICAgICAgIC8vIHJlbW92ZSA8cD57LmN9PC9wPlxuICAgICAgICB0b2tlbnMuc3BsaWNlKGkgKyAxLCAzKTtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICAvKipcbiAgICAgICAqICplbXBoYXNpcyp7LndpdGggYXR0cnM9MX1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2lubGluZSBhdHRyaWJ1dGVzJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaGlmdDogLTEsXG4gICAgICAgICAgICAgIG5lc3Rpbmc6IC0xICAvLyBjbG9zaW5nIGlubGluZSB0YWcsIDwvZW0+ey5hfVxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgICBjb250ZW50OiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdzdGFydCcsIG9wdGlvbnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgbGV0IG9wZW5pbmdUb2tlbiA9IHV0aWxzLmdldE1hdGNoaW5nT3BlbmluZ1Rva2VuKHRva2Vuc1tpXS5jaGlsZHJlbiwgaiAtIDEpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgb3BlbmluZ1Rva2VuKTtcbiAgICAgICAgdG9rZW4uY29udGVudCA9IGNvbnRlbnQuc2xpY2UoY29udGVudC5pbmRleE9mKG9wdGlvbnMucmlnaHREZWxpbWl0ZXIpICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogLSBpdGVtXG4gICAgICAgKiB7LmF9XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdsaXN0IHNvZnRicmVhaycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IC0yLFxuICAgICAgICAgIHR5cGU6ICdsaXN0X2l0ZW1fb3BlbidcbiAgICAgICAgfSwge1xuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAtMixcbiAgICAgICAgICAgICAgdHlwZTogJ3NvZnRicmVhaydcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0xLFxuICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ29ubHknLCBvcHRpb25zKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSwgaikgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW5bal07XG4gICAgICAgIGxldCBjb250ZW50ID0gdG9rZW4uY29udGVudDtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnMoY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBpaSA9IGkgLSAyO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2lpIC0gMV0gJiZcbiAgICAgICAgICB0b2tlbnNbaWkgLSAxXS50eXBlICE9PSAnb3JkZXJlZF9saXN0X29wZW4nICYmXG4gICAgICAgICAgdG9rZW5zW2lpIC0gMV0udHlwZSAhPT0gJ2J1bGxldF9saXN0X29wZW4nKSB7IGlpLS07IH1cbiAgICAgICAgdXRpbHMuYWRkQXR0cnMoYXR0cnMsIHRva2Vuc1tpaSAtIDFdKTtcbiAgICAgICAgdG9rZW5zW2ldLmNoaWxkcmVuID0gdG9rZW5zW2ldLmNoaWxkcmVuLnNsaWNlKDAsIC0yKTtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICAvKipcbiAgICAgICAqIC0gbmVzdGVkIGxpc3RcbiAgICAgICAqICAgLSB3aXRoIGRvdWJsZSBcXG5cbiAgICAgICAqICAgey5hfSA8LS0gYXBwbHkgdG8gbmVzdGVkIHVsXG4gICAgICAgKlxuICAgICAgICogey5ifSA8LS0gYXBwbHkgdG8gcm9vdCA8dWw+XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdsaXN0IGRvdWJsZSBzb2Z0YnJlYWsnLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIC8vIGxldCB0aGlzIHRva2VuIGJlIGkgPSAwIHNvIHRoYXQgd2UgY2FuIGVyYXNlXG4gICAgICAgICAgLy8gdGhlIDxwPnsuYX08L3A+IHRva2VucyBiZWxvd1xuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6IChzdHIpID0+XG4gICAgICAgICAgICBzdHIgPT09ICdidWxsZXRfbGlzdF9jbG9zZScgfHxcbiAgICAgICAgICAgIHN0ciA9PT0gJ29yZGVyZWRfbGlzdF9jbG9zZSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIHNoaWZ0OiAxLFxuICAgICAgICAgIHR5cGU6ICdwYXJhZ3JhcGhfb3BlbidcbiAgICAgICAgfSwge1xuICAgICAgICAgIHNoaWZ0OiAyLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ29ubHknLCBvcHRpb25zKSxcbiAgICAgICAgICBjaGlsZHJlbjogKGFycikgPT4gYXJyLmxlbmd0aCA9PT0gMVxuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDMsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9jbG9zZSdcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSkgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaSArIDJdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zLCBpKTtcbiAgICAgICAgdXRpbHMuYWRkQXR0cnMoYXR0cnMsIG9wZW5pbmdUb2tlbik7XG4gICAgICAgIHRva2Vucy5zcGxpY2UoaSArIDEsIDMpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogLSBlbmQgb2Ygey5saXN0LWl0ZW19XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdsaXN0IGl0ZW0gZW5kJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogLTIsXG4gICAgICAgICAgdHlwZTogJ2xpc3RfaXRlbV9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0xLFxuICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ2VuZCcsIG9wdGlvbnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCBjb250ZW50Lmxhc3RJbmRleE9mKG9wdGlvbnMubGVmdERlbGltaXRlciksIG9wdGlvbnMpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdG9rZW5zW2kgLSAyXSk7XG4gICAgICAgIGxldCB0cmltbWVkID0gY29udGVudC5zbGljZSgwLCBjb250ZW50Lmxhc3RJbmRleE9mKG9wdGlvbnMubGVmdERlbGltaXRlcikpO1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gbGFzdCh0cmltbWVkKSAhPT0gJyAnID9cbiAgICAgICAgICB0cmltbWVkIDogdHJpbW1lZC5zbGljZSgwLCAtMSk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiBzb21ldGhpbmcgd2l0aCBzb2Z0YnJlYWtcbiAgICAgICAqIHsuY2xzfVxuICAgICAgICovXG4gICAgICBuYW1lOiAnXFxuey5hfSBzb2Z0YnJlYWsgdGhlbiBjdXJseSBpbiBzdGFydCcsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0yLFxuICAgICAgICAgICAgICB0eXBlOiAnc29mdGJyZWFrJ1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTEsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnModG9rZW4uY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIC8vIGZpbmQgbGFzdCBjbG9zaW5nIHRhZ1xuICAgICAgICBsZXQgaWkgPSBpICsgMTtcbiAgICAgICAgd2hpbGUgKHRva2Vuc1tpaSArIDFdICYmIHRva2Vuc1tpaSArIDFdLm5lc3RpbmcgPT09IC0xKSB7IGlpKys7IH1cbiAgICAgICAgbGV0IG9wZW5pbmdUb2tlbiA9IHV0aWxzLmdldE1hdGNoaW5nT3BlbmluZ1Rva2VuKHRva2VucywgaWkpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgb3BlbmluZ1Rva2VuKTtcbiAgICAgICAgdG9rZW5zW2ldLmNoaWxkcmVuID0gdG9rZW5zW2ldLmNoaWxkcmVuLnNsaWNlKDAsIC0yKTtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICAvKipcbiAgICAgICAqIGhvcml6b250YWwgcnVsZSAtLS0geyNpZH1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2hvcml6b250YWwgcnVsZScsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9vcGVuJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDEsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IChhcnIpID0+IGFyci5sZW5ndGggPT09IDEsXG4gICAgICAgICAgY29udGVudDogKHN0cikgPT4gc3RyLm1hdGNoKF9faHIpICE9PSBudWxsLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDIsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9jbG9zZSdcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSkgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICAgIHRva2VuLnR5cGUgPSAnaHInO1xuICAgICAgICB0b2tlbi50YWcgPSAnaHInO1xuICAgICAgICB0b2tlbi5uZXN0aW5nID0gMDtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbnNbaSArIDFdLmNvbnRlbnQ7XG4gICAgICAgIGxldCBzdGFydCA9IGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKTtcbiAgICAgICAgdG9rZW4uYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCBzdGFydCwgb3B0aW9ucyk7XG4gICAgICAgIHRva2VuLm1hcmt1cCA9IGNvbnRlbnQ7XG4gICAgICAgIHRva2Vucy5zcGxpY2UoaSArIDEsIDIpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogZW5kIG9mIHsuYmxvY2t9XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdlbmQgb2YgYmxvY2snLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAtMSxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnZW5kJywgb3B0aW9ucyksXG4gICAgICAgICAgICAgIHR5cGU6ICh0KSA9PiB0ICE9PSAnY29kZV9pbmxpbmUnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCBjb250ZW50Lmxhc3RJbmRleE9mKG9wdGlvbnMubGVmdERlbGltaXRlciksIG9wdGlvbnMpO1xuICAgICAgICBsZXQgaWkgPSBpICsgMTtcbiAgICAgICAgd2hpbGUgKHRva2Vuc1tpaSArIDFdICYmIHRva2Vuc1tpaSArIDFdLm5lc3RpbmcgPT09IC0xKSB7IGlpKys7IH1cbiAgICAgICAgbGV0IG9wZW5pbmdUb2tlbiA9IHV0aWxzLmdldE1hdGNoaW5nT3BlbmluZ1Rva2VuKHRva2VucywgaWkpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgb3BlbmluZ1Rva2VuKTtcbiAgICAgICAgbGV0IHRyaW1tZWQgPSBjb250ZW50LnNsaWNlKDAsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSk7XG4gICAgICAgIHRva2VuLmNvbnRlbnQgPSBsYXN0KHRyaW1tZWQpICE9PSAnICcgP1xuICAgICAgICAgIHRyaW1tZWQgOiB0cmltbWVkLnNsaWNlKDAsIC0xKTtcbiAgICAgIH1cbiAgICB9XG4gIF0pO1xufTtcblxuLy8gZ2V0IGxhc3QgZWxlbWVudCBvZiBhcnJheSBvciBzdHJpbmdcbmZ1bmN0aW9uIGxhc3QoYXJyKSB7XG4gIHJldHVybiBhcnIuc2xpY2UoLTEpWzBdO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLyoqXG4gKiBwYXJzZSB7LmNsYXNzICNpZCBrZXk9dmFsfSBzdHJpbmdzXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyOiBzdHJpbmcgdG8gcGFyc2VcbiAqIEBwYXJhbSB7aW50fSBzdGFydDogd2hlcmUgdG8gc3RhcnQgcGFyc2luZyAoaW5jbHVkaW5nIHspXG4gKiBAcmV0dXJucyB7MmQgYXJyYXl9OiBbWydrZXknLCAndmFsJ10sIFsnY2xhc3MnLCAncmVkJ11dXG4gKi9cbmV4cG9ydHMuZ2V0QXR0cnMgPSBmdW5jdGlvbiAoc3RyLCBzdGFydCwgb3B0aW9ucykge1xuICAvLyBub3QgdGFiLCBsaW5lIGZlZWQsIGZvcm0gZmVlZCwgc3BhY2UsIHNvbGlkdXMsIGdyZWF0ZXIgdGhhbiBzaWduLCBxdW90YXRpb24gbWFyaywgYXBvc3Ryb3BoZSBhbmQgZXF1YWxzIHNpZ25cbiAgY29uc3QgYWxsb3dlZEtleUNoYXJzID0gL1teXFx0XFxuXFxmIC8+XCInPV0vO1xuICBjb25zdCBwYWlyU2VwYXJhdG9yID0gJyAnO1xuICBjb25zdCBrZXlTZXBhcmF0b3IgPSAnPSc7XG4gIGNvbnN0IGNsYXNzQ2hhciA9ICcuJztcbiAgY29uc3QgaWRDaGFyID0gJyMnO1xuXG4gIGNvbnN0IGF0dHJzID0gW107XG4gIGxldCBrZXkgPSAnJztcbiAgbGV0IHZhbHVlID0gJyc7XG4gIGxldCBwYXJzaW5nS2V5ID0gdHJ1ZTtcbiAgbGV0IHZhbHVlSW5zaWRlUXVvdGVzID0gZmFsc2U7XG5cbiAgLy8gcmVhZCBpbnNpZGUge31cbiAgLy8gc3RhcnQgKyBsZWZ0IGRlbGltaXRlciBsZW5ndGggdG8gYXZvaWQgYmVnaW5uaW5nIHtcbiAgLy8gYnJlYWtzIHdoZW4gfSBpcyBmb3VuZCBvciBlbmQgb2Ygc3RyaW5nXG4gIGZvciAobGV0IGkgPSBzdGFydCArIG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGg7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoc3RyLnNsaWNlKGksIGkgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCkgPT09IG9wdGlvbnMucmlnaHREZWxpbWl0ZXIpIHtcbiAgICAgIGlmIChrZXkgIT09ICcnKSB7IGF0dHJzLnB1c2goW2tleSwgdmFsdWVdKTsgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGxldCBjaGFyXyA9IHN0ci5jaGFyQXQoaSk7XG5cbiAgICAvLyBzd2l0Y2ggdG8gcmVhZGluZyB2YWx1ZSBpZiBlcXVhbCBzaWduXG4gICAgaWYgKGNoYXJfID09PSBrZXlTZXBhcmF0b3IgJiYgcGFyc2luZ0tleSkge1xuICAgICAgcGFyc2luZ0tleSA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gey5jbGFzc30gey4uY3NzLW1vZHVsZX1cbiAgICBpZiAoY2hhcl8gPT09IGNsYXNzQ2hhciAmJiBrZXkgPT09ICcnKSB7XG4gICAgICBpZiAoc3RyLmNoYXJBdChpICsgMSkgPT09IGNsYXNzQ2hhcikge1xuICAgICAgICBrZXkgPSAnY3NzLW1vZHVsZSc7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9ICdjbGFzcyc7XG4gICAgICB9XG4gICAgICBwYXJzaW5nS2V5ID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB7I2lkfVxuICAgIGlmIChjaGFyXyA9PT0gaWRDaGFyICYmIGtleSA9PT0gJycpIHtcbiAgICAgIGtleSA9ICdpZCc7XG4gICAgICBwYXJzaW5nS2V5ID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB7dmFsdWU9XCJpbnNpZGUgcXVvdGVzXCJ9XG4gICAgaWYgKGNoYXJfID09PSAnXCInICYmIHZhbHVlID09PSAnJykge1xuICAgICAgdmFsdWVJbnNpZGVRdW90ZXMgPSB0cnVlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChjaGFyXyA9PT0gJ1wiJyAmJiB2YWx1ZUluc2lkZVF1b3Rlcykge1xuICAgICAgdmFsdWVJbnNpZGVRdW90ZXMgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHJlYWQgbmV4dCBrZXkvdmFsdWUgcGFpclxuICAgIGlmICgoY2hhcl8gPT09IHBhaXJTZXBhcmF0b3IgJiYgIXZhbHVlSW5zaWRlUXVvdGVzKSkge1xuICAgICAgaWYgKGtleSA9PT0gJycpIHtcbiAgICAgICAgLy8gYmVnaW5uaW5nIG9yIGVuZGluZyBzcGFjZTogeyAucmVkIH0gdnMgey5yZWR9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgYXR0cnMucHVzaChba2V5LCB2YWx1ZV0pO1xuICAgICAga2V5ID0gJyc7XG4gICAgICB2YWx1ZSA9ICcnO1xuICAgICAgcGFyc2luZ0tleSA9IHRydWU7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBjb250aW51ZSBpZiBjaGFyYWN0ZXIgbm90IGFsbG93ZWRcbiAgICBpZiAocGFyc2luZ0tleSAmJiBjaGFyXy5zZWFyY2goYWxsb3dlZEtleUNoYXJzKSA9PT0gLTEpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIG5vIG90aGVyIGNvbmRpdGlvbnMgbWV0OyBhcHBlbmQgdG8ga2V5L3ZhbHVlXG4gICAgaWYgKHBhcnNpbmdLZXkpIHtcbiAgICAgIGtleSArPSBjaGFyXztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YWx1ZSArPSBjaGFyXztcbiAgfVxuXG4gIGlmIChvcHRpb25zLmFsbG93ZWRBdHRyaWJ1dGVzICYmIG9wdGlvbnMuYWxsb3dlZEF0dHJpYnV0ZXMubGVuZ3RoKSB7XG4gICAgbGV0IGFsbG93ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hbGxvd2VkQXR0cmlidXRlcztcblxuICAgIHJldHVybiBhdHRycy5maWx0ZXIoZnVuY3Rpb24gKGF0dHJQYWlyKSB7XG4gICAgICBsZXQgYXR0ciA9IGF0dHJQYWlyWzBdO1xuXG4gICAgICBmdW5jdGlvbiBpc0FsbG93ZWRBdHRyaWJ1dGUgKGFsbG93ZWRBdHRyaWJ1dGUpIHtcbiAgICAgICAgcmV0dXJuIChhdHRyID09PSBhbGxvd2VkQXR0cmlidXRlXG4gICAgICAgICAgfHwgKGFsbG93ZWRBdHRyaWJ1dGUgaW5zdGFuY2VvZiBSZWdFeHAgJiYgYWxsb3dlZEF0dHJpYnV0ZS50ZXN0KGF0dHIpKVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYWxsb3dlZEF0dHJpYnV0ZXMuc29tZShpc0FsbG93ZWRBdHRyaWJ1dGUpO1xuICAgIH0pO1xuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG59O1xuXG4vKipcbiAqIGFkZCBhdHRyaWJ1dGVzIGZyb20gW1sna2V5JywgJ3ZhbCddXSBsaXN0XG4gKiBAcGFyYW0ge2FycmF5fSBhdHRyczogW1sna2V5JywgJ3ZhbCddXVxuICogQHBhcmFtIHt0b2tlbn0gdG9rZW46IHdoaWNoIHRva2VuIHRvIGFkZCBhdHRyaWJ1dGVzXG4gKiBAcmV0dXJucyB0b2tlblxuICovXG5leHBvcnRzLmFkZEF0dHJzID0gZnVuY3Rpb24gKGF0dHJzLCB0b2tlbikge1xuICBmb3IgKGxldCBqID0gMCwgbCA9IGF0dHJzLmxlbmd0aDsgaiA8IGw7ICsraikge1xuICAgIGxldCBrZXkgPSBhdHRyc1tqXVswXTtcbiAgICBpZiAoa2V5ID09PSAnY2xhc3MnKSB7XG4gICAgICB0b2tlbi5hdHRySm9pbignY2xhc3MnLCBhdHRyc1tqXVsxXSk7XG4gICAgfSBlbHNlIGlmIChrZXkgPT09ICdjc3MtbW9kdWxlJykge1xuICAgICAgdG9rZW4uYXR0ckpvaW4oJ2Nzcy1tb2R1bGUnLCBhdHRyc1tqXVsxXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRva2VuLmF0dHJQdXNoKGF0dHJzW2pdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRva2VuO1xufTtcblxuLyoqXG4gKiBEb2VzIHN0cmluZyBoYXZlIHByb3Blcmx5IGZvcm1hdHRlZCBjdXJseT9cbiAqXG4gKiBzdGFydDogJ3suYX0gYXNkZidcbiAqIG1pZGRsZTogJ2F7LmJ9YydcbiAqIGVuZDogJ2FzZGYgey5hfSdcbiAqIG9ubHk6ICd7LmF9J1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB3aGVyZSB0byBleHBlY3Qge30gY3VybHkuIHN0YXJ0LCBtaWRkbGUsIGVuZCBvciBvbmx5LlxuICogQHJldHVybiB7ZnVuY3Rpb24oc3RyaW5nKX0gRnVuY3Rpb24gd2hpY2ggdGVzdGVzIGlmIHN0cmluZyBoYXMgY3VybHkuXG4gKi9cbmV4cG9ydHMuaGFzRGVsaW1pdGVycyA9IGZ1bmN0aW9uICh3aGVyZSwgb3B0aW9ucykge1xuXG4gIGlmICghd2hlcmUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcmFtZXRlciBgd2hlcmVgIG5vdCBwYXNzZWQuIFNob3VsZCBiZSBcInN0YXJ0XCIsIFwibWlkZGxlXCIsIFwiZW5kXCIgb3IgXCJvbmx5XCIuJyk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IHN0clxuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKi9cbiAgcmV0dXJuIGZ1bmN0aW9uIChzdHIpIHtcbiAgICAvLyB3ZSBuZWVkIG1pbmltdW0gdGhyZWUgY2hhcnMsIGZvciBleGFtcGxlIHtifVxuICAgIGxldCBtaW5DdXJseUxlbmd0aCA9IG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGggKyAxICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGg7XG4gICAgaWYgKCFzdHIgfHwgdHlwZW9mIHN0ciAhPT0gJ3N0cmluZycgfHwgc3RyLmxlbmd0aCA8IG1pbkN1cmx5TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWRDdXJseUxlbmd0aCAoY3VybHkpIHtcbiAgICAgIGxldCBpc0NsYXNzID0gY3VybHkuY2hhckF0KG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGgpID09PSAnLic7XG4gICAgICBsZXQgaXNJZCA9IGN1cmx5LmNoYXJBdChvcHRpb25zLmxlZnREZWxpbWl0ZXIubGVuZ3RoKSA9PT0gJyMnO1xuICAgICAgcmV0dXJuIChpc0NsYXNzIHx8IGlzSWQpXG4gICAgICAgID8gY3VybHkubGVuZ3RoID49IChtaW5DdXJseUxlbmd0aCArIDEpXG4gICAgICAgIDogY3VybHkubGVuZ3RoID49IG1pbkN1cmx5TGVuZ3RoO1xuICAgIH1cblxuICAgIGxldCBzdGFydCwgZW5kLCBzbGljZSwgbmV4dENoYXI7XG4gICAgbGV0IHJpZ2h0RGVsaW1pdGVyTWluaW11bVNoaWZ0ID0gbWluQ3VybHlMZW5ndGggLSBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aDtcbiAgICBzd2l0Y2ggKHdoZXJlKSB7XG4gICAgY2FzZSAnc3RhcnQnOlxuICAgICAgLy8gZmlyc3QgY2hhciBzaG91bGQgYmUgeywgfSBmb3VuZCBpbiBjaGFyIDIgb3IgbW9yZVxuICAgICAgc2xpY2UgPSBzdHIuc2xpY2UoMCwgb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICBzdGFydCA9IHNsaWNlID09PSBvcHRpb25zLmxlZnREZWxpbWl0ZXIgPyAwIDogLTE7XG4gICAgICBlbmQgPSBzdGFydCA9PT0gLTEgPyAtMSA6IHN0ci5pbmRleE9mKG9wdGlvbnMucmlnaHREZWxpbWl0ZXIsIHJpZ2h0RGVsaW1pdGVyTWluaW11bVNoaWZ0KTtcbiAgICAgIC8vIGNoZWNrIGlmIG5leHQgY2hhcmFjdGVyIGlzIG5vdCBvbmUgb2YgdGhlIGRlbGltaXRlcnNcbiAgICAgIG5leHRDaGFyID0gc3RyLmNoYXJBdChlbmQgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICBpZiAobmV4dENoYXIgJiYgb3B0aW9ucy5yaWdodERlbGltaXRlci5pbmRleE9mKG5leHRDaGFyKSAhPT0gLTEpIHtcbiAgICAgICAgZW5kID0gLTE7XG4gICAgICB9XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2VuZCc6XG4gICAgICAvLyBsYXN0IGNoYXIgc2hvdWxkIGJlIH1cbiAgICAgIHN0YXJ0ID0gc3RyLmxhc3RJbmRleE9mKG9wdGlvbnMubGVmdERlbGltaXRlcik7XG4gICAgICBlbmQgPSBzdGFydCA9PT0gLTEgPyAtMSA6IHN0ci5pbmRleE9mKG9wdGlvbnMucmlnaHREZWxpbWl0ZXIsIHN0YXJ0ICsgcmlnaHREZWxpbWl0ZXJNaW5pbXVtU2hpZnQpO1xuICAgICAgZW5kID0gZW5kID09PSBzdHIubGVuZ3RoIC0gb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGggPyBlbmQgOiAtMTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnb25seSc6XG4gICAgICAvLyAney5hfSdcbiAgICAgIHNsaWNlID0gc3RyLnNsaWNlKDAsIG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgc3RhcnQgPSBzbGljZSA9PT0gb3B0aW9ucy5sZWZ0RGVsaW1pdGVyID8gMCA6IC0xO1xuICAgICAgc2xpY2UgPSBzdHIuc2xpY2Uoc3RyLmxlbmd0aCAtIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgIGVuZCA9IHNsaWNlID09PSBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyID8gc3RyLmxlbmd0aCAtIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoIDogLTE7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhcnQgIT09IC0xICYmIGVuZCAhPT0gLTEgJiYgdmFsaWRDdXJseUxlbmd0aChzdHIuc3Vic3RyaW5nKHN0YXJ0LCBlbmQgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCkpO1xuICB9O1xufTtcblxuLyoqXG4gKiBSZW1vdmVzIGxhc3QgY3VybHkgZnJvbSBzdHJpbmcuXG4gKi9cbmV4cG9ydHMucmVtb3ZlRGVsaW1pdGVyID0gZnVuY3Rpb24gKHN0ciwgb3B0aW9ucykge1xuICBjb25zdCBzdGFydCA9IGVzY2FwZVJlZ0V4cChvcHRpb25zLmxlZnREZWxpbWl0ZXIpO1xuICBjb25zdCBlbmQgPSBlc2NhcGVSZWdFeHAob3B0aW9ucy5yaWdodERlbGltaXRlcik7XG5cbiAgbGV0IGN1cmx5ID0gbmV3IFJlZ0V4cChcbiAgICAnWyBcXFxcbl0/JyArIHN0YXJ0ICsgJ1teJyArIHN0YXJ0ICsgZW5kICsgJ10rJyArIGVuZCArICckJ1xuICApO1xuICBsZXQgcG9zID0gc3RyLnNlYXJjaChjdXJseSk7XG5cbiAgcmV0dXJuIHBvcyAhPT0gLTEgPyBzdHIuc2xpY2UoMCwgcG9zKSA6IHN0cjtcbn07XG5cbi8qKlxuICogRXNjYXBlcyBzcGVjaWFsIGNoYXJhY3RlcnMgaW4gc3RyaW5nIHMgc3VjaCB0aGF0IHRoZSBzdHJpbmdcbiAqIGNhbiBiZSB1c2VkIGluIGBuZXcgUmVnRXhwYC4gRm9yIGV4YW1wbGUgXCJbXCIgYmVjb21lcyBcIlxcXFxbXCIuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHMgUmVnZXggc3RyaW5nLlxuICogQHJldHVybiB7c3RyaW5nfSBFc2NhcGVkIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZXNjYXBlUmVnRXhwIChzKSB7XG4gIHJldHVybiBzLnJlcGxhY2UoL1stL1xcXFxeJCorPy4oKXxbXFxde31dL2csICdcXFxcJCYnKTtcbn1cbmV4cG9ydHMuZXNjYXBlUmVnRXhwID0gZXNjYXBlUmVnRXhwO1xuXG4vKipcbiAqIGZpbmQgY29ycmVzcG9uZGluZyBvcGVuaW5nIGJsb2NrXG4gKi9cbmV4cG9ydHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4gPSBmdW5jdGlvbiAodG9rZW5zLCBpKSB7XG4gIGlmICh0b2tlbnNbaV0udHlwZSA9PT0gJ3NvZnRicmVhaycpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gbm9uIGNsb3NpbmcgYmxvY2tzLCBleGFtcGxlIGltZ1xuICBpZiAodG9rZW5zW2ldLm5lc3RpbmcgPT09IDApIHtcbiAgICByZXR1cm4gdG9rZW5zW2ldO1xuICB9XG5cbiAgbGV0IGxldmVsID0gdG9rZW5zW2ldLmxldmVsO1xuICBsZXQgdHlwZSA9IHRva2Vuc1tpXS50eXBlLnJlcGxhY2UoJ19jbG9zZScsICdfb3BlbicpO1xuXG4gIGZvciAoOyBpID49IDA7IC0taSkge1xuICAgIGlmICh0b2tlbnNbaV0udHlwZSA9PT0gdHlwZSAmJiB0b2tlbnNbaV0ubGV2ZWwgPT09IGxldmVsKSB7XG4gICAgICByZXR1cm4gdG9rZW5zW2ldO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKipcbiAqIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvbWFzdGVyL2xpYi9jb21tb24vdXRpbHMuanNcbiAqL1xubGV0IEhUTUxfRVNDQVBFX1RFU1RfUkUgPSAvWyY8PlwiXS87XG5sZXQgSFRNTF9FU0NBUEVfUkVQTEFDRV9SRSA9IC9bJjw+XCJdL2c7XG5sZXQgSFRNTF9SRVBMQUNFTUVOVFMgPSB7XG4gICcmJzogJyZhbXA7JyxcbiAgJzwnOiAnJmx0OycsXG4gICc+JzogJyZndDsnLFxuICAnXCInOiAnJnF1b3Q7J1xufTtcblxuZnVuY3Rpb24gcmVwbGFjZVVuc2FmZUNoYXIoY2gpIHtcbiAgcmV0dXJuIEhUTUxfUkVQTEFDRU1FTlRTW2NoXTtcbn1cblxuZXhwb3J0cy5lc2NhcGVIdG1sID0gZnVuY3Rpb24gKHN0cikge1xuICBpZiAoSFRNTF9FU0NBUEVfVEVTVF9SRS50ZXN0KHN0cikpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoSFRNTF9FU0NBUEVfUkVQTEFDRV9SRSwgcmVwbGFjZVVuc2FmZUNoYXIpO1xuICB9XG4gIHJldHVybiBzdHI7XG59O1xuIiwidmFyIF8sIGNoZWNrYm94UmVwbGFjZTtcblxuXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxuY2hlY2tib3hSZXBsYWNlID0gZnVuY3Rpb24obWQsIG9wdGlvbnMsIFRva2VuKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuICB2YXIgYXJyYXlSZXBsYWNlQXQsIGNyZWF0ZVRva2VucywgZGVmYXVsdHMsIGxhc3RJZCwgcGF0dGVybiwgc3BsaXRUZXh0VG9rZW47XG4gIGFycmF5UmVwbGFjZUF0ID0gbWQudXRpbHMuYXJyYXlSZXBsYWNlQXQ7XG4gIGxhc3RJZCA9IDA7XG4gIGRlZmF1bHRzID0ge1xuICAgIGRpdldyYXA6IGZhbHNlLFxuICAgIGRpdkNsYXNzOiAnY2hlY2tib3gnLFxuICAgIGlkUHJlZml4OiAnY2hlY2tib3gnXG4gIH07XG4gIG9wdGlvbnMgPSBfLmV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG4gIHBhdHRlcm4gPSAvXFxbKFh8XFxzfFxcX3xcXC0pXFxdXFxzKC4qKS9pO1xuICBjcmVhdGVUb2tlbnMgPSBmdW5jdGlvbihjaGVja2VkLCBsYWJlbCwgVG9rZW4pIHtcbiAgICB2YXIgaWQsIG5vZGVzLCB0b2tlbjtcbiAgICBub2RlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogPGRpdiBjbGFzcz1cImNoZWNrYm94XCI+XG4gICAgICovXG4gICAgaWYgKG9wdGlvbnMuZGl2V3JhcCkge1xuICAgICAgdG9rZW4gPSBuZXcgVG9rZW4oXCJjaGVja2JveF9vcGVuXCIsIFwiZGl2XCIsIDEpO1xuICAgICAgdG9rZW4uYXR0cnMgPSBbW1wiY2xhc3NcIiwgb3B0aW9ucy5kaXZDbGFzc11dO1xuICAgICAgbm9kZXMucHVzaCh0b2tlbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwiY2hlY2tib3h7bn1cIiBjaGVja2VkPVwidHJ1ZVwiPlxuICAgICAqL1xuICAgIGlkID0gb3B0aW9ucy5pZFByZWZpeCArIGxhc3RJZDtcbiAgICBsYXN0SWQgKz0gMTtcbiAgICB0b2tlbiA9IG5ldyBUb2tlbihcImNoZWNrYm94X2lucHV0XCIsIFwiaW5wdXRcIiwgMCk7XG4gICAgdG9rZW4uYXR0cnMgPSBbW1widHlwZVwiLCBcImNoZWNrYm94XCJdLCBbXCJpZFwiLCBpZF1dO1xuICAgIGlmIChjaGVja2VkID09PSB0cnVlKSB7XG4gICAgICB0b2tlbi5hdHRycy5wdXNoKFtcImNoZWNrZWRcIiwgXCJ0cnVlXCJdKTtcbiAgICB9XG4gICAgbm9kZXMucHVzaCh0b2tlbik7XG5cbiAgICAvKipcbiAgICAgKiA8bGFiZWwgZm9yPVwiY2hlY2tib3h7bn1cIj5cbiAgICAgKi9cbiAgICB0b2tlbiA9IG5ldyBUb2tlbihcImxhYmVsX29wZW5cIiwgXCJsYWJlbFwiLCAxKTtcbiAgICB0b2tlbi5hdHRycyA9IFtbXCJmb3JcIiwgaWRdXTtcbiAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgIC8qKlxuICAgICAqIGNvbnRlbnQgb2YgbGFiZWwgdGFnXG4gICAgICovXG4gICAgdG9rZW4gPSBuZXcgVG9rZW4oXCJ0ZXh0XCIsIFwiXCIsIDApO1xuICAgIHRva2VuLmNvbnRlbnQgPSBsYWJlbDtcbiAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgIC8qKlxuICAgICAqIGNsb3NpbmcgdGFnc1xuICAgICAqL1xuICAgIG5vZGVzLnB1c2gobmV3IFRva2VuKFwibGFiZWxfY2xvc2VcIiwgXCJsYWJlbFwiLCAtMSkpO1xuICAgIGlmIChvcHRpb25zLmRpdldyYXApIHtcbiAgICAgIG5vZGVzLnB1c2gobmV3IFRva2VuKFwiY2hlY2tib3hfY2xvc2VcIiwgXCJkaXZcIiwgLTEpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGVzO1xuICB9O1xuICBzcGxpdFRleHRUb2tlbiA9IGZ1bmN0aW9uKG9yaWdpbmFsLCBUb2tlbikge1xuICAgIHZhciBjaGVja2VkLCBsYWJlbCwgbWF0Y2hlcywgdGV4dCwgdmFsdWU7XG4gICAgdGV4dCA9IG9yaWdpbmFsLmNvbnRlbnQ7XG4gICAgbWF0Y2hlcyA9IHRleHQubWF0Y2gocGF0dGVybik7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBvcmlnaW5hbDtcbiAgICB9XG4gICAgY2hlY2tlZCA9IGZhbHNlO1xuICAgIHZhbHVlID0gbWF0Y2hlc1sxXTtcbiAgICBsYWJlbCA9IG1hdGNoZXNbMl07XG4gICAgaWYgKHZhbHVlID09PSBcIlhcIiB8fCB2YWx1ZSA9PT0gXCJ4XCIpIHtcbiAgICAgIGNoZWNrZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gY3JlYXRlVG9rZW5zKGNoZWNrZWQsIGxhYmVsLCBUb2tlbik7XG4gIH07XG4gIHJldHVybiBmdW5jdGlvbihzdGF0ZSkge1xuICAgIHZhciBibG9ja1Rva2VucywgaSwgaiwgbCwgdG9rZW4sIHRva2VucztcbiAgICBibG9ja1Rva2VucyA9IHN0YXRlLnRva2VucztcbiAgICBqID0gMDtcbiAgICBsID0gYmxvY2tUb2tlbnMubGVuZ3RoO1xuICAgIHdoaWxlIChqIDwgbCkge1xuICAgICAgaWYgKGJsb2NrVG9rZW5zW2pdLnR5cGUgIT09IFwiaW5saW5lXCIpIHtcbiAgICAgICAgaisrO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHRva2VucyA9IGJsb2NrVG9rZW5zW2pdLmNoaWxkcmVuO1xuICAgICAgaSA9IHRva2Vucy5sZW5ndGggLSAxO1xuICAgICAgd2hpbGUgKGkgPj0gMCkge1xuICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgYmxvY2tUb2tlbnNbal0uY2hpbGRyZW4gPSB0b2tlbnMgPSBhcnJheVJlcGxhY2VBdCh0b2tlbnMsIGksIHNwbGl0VGV4dFRva2VuKHRva2VuLCBzdGF0ZS5Ub2tlbikpO1xuICAgICAgICBpLS07XG4gICAgICB9XG4gICAgICBqKys7XG4gICAgfVxuICB9O1xufTtcblxuXG4vKmdsb2JhbCBtb2R1bGUgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihtZCwgb3B0aW9ucykge1xuICBcInVzZSBzdHJpY3RcIjtcbiAgbWQuY29yZS5ydWxlci5wdXNoKFwiY2hlY2tib3hcIiwgY2hlY2tib3hSZXBsYWNlKG1kLCBvcHRpb25zKSk7XG59O1xuIiwiLy8gUHJvY2VzcyBibG9jay1sZXZlbCBjdXN0b20gY29udGFpbmVyc1xuLy9cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbnRhaW5lcl9wbHVnaW4obWQsIG5hbWUsIG9wdGlvbnMpIHtcblxuICAvLyBTZWNvbmQgcGFyYW0gbWF5IGJlIHVzZWZ1bCBpZiB5b3UgZGVjaWRlXG4gIC8vIHRvIGluY3JlYXNlIG1pbmltYWwgYWxsb3dlZCBtYXJrZXIgbGVuZ3RoXG4gIGZ1bmN0aW9uIHZhbGlkYXRlRGVmYXVsdChwYXJhbXMvKiwgbWFya3VwKi8pIHtcbiAgICByZXR1cm4gcGFyYW1zLnRyaW0oKS5zcGxpdCgnICcsIDIpWzBdID09PSBuYW1lO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVyRGVmYXVsdCh0b2tlbnMsIGlkeCwgX29wdGlvbnMsIGVudiwgc2xmKSB7XG5cbiAgICAvLyBhZGQgYSBjbGFzcyB0byB0aGUgb3BlbmluZyB0YWdcbiAgICBpZiAodG9rZW5zW2lkeF0ubmVzdGluZyA9PT0gMSkge1xuICAgICAgdG9rZW5zW2lkeF0uYXR0ckpvaW4oJ2NsYXNzJywgbmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgX29wdGlvbnMsIGVudiwgc2xmKTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHZhciBtaW5fbWFya2VycyA9IDMsXG4gICAgICBtYXJrZXJfc3RyICA9IG9wdGlvbnMubWFya2VyIHx8ICc6JyxcbiAgICAgIG1hcmtlcl9jaGFyID0gbWFya2VyX3N0ci5jaGFyQ29kZUF0KDApLFxuICAgICAgbWFya2VyX2xlbiAgPSBtYXJrZXJfc3RyLmxlbmd0aCxcbiAgICAgIHZhbGlkYXRlICAgID0gb3B0aW9ucy52YWxpZGF0ZSB8fCB2YWxpZGF0ZURlZmF1bHQsXG4gICAgICByZW5kZXIgICAgICA9IG9wdGlvbnMucmVuZGVyIHx8IHJlbmRlckRlZmF1bHQ7XG5cbiAgZnVuY3Rpb24gY29udGFpbmVyKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICAgIHZhciBwb3MsIG5leHRMaW5lLCBtYXJrZXJfY291bnQsIG1hcmt1cCwgcGFyYW1zLCB0b2tlbixcbiAgICAgICAgb2xkX3BhcmVudCwgb2xkX2xpbmVfbWF4LFxuICAgICAgICBhdXRvX2Nsb3NlZCA9IGZhbHNlLFxuICAgICAgICBzdGFydCA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0sXG4gICAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gICAgLy8gQ2hlY2sgb3V0IHRoZSBmaXJzdCBjaGFyYWN0ZXIgcXVpY2tseSxcbiAgICAvLyB0aGlzIHNob3VsZCBmaWx0ZXIgb3V0IG1vc3Qgb2Ygbm9uLWNvbnRhaW5lcnNcbiAgICAvL1xuICAgIGlmIChtYXJrZXJfY2hhciAhPT0gc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhcnQpKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgLy8gQ2hlY2sgb3V0IHRoZSByZXN0IG9mIHRoZSBtYXJrZXIgc3RyaW5nXG4gICAgLy9cbiAgICBmb3IgKHBvcyA9IHN0YXJ0ICsgMTsgcG9zIDw9IG1heDsgcG9zKyspIHtcbiAgICAgIGlmIChtYXJrZXJfc3RyWyhwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuXSAhPT0gc3RhdGUuc3JjW3Bvc10pIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbWFya2VyX2NvdW50ID0gTWF0aC5mbG9vcigocG9zIC0gc3RhcnQpIC8gbWFya2VyX2xlbik7XG4gICAgaWYgKG1hcmtlcl9jb3VudCA8IG1pbl9tYXJrZXJzKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHBvcyAtPSAocG9zIC0gc3RhcnQpICUgbWFya2VyX2xlbjtcblxuICAgIG1hcmt1cCA9IHN0YXRlLnNyYy5zbGljZShzdGFydCwgcG9zKTtcbiAgICBwYXJhbXMgPSBzdGF0ZS5zcmMuc2xpY2UocG9zLCBtYXgpO1xuICAgIGlmICghdmFsaWRhdGUocGFyYW1zLCBtYXJrdXApKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgLy8gU2luY2Ugc3RhcnQgaXMgZm91bmQsIHdlIGNhbiByZXBvcnQgc3VjY2VzcyBoZXJlIGluIHZhbGlkYXRpb24gbW9kZVxuICAgIC8vXG4gICAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gICAgLy8gU2VhcmNoIGZvciB0aGUgZW5kIG9mIHRoZSBibG9ja1xuICAgIC8vXG4gICAgbmV4dExpbmUgPSBzdGFydExpbmU7XG5cbiAgICBmb3IgKDs7KSB7XG4gICAgICBuZXh0TGluZSsrO1xuICAgICAgaWYgKG5leHRMaW5lID49IGVuZExpbmUpIHtcbiAgICAgICAgLy8gdW5jbG9zZWQgYmxvY2sgc2hvdWxkIGJlIGF1dG9jbG9zZWQgYnkgZW5kIG9mIGRvY3VtZW50LlxuICAgICAgICAvLyBhbHNvIGJsb2NrIHNlZW1zIHRvIGJlIGF1dG9jbG9zZWQgYnkgZW5kIG9mIHBhcmVudFxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgc3RhcnQgPSBzdGF0ZS5iTWFya3NbbmV4dExpbmVdICsgc3RhdGUudFNoaWZ0W25leHRMaW5lXTtcbiAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tuZXh0TGluZV07XG5cbiAgICAgIGlmIChzdGFydCA8IG1heCAmJiBzdGF0ZS5zQ291bnRbbmV4dExpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7XG4gICAgICAgIC8vIG5vbi1lbXB0eSBsaW5lIHdpdGggbmVnYXRpdmUgaW5kZW50IHNob3VsZCBzdG9wIHRoZSBsaXN0OlxuICAgICAgICAvLyAtIGBgYFxuICAgICAgICAvLyAgdGVzdFxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKG1hcmtlcl9jaGFyICE9PSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCkpIHsgY29udGludWU7IH1cblxuICAgICAgaWYgKHN0YXRlLnNDb3VudFtuZXh0TGluZV0gLSBzdGF0ZS5ibGtJbmRlbnQgPj0gNCkge1xuICAgICAgICAvLyBjbG9zaW5nIGZlbmNlIHNob3VsZCBiZSBpbmRlbnRlZCBsZXNzIHRoYW4gNCBzcGFjZXNcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGZvciAocG9zID0gc3RhcnQgKyAxOyBwb3MgPD0gbWF4OyBwb3MrKykge1xuICAgICAgICBpZiAobWFya2VyX3N0clsocG9zIC0gc3RhcnQpICUgbWFya2VyX2xlbl0gIT09IHN0YXRlLnNyY1twb3NdKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gY2xvc2luZyBjb2RlIGZlbmNlIG11c3QgYmUgYXQgbGVhc3QgYXMgbG9uZyBhcyB0aGUgb3BlbmluZyBvbmVcbiAgICAgIGlmIChNYXRoLmZsb29yKChwb3MgLSBzdGFydCkgLyBtYXJrZXJfbGVuKSA8IG1hcmtlcl9jb3VudCkgeyBjb250aW51ZTsgfVxuXG4gICAgICAvLyBtYWtlIHN1cmUgdGFpbCBoYXMgc3BhY2VzIG9ubHlcbiAgICAgIHBvcyAtPSAocG9zIC0gc3RhcnQpICUgbWFya2VyX2xlbjtcbiAgICAgIHBvcyA9IHN0YXRlLnNraXBTcGFjZXMocG9zKTtcblxuICAgICAgaWYgKHBvcyA8IG1heCkgeyBjb250aW51ZTsgfVxuXG4gICAgICAvLyBmb3VuZCFcbiAgICAgIGF1dG9fY2xvc2VkID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIG9sZF9wYXJlbnQgPSBzdGF0ZS5wYXJlbnRUeXBlO1xuICAgIG9sZF9saW5lX21heCA9IHN0YXRlLmxpbmVNYXg7XG4gICAgc3RhdGUucGFyZW50VHlwZSA9ICdjb250YWluZXInO1xuXG4gICAgLy8gdGhpcyB3aWxsIHByZXZlbnQgbGF6eSBjb250aW51YXRpb25zIGZyb20gZXZlciBnb2luZyBwYXN0IG91ciBlbmQgbWFya2VyXG4gICAgc3RhdGUubGluZU1heCA9IG5leHRMaW5lO1xuXG4gICAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnY29udGFpbmVyXycgKyBuYW1lICsgJ19vcGVuJywgJ2RpdicsIDEpO1xuICAgIHRva2VuLm1hcmt1cCA9IG1hcmt1cDtcbiAgICB0b2tlbi5ibG9jayAgPSB0cnVlO1xuICAgIHRva2VuLmluZm8gICA9IHBhcmFtcztcbiAgICB0b2tlbi5tYXAgICAgPSBbIHN0YXJ0TGluZSwgbmV4dExpbmUgXTtcblxuICAgIHN0YXRlLm1kLmJsb2NrLnRva2VuaXplKHN0YXRlLCBzdGFydExpbmUgKyAxLCBuZXh0TGluZSk7XG5cbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdjb250YWluZXJfJyArIG5hbWUgKyAnX2Nsb3NlJywgJ2RpdicsIC0xKTtcbiAgICB0b2tlbi5tYXJrdXAgPSBzdGF0ZS5zcmMuc2xpY2Uoc3RhcnQsIHBvcyk7XG4gICAgdG9rZW4uYmxvY2sgID0gdHJ1ZTtcblxuICAgIHN0YXRlLnBhcmVudFR5cGUgPSBvbGRfcGFyZW50O1xuICAgIHN0YXRlLmxpbmVNYXggPSBvbGRfbGluZV9tYXg7XG4gICAgc3RhdGUubGluZSA9IG5leHRMaW5lICsgKGF1dG9fY2xvc2VkID8gMSA6IDApO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBtZC5ibG9jay5ydWxlci5iZWZvcmUoJ2ZlbmNlJywgJ2NvbnRhaW5lcl8nICsgbmFtZSwgY29udGFpbmVyLCB7XG4gICAgYWx0OiBbICdwYXJhZ3JhcGgnLCAncmVmZXJlbmNlJywgJ2Jsb2NrcXVvdGUnLCAnbGlzdCcgXVxuICB9KTtcbiAgbWQucmVuZGVyZXIucnVsZXNbJ2NvbnRhaW5lcl8nICsgbmFtZSArICdfb3BlbiddID0gcmVuZGVyO1xuICBtZC5yZW5kZXJlci5ydWxlc1snY29udGFpbmVyXycgKyBuYW1lICsgJ19jbG9zZSddID0gcmVuZGVyO1xufTtcbiIsIi8vIFByb2Nlc3MgZGVmaW5pdGlvbiBsaXN0c1xuLy9cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlZmxpc3RfcGx1Z2luKG1kKSB7XG4gIHZhciBpc1NwYWNlID0gbWQudXRpbHMuaXNTcGFjZTtcblxuICAvLyBTZWFyY2ggYFs6fl1bXFxuIF1gLCByZXR1cm5zIG5leHQgcG9zIGFmdGVyIG1hcmtlciBvbiBzdWNjZXNzXG4gIC8vIG9yIC0xIG9uIGZhaWwuXG4gIGZ1bmN0aW9uIHNraXBNYXJrZXIoc3RhdGUsIGxpbmUpIHtcbiAgICB2YXIgcG9zLCBtYXJrZXIsXG4gICAgICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW2xpbmVdICsgc3RhdGUudFNoaWZ0W2xpbmVdLFxuICAgICAgICBtYXggPSBzdGF0ZS5lTWFya3NbbGluZV07XG5cbiAgICBpZiAoc3RhcnQgPj0gbWF4KSB7IHJldHVybiAtMTsgfVxuXG4gICAgLy8gQ2hlY2sgYnVsbGV0XG4gICAgbWFya2VyID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhcnQrKyk7XG4gICAgaWYgKG1hcmtlciAhPT0gMHg3RS8qIH4gKi8gJiYgbWFya2VyICE9PSAweDNBLyogOiAqLykgeyByZXR1cm4gLTE7IH1cblxuICAgIHBvcyA9IHN0YXRlLnNraXBTcGFjZXMoc3RhcnQpO1xuXG4gICAgLy8gcmVxdWlyZSBzcGFjZSBhZnRlciBcIjpcIlxuICAgIGlmIChzdGFydCA9PT0gcG9zKSB7IHJldHVybiAtMTsgfVxuXG4gICAgLy8gbm8gZW1wdHkgZGVmaW5pdGlvbnMsIGUuZy4gXCIgIDogXCJcbiAgICBpZiAocG9zID49IG1heCkgeyByZXR1cm4gLTE7IH1cblxuICAgIHJldHVybiBzdGFydDtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcmtUaWdodFBhcmFncmFwaHMoc3RhdGUsIGlkeCkge1xuICAgIHZhciBpLCBsLFxuICAgICAgICBsZXZlbCA9IHN0YXRlLmxldmVsICsgMjtcblxuICAgIGZvciAoaSA9IGlkeCArIDIsIGwgPSBzdGF0ZS50b2tlbnMubGVuZ3RoIC0gMjsgaSA8IGw7IGkrKykge1xuICAgICAgaWYgKHN0YXRlLnRva2Vuc1tpXS5sZXZlbCA9PT0gbGV2ZWwgJiYgc3RhdGUudG9rZW5zW2ldLnR5cGUgPT09ICdwYXJhZ3JhcGhfb3BlbicpIHtcbiAgICAgICAgc3RhdGUudG9rZW5zW2kgKyAyXS5oaWRkZW4gPSB0cnVlO1xuICAgICAgICBzdGF0ZS50b2tlbnNbaV0uaGlkZGVuID0gdHJ1ZTtcbiAgICAgICAgaSArPSAyO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmxpc3Qoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gICAgdmFyIGNoLFxuICAgICAgICBjb250ZW50U3RhcnQsXG4gICAgICAgIGRkTGluZSxcbiAgICAgICAgZHRMaW5lLFxuICAgICAgICBpdGVtTGluZXMsXG4gICAgICAgIGxpc3RMaW5lcyxcbiAgICAgICAgbGlzdFRva0lkeCxcbiAgICAgICAgbWF4LFxuICAgICAgICBuZXh0TGluZSxcbiAgICAgICAgb2Zmc2V0LFxuICAgICAgICBvbGREREluZGVudCxcbiAgICAgICAgb2xkSW5kZW50LFxuICAgICAgICBvbGRQYXJlbnRUeXBlLFxuICAgICAgICBvbGRTQ291bnQsXG4gICAgICAgIG9sZFRTaGlmdCxcbiAgICAgICAgb2xkVGlnaHQsXG4gICAgICAgIHBvcyxcbiAgICAgICAgcHJldkVtcHR5RW5kLFxuICAgICAgICB0aWdodCxcbiAgICAgICAgdG9rZW47XG5cbiAgICBpZiAoc2lsZW50KSB7XG4gICAgICAvLyBxdWlyazogdmFsaWRhdGlvbiBtb2RlIHZhbGlkYXRlcyBhIGRkIGJsb2NrIG9ubHksIG5vdCBhIHdob2xlIGRlZmxpc3RcbiAgICAgIGlmIChzdGF0ZS5kZEluZGVudCA8IDApIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICByZXR1cm4gc2tpcE1hcmtlcihzdGF0ZSwgc3RhcnRMaW5lKSA+PSAwO1xuICAgIH1cblxuICAgIG5leHRMaW5lID0gc3RhcnRMaW5lICsgMTtcbiAgICBpZiAobmV4dExpbmUgPj0gZW5kTGluZSkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIGlmIChzdGF0ZS5pc0VtcHR5KG5leHRMaW5lKSkge1xuICAgICAgbmV4dExpbmUrKztcbiAgICAgIGlmIChuZXh0TGluZSA+PSBlbmRMaW5lKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIH1cblxuICAgIGlmIChzdGF0ZS5zQ291bnRbbmV4dExpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7IHJldHVybiBmYWxzZTsgfVxuICAgIGNvbnRlbnRTdGFydCA9IHNraXBNYXJrZXIoc3RhdGUsIG5leHRMaW5lKTtcbiAgICBpZiAoY29udGVudFN0YXJ0IDwgMCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIC8vIFN0YXJ0IGxpc3RcbiAgICBsaXN0VG9rSWR4ID0gc3RhdGUudG9rZW5zLmxlbmd0aDtcbiAgICB0aWdodCA9IHRydWU7XG5cbiAgICB0b2tlbiAgICAgPSBzdGF0ZS5wdXNoKCdkbF9vcGVuJywgJ2RsJywgMSk7XG4gICAgdG9rZW4ubWFwID0gbGlzdExpbmVzID0gWyBzdGFydExpbmUsIDAgXTtcblxuICAgIC8vXG4gICAgLy8gSXRlcmF0ZSBsaXN0IGl0ZW1zXG4gICAgLy9cblxuICAgIGR0TGluZSA9IHN0YXJ0TGluZTtcbiAgICBkZExpbmUgPSBuZXh0TGluZTtcblxuICAgIC8vIE9uZSBkZWZpbml0aW9uIGxpc3QgY2FuIGNvbnRhaW4gbXVsdGlwbGUgRFRzLFxuICAgIC8vIGFuZCBvbmUgRFQgY2FuIGJlIGZvbGxvd2VkIGJ5IG11bHRpcGxlIEREcy5cbiAgICAvL1xuICAgIC8vIFRodXMsIHRoZXJlIGlzIHR3byBsb29wcyBoZXJlLCBhbmQgbGFiZWwgaXNcbiAgICAvLyBuZWVkZWQgdG8gYnJlYWsgb3V0IG9mIHRoZSBzZWNvbmQgb25lXG4gICAgLy9cbiAgICAvKmVzbGludCBuby1sYWJlbHM6MCxibG9jay1zY29wZWQtdmFyOjAqL1xuICAgIE9VVEVSOlxuICAgIGZvciAoOzspIHtcbiAgICAgIHByZXZFbXB0eUVuZCA9IGZhbHNlO1xuXG4gICAgICB0b2tlbiAgICAgICAgICA9IHN0YXRlLnB1c2goJ2R0X29wZW4nLCAnZHQnLCAxKTtcbiAgICAgIHRva2VuLm1hcCAgICAgID0gWyBkdExpbmUsIGR0TGluZSBdO1xuXG4gICAgICB0b2tlbiAgICAgICAgICA9IHN0YXRlLnB1c2goJ2lubGluZScsICcnLCAwKTtcbiAgICAgIHRva2VuLm1hcCAgICAgID0gWyBkdExpbmUsIGR0TGluZSBdO1xuICAgICAgdG9rZW4uY29udGVudCAgPSBzdGF0ZS5nZXRMaW5lcyhkdExpbmUsIGR0TGluZSArIDEsIHN0YXRlLmJsa0luZGVudCwgZmFsc2UpLnRyaW0oKTtcbiAgICAgIHRva2VuLmNoaWxkcmVuID0gW107XG5cbiAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnZHRfY2xvc2UnLCAnZHQnLCAtMSk7XG5cbiAgICAgIGZvciAoOzspIHtcbiAgICAgICAgdG9rZW4gICAgID0gc3RhdGUucHVzaCgnZGRfb3BlbicsICdkZCcsIDEpO1xuICAgICAgICB0b2tlbi5tYXAgPSBpdGVtTGluZXMgPSBbIG5leHRMaW5lLCAwIF07XG5cbiAgICAgICAgcG9zID0gY29udGVudFN0YXJ0O1xuICAgICAgICBtYXggPSBzdGF0ZS5lTWFya3NbZGRMaW5lXTtcbiAgICAgICAgb2Zmc2V0ID0gc3RhdGUuc0NvdW50W2RkTGluZV0gKyBjb250ZW50U3RhcnQgLSAoc3RhdGUuYk1hcmtzW2RkTGluZV0gKyBzdGF0ZS50U2hpZnRbZGRMaW5lXSk7XG5cbiAgICAgICAgd2hpbGUgKHBvcyA8IG1heCkge1xuICAgICAgICAgIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKTtcblxuICAgICAgICAgIGlmIChpc1NwYWNlKGNoKSkge1xuICAgICAgICAgICAgaWYgKGNoID09PSAweDA5KSB7XG4gICAgICAgICAgICAgIG9mZnNldCArPSA0IC0gb2Zmc2V0ICUgNDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9mZnNldCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBwb3MrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRlbnRTdGFydCA9IHBvcztcblxuICAgICAgICBvbGRUaWdodCA9IHN0YXRlLnRpZ2h0O1xuICAgICAgICBvbGREREluZGVudCA9IHN0YXRlLmRkSW5kZW50O1xuICAgICAgICBvbGRJbmRlbnQgPSBzdGF0ZS5ibGtJbmRlbnQ7XG4gICAgICAgIG9sZFRTaGlmdCA9IHN0YXRlLnRTaGlmdFtkZExpbmVdO1xuICAgICAgICBvbGRTQ291bnQgPSBzdGF0ZS5zQ291bnRbZGRMaW5lXTtcbiAgICAgICAgb2xkUGFyZW50VHlwZSA9IHN0YXRlLnBhcmVudFR5cGU7XG4gICAgICAgIHN0YXRlLmJsa0luZGVudCA9IHN0YXRlLmRkSW5kZW50ID0gc3RhdGUuc0NvdW50W2RkTGluZV0gKyAyO1xuICAgICAgICBzdGF0ZS50U2hpZnRbZGRMaW5lXSA9IGNvbnRlbnRTdGFydCAtIHN0YXRlLmJNYXJrc1tkZExpbmVdO1xuICAgICAgICBzdGF0ZS5zQ291bnRbZGRMaW5lXSA9IG9mZnNldDtcbiAgICAgICAgc3RhdGUudGlnaHQgPSB0cnVlO1xuICAgICAgICBzdGF0ZS5wYXJlbnRUeXBlID0gJ2RlZmxpc3QnO1xuXG4gICAgICAgIHN0YXRlLm1kLmJsb2NrLnRva2VuaXplKHN0YXRlLCBkZExpbmUsIGVuZExpbmUsIHRydWUpO1xuXG4gICAgICAgIC8vIElmIGFueSBvZiBsaXN0IGl0ZW0gaXMgdGlnaHQsIG1hcmsgbGlzdCBhcyB0aWdodFxuICAgICAgICBpZiAoIXN0YXRlLnRpZ2h0IHx8IHByZXZFbXB0eUVuZCkge1xuICAgICAgICAgIHRpZ2h0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXRlbSBiZWNvbWUgbG9vc2UgaWYgZmluaXNoIHdpdGggZW1wdHkgbGluZSxcbiAgICAgICAgLy8gYnV0IHdlIHNob3VsZCBmaWx0ZXIgbGFzdCBlbGVtZW50LCBiZWNhdXNlIGl0IG1lYW5zIGxpc3QgZmluaXNoXG4gICAgICAgIHByZXZFbXB0eUVuZCA9IChzdGF0ZS5saW5lIC0gZGRMaW5lKSA+IDEgJiYgc3RhdGUuaXNFbXB0eShzdGF0ZS5saW5lIC0gMSk7XG5cbiAgICAgICAgc3RhdGUudFNoaWZ0W2RkTGluZV0gPSBvbGRUU2hpZnQ7XG4gICAgICAgIHN0YXRlLnNDb3VudFtkZExpbmVdID0gb2xkU0NvdW50O1xuICAgICAgICBzdGF0ZS50aWdodCA9IG9sZFRpZ2h0O1xuICAgICAgICBzdGF0ZS5wYXJlbnRUeXBlID0gb2xkUGFyZW50VHlwZTtcbiAgICAgICAgc3RhdGUuYmxrSW5kZW50ID0gb2xkSW5kZW50O1xuICAgICAgICBzdGF0ZS5kZEluZGVudCA9IG9sZERESW5kZW50O1xuXG4gICAgICAgIHRva2VuID0gc3RhdGUucHVzaCgnZGRfY2xvc2UnLCAnZGQnLCAtMSk7XG5cbiAgICAgICAgaXRlbUxpbmVzWzFdID0gbmV4dExpbmUgPSBzdGF0ZS5saW5lO1xuXG4gICAgICAgIGlmIChuZXh0TGluZSA+PSBlbmRMaW5lKSB7IGJyZWFrIE9VVEVSOyB9XG5cbiAgICAgICAgaWYgKHN0YXRlLnNDb3VudFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHsgYnJlYWsgT1VURVI7IH1cbiAgICAgICAgY29udGVudFN0YXJ0ID0gc2tpcE1hcmtlcihzdGF0ZSwgbmV4dExpbmUpO1xuICAgICAgICBpZiAoY29udGVudFN0YXJ0IDwgMCkgeyBicmVhazsgfVxuXG4gICAgICAgIGRkTGluZSA9IG5leHRMaW5lO1xuXG4gICAgICAgIC8vIGdvIHRvIHRoZSBuZXh0IGxvb3AgaXRlcmF0aW9uOlxuICAgICAgICAvLyBpbnNlcnQgREQgdGFnIGFuZCByZXBlYXQgY2hlY2tpbmdcbiAgICAgIH1cblxuICAgICAgaWYgKG5leHRMaW5lID49IGVuZExpbmUpIHsgYnJlYWs7IH1cbiAgICAgIGR0TGluZSA9IG5leHRMaW5lO1xuXG4gICAgICBpZiAoc3RhdGUuaXNFbXB0eShkdExpbmUpKSB7IGJyZWFrOyB9XG4gICAgICBpZiAoc3RhdGUuc0NvdW50W2R0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHsgYnJlYWs7IH1cblxuICAgICAgZGRMaW5lID0gZHRMaW5lICsgMTtcbiAgICAgIGlmIChkZExpbmUgPj0gZW5kTGluZSkgeyBicmVhazsgfVxuICAgICAgaWYgKHN0YXRlLmlzRW1wdHkoZGRMaW5lKSkgeyBkZExpbmUrKzsgfVxuICAgICAgaWYgKGRkTGluZSA+PSBlbmRMaW5lKSB7IGJyZWFrOyB9XG5cbiAgICAgIGlmIChzdGF0ZS5zQ291bnRbZGRMaW5lXSA8IHN0YXRlLmJsa0luZGVudCkgeyBicmVhazsgfVxuICAgICAgY29udGVudFN0YXJ0ID0gc2tpcE1hcmtlcihzdGF0ZSwgZGRMaW5lKTtcbiAgICAgIGlmIChjb250ZW50U3RhcnQgPCAwKSB7IGJyZWFrOyB9XG5cbiAgICAgIC8vIGdvIHRvIHRoZSBuZXh0IGxvb3AgaXRlcmF0aW9uOlxuICAgICAgLy8gaW5zZXJ0IERUIGFuZCBERCB0YWdzIGFuZCByZXBlYXQgY2hlY2tpbmdcbiAgICB9XG5cbiAgICAvLyBGaW5pbGl6ZSBsaXN0XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCdkbF9jbG9zZScsICdkbCcsIC0xKTtcblxuICAgIGxpc3RMaW5lc1sxXSA9IG5leHRMaW5lO1xuXG4gICAgc3RhdGUubGluZSA9IG5leHRMaW5lO1xuXG4gICAgLy8gbWFyayBwYXJhZ3JhcGhzIHRpZ2h0IGlmIG5lZWRlZFxuICAgIGlmICh0aWdodCkge1xuICAgICAgbWFya1RpZ2h0UGFyYWdyYXBocyhzdGF0ZSwgbGlzdFRva0lkeCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuXG4gIG1kLmJsb2NrLnJ1bGVyLmJlZm9yZSgncGFyYWdyYXBoJywgJ2RlZmxpc3QnLCBkZWZsaXN0LCB7IGFsdDogWyAncGFyYWdyYXBoJywgJ3JlZmVyZW5jZScsICdibG9ja3F1b3RlJyBdIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuXG52YXIgZW1vamlfaHRtbCAgICAgICAgPSByZXF1aXJlKCcuL2xpYi9yZW5kZXInKTtcbnZhciBlbW9qaV9yZXBsYWNlICAgICA9IHJlcXVpcmUoJy4vbGliL3JlcGxhY2UnKTtcbnZhciBub3JtYWxpemVfb3B0cyAgICA9IHJlcXVpcmUoJy4vbGliL25vcm1hbGl6ZV9vcHRzJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbW9qaV9wbHVnaW4obWQsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmF1bHRzID0ge1xuICAgIGRlZnM6IHt9LFxuICAgIHNob3J0Y3V0czoge30sXG4gICAgZW5hYmxlZDogW11cbiAgfTtcblxuICB2YXIgb3B0cyA9IG5vcm1hbGl6ZV9vcHRzKG1kLnV0aWxzLmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdGlvbnMgfHwge30pKTtcblxuICBtZC5yZW5kZXJlci5ydWxlcy5lbW9qaSA9IGVtb2ppX2h0bWw7XG5cbiAgbWQuY29yZS5ydWxlci5wdXNoKCdlbW9qaScsIGVtb2ppX3JlcGxhY2UobWQsIG9wdHMuZGVmcywgb3B0cy5zaG9ydGN1dHMsIG9wdHMuc2NhblJFLCBvcHRzLnJlcGxhY2VSRSkpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuXG52YXIgZW1vamllc19kZWZzICAgICAgPSByZXF1aXJlKCcuL2xpYi9kYXRhL2Z1bGwuanNvbicpO1xudmFyIGVtb2ppZXNfc2hvcnRjdXRzID0gcmVxdWlyZSgnLi9saWIvZGF0YS9zaG9ydGN1dHMnKTtcbnZhciBiYXJlX2Vtb2ppX3BsdWdpbiA9IHJlcXVpcmUoJy4vYmFyZScpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW1vamlfcGx1Z2luKG1kLCBvcHRpb25zKSB7XG4gIHZhciBkZWZhdWx0cyA9IHtcbiAgICBkZWZzOiBlbW9qaWVzX2RlZnMsXG4gICAgc2hvcnRjdXRzOiBlbW9qaWVzX3Nob3J0Y3V0cyxcbiAgICBlbmFibGVkOiBbXVxuICB9O1xuXG4gIHZhciBvcHRzID0gbWQudXRpbHMuYXNzaWduKHt9LCBkZWZhdWx0cywgb3B0aW9ucyB8fCB7fSk7XG5cbiAgYmFyZV9lbW9qaV9wbHVnaW4obWQsIG9wdHMpO1xufTtcbiIsIi8vIEVtb3RpY29ucyAtPiBFbW9qaSBtYXBwaW5nLlxuLy9cbi8vICghKSBTb21lIHBhdHRlcm5zIHNraXBwZWQsIHRvIGF2b2lkIGNvbGxpc2lvbnNcbi8vIHdpdGhvdXQgaW5jcmVhc2UgbWF0Y2hlciBjb21wbGljaXR5LiBUaGFuIGNhbiBjaGFuZ2UgaW4gZnV0dXJlLlxuLy9cbi8vIFBsYWNlcyB0byBsb29rIGZvciBtb3JlIGVtb3RpY29ucyBpbmZvOlxuLy9cbi8vIC0gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9MaXN0X29mX2Vtb3RpY29ucyNXZXN0ZXJuXG4vLyAtIGh0dHBzOi8vZ2l0aHViLmNvbS93b29vcm0vZW1vdGljb24vYmxvYi9tYXN0ZXIvU3VwcG9ydC5tZFxuLy8gLSBodHRwOi8vZmFjdG9yeWpvZS5jb20vcHJvamVjdHMvZW1vdGljb25zL1xuLy9cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFuZ3J5OiAgICAgICAgICAgIFsgJz46KCcsICc+Oi0oJyBdLFxuICBibHVzaDogICAgICAgICAgICBbICc6XCIpJywgJzotXCIpJyBdLFxuICBicm9rZW5faGVhcnQ6ICAgICBbICc8LzMnLCAnPFxcXFwzJyBdLFxuICAvLyA6XFwgYW5kIDotXFwgbm90IHVzZWQgYmVjYXVzZSBvZiBjb25mbGljdCB3aXRoIG1hcmtkb3duIGVzY2FwaW5nXG4gIGNvbmZ1c2VkOiAgICAgICAgIFsgJzovJywgJzotLycgXSwgLy8gdHdlbW9qaSBzaG93cyBxdWVzdGlvblxuICBjcnk6ICAgICAgICAgICAgICBbIFwiOicoXCIsIFwiOictKFwiLCAnOiwoJywgJzosLSgnIF0sXG4gIGZyb3duaW5nOiAgICAgICAgIFsgJzooJywgJzotKCcgXSxcbiAgaGVhcnQ6ICAgICAgICAgICAgWyAnPDMnIF0sXG4gIGltcDogICAgICAgICAgICAgIFsgJ106KCcsICddOi0oJyBdLFxuICBpbm5vY2VudDogICAgICAgICBbICdvOiknLCAnTzopJywgJ286LSknLCAnTzotKScsICcwOiknLCAnMDotKScgXSxcbiAgam95OiAgICAgICAgICAgICAgWyBcIjonKVwiLCBcIjonLSlcIiwgJzosKScsICc6LC0pJywgXCI6J0RcIiwgXCI6Jy1EXCIsICc6LEQnLCAnOiwtRCcgXSxcbiAga2lzc2luZzogICAgICAgICAgWyAnOionLCAnOi0qJyBdLFxuICBsYXVnaGluZzogICAgICAgICBbICd4LSknLCAnWC0pJyBdLFxuICBuZXV0cmFsX2ZhY2U6ICAgICBbICc6fCcsICc6LXwnIF0sXG4gIG9wZW5fbW91dGg6ICAgICAgIFsgJzpvJywgJzotbycsICc6TycsICc6LU8nIF0sXG4gIHJhZ2U6ICAgICAgICAgICAgIFsgJzpAJywgJzotQCcgXSxcbiAgc21pbGU6ICAgICAgICAgICAgWyAnOkQnLCAnOi1EJyBdLFxuICBzbWlsZXk6ICAgICAgICAgICBbICc6KScsICc6LSknIF0sXG4gIHNtaWxpbmdfaW1wOiAgICAgIFsgJ106KScsICddOi0pJyBdLFxuICBzb2I6ICAgICAgICAgICAgICBbIFwiOiwnKFwiLCBcIjosJy0oXCIsICc7KCcsICc7LSgnIF0sXG4gIHN0dWNrX291dF90b25ndWU6IFsgJzpQJywgJzotUCcgXSxcbiAgc3VuZ2xhc3NlczogICAgICAgWyAnOC0pJywgJ0ItKScgXSxcbiAgc3dlYXQ6ICAgICAgICAgICAgWyAnLDooJywgJyw6LSgnIF0sXG4gIHN3ZWF0X3NtaWxlOiAgICAgIFsgJyw6KScsICcsOi0pJyBdLFxuICB1bmFtdXNlZDogICAgICAgICBbICc6cycsICc6LVMnLCAnOnonLCAnOi1aJywgJzokJywgJzotJCcgXSxcbiAgd2luazogICAgICAgICAgICAgWyAnOyknLCAnOy0pJyBdXG59O1xuIiwiLy8gQ29udmVydCBpbnB1dCBvcHRpb25zIHRvIG1vcmUgdXNlYWJsZSBmb3JtYXRcbi8vIGFuZCBjb21waWxlIHNlYXJjaCByZWdleHBcblxuJ3VzZSBzdHJpY3QnO1xuXG5cbmZ1bmN0aW9uIHF1b3RlUkUoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvWy4/KiteJFtcXF1cXFxcKCl7fXwtXS9nLCAnXFxcXCQmJyk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBub3JtYWxpemVfb3B0cyhvcHRpb25zKSB7XG4gIHZhciBlbW9qaWVzID0gb3B0aW9ucy5kZWZzLFxuICAgICAgc2hvcnRjdXRzO1xuXG4gIC8vIEZpbHRlciBlbW9qaWVzIGJ5IHdoaXRlbGlzdCwgaWYgbmVlZGVkXG4gIGlmIChvcHRpb25zLmVuYWJsZWQubGVuZ3RoKSB7XG4gICAgZW1vamllcyA9IE9iamVjdC5rZXlzKGVtb2ppZXMpLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBrZXkpIHtcbiAgICAgIGlmIChvcHRpb25zLmVuYWJsZWQuaW5kZXhPZihrZXkpID49IDApIHtcbiAgICAgICAgYWNjW2tleV0gPSBlbW9qaWVzW2tleV07XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcbiAgfVxuXG4gIC8vIEZsYXR0ZW4gc2hvcnRjdXRzIHRvIHNpbXBsZSBvYmplY3Q6IHsgYWxpYXM6IGVtb2ppX25hbWUgfVxuICBzaG9ydGN1dHMgPSBPYmplY3Qua2V5cyhvcHRpb25zLnNob3J0Y3V0cykucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgIC8vIFNraXAgYWxpYXNlcyBmb3IgZmlsdGVyZWQgZW1vamllcywgdG8gcmVkdWNlIHJlZ2V4cFxuICAgIGlmICghZW1vamllc1trZXldKSB7IHJldHVybiBhY2M7IH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KG9wdGlvbnMuc2hvcnRjdXRzW2tleV0pKSB7XG4gICAgICBvcHRpb25zLnNob3J0Y3V0c1trZXldLmZvckVhY2goZnVuY3Rpb24gKGFsaWFzKSB7XG4gICAgICAgIGFjY1thbGlhc10gPSBrZXk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfVxuXG4gICAgYWNjW29wdGlvbnMuc2hvcnRjdXRzW2tleV1dID0ga2V5O1xuICAgIHJldHVybiBhY2M7XG4gIH0sIHt9KTtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGVtb2ppZXMpLFxuICAgICAgbmFtZXM7XG5cbiAgLy8gSWYgbm8gZGVmaW5pdGlvbnMgYXJlIGdpdmVuLCByZXR1cm4gZW1wdHkgcmVnZXggdG8gYXZvaWQgcmVwbGFjZW1lbnRzIHdpdGggJ3VuZGVmaW5lZCcuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIG5hbWVzID0gJ14kJztcbiAgfSBlbHNlIHtcbiAgICAvLyBDb21waWxlIHJlZ2V4cFxuICAgIG5hbWVzID0ga2V5c1xuICAgICAgLm1hcChmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gJzonICsgbmFtZSArICc6JzsgfSlcbiAgICAgIC5jb25jYXQoT2JqZWN0LmtleXMoc2hvcnRjdXRzKSlcbiAgICAgIC5zb3J0KClcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC5tYXAoZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIHF1b3RlUkUobmFtZSk7IH0pXG4gICAgICAuam9pbignfCcpO1xuICB9XG4gIHZhciBzY2FuUkUgPSBSZWdFeHAobmFtZXMpO1xuICB2YXIgcmVwbGFjZVJFID0gUmVnRXhwKG5hbWVzLCAnZycpO1xuXG4gIHJldHVybiB7XG4gICAgZGVmczogZW1vamllcyxcbiAgICBzaG9ydGN1dHM6IHNob3J0Y3V0cyxcbiAgICBzY2FuUkU6IHNjYW5SRSxcbiAgICByZXBsYWNlUkU6IHJlcGxhY2VSRVxuICB9O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbW9qaV9odG1sKHRva2VucywgaWR4IC8qLCBvcHRpb25zLCBlbnYgKi8pIHtcbiAgcmV0dXJuIHRva2Vuc1tpZHhdLmNvbnRlbnQ7XG59O1xuIiwiLy8gRW1vamllcyAmIHNob3J0Y3V0cyByZXBsYWNlbWVudCBsb2dpYy5cbi8vXG4vLyBOb3RlOiBJbiB0aGVvcnksIGl0IGNvdWxkIGJlIGZhc3RlciB0byBwYXJzZSA6c21pbGU6IGluIGlubGluZSBjaGFpbiBhbmRcbi8vIGxlYXZlIG9ubHkgc2hvcnRjdXRzIGhlcmUuIEJ1dCwgd2hvIGNhcmUuLi5cbi8vXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZV9ydWxlKG1kLCBlbW9qaWVzLCBzaG9ydGN1dHMsIHNjYW5SRSwgcmVwbGFjZVJFKSB7XG4gIHZhciBhcnJheVJlcGxhY2VBdCA9IG1kLnV0aWxzLmFycmF5UmVwbGFjZUF0LFxuICAgICAgdWNtID0gbWQudXRpbHMubGliLnVjbWljcm8sXG4gICAgICBaUENjID0gbmV3IFJlZ0V4cChbIHVjbS5aLnNvdXJjZSwgdWNtLlAuc291cmNlLCB1Y20uQ2Muc291cmNlIF0uam9pbignfCcpKTtcblxuICBmdW5jdGlvbiBzcGxpdFRleHRUb2tlbih0ZXh0LCBsZXZlbCwgVG9rZW4pIHtcbiAgICB2YXIgdG9rZW4sIGxhc3RfcG9zID0gMCwgbm9kZXMgPSBbXTtcblxuICAgIHRleHQucmVwbGFjZShyZXBsYWNlUkUsIGZ1bmN0aW9uIChtYXRjaCwgb2Zmc2V0LCBzcmMpIHtcbiAgICAgIHZhciBlbW9qaV9uYW1lO1xuICAgICAgLy8gVmFsaWRhdGUgZW1vamkgbmFtZVxuICAgICAgaWYgKHNob3J0Y3V0cy5oYXNPd25Qcm9wZXJ0eShtYXRjaCkpIHtcbiAgICAgICAgLy8gcmVwbGFjZSBzaG9ydGN1dCB3aXRoIGZ1bGwgbmFtZVxuICAgICAgICBlbW9qaV9uYW1lID0gc2hvcnRjdXRzW21hdGNoXTtcblxuICAgICAgICAvLyBEb24ndCBhbGxvdyBsZXR0ZXJzIGJlZm9yZSBhbnkgc2hvcnRjdXQgKGFzIGluIG5vIFwiOi9cIiBpbiBodHRwOi8vKVxuICAgICAgICBpZiAob2Zmc2V0ID4gMCAmJiAhWlBDYy50ZXN0KHNyY1tvZmZzZXQgLSAxXSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEb24ndCBhbGxvdyBsZXR0ZXJzIGFmdGVyIGFueSBzaG9ydGN1dFxuICAgICAgICBpZiAob2Zmc2V0ICsgbWF0Y2gubGVuZ3RoIDwgc3JjLmxlbmd0aCAmJiAhWlBDYy50ZXN0KHNyY1tvZmZzZXQgKyBtYXRjaC5sZW5ndGhdKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW1vamlfbmFtZSA9IG1hdGNoLnNsaWNlKDEsIC0xKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIG5ldyB0b2tlbnMgdG8gcGVuZGluZyBsaXN0XG4gICAgICBpZiAob2Zmc2V0ID4gbGFzdF9wb3MpIHtcbiAgICAgICAgdG9rZW4gICAgICAgICA9IG5ldyBUb2tlbigndGV4dCcsICcnLCAwKTtcbiAgICAgICAgdG9rZW4uY29udGVudCA9IHRleHQuc2xpY2UobGFzdF9wb3MsIG9mZnNldCk7XG4gICAgICAgIG5vZGVzLnB1c2godG9rZW4pO1xuICAgICAgfVxuXG4gICAgICB0b2tlbiAgICAgICAgID0gbmV3IFRva2VuKCdlbW9qaScsICcnLCAwKTtcbiAgICAgIHRva2VuLm1hcmt1cCAgPSBlbW9qaV9uYW1lO1xuICAgICAgdG9rZW4uY29udGVudCA9IGVtb2ppZXNbZW1vamlfbmFtZV07XG4gICAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgICAgbGFzdF9wb3MgPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG4gICAgfSk7XG5cbiAgICBpZiAobGFzdF9wb3MgPCB0ZXh0Lmxlbmd0aCkge1xuICAgICAgdG9rZW4gICAgICAgICA9IG5ldyBUb2tlbigndGV4dCcsICcnLCAwKTtcbiAgICAgIHRva2VuLmNvbnRlbnQgPSB0ZXh0LnNsaWNlKGxhc3RfcG9zKTtcbiAgICAgIG5vZGVzLnB1c2godG9rZW4pO1xuICAgIH1cblxuICAgIHJldHVybiBub2RlcztcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiBlbW9qaV9yZXBsYWNlKHN0YXRlKSB7XG4gICAgdmFyIGksIGosIGwsIHRva2VucywgdG9rZW4sXG4gICAgICAgIGJsb2NrVG9rZW5zID0gc3RhdGUudG9rZW5zLFxuICAgICAgICBhdXRvbGlua0xldmVsID0gMDtcblxuICAgIGZvciAoaiA9IDAsIGwgPSBibG9ja1Rva2Vucy5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgIGlmIChibG9ja1Rva2Vuc1tqXS50eXBlICE9PSAnaW5saW5lJykgeyBjb250aW51ZTsgfVxuICAgICAgdG9rZW5zID0gYmxvY2tUb2tlbnNbal0uY2hpbGRyZW47XG5cbiAgICAgIC8vIFdlIHNjYW4gZnJvbSB0aGUgZW5kLCB0byBrZWVwIHBvc2l0aW9uIHdoZW4gbmV3IHRhZ3MgYWRkZWQuXG4gICAgICAvLyBVc2UgcmV2ZXJzZWQgbG9naWMgaW4gbGlua3Mgc3RhcnQvZW5kIG1hdGNoXG4gICAgICBmb3IgKGkgPSB0b2tlbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgICAgaWYgKHRva2VuLnR5cGUgPT09ICdsaW5rX29wZW4nIHx8IHRva2VuLnR5cGUgPT09ICdsaW5rX2Nsb3NlJykge1xuICAgICAgICAgIGlmICh0b2tlbi5pbmZvID09PSAnYXV0bycpIHsgYXV0b2xpbmtMZXZlbCAtPSB0b2tlbi5uZXN0aW5nOyB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gJ3RleHQnICYmIGF1dG9saW5rTGV2ZWwgPT09IDAgJiYgc2NhblJFLnRlc3QodG9rZW4uY29udGVudCkpIHtcbiAgICAgICAgICAvLyByZXBsYWNlIGN1cnJlbnQgbm9kZVxuICAgICAgICAgIGJsb2NrVG9rZW5zW2pdLmNoaWxkcmVuID0gdG9rZW5zID0gYXJyYXlSZXBsYWNlQXQoXG4gICAgICAgICAgICB0b2tlbnMsIGksIHNwbGl0VGV4dFRva2VuKHRva2VuLmNvbnRlbnQsIHRva2VuLmxldmVsLCBzdGF0ZS5Ub2tlbilcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xufTtcbiIsIi8qISBtYXJrZG93bi1pdC1odG1sNS1lbWJlZCBodHRwczovL2dpdGh1Yi5jb20vY21yZC1zZW55YS9tYXJrZG93bi1pdC1odG1sNS1lbWJlZCBAbGljZW5zZSBNUEx2MiAqL1xuLy8gVGhpcyBpcyBhIHBsdWdpbiBmb3IgbWFya2Rvd24taXQgd2hpY2ggYWRkcyBzdXBwb3J0IGZvciBlbWJlZGRpbmcgYXVkaW8vdmlkZW8gaW4gdGhlIEhUTUw1IHdheS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWltb3phID0gcmVxdWlyZSgnbWltb3phJyk7XG5cbi8vIERlZmF1bHQgVUkgbWVzc2FnZXMuIFlvdSBjYW4gY3VzdG9taXplIGFuZCBhZGQgc2ltcGxlIHRyYW5zbGF0aW9ucyB2aWFcbi8vIG9wdGlvbnMubWVzc2FnZXMuIFRoZSBsYW5ndWFnZSBoYXMgdG8gYmUgcHJvdmlkZWQgdmlhIHRoZSBtYXJrZG93bi1pdFxuLy8gZW52aXJvbm1lbnQsIGUuZy46XG4vL1xuLy8gbWQucmVuZGVyKCdzb21lIHRleHQnLCB7IGxhbmd1YWdlOiAnc29tZSBjb2RlJyB9KVxuLy9cbi8vIEl0IHdpbGwgZGVmYXVsdCB0byBFbmdsaXNoIGlmIG5vdCBwcm92aWRlZC4gVG8gdXNlIHlvdXIgb3duIGkxOG4gZnJhbWV3b3JrLFxuLy8geW91IGhhdmUgdG8gcHJvdmlkZSBhIHRyYW5zbGF0aW9uIGZ1bmN0aW9uIHZpYSBvcHRpb25zLnRyYW5zbGF0ZUZuLlxuLy9cbi8vIFRoZSBcInVudGl0bGVkIHZpZGVvXCIgLyBcInVudGl0bGVkIGF1ZGlvXCIgbWVzc2FnZXMgYXJlIG9ubHkgcmVsZXZhbnQgdG8gdXNhZ2Vcbi8vIGluc2lkZSBhbHRlcm5hdGl2ZSByZW5kZXIgZnVuY3Rpb25zLCB3aGVyZSB5b3UgY2FuIGFjY2VzcyB0aGUgdGl0bGUgYmV0d2VlbiBbXSBhc1xuLy8ge3t0aXRsZX19LCBhbmQgdGhpcyB0ZXh0IGlzIHVzZWQgaWYgbm8gdGl0bGUgaXMgcHJvdmlkZWQuXG52YXIgbWVzc2FnZXMgPSB7XG4gIGVuOiB7XG4gICAgJ3ZpZGVvIG5vdCBzdXBwb3J0ZWQnOiAnWW91ciBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgcGxheWluZyBIVE1MNSB2aWRlby4gJyArXG4gICAgICAnWW91IGNhbiA8YSBocmVmPVwiJXNcIiBkb3dubG9hZD5kb3dubG9hZCBhIGNvcHkgb2YgdGhlIHZpZGVvIGZpbGU8L2E+IGluc3RlYWQuJyxcbiAgICAnYXVkaW8gbm90IHN1cHBvcnRlZCc6ICdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBwbGF5aW5nIEhUTUw1IGF1ZGlvLiAnICtcbiAgICAgICdZb3UgY2FuIDxhIGhyZWY9XCIlc1wiIGRvd25sb2FkPmRvd25sb2FkIGEgY29weSBvZiB0aGUgYXVkaW8gZmlsZTwvYT4gaW5zdGVhZC4nLFxuICAgICdjb250ZW50IGRlc2NyaXB0aW9uJzogJ0hlcmUgaXMgYSBkZXNjcmlwdGlvbiBvZiB0aGUgY29udGVudDogJXMnLFxuICAgICd1bnRpdGxlZCB2aWRlbyc6ICdVbnRpdGxlZCB2aWRlbycsXG4gICAgJ3VudGl0bGVkIGF1ZGlvJzogJ1VudGl0bGVkIGF1ZGlvJ1xuICB9XG59O1xuXG5mdW5jdGlvbiBjbGVhclRva2Vucyh0b2tlbnMsIGlkeCkge1xuICBmb3IgKHZhciBpID0gaWR4OyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgc3dpdGNoICh0b2tlbnNbaV0udHlwZSkge1xuICAgICAgY2FzZSAnbGlua19jbG9zZSc6XG4gICAgICAgIHRva2Vuc1tpXS5oaWRkZW4gPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3RleHQnOlxuICAgICAgICB0b2tlbnNbaV0uY29udGVudCA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IFwiVW5leHBlY3RlZCB0b2tlbjogXCIgKyB0b2tlbnNbaV0udHlwZTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VUb2tlbih0b2tlbnMsIGlkeCwgZW52KSB7XG4gIHZhciBwYXJzZWQgPSB7fTtcbiAgdmFyIHRva2VuID0gdG9rZW5zW2lkeF07XG4gIHZhciBkZXNjcmlwdGlvbiA9ICcnO1xuXG4gIHZhciBhSW5kZXggPSB0b2tlbi5hdHRySW5kZXgoJ3NyYycpO1xuICBwYXJzZWQuaXNMaW5rID0gYUluZGV4IDwgMDtcbiAgaWYgKHBhcnNlZC5pc0xpbmspIHtcbiAgICBhSW5kZXggPSB0b2tlbi5hdHRySW5kZXgoJ2hyZWYnKTtcbiAgICBkZXNjcmlwdGlvbiA9IHRva2Vuc1tpZHggKyAxXS5jb250ZW50O1xuICB9IGVsc2Uge1xuICAgIGRlc2NyaXB0aW9uID0gdG9rZW4uY29udGVudDtcbiAgfVxuXG4gIHBhcnNlZC51cmwgPSB0b2tlbi5hdHRyc1thSW5kZXhdWzFdO1xuICBwYXJzZWQubWltZVR5cGUgPSBNaW1vemEuZ2V0TWltZVR5cGUocGFyc2VkLnVybCk7XG4gIHZhciBSRSA9IC9eKGF1ZGlvfHZpZGVvKVxcLy4qL2dpO1xuICB2YXIgbWltZXR5cGVfbWF0Y2hlcyA9IFJFLmV4ZWMocGFyc2VkLm1pbWVUeXBlKTtcbiAgaWYgKG1pbWV0eXBlX21hdGNoZXMgPT09IG51bGwpIHtcbiAgICBwYXJzZWQubWVkaWFUeXBlID0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICBwYXJzZWQubWVkaWFUeXBlID0gbWltZXR5cGVfbWF0Y2hlc1sxXTtcbiAgfVxuXG4gIGlmIChwYXJzZWQubWVkaWFUeXBlICE9PSBudWxsKSB7XG4gICAgLy8gRm9yIHVzZSBhcyB0aXRsZXMgaW4gYWx0ZXJuYXRpdmUgcmVuZGVyIGZ1bmN0aW9ucywgd2Ugc3RvcmUgdGhlIGRlc2NyaXB0aW9uXG4gICAgLy8gaW4gcGFyc2VkLnRpdGxlLiBGb3IgdXNlIGFzIGZhbGxiYWNrIHRleHQsIHdlIHN0b3JlIGl0IGluIHBhcnNlZC5mYWxsYmFja1xuICAgIC8vIGFsb25nc2lkZSB0aGUgc3RhbmRhcmQgZmFsbGJhY2sgdGV4dC5cbiAgICBwYXJzZWQuZmFsbGJhY2sgPSB0cmFuc2xhdGUoe1xuICAgICAgbWVzc2FnZUtleTogcGFyc2VkLm1lZGlhVHlwZSArICcgbm90IHN1cHBvcnRlZCcsXG4gICAgICBtZXNzYWdlUGFyYW06IHBhcnNlZC51cmwsXG4gICAgICBsYW5ndWFnZTogZW52Lmxhbmd1YWdlXG4gICAgfSk7XG4gICAgaWYgKGRlc2NyaXB0aW9uLnRyaW0oKS5sZW5ndGgpIHtcbiAgICAgIHBhcnNlZC5mYWxsYmFjayArPSAnXFxuJyArIHRyYW5zbGF0ZSh7XG4gICAgICAgIG1lc3NhZ2VLZXk6ICdjb250ZW50IGRlc2NyaXB0aW9uJyxcbiAgICAgICAgbWVzc2FnZVBhcmFtOiBkZXNjcmlwdGlvbixcbiAgICAgICAgbGFuZ3VhZ2U6IGVudi5sYW5ndWFnZVxuICAgICAgfSk7XG4gICAgICBwYXJzZWQudGl0bGUgPSBkZXNjcmlwdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyc2VkLnRpdGxlID0gdHJhbnNsYXRlKHtcbiAgICAgICAgbWVzc2FnZUtleTogJ3VudGl0bGVkICcgKyBwYXJzZWQubWVkaWFUeXBlLFxuICAgICAgICBsYW5ndWFnZTogZW52Lmxhbmd1YWdlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBhcnNlZDtcbn1cblxuZnVuY3Rpb24gaXNBbGxvd2VkTWltZVR5cGUocGFyc2VkLCBvcHRpb25zKSB7XG4gIHJldHVybiBwYXJzZWQubWVkaWFUeXBlICE9PSBudWxsICYmXG4gICAgKCFvcHRpb25zLmlzQWxsb3dlZE1pbWVUeXBlIHx8IG9wdGlvbnMuaXNBbGxvd2VkTWltZVR5cGUoW3BhcnNlZC5taW1lVHlwZSwgcGFyc2VkLm1lZGlhVHlwZV0pKTtcbn1cblxuZnVuY3Rpb24gaXNBbGxvd2VkU2NoZW1hKHBhcnNlZCwgb3B0aW9ucykge1xuICBpZiAoIW9wdGlvbnMuaXNBbGxvd2VkSHR0cCAmJiBwYXJzZWQudXJsLm1hdGNoKCdeaHR0cDovLycpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc0FsbG93ZWRUb0VtYmVkKHBhcnNlZCwgb3B0aW9ucykge1xuICByZXR1cm4gaXNBbGxvd2VkTWltZVR5cGUocGFyc2VkLCBvcHRpb25zKSAmJiBpc0FsbG93ZWRTY2hlbWEocGFyc2VkLCBvcHRpb25zKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWVkaWFFbWJlZChwYXJzZWQsIG1lZGlhQXR0cmlidXRlcykge1xuICB2YXIgYXR0cmlidXRlcyA9IG1lZGlhQXR0cmlidXRlc1twYXJzZWQubWVkaWFUeXBlXTtcblxuICByZXR1cm4gWyc8JyArIHBhcnNlZC5tZWRpYVR5cGUgKyAnICcgKyBhdHRyaWJ1dGVzICsgJz4nLFxuICAgICc8c291cmNlIHR5cGU9XCInICsgcGFyc2VkLm1pbWVUeXBlICsgJ1wiIHNyYz1cIicgKyBwYXJzZWQudXJsICsgJ1wiPjwvc291cmNlPicsXG4gICAgcGFyc2VkLmZhbGxiYWNrLFxuICAgICc8LycgKyBwYXJzZWQubWVkaWFUeXBlICsgJz4nXG4gIF0uam9pbignXFxuJyk7XG59XG5cbmZ1bmN0aW9uIGh0bWw1RW1iZWRSZW5kZXJlcih0b2tlbnMsIGlkeCwgb3B0aW9ucywgZW52LCByZW5kZXJlciwgZGVmYXVsdFJlbmRlcikge1xuICB2YXIgcGFyc2VkID0gcGFyc2VUb2tlbih0b2tlbnMsIGlkeCwgZW52KTtcblxuICBpZiAoIWlzQWxsb3dlZFRvRW1iZWQocGFyc2VkLCBvcHRpb25zLmh0bWw1ZW1iZWQpKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRSZW5kZXIodG9rZW5zLCBpZHgsIG9wdGlvbnMsIGVudiwgcmVuZGVyZXIpO1xuICB9XG5cbiAgaWYgKHBhcnNlZC5pc0xpbmspIHtcbiAgICBjbGVhclRva2Vucyh0b2tlbnMsIGlkeCArIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJlbmRlck1lZGlhRW1iZWQocGFyc2VkLCBvcHRpb25zLmh0bWw1ZW1iZWQuYXR0cmlidXRlcyk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2hMaW5rT3BlbihzdGF0ZSwgYWN0aW9uKSB7XG4gIHN0YXRlLnRva2Vucy5mb3JFYWNoKGZ1bmN0aW9uKHRva2VuLCBfaWR4LCBfdG9rZW5zKSB7XG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiaW5saW5lXCIpIHtcbiAgICAgIHRva2VuLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24odG9rZW4sIGlkeCwgdG9rZW5zKSB7XG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSBcImxpbmtfb3BlblwiKSB7XG4gICAgICAgICAgYWN0aW9uKHRva2VucywgaWR4KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gZmluZERpcmVjdGl2ZShzdGF0ZSwgc3RhcnRMaW5lLCBfZW5kTGluZSwgc2lsZW50LCByZWdleHAsIGJ1aWxkX3Rva2VuKSB7XG4gIHZhciBwb3MgPSBzdGF0ZS5iTWFya3Nbc3RhcnRMaW5lXSArIHN0YXRlLnRTaGlmdFtzdGFydExpbmVdO1xuICB2YXIgbWF4ID0gc3RhdGUuZU1hcmtzW3N0YXJ0TGluZV07XG5cbiAgLy8gRGV0ZWN0IGRpcmVjdGl2ZSBtYXJrZG93blxuICB2YXIgY3VycmVudExpbmUgPSBzdGF0ZS5zcmMuc3Vic3RyaW5nKHBvcywgbWF4KTtcbiAgdmFyIG1hdGNoID0gcmVnZXhwLmV4ZWMoY3VycmVudExpbmUpO1xuICBpZiAobWF0Y2ggPT09IG51bGwgfHwgbWF0Y2gubGVuZ3RoIDwgMSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChzaWxlbnQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHN0YXRlLmxpbmUgPSBzdGFydExpbmUgKyAxO1xuXG4gIC8vIEJ1aWxkIGNvbnRlbnRcbiAgdmFyIHRva2VuID0gYnVpbGRfdG9rZW4oKTtcbiAgdG9rZW4ubWFwID0gW3N0YXJ0TGluZSwgc3RhdGUubGluZV07XG4gIHRva2VuLm1hcmt1cCA9IGN1cnJlbnRMaW5lO1xuXG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIFZlcnkgYmFzaWMgdHJhbnNsYXRpb24gZnVuY3Rpb24uIFRvIHRyYW5zbGF0ZSBvciBjdXN0b21pemUgdGhlIFVJIG1lc3NhZ2VzLFxuICogc2V0IG9wdGlvbnMubWVzc2FnZXMuIFRvIGFsc28gY3VzdG9taXplIHRoZSB0cmFuc2xhdGlvbiBmdW5jdGlvbiBpdHNlbGYsIHNldFxuICogb3B0aW9uLnRyYW5zbGF0ZUZuIHRvIGEgZnVuY3Rpb24gdGhhdCBoYW5kbGVzIHRoZSBzYW1lIG1lc3NhZ2Ugb2JqZWN0IGZvcm1hdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gbWVzc2FnZU9ialxuICogIHRoZSBtZXNzYWdlIG9iamVjdFxuICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VPYmoubWVzc2FnZUtleVxuICogIGFuIGlkZW50aWZpZXIgdXNlZCBmb3IgbG9va2luZyB1cCB0aGUgbWVzc2FnZSBpbiBpMThuIGZpbGVzXG4gKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZU9iai5tZXNzYWdlUGFyYW1cbiAqICBmb3Igc3Vic3RpdHV0aW9uIG9mICVzIGZvciBmaWxlbmFtZSBhbmQgZGVzY3JpcHRpb24gaW4gdGhlIHJlc3BlY3RpdmVcbiAqICBtZXNzYWdlc1xuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlT2JqLmxhbmd1YWdlPSdlbiddXG4gKiAgYSBsYW5ndWFnZSBjb2RlLCBpZ25vcmVkIGluIHRoZSBkZWZhdWx0IGltcGxlbWVudGF0aW9uXG4gKiBAdGhpcyB7T2JqZWN0fVxuICogIHRoZSBidWlsdC1pbiBkZWZhdWx0IG1lc3NhZ2VzLCBvciBvcHRpb25zLm1lc3NhZ2VzIGlmIHNldFxuICovXG5mdW5jdGlvbiB0cmFuc2xhdGUobWVzc2FnZU9iaikge1xuICAvLyBEZWZhdWx0IHRvIEVuZ2xpc2ggaWYgd2UgZG9uJ3QgaGF2ZSB0aGlzIG1lc3NhZ2UsIG9yIGRvbid0IHN1cHBvcnQgdGhpc1xuICAvLyBsYW5ndWFnZSBhdCBhbGxcbiAgdmFyIGxhbmd1YWdlID0gbWVzc2FnZU9iai5sYW5ndWFnZSAmJiB0aGlzW21lc3NhZ2VPYmoubGFuZ3VhZ2VdICYmXG4gICAgdGhpc1ttZXNzYWdlT2JqLmxhbmd1YWdlXVttZXNzYWdlT2JqLm1lc3NhZ2VLZXldID9cbiAgICBtZXNzYWdlT2JqLmxhbmd1YWdlIDpcbiAgICAnZW4nO1xuICB2YXIgcnYgPSB0aGlzW2xhbmd1YWdlXVttZXNzYWdlT2JqLm1lc3NhZ2VLZXldO1xuXG4gIGlmIChtZXNzYWdlT2JqLm1lc3NhZ2VQYXJhbSkge1xuICAgIHJ2ID0gcnYucmVwbGFjZSgnJXMnLCBtZXNzYWdlT2JqLm1lc3NhZ2VQYXJhbSk7XG4gIH1cbiAgcmV0dXJuIHJ2O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGh0bWw1X2VtYmVkX3BsdWdpbihtZCwgb3B0aW9ucykge1xuICB2YXIgZ3N0YXRlO1xuICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgYXR0cmlidXRlczoge1xuICAgICAgYXVkaW86ICdjb250cm9scyBwcmVsb2FkPVwibWV0YWRhdGFcIicsXG4gICAgICB2aWRlbzogJ2NvbnRyb2xzIHByZWxvYWQ9XCJtZXRhZGF0YVwiJ1xuICAgIH0sXG4gICAgdXNlSW1hZ2VTeW50YXg6IHRydWUsXG4gICAgaW5saW5lOiB0cnVlLFxuICAgIGF1dG9BcHBlbmQ6IGZhbHNlLFxuICAgIGVtYmVkUGxhY2VEaXJlY3RpdmVSZWdleHA6IC9eXFxbXFxbaHRtbDVtZWRpYVxcXVxcXS9pbSxcbiAgICBtZXNzYWdlczogbWVzc2FnZXNcbiAgfTtcbiAgdmFyIG9wdGlvbnMgPSBtZC51dGlscy5hc3NpZ24oe30sIGRlZmF1bHRzLCBvcHRpb25zLmh0bWw1ZW1iZWQpO1xuXG4gIGlmICghb3B0aW9ucy5pbmxpbmUpIHtcbiAgICBtZC5ibG9jay5ydWxlci5iZWZvcmUoXCJwYXJhZ3JhcGhcIiwgXCJodG1sNWVtYmVkXCIsIGZ1bmN0aW9uKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICAgICAgcmV0dXJuIGZpbmREaXJlY3RpdmUoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50LCBvcHRpb25zLmVtYmVkUGxhY2VEaXJlY3RpdmVSZWdleHAsIGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc3RhdGUucHVzaChcImh0bWw1bWVkaWFcIiwgXCJodG1sNW1lZGlhXCIsIDApO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBtZC5yZW5kZXJlci5ydWxlcy5odG1sNW1lZGlhID0gZnVuY3Rpb24odG9rZW5zLCBpbmRleCwgXywgZW52KSB7XG4gICAgICB2YXIgcmVzdWx0ID0gXCJcIjtcbiAgICAgIGZvckVhY2hMaW5rT3Blbihnc3RhdGUsIGZ1bmN0aW9uKHRva2VucywgaWR4KSB7XG4gICAgICAgIHZhciBwYXJzZWQgPSBwYXJzZVRva2VuKHRva2VucywgaWR4LCBlbnYpO1xuXG4gICAgICAgIGlmICghaXNBbGxvd2VkVG9FbWJlZChwYXJzZWQsIG9wdGlvbnMpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0ICs9IHJlbmRlck1lZGlhRW1iZWQocGFyc2VkLCBvcHRpb25zLmF0dHJpYnV0ZXMpO1xuICAgICAgfSk7XG4gICAgICBpZiAocmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICByZXN1bHQgKz0gXCJcXG5cIjtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIC8vIENhdGNoIGFsbCB0aGUgdG9rZW5zIGZvciBpdGVyYXRpb24gbGF0ZXJcbiAgICBtZC5jb3JlLnJ1bGVyLnB1c2goXCJncmFiX3N0YXRlXCIsIGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgICBnc3RhdGUgPSBzdGF0ZTtcblxuICAgICAgaWYgKG9wdGlvbnMuYXV0b0FwcGVuZCkge1xuICAgICAgICB2YXIgdG9rZW4gPSBuZXcgc3RhdGUuVG9rZW4oXCJodG1sNW1lZGlhXCIsIFwiXCIsIDApO1xuICAgICAgICBzdGF0ZS50b2tlbnMucHVzaCh0b2tlbik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAodHlwZW9mIG9wdGlvbnMuaXNBbGxvd2VkTWltZVR5cGUgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBvcHRpb25zLmlzQWxsb3dlZE1pbWVUeXBlID0gb3B0aW9ucy5pc19hbGxvd2VkX21pbWVfdHlwZTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmlubGluZSAmJiBvcHRpb25zLnVzZUltYWdlU3ludGF4KSB7XG4gICAgdmFyIGRlZmF1bHRSZW5kZXIgPSBtZC5yZW5kZXJlci5ydWxlcy5pbWFnZTtcbiAgICBtZC5yZW5kZXJlci5ydWxlcy5pbWFnZSA9IGZ1bmN0aW9uKHRva2VucywgaWR4LCBvcHQsIGVudiwgc2VsZikge1xuICAgICAgb3B0Lmh0bWw1ZW1iZWQgPSBvcHRpb25zO1xuICAgICAgcmV0dXJuIGh0bWw1RW1iZWRSZW5kZXJlcih0b2tlbnMsIGlkeCwgb3B0LCBlbnYsIHNlbGYsIGRlZmF1bHRSZW5kZXIpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvcHRpb25zLmlubGluZSAmJiBvcHRpb25zLnVzZUxpbmtTeW50YXgpIHtcbiAgICB2YXIgZGVmYXVsdFJlbmRlciA9IG1kLnJlbmRlcmVyLnJ1bGVzLmxpbmtfb3BlbiB8fCBmdW5jdGlvbih0b2tlbnMsIGlkeCwgb3B0aW9ucywgZW52LCBzZWxmKSB7XG4gICAgICByZXR1cm4gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICBtZC5yZW5kZXJlci5ydWxlcy5saW5rX29wZW4gPSBmdW5jdGlvbih0b2tlbnMsIGlkeCwgb3B0LCBlbnYsIHNlbGYpIHtcbiAgICAgIG9wdC5odG1sNWVtYmVkID0gb3B0aW9ucztcbiAgICAgIHJldHVybiBodG1sNUVtYmVkUmVuZGVyZXIodG9rZW5zLCBpZHgsIG9wdCwgZW52LCBzZWxmLCBkZWZhdWx0UmVuZGVyKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gb3B0aW9ucy5tZXNzYWdlcyB3aWxsIGJlIHNldCB0byBidWlsdC1pbiBtZXNzYWdlcyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoaXNcbiAgLy8gZmlsZSBpZiBub3QgY29uZmlndXJlZFxuICB0cmFuc2xhdGUgPSB0eXBlb2Ygb3B0aW9ucy50cmFuc2xhdGVGbiA9PSAnZnVuY3Rpb24nID9cbiAgICBvcHRpb25zLnRyYW5zbGF0ZUZuLmJpbmQob3B0aW9ucy5tZXNzYWdlcykgOlxuICAgIHRyYW5zbGF0ZS5iaW5kKG9wdGlvbnMubWVzc2FnZXMpO1xuXG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5yZW5kZXJGbiA9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmVuZGVyTWVkaWFFbWJlZCA9IG9wdGlvbnMucmVuZGVyRm47XG4gIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnNfcGx1Z2luKG1kKSB7XG4gIC8vIEluc2VydCBlYWNoIG1hcmtlciBhcyBhIHNlcGFyYXRlIHRleHQgdG9rZW4sIGFuZCBhZGQgaXQgdG8gZGVsaW1pdGVyIGxpc3RcbiAgLy9cbiAgZnVuY3Rpb24gdG9rZW5pemUoc3RhdGUsIHNpbGVudCkge1xuICAgIHZhciBpLCBzY2FubmVkLCB0b2tlbiwgbGVuLCBjaCxcbiAgICAgICAgc3RhcnQgPSBzdGF0ZS5wb3MsXG4gICAgICAgIG1hcmtlciA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXJ0KTtcblxuICAgIGlmIChzaWxlbnQpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICBpZiAobWFya2VyICE9PSAweDNELyogPSAqLykgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIHNjYW5uZWQgPSBzdGF0ZS5zY2FuRGVsaW1zKHN0YXRlLnBvcywgdHJ1ZSk7XG4gICAgbGVuID0gc2Nhbm5lZC5sZW5ndGg7XG4gICAgY2ggPSBTdHJpbmcuZnJvbUNoYXJDb2RlKG1hcmtlcik7XG5cbiAgICBpZiAobGVuIDwgMikgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIGlmIChsZW4gJSAyKSB7XG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgndGV4dCcsICcnLCAwKTtcbiAgICAgIHRva2VuLmNvbnRlbnQgPSBjaDtcbiAgICAgIGxlbi0tO1xuICAgIH1cblxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgICAgdG9rZW4gICAgICAgICA9IHN0YXRlLnB1c2goJ3RleHQnLCAnJywgMCk7XG4gICAgICB0b2tlbi5jb250ZW50ID0gY2ggKyBjaDtcblxuICAgICAgaWYgKCFzY2FubmVkLmNhbl9vcGVuICYmICFzY2FubmVkLmNhbl9jbG9zZSkgeyBjb250aW51ZTsgfVxuXG4gICAgICBzdGF0ZS5kZWxpbWl0ZXJzLnB1c2goe1xuICAgICAgICBtYXJrZXI6IG1hcmtlcixcbiAgICAgICAgbGVuZ3RoOiAwLCAgICAgLy8gZGlzYWJsZSBcInJ1bGUgb2YgM1wiIGxlbmd0aCBjaGVja3MgbWVhbnQgZm9yIGVtcGhhc2lzXG4gICAgICAgIGp1bXA6ICAgaSAvIDIsIC8vIDEgZGVsaW1pdGVyID0gMiBjaGFyYWN0ZXJzXG4gICAgICAgIHRva2VuOiAgc3RhdGUudG9rZW5zLmxlbmd0aCAtIDEsXG4gICAgICAgIGVuZDogICAgLTEsXG4gICAgICAgIG9wZW46ICAgc2Nhbm5lZC5jYW5fb3BlbixcbiAgICAgICAgY2xvc2U6ICBzY2FubmVkLmNhbl9jbG9zZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhdGUucG9zICs9IHNjYW5uZWQubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuXG4gIC8vIFdhbGsgdGhyb3VnaCBkZWxpbWl0ZXIgbGlzdCBhbmQgcmVwbGFjZSB0ZXh0IHRva2VucyB3aXRoIHRhZ3NcbiAgLy9cbiAgZnVuY3Rpb24gcG9zdFByb2Nlc3Moc3RhdGUsIGRlbGltaXRlcnMpIHtcbiAgICB2YXIgaSwgaixcbiAgICAgICAgc3RhcnREZWxpbSxcbiAgICAgICAgZW5kRGVsaW0sXG4gICAgICAgIHRva2VuLFxuICAgICAgICBsb25lTWFya2VycyA9IFtdLFxuICAgICAgICBtYXggPSBkZWxpbWl0ZXJzLmxlbmd0aDtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBtYXg7IGkrKykge1xuICAgICAgc3RhcnREZWxpbSA9IGRlbGltaXRlcnNbaV07XG5cbiAgICAgIGlmIChzdGFydERlbGltLm1hcmtlciAhPT0gMHgzRC8qID0gKi8pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGFydERlbGltLmVuZCA9PT0gLTEpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGVuZERlbGltID0gZGVsaW1pdGVyc1tzdGFydERlbGltLmVuZF07XG5cbiAgICAgIHRva2VuICAgICAgICAgPSBzdGF0ZS50b2tlbnNbc3RhcnREZWxpbS50b2tlbl07XG4gICAgICB0b2tlbi50eXBlICAgID0gJ21hcmtfb3Blbic7XG4gICAgICB0b2tlbi50YWcgICAgID0gJ21hcmsnO1xuICAgICAgdG9rZW4ubmVzdGluZyA9IDE7XG4gICAgICB0b2tlbi5tYXJrdXAgID0gJz09JztcbiAgICAgIHRva2VuLmNvbnRlbnQgPSAnJztcblxuICAgICAgdG9rZW4gICAgICAgICA9IHN0YXRlLnRva2Vuc1tlbmREZWxpbS50b2tlbl07XG4gICAgICB0b2tlbi50eXBlICAgID0gJ21hcmtfY2xvc2UnO1xuICAgICAgdG9rZW4udGFnICAgICA9ICdtYXJrJztcbiAgICAgIHRva2VuLm5lc3RpbmcgPSAtMTtcbiAgICAgIHRva2VuLm1hcmt1cCAgPSAnPT0nO1xuICAgICAgdG9rZW4uY29udGVudCA9ICcnO1xuXG4gICAgICBpZiAoc3RhdGUudG9rZW5zW2VuZERlbGltLnRva2VuIC0gMV0udHlwZSA9PT0gJ3RleHQnICYmXG4gICAgICAgICAgc3RhdGUudG9rZW5zW2VuZERlbGltLnRva2VuIC0gMV0uY29udGVudCA9PT0gJz0nKSB7XG5cbiAgICAgICAgbG9uZU1hcmtlcnMucHVzaChlbmREZWxpbS50b2tlbiAtIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIGEgbWFya2VyIHNlcXVlbmNlIGhhcyBhbiBvZGQgbnVtYmVyIG9mIGNoYXJhY3RlcnMsIGl0J3Mgc3BsaXR0ZWRcbiAgICAvLyBsaWtlIHRoaXM6IGB+fn5+fmAgLT4gYH5gICsgYH5+YCArIGB+fmAsIGxlYXZpbmcgb25lIG1hcmtlciBhdCB0aGVcbiAgICAvLyBzdGFydCBvZiB0aGUgc2VxdWVuY2UuXG4gICAgLy9cbiAgICAvLyBTbywgd2UgaGF2ZSB0byBtb3ZlIGFsbCB0aG9zZSBtYXJrZXJzIGFmdGVyIHN1YnNlcXVlbnQgc19jbG9zZSB0YWdzLlxuICAgIC8vXG4gICAgd2hpbGUgKGxvbmVNYXJrZXJzLmxlbmd0aCkge1xuICAgICAgaSA9IGxvbmVNYXJrZXJzLnBvcCgpO1xuICAgICAgaiA9IGkgKyAxO1xuXG4gICAgICB3aGlsZSAoaiA8IHN0YXRlLnRva2Vucy5sZW5ndGggJiYgc3RhdGUudG9rZW5zW2pdLnR5cGUgPT09ICdtYXJrX2Nsb3NlJykge1xuICAgICAgICBqKys7XG4gICAgICB9XG5cbiAgICAgIGotLTtcblxuICAgICAgaWYgKGkgIT09IGopIHtcbiAgICAgICAgdG9rZW4gPSBzdGF0ZS50b2tlbnNbal07XG4gICAgICAgIHN0YXRlLnRva2Vuc1tqXSA9IHN0YXRlLnRva2Vuc1tpXTtcbiAgICAgICAgc3RhdGUudG9rZW5zW2ldID0gdG9rZW47XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbWQuaW5saW5lLnJ1bGVyLmJlZm9yZSgnZW1waGFzaXMnLCAnbWFyaycsIHRva2VuaXplKTtcbiAgbWQuaW5saW5lLnJ1bGVyMi5iZWZvcmUoJ2VtcGhhc2lzJywgJ21hcmsnLCBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICB2YXIgY3VycixcbiAgICAgICAgdG9rZW5zX21ldGEgPSBzdGF0ZS50b2tlbnNfbWV0YSxcbiAgICAgICAgbWF4ID0gKHN0YXRlLnRva2Vuc19tZXRhIHx8IFtdKS5sZW5ndGg7XG5cbiAgICBwb3N0UHJvY2VzcyhzdGF0ZSwgc3RhdGUuZGVsaW1pdGVycyk7XG5cbiAgICBmb3IgKGN1cnIgPSAwOyBjdXJyIDwgbWF4OyBjdXJyKyspIHtcbiAgICAgIGlmICh0b2tlbnNfbWV0YVtjdXJyXSAmJiB0b2tlbnNfbWV0YVtjdXJyXS5kZWxpbWl0ZXJzKSB7XG4gICAgICAgIHBvc3RQcm9jZXNzKHN0YXRlLCB0b2tlbnNfbWV0YVtjdXJyXS5kZWxpbWl0ZXJzKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBERkEgPSByZXF1aXJlKCcuL2xpYi9kZmEuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtdWx0aW1kX3RhYmxlX3BsdWdpbihtZCwgb3B0aW9ucykge1xuICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgbXVsdGlsaW5lOiAgZmFsc2UsXG4gICAgcm93c3BhbjogICAgZmFsc2UsXG4gICAgaGVhZGVybGVzczogZmFsc2UsXG4gICAgbXVsdGlib2R5OiAgdHJ1ZVxuICB9O1xuICBvcHRpb25zID0gbWQudXRpbHMuYXNzaWduKHt9LCBkZWZhdWx0cywgb3B0aW9ucyB8fCB7fSk7XG5cbiAgZnVuY3Rpb24gc2Nhbl9ib3VuZF9pbmRpY2VzKHN0YXRlLCBsaW5lKSB7XG4gICAgLyoqXG4gICAgICogTmFtaW5nIGNvbnZlbnRpb24gb2YgcG9zaXRpb25hbCB2YXJpYWJsZXNcbiAgICAgKiAtIGxpc3QtaXRlbVxuICAgICAqIMK3wrfCt8K3wrfCt8K3wrfCt2xvbmd0ZXh0wrfCt8K3wrfCt8K3XFxuXG4gICAgICogICBeaGVhZCAgXnN0YXJ0ICBeZW5kICBebWF4XG4gICAgICovXG4gICAgdmFyIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW2xpbmVdICsgc3RhdGUuc0NvdW50W2xpbmVdLFxuICAgICAgICBoZWFkID0gc3RhdGUuYk1hcmtzW2xpbmVdICsgc3RhdGUuYmxrSW5kZW50LFxuICAgICAgICBlbmQgPSBzdGF0ZS5za2lwU3BhY2VzQmFjayhzdGF0ZS5lTWFya3NbbGluZV0sIGhlYWQpLFxuICAgICAgICBib3VuZHMgPSBbXSwgcG9zLCBwb3NqdW1wLFxuICAgICAgICBlc2NhcGUgPSBmYWxzZSwgY29kZSA9IGZhbHNlO1xuXG4gICAgLyogU2NhbiBmb3IgdmFsaWQgcGlwZSBjaGFyYWN0ZXIgcG9zaXRpb24gKi9cbiAgICBmb3IgKHBvcyA9IHN0YXJ0OyBwb3MgPCBlbmQ7IHBvcysrKSB7XG4gICAgICBzd2l0Y2ggKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykpIHtcbiAgICAgICAgY2FzZSAweDVjIC8qIFxcICovOlxuICAgICAgICAgIGVzY2FwZSA9IHRydWU7IGJyZWFrO1xuICAgICAgICBjYXNlIDB4NjAgLyogYCAqLzpcbiAgICAgICAgICBwb3NqdW1wID0gc3RhdGUuc2tpcENoYXJzKHBvcywgMHg2MCkgLSAxO1xuICAgICAgICAgIC8qIG1ha2UgXFxgIGNsb3NlcyB0aGUgY29kZSBzZXF1ZW5jZSwgYnV0IG5vdCBvcGVuIGl0O1xuICAgICAgICAgICAgIHRoZSByZWFzb24gaXMgdGhhdCBgXFxgIGlzIGNvcnJlY3QgY29kZSBibG9jayAqL1xuICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBicmFjZS1zdHlsZSAqL1xuICAgICAgICAgIGlmIChwb3NqdW1wID4gcG9zKSB7IHBvcyA9IHBvc2p1bXA7IH1cbiAgICAgICAgICBlbHNlIGlmIChjb2RlIHx8ICFlc2NhcGUpIHsgY29kZSA9ICFjb2RlOyB9XG4gICAgICAgICAgZXNjYXBlID0gZmFsc2U7IGJyZWFrO1xuICAgICAgICBjYXNlIDB4N2MgLyogfCAqLzpcbiAgICAgICAgICBpZiAoIWNvZGUgJiYgIWVzY2FwZSkgeyBib3VuZHMucHVzaChwb3MpOyB9XG4gICAgICAgICAgZXNjYXBlID0gZmFsc2U7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGVzY2FwZSA9IGZhbHNlOyBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJvdW5kcy5sZW5ndGggPT09IDApIHJldHVybiBib3VuZHM7XG5cbiAgICAvKiBQYWQgaW4gbmV3bGluZSBjaGFyYWN0ZXJzIG9uIGxhc3QgYW5kIHRoaXMgbGluZSAqL1xuICAgIGlmIChib3VuZHNbMF0gPiBoZWFkKSB7IGJvdW5kcy51bnNoaWZ0KGhlYWQgLSAxKTsgfVxuICAgIGlmIChib3VuZHNbYm91bmRzLmxlbmd0aCAtIDFdIDwgZW5kIC0gMSkgeyBib3VuZHMucHVzaChlbmQpOyB9XG5cbiAgICByZXR1cm4gYm91bmRzO1xuICB9XG5cbiAgZnVuY3Rpb24gdGFibGVfY2FwdGlvbihzdGF0ZSwgc2lsZW50LCBsaW5lKSB7XG4gICAgdmFyIG1ldGEgPSB7IHRleHQ6IG51bGwsIGxhYmVsOiBudWxsIH0sXG4gICAgICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW2xpbmVdICsgc3RhdGUuc0NvdW50W2xpbmVdLFxuICAgICAgICBtYXggPSBzdGF0ZS5lTWFya3NbbGluZV0sXG4gICAgICAgIGNhcFJFID0gL15cXFsoW15cXFtcXF1dKylcXF0oXFxbKFteXFxbXFxdXSspXFxdKT9cXHMqJC8sXG4gICAgICAgIG1hdGNoZXMgPSBzdGF0ZS5zcmMuc2xpY2Uoc3RhcnQsIG1heCkubWF0Y2goY2FwUkUpO1xuXG4gICAgaWYgKCFtYXRjaGVzKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIGlmIChzaWxlbnQpICB7IHJldHVybiB0cnVlOyB9XG4gICAgLy8gVE9ETyBlbGltaW5hdGUgY2FwUkUgYnkgc2ltcGxlIGNoZWNraW5nXG5cbiAgICBtZXRhLnRleHQgID0gbWF0Y2hlc1sxXTtcbiAgICBtZXRhLmxhYmVsID0gbWF0Y2hlc1syXSB8fCBtYXRjaGVzWzFdO1xuICAgIG1ldGEubGFiZWwgPSBtZXRhLmxhYmVsLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXFxXKy9nLCAnJyk7XG5cbiAgICByZXR1cm4gbWV0YTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhYmxlX3JvdyhzdGF0ZSwgc2lsZW50LCBsaW5lKSB7XG4gICAgdmFyIG1ldGEgPSB7IGJvdW5kczogbnVsbCwgbXVsdGlsaW5lOiBudWxsIH0sXG4gICAgICAgIGJvdW5kcyA9IHNjYW5fYm91bmRfaW5kaWNlcyhzdGF0ZSwgbGluZSksXG4gICAgICAgIHN0YXJ0LCBwb3MsIG9sZE1heDtcblxuICAgIGlmIChib3VuZHMubGVuZ3RoIDwgMikgeyByZXR1cm4gZmFsc2U7IH1cbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgICBtZXRhLmJvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qIE11bHRpbGluZS4gU2NhbiBib3VuZGFyaWVzIGFnYWluIHNpbmNlIGl0J3MgdmVyeSBjb21wbGljYXRlZCAqL1xuICAgIGlmIChvcHRpb25zLm11bHRpbGluZSkge1xuICAgICAgc3RhcnQgPSBzdGF0ZS5iTWFya3NbbGluZV0gKyBzdGF0ZS5zQ291bnRbbGluZV07XG4gICAgICBwb3MgPSBzdGF0ZS5lTWFya3NbbGluZV0gLSAxOyAvKiB3aGVyZSBiYWNrc2xhc2ggc2hvdWxkIGJlICovXG4gICAgICBtZXRhLm11bHRpbGluZSA9IChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDVDLyogXFwgKi8pO1xuICAgICAgaWYgKG1ldGEubXVsdGlsaW5lKSB7XG4gICAgICAgIG9sZE1heCA9IHN0YXRlLmVNYXJrc1tsaW5lXTtcbiAgICAgICAgc3RhdGUuZU1hcmtzW2xpbmVdID0gc3RhdGUuc2tpcFNwYWNlc0JhY2socG9zLCBzdGFydCk7XG4gICAgICAgIG1ldGEuYm91bmRzID0gc2Nhbl9ib3VuZF9pbmRpY2VzKHN0YXRlLCBsaW5lKTtcbiAgICAgICAgc3RhdGUuZU1hcmtzW2xpbmVdID0gb2xkTWF4O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtZXRhO1xuICB9XG5cbiAgZnVuY3Rpb24gdGFibGVfc2VwYXJhdG9yKHN0YXRlLCBzaWxlbnQsIGxpbmUpIHtcbiAgICB2YXIgbWV0YSA9IHsgYWxpZ25zOiBbXSwgd3JhcHM6IFtdIH0sXG4gICAgICAgIGJvdW5kcyA9IHNjYW5fYm91bmRfaW5kaWNlcyhzdGF0ZSwgbGluZSksXG4gICAgICAgIHNlcFJFID0gL146PygtK3w9Kyk6P1xcKz8kLyxcbiAgICAgICAgYywgdGV4dCwgYWxpZ247XG5cbiAgICAvKiBPbmx5IHNlcGFyYXRvciBuZWVkcyB0byBjaGVjayBpbmRlbnRzICovXG4gICAgaWYgKHN0YXRlLnNDb3VudFtsaW5lXSAtIHN0YXRlLmJsa0luZGVudCA+PSA0KSB7IHJldHVybiBmYWxzZTsgfVxuICAgIGlmIChib3VuZHMubGVuZ3RoID09PSAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgZm9yIChjID0gMDsgYyA8IGJvdW5kcy5sZW5ndGggLSAxOyBjKyspIHtcbiAgICAgIHRleHQgPSBzdGF0ZS5zcmMuc2xpY2UoYm91bmRzW2NdICsgMSwgYm91bmRzW2MgKyAxXSkudHJpbSgpO1xuICAgICAgaWYgKCFzZXBSRS50ZXN0KHRleHQpKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgICBtZXRhLndyYXBzLnB1c2godGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMSkgPT09IDB4MkIvKiArICovKTtcbiAgICAgIGFsaWduID0gKCh0ZXh0LmNoYXJDb2RlQXQoMCkgPT09IDB4M0EvKiA6ICovKSA8PCA0KSB8XG4gICAgICAgICAgICAgICAodGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMSAtIG1ldGEud3JhcHNbY10pID09PSAweDNBKTtcbiAgICAgIHN3aXRjaCAoYWxpZ24pIHtcbiAgICAgICAgY2FzZSAweDAwOiBtZXRhLmFsaWducy5wdXNoKCcnKTsgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgwMTogbWV0YS5hbGlnbnMucHVzaCgncmlnaHQnKTsgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MTA6IG1ldGEuYWxpZ25zLnB1c2goJ2xlZnQnKTsgICBicmVhaztcbiAgICAgICAgY2FzZSAweDExOiBtZXRhLmFsaWducy5wdXNoKCdjZW50ZXInKTsgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzaWxlbnQpIHsgcmV0dXJuIHRydWU7IH1cbiAgICByZXR1cm4gbWV0YTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhYmxlX2VtcHR5KHN0YXRlLCBzaWxlbnQsIGxpbmUpIHtcbiAgICByZXR1cm4gc3RhdGUuaXNFbXB0eShsaW5lKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhYmxlKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICAgIC8qKlxuICAgICAqIFJlZ2V4IHBzZXVkbyBjb2RlIGZvciB0YWJsZTpcbiAgICAgKiAgICAgY2FwdGlvbj8gaGVhZGVyKyBzZXBhcmF0b3IgKGRhdGErIGVtcHR5KSogZGF0YSsgY2FwdGlvbj9cbiAgICAgKlxuICAgICAqIFdlIHVzZSBERkEgdG8gZW11bGF0ZSB0aGlzIHBsdWdpbi4gVHlwZXMgd2l0aCBsb3dlciBwcmVjZWRlbmNlIGFyZVxuICAgICAqIHNldC1taW51cyBmcm9tIGFsbCB0aGUgZm9ybWVycy4gIE5vdGVkIHRoYXQgc2VwYXJhdG9yIHNob3VsZCBoYXZlIGhpZ2hlclxuICAgICAqIHByZWNlZGVuY2UgdGhhbiBoZWFkZXIgb3IgZGF0YS5cbiAgICAgKiAgIHwgIHN0YXRlICB8IGNhcHRpb24gc2VwYXJhdG9yIGhlYWRlciBkYXRhIGVtcHR5IHwgLS0+IGxvd2VyIHByZWNlZGVuY2VcbiAgICAgKiAgIHwgMHgxMDEwMCB8ICAgIDEgICAgICAgIDAgICAgICAgMSAgICAgMCAgICAgMCAgIHxcbiAgICAgKi9cbiAgICB2YXIgdGFibGVERkEgPSBuZXcgREZBKCksXG4gICAgICAgIGdycCA9IDB4MTAsIG10ciA9IC0xLFxuICAgICAgICB0b2tlbiwgdGFibGVUb2tlbiwgdHJUb2tlbixcbiAgICAgICAgY29sc3BhbiwgbGVmdFRva2VuLFxuICAgICAgICByb3dzcGFuLCB1cFRva2VucyA9IFtdLFxuICAgICAgICB0YWJsZUxpbmVzLCB0Z3JvdXBMaW5lcyxcbiAgICAgICAgdGFnLCB0ZXh0LCByYW5nZSwgciwgYywgYjtcblxuICAgIGlmIChzdGFydExpbmUgKyAyID4gZW5kTGluZSkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIC8qKlxuICAgICAqIEZpcnN0IHBhc3M6IHZhbGlkYXRlIGFuZCBjb2xsZWN0IGluZm8gaW50byB0YWJsZSB0b2tlbi4gSVIgaXMgc3RvcmVkIGluXG4gICAgICogbWFya2Rvd24taXQgYHRva2VuLm1ldGFgIHRvIGJlIHB1c2hlZCBsYXRlci4gdGFibGUvdHIgb3BlbiB0b2tlbnMgYXJlXG4gICAgICogZ2VuZXJhdGVkIGhlcmUuXG4gICAgICovXG4gICAgdGFibGVUb2tlbiAgICAgICA9IG5ldyBzdGF0ZS5Ub2tlbigndGFibGVfb3BlbicsICd0YWJsZScsIDEpO1xuICAgIHRhYmxlVG9rZW4ubWV0YSAgPSB7IHNlcDogbnVsbCwgY2FwOiBudWxsLCB0cjogW10gfTtcblxuICAgIHRhYmxlREZBLnNldF9oaWdoZXN0X2FscGhhYmV0KDB4MTAwMDApO1xuICAgIHRhYmxlREZBLnNldF9pbml0aWFsX3N0YXRlKDB4MTAxMDApO1xuICAgIHRhYmxlREZBLnNldF9hY2NlcHRfc3RhdGVzKFsgMHgxMDAxMCwgMHgxMDAxMSwgMHgwMDAwMCBdKTtcbiAgICB0YWJsZURGQS5zZXRfbWF0Y2hfYWxwaGFiZXRzKHtcbiAgICAgIDB4MTAwMDA6IHRhYmxlX2NhcHRpb24uYmluZCh0aGlzLCBzdGF0ZSwgdHJ1ZSksXG4gICAgICAweDAxMDAwOiB0YWJsZV9zZXBhcmF0b3IuYmluZCh0aGlzLCBzdGF0ZSwgdHJ1ZSksXG4gICAgICAweDAwMTAwOiB0YWJsZV9yb3cuYmluZCh0aGlzLCBzdGF0ZSwgdHJ1ZSksXG4gICAgICAweDAwMDEwOiB0YWJsZV9yb3cuYmluZCh0aGlzLCBzdGF0ZSwgdHJ1ZSksXG4gICAgICAweDAwMDAxOiB0YWJsZV9lbXB0eS5iaW5kKHRoaXMsIHN0YXRlLCB0cnVlKVxuICAgIH0pO1xuICAgIHRhYmxlREZBLnNldF90cmFuc2l0aW9ucyh7XG4gICAgICAweDEwMTAwOiB7IDB4MTAwMDA6IDB4MDAxMDAsIDB4MDAxMDA6IDB4MDExMDAgfSxcbiAgICAgIDB4MDAxMDA6IHsgMHgwMDEwMDogMHgwMTEwMCB9LFxuICAgICAgMHgwMTEwMDogeyAweDAxMDAwOiAweDEwMDEwLCAweDAwMTAwOiAweDAxMTAwIH0sXG4gICAgICAweDEwMDEwOiB7IDB4MTAwMDA6IDB4MDAwMDAsIDB4MDAwMTA6IDB4MTAwMTEgfSxcbiAgICAgIDB4MTAwMTE6IHsgMHgxMDAwMDogMHgwMDAwMCwgMHgwMDAxMDogMHgxMDAxMSwgMHgwMDAwMTogMHgxMDAxMCB9XG4gICAgfSk7XG4gICAgaWYgKG9wdGlvbnMuaGVhZGVybGVzcykge1xuICAgICAgdGFibGVERkEuc2V0X2luaXRpYWxfc3RhdGUoMHgxMTEwMCk7XG4gICAgICB0YWJsZURGQS51cGRhdGVfdHJhbnNpdGlvbigweDExMTAwLFxuICAgICAgICB7IDB4MTAwMDA6IDB4MDExMDAsIDB4MDEwMDA6IDB4MTAwMTAsIDB4MDAxMDA6IDB4MDExMDAgfVxuICAgICAgKTtcbiAgICAgIHRyVG9rZW4gICAgICA9IG5ldyBzdGF0ZS5Ub2tlbigndGFibGVfZmFrZV9oZWFkZXJfcm93JywgJ3RyJywgMSk7XG4gICAgICB0clRva2VuLm1ldGEgPSBPYmplY3QoKTsgIC8vIGF2b2lkIHRyVG9rZW4ubWV0YS5ncnAgdGhyb3dzIGV4Y2VwdGlvblxuICAgIH1cbiAgICBpZiAoIW9wdGlvbnMubXVsdGlib2R5KSB7XG4gICAgICB0YWJsZURGQS51cGRhdGVfdHJhbnNpdGlvbigweDEwMDEwLFxuICAgICAgICB7IDB4MTAwMDA6IDB4MDAwMDAsIDB4MDAwMTA6IDB4MTAwMTAgfSAgLy8gMHgxMDAxMSBpcyBuZXZlciByZWFjaGVkXG4gICAgICApO1xuICAgIH1cbiAgICAvKiBEb24ndCBtaXggdXAgREZBIGBfc3RhdGVgIGFuZCBtYXJrZG93bi1pdCBgc3RhdGVgICovXG4gICAgdGFibGVERkEuc2V0X2FjdGlvbnMoZnVuY3Rpb24gKF9saW5lLCBfc3RhdGUsIF90eXBlKSB7XG4gICAgICAvLyBjb25zb2xlLmxvZyhfbGluZSwgX3N0YXRlLnRvU3RyaW5nKDE2KSwgX3R5cGUudG9TdHJpbmcoMTYpKSAgLy8gZm9yIHRlc3RcbiAgICAgIHN3aXRjaCAoX3R5cGUpIHtcbiAgICAgICAgY2FzZSAweDEwMDAwOlxuICAgICAgICAgIGlmICh0YWJsZVRva2VuLm1ldGEuY2FwKSB7IGJyZWFrOyB9XG4gICAgICAgICAgdGFibGVUb2tlbi5tZXRhLmNhcCAgICAgICA9IHRhYmxlX2NhcHRpb24oc3RhdGUsIGZhbHNlLCBfbGluZSk7XG4gICAgICAgICAgdGFibGVUb2tlbi5tZXRhLmNhcC5tYXAgICA9IFsgX2xpbmUsIF9saW5lICsgMSBdO1xuICAgICAgICAgIHRhYmxlVG9rZW4ubWV0YS5jYXAuZmlyc3QgPSAoX2xpbmUgPT09IHN0YXJ0TGluZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgwMTAwMDpcbiAgICAgICAgICB0YWJsZVRva2VuLm1ldGEuc2VwICAgICA9IHRhYmxlX3NlcGFyYXRvcihzdGF0ZSwgZmFsc2UsIF9saW5lKTtcbiAgICAgICAgICB0YWJsZVRva2VuLm1ldGEuc2VwLm1hcCA9IFsgX2xpbmUsIF9saW5lICsgMSBdO1xuICAgICAgICAgIHRyVG9rZW4ubWV0YS5ncnAgfD0gMHgwMTsgIC8vIHByZXZpb3VzbHkgYXNzaWduZWQgYXQgY2FzZSAweDAwMTEwXG4gICAgICAgICAgZ3JwICAgICAgICAgICAgICAgPSAweDEwO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MDAxMDA6XG4gICAgICAgIGNhc2UgMHgwMDAxMDpcbiAgICAgICAgICB0clRva2VuICAgICAgICAgICA9IG5ldyBzdGF0ZS5Ub2tlbigndHJfb3BlbicsICd0cicsIDEpO1xuICAgICAgICAgIHRyVG9rZW4ubWFwICAgICAgID0gWyBfbGluZSwgX2xpbmUgKyAxIF07XG4gICAgICAgICAgdHJUb2tlbi5tZXRhICAgICAgPSB0YWJsZV9yb3coc3RhdGUsIGZhbHNlLCBfbGluZSk7XG4gICAgICAgICAgdHJUb2tlbi5tZXRhLnR5cGUgPSBfdHlwZTtcbiAgICAgICAgICB0clRva2VuLm1ldGEuZ3JwICA9IGdycDtcbiAgICAgICAgICBncnAgICAgICAgICAgICAgICA9IDB4MDA7XG4gICAgICAgICAgdGFibGVUb2tlbi5tZXRhLnRyLnB1c2godHJUb2tlbik7XG4gICAgICAgICAgLyogTXVsdGlsaW5lLiBNZXJnZSB0clRva2VucyBhcyBhbiBlbnRpcmUgbXVsdGlsaW5lIHRyVG9rZW4gKi9cbiAgICAgICAgICBpZiAob3B0aW9ucy5tdWx0aWxpbmUpIHtcbiAgICAgICAgICAgIGlmICh0clRva2VuLm1ldGEubXVsdGlsaW5lICYmIG10ciA8IDApIHtcbiAgICAgICAgICAgICAgLyogU3RhcnQgbGluZSBvZiBtdWx0aWxpbmUgcm93LiBtYXJrIHRoaXMgdHJUb2tlbiAqL1xuICAgICAgICAgICAgICBtdHIgPSB0YWJsZVRva2VuLm1ldGEudHIubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXRyVG9rZW4ubWV0YS5tdWx0aWxpbmUgJiYgbXRyID49IDApIHtcbiAgICAgICAgICAgICAgLyogRW5kIGxpbmUgb2YgbXVsdGlsaW5lIHJvdy4gbWVyZ2UgZm9yd2FyZCB1bnRpbCB0aGUgbWFya2VkIHRyVG9rZW4gKi9cbiAgICAgICAgICAgICAgdG9rZW4gICAgICAgICAgICAgICA9IHRhYmxlVG9rZW4ubWV0YS50clttdHJdO1xuICAgICAgICAgICAgICB0b2tlbi5tZXRhLm1ib3VuZHMgID0gdGFibGVUb2tlbi5tZXRhLnRyXG4gICAgICAgICAgICAgICAgLnNsaWNlKG10cikubWFwKGZ1bmN0aW9uICh0aykgeyByZXR1cm4gdGsubWV0YS5ib3VuZHM7IH0pO1xuICAgICAgICAgICAgICB0b2tlbi5tYXBbMV0gICAgICAgID0gdHJUb2tlbi5tYXBbMV07XG4gICAgICAgICAgICAgIHRhYmxlVG9rZW4ubWV0YS50ciAgPSB0YWJsZVRva2VuLm1ldGEudHIuc2xpY2UoMCwgbXRyICsgMSk7XG4gICAgICAgICAgICAgIG10ciA9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAweDAwMDAxOlxuICAgICAgICAgIHRyVG9rZW4ubWV0YS5ncnAgfD0gMHgwMTtcbiAgICAgICAgICBncnAgICAgICAgICAgICAgICA9IDB4MTA7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAodGFibGVERkEuZXhlY3V0ZShzdGFydExpbmUsIGVuZExpbmUpID09PSBmYWxzZSkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAvLyBpZiAoIXRhYmxlVG9rZW4ubWV0YS5zZXApIHsgcmV0dXJuIGZhbHNlOyB9IC8vIGFsd2F5cyBldmFsdWF0ZWQgdHJ1ZVxuICAgIGlmICghdGFibGVUb2tlbi5tZXRhLnRyLmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH0gLy8gZmFsc2UgdW5kZXIgaGVhZGVybGVzcyBjb3JuZXIgY2FzZVxuICAgIGlmIChzaWxlbnQpIHsgcmV0dXJuIHRydWU7IH1cblxuICAgIC8qIExhc3QgZGF0YSByb3cgY2Fubm90IGJlIGRldGVjdGVkLiBub3Qgc3RvcmVkIHRvIHRyVG9rZW4gb3V0c2lkZT8gKi9cbiAgICB0YWJsZVRva2VuLm1ldGEudHJbdGFibGVUb2tlbi5tZXRhLnRyLmxlbmd0aCAtIDFdLm1ldGEuZ3JwIHw9IDB4MDE7XG5cblxuICAgIC8qKlxuICAgICAqIFNlY29uZCBwYXNzOiBhY3R1YWxseSBwdXNoIHRoZSB0b2tlbnMgaW50byBgc3RhdGUudG9rZW5zYC5cbiAgICAgKiB0aGVhZC90Ym9keS90aC90ZCBvcGVuIHRva2VucyBhbmQgYWxsIGNsb3NlZCB0b2tlbnMgYXJlIGdlbmVyYXRlZCBoZXJlO1xuICAgICAqIHRoZWFkL3Rib2R5IGFyZSBnZW5lcmFsbHkgY2FsbGVkIHRncm91cDsgdGQvdGggYXJlIGdlbmVyYWxseSBjYWxsZWQgdGNvbC5cbiAgICAgKi9cbiAgICB0YWJsZVRva2VuLm1hcCAgID0gdGFibGVMaW5lcyA9IFsgc3RhcnRMaW5lLCAwIF07XG4gICAgdGFibGVUb2tlbi5ibG9jayA9IHRydWU7XG4gICAgdGFibGVUb2tlbi5sZXZlbCA9IHN0YXRlLmxldmVsKys7XG4gICAgc3RhdGUudG9rZW5zLnB1c2godGFibGVUb2tlbik7XG5cbiAgICBpZiAodGFibGVUb2tlbi5tZXRhLmNhcCkge1xuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdjYXB0aW9uX29wZW4nLCAnY2FwdGlvbicsIDEpO1xuICAgICAgdG9rZW4ubWFwICAgICAgPSB0YWJsZVRva2VuLm1ldGEuY2FwLm1hcDtcbiAgICAgIHRva2VuLmF0dHJzICAgID0gWyBbICdpZCcsIHRhYmxlVG9rZW4ubWV0YS5jYXAubGFiZWwgXSBdO1xuXG4gICAgICB0b2tlbiAgICAgICAgICA9IHN0YXRlLnB1c2goJ2lubGluZScsICcnLCAwKTtcbiAgICAgIHRva2VuLmNvbnRlbnQgID0gdGFibGVUb2tlbi5tZXRhLmNhcC50ZXh0O1xuICAgICAgdG9rZW4ubWFwICAgICAgPSB0YWJsZVRva2VuLm1ldGEuY2FwLm1hcDtcbiAgICAgIHRva2VuLmNoaWxkcmVuID0gW107XG5cbiAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnY2FwdGlvbl9jbG9zZScsICdjYXB0aW9uJywgLTEpO1xuICAgIH1cblxuICAgIGZvciAociA9IDA7IHIgPCB0YWJsZVRva2VuLm1ldGEudHIubGVuZ3RoOyByKyspIHtcbiAgICAgIGxlZnRUb2tlbiA9IG5ldyBzdGF0ZS5Ub2tlbigndGFibGVfZmFrZV90Y29sX29wZW4nLCAnJywgMSk7XG5cbiAgICAgIC8qIFB1c2ggaW4gdGhlYWQvdGJvZHkgYW5kIHRyIG9wZW4gdG9rZW5zICovXG4gICAgICB0clRva2VuID0gdGFibGVUb2tlbi5tZXRhLnRyW3JdO1xuICAgICAgLy8gY29uc29sZS5sb2codHJUb2tlbi5tZXRhKTsgLy8gZm9yIHRlc3RcbiAgICAgIGlmICh0clRva2VuLm1ldGEuZ3JwICYgMHgxMCkge1xuICAgICAgICB0YWcgPSAodHJUb2tlbi5tZXRhLnR5cGUgPT09IDB4MDAxMDApID8gJ3RoZWFkJyA6ICd0Ym9keSc7XG4gICAgICAgIHRva2VuICAgICA9IHN0YXRlLnB1c2godGFnICsgJ19vcGVuJywgdGFnLCAxKTtcbiAgICAgICAgdG9rZW4ubWFwID0gdGdyb3VwTGluZXMgPSBbIHRyVG9rZW4ubWFwWzBdLCAwIF07ICAvLyBhcnJheSByZWZcbiAgICAgICAgdXBUb2tlbnMgID0gW107XG4gICAgICB9XG4gICAgICB0clRva2VuLmJsb2NrID0gdHJ1ZTtcbiAgICAgIHRyVG9rZW4ubGV2ZWwgPSBzdGF0ZS5sZXZlbCsrO1xuICAgICAgc3RhdGUudG9rZW5zLnB1c2godHJUb2tlbik7XG5cbiAgICAgIC8qIFB1c2ggaW4gdGgvdGQgdG9rZW5zICovXG4gICAgICBmb3IgKGMgPSAwOyBjIDwgdHJUb2tlbi5tZXRhLmJvdW5kcy5sZW5ndGggLSAxOyBjKyspIHtcbiAgICAgICAgcmFuZ2UgPSBbIHRyVG9rZW4ubWV0YS5ib3VuZHNbY10gKyAxLCB0clRva2VuLm1ldGEuYm91bmRzW2MgKyAxXSBdO1xuICAgICAgICB0ZXh0ID0gc3RhdGUuc3JjLnNsaWNlLmFwcGx5KHN0YXRlLnNyYywgcmFuZ2UpO1xuXG4gICAgICAgIGlmICh0ZXh0ID09PSAnJykge1xuICAgICAgICAgIGNvbHNwYW4gPSBsZWZ0VG9rZW4uYXR0ckdldCgnY29sc3BhbicpO1xuICAgICAgICAgIGxlZnRUb2tlbi5hdHRyU2V0KCdjb2xzcGFuJywgY29sc3BhbiA9PT0gbnVsbCA/IDIgOiBjb2xzcGFuICsgMSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMucm93c3BhbiAmJiB1cFRva2Vuc1tjXSAmJiB0ZXh0LnRyaW0oKSA9PT0gJ15eJykge1xuICAgICAgICAgIHJvd3NwYW4gPSB1cFRva2Vuc1tjXS5hdHRyR2V0KCdyb3dzcGFuJyk7XG4gICAgICAgICAgdXBUb2tlbnNbY10uYXR0clNldCgncm93c3BhbicsIHJvd3NwYW4gPT09IG51bGwgPyAyIDogcm93c3BhbiArIDEpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFnID0gKHRyVG9rZW4ubWV0YS50eXBlID09PSAweDAwMTAwKSA/ICd0aCcgOiAndGQnO1xuICAgICAgICB0b2tlbiAgICAgICA9IHN0YXRlLnB1c2godGFnICsgJ19vcGVuJywgdGFnLCAxKTtcbiAgICAgICAgdG9rZW4ubWFwICAgPSB0clRva2VuLm1hcDtcbiAgICAgICAgdG9rZW4uYXR0cnMgPSBbXTtcbiAgICAgICAgaWYgKHRhYmxlVG9rZW4ubWV0YS5zZXAuYWxpZ25zW2NdKSB7XG4gICAgICAgICAgdG9rZW4uYXR0cnMucHVzaChbICdzdHlsZScsICd0ZXh0LWFsaWduOicgKyB0YWJsZVRva2VuLm1ldGEuc2VwLmFsaWduc1tjXSBdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGFibGVUb2tlbi5tZXRhLnNlcC53cmFwc1tjXSkge1xuICAgICAgICAgIHRva2VuLmF0dHJzLnB1c2goWyAnY2xhc3MnLCAnZXh0ZW5kJyBdKTtcbiAgICAgICAgfVxuICAgICAgICBsZWZ0VG9rZW4gPSB1cFRva2Vuc1tjXSA9IHRva2VuO1xuXG4gICAgICAgIC8qIE11bHRpbGluZS4gSm9pbiB0aGUgdGV4dCBhbmQgZmVlZCBpbnRvIG1hcmtkb3duLWl0IGJsb2NrUGFyc2VyLiAqL1xuICAgICAgICBpZiAob3B0aW9ucy5tdWx0aWxpbmUgJiYgdHJUb2tlbi5tZXRhLm11bHRpbGluZSAmJiB0clRva2VuLm1ldGEubWJvdW5kcykge1xuICAgICAgICAgIHRleHQgPSBbIHRleHQudHJpbVJpZ2h0KCkgXTtcbiAgICAgICAgICBmb3IgKGIgPSAxOyBiIDwgdHJUb2tlbi5tZXRhLm1ib3VuZHMubGVuZ3RoOyBiKyspIHtcbiAgICAgICAgICAgIC8qIExpbmUgd2l0aCBOIGJvdW5kcyBoYXMgY2VsbHMgaW5kZXhlZCBmcm9tIDAgdG8gTi0yICovXG4gICAgICAgICAgICBpZiAoYyA+IHRyVG9rZW4ubWV0YS5tYm91bmRzW2JdLmxlbmd0aCAtIDIpIHsgY29udGludWU7IH1cbiAgICAgICAgICAgIHJhbmdlID0gWyB0clRva2VuLm1ldGEubWJvdW5kc1tiXVtjXSArIDEsIHRyVG9rZW4ubWV0YS5tYm91bmRzW2JdW2MgKyAxXSBdO1xuICAgICAgICAgICAgdGV4dC5wdXNoKHN0YXRlLnNyYy5zbGljZS5hcHBseShzdGF0ZS5zcmMsIHJhbmdlKS50cmltUmlnaHQoKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0YXRlLm1kLmJsb2NrLnBhcnNlKHRleHQuam9pbignXFxuJyksIHN0YXRlLm1kLCBzdGF0ZS5lbnYsIHN0YXRlLnRva2Vucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdpbmxpbmUnLCAnJywgMCk7XG4gICAgICAgICAgdG9rZW4uY29udGVudCAgPSB0ZXh0LnRyaW0oKTtcbiAgICAgICAgICB0b2tlbi5tYXAgICAgICA9IHRyVG9rZW4ubWFwO1xuICAgICAgICAgIHRva2VuLmNoaWxkcmVuID0gW107XG4gICAgICAgIH1cblxuICAgICAgICB0b2tlbiA9IHN0YXRlLnB1c2godGFnICsgJ19jbG9zZScsIHRhZywgLTEpO1xuICAgICAgfVxuXG4gICAgICAvKiBQdXNoIGluIHRyIGFuZCB0aGVhZC90Ym9keSBjbG9zZWQgdG9rZW5zICovXG4gICAgICBzdGF0ZS5wdXNoKCd0cl9jbG9zZScsICd0cicsIC0xKTtcbiAgICAgIGlmICh0clRva2VuLm1ldGEuZ3JwICYgMHgwMSkge1xuICAgICAgICB0YWcgPSAodHJUb2tlbi5tZXRhLnR5cGUgPT09IDB4MDAxMDApID8gJ3RoZWFkJyA6ICd0Ym9keSc7XG4gICAgICAgIHRva2VuID0gc3RhdGUucHVzaCh0YWcgKyAnX2Nsb3NlJywgdGFnLCAtMSk7XG4gICAgICAgIHRncm91cExpbmVzWzFdID0gdHJUb2tlbi5tYXBbMV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGFibGVMaW5lc1sxXSA9IE1hdGgubWF4KFxuICAgICAgdGdyb3VwTGluZXNbMV0sXG4gICAgICB0YWJsZVRva2VuLm1ldGEuc2VwLm1hcFsxXSxcbiAgICAgIHRhYmxlVG9rZW4ubWV0YS5jYXAgPyB0YWJsZVRva2VuLm1ldGEuY2FwLm1hcFsxXSA6IC0xXG4gICAgKTtcbiAgICB0b2tlbiA9IHN0YXRlLnB1c2goJ3RhYmxlX2Nsb3NlJywgJ3RhYmxlJywgLTEpO1xuXG4gICAgc3RhdGUubGluZSA9IHRhYmxlTGluZXNbMV07XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBtZC5ibG9jay5ydWxlci5hdCgndGFibGUnLCB0YWJsZSwgeyBhbHQ6IFsgJ3BhcmFncmFwaCcsICdyZWZlcmVuY2UnIF0gfSk7XG59O1xuXG4vKiB2aW06IHNldCB0cz0yIHN3PTIgZXQ6ICovXG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIGNvbnN0cnVjdG9yXG5cbmZ1bmN0aW9uIERGQSgpIHtcbiAgLy8gYWxwaGFiZXRzIGFyZSBlbmNvZGVkIGJ5IG51bWJlcnMgaW4gMTZeTiBmb3JtLCBwcmVzZW50aW5nIGl0cyBwcmVjZWRlbmNlXG4gIHRoaXMuX19oaWdoZXN0X2FscGhhYmV0X18gPSAweDA7XG4gIHRoaXMuX19tYXRjaF9hbHBoYWJldHNfXyA9IHt9O1xuICAvLyBzdGF0ZXMgYXJlIHVuaW9uIChiaXR3aXNlIE9SKSBvZiBpdHMgYWNjZXB0ZWQgYWxwaGFiZXRzXG4gIHRoaXMuX19pbml0aWFsX3N0YXRlX18gPSAweDA7XG4gIHRoaXMuX19hY2NlcHRfc3RhdGVzX18gPSB7fTtcbiAgLy8gdHJhbnNpdGlvbnMgYXJlIGluIHRoZSBmb3JtOiB7cHJldl9zdGF0ZToge2FscGhhYmV0OiBuZXh0X3N0YXRlfX1cbiAgdGhpcy5fX3RyYW5zaXRpb25zX18gPSB7fTtcbiAgLy8gYWN0aW9ucyB0YWtlIHR3byBwYXJhbWV0ZXJzOiBzdGVwIChsaW5lIG51bWJlciksIHByZXZfc3RhdGUgYW5kIGFscGhhYmV0XG4gIHRoaXMuX19hY3Rpb25zX18gPSB7fTtcbn1cblxuLy8gc2V0dGVyc1xuXG5ERkEucHJvdG90eXBlLnNldF9oaWdoZXN0X2FscGhhYmV0ID0gZnVuY3Rpb24gKGFscGhhYmV0KSB7XG4gIHRoaXMuX19oaWdoZXN0X2FscGhhYmV0X18gPSBhbHBoYWJldDtcbn07XG5cbkRGQS5wcm90b3R5cGUuc2V0X21hdGNoX2FscGhhYmV0cyA9IGZ1bmN0aW9uIChtYXRjaGVzKSB7XG4gIHRoaXMuX19tYXRjaF9hbHBoYWJldHNfXyA9IG1hdGNoZXM7XG59O1xuXG5ERkEucHJvdG90eXBlLnNldF9pbml0aWFsX3N0YXRlID0gZnVuY3Rpb24gKGluaXRpYWwpIHtcbiAgdGhpcy5fX2luaXRpYWxfc3RhdGVfXyA9IGluaXRpYWw7XG59O1xuXG5ERkEucHJvdG90eXBlLnNldF9hY2NlcHRfc3RhdGVzID0gZnVuY3Rpb24gKGFjY2VwdHMpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhY2NlcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy5fX2FjY2VwdF9zdGF0ZXNfX1thY2NlcHRzW2ldXSA9IHRydWU7XG4gIH1cbn07XG5cbkRGQS5wcm90b3R5cGUuc2V0X3RyYW5zaXRpb25zID0gZnVuY3Rpb24gKHRyYW5zaXRpb25zKSB7XG4gIHRoaXMuX190cmFuc2l0aW9uc19fID0gdHJhbnNpdGlvbnM7XG59O1xuXG5ERkEucHJvdG90eXBlLnNldF9hY3Rpb25zID0gZnVuY3Rpb24gKGFjdGlvbnMpIHtcbiAgdGhpcy5fX2FjdGlvbnNfXyA9IGFjdGlvbnM7XG59O1xuXG5ERkEucHJvdG90eXBlLnVwZGF0ZV90cmFuc2l0aW9uID0gZnVuY3Rpb24gKHN0YXRlLCBhbHBoYWJldHMpIHtcbiAgdGhpcy5fX3RyYW5zaXRpb25zX19bc3RhdGVdID0gT2JqZWN0LmFzc2lnbihcbiAgICB0aGlzLl9fdHJhbnNpdGlvbnNfX1tzdGF0ZV0gfHwgT2JqZWN0KCksIGFscGhhYmV0c1xuICApO1xufTtcblxuLy8gbWV0aG9kc1xuXG5ERkEucHJvdG90eXBlLmV4ZWN1dGUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCkge1xuICB2YXIgc3RhdGUsIHN0ZXAsIGFscGhhYmV0O1xuICBmb3IgKHN0YXRlID0gdGhpcy5fX2luaXRpYWxfc3RhdGVfXywgc3RlcCA9IHN0YXJ0OyBzdGF0ZSAmJiBzdGVwIDwgZW5kOyBzdGVwKyspIHtcbiAgICBmb3IgKGFscGhhYmV0ID0gdGhpcy5fX2hpZ2hlc3RfYWxwaGFiZXRfXzsgYWxwaGFiZXQgPiAweDA7IGFscGhhYmV0ID4+PSA0KSB7XG4gICAgICBpZiAoKHN0YXRlICYgYWxwaGFiZXQpXG4gICAgICAgICAgJiYgdGhpcy5fX21hdGNoX2FscGhhYmV0c19fW2FscGhhYmV0XS5jYWxsKHRoaXMsIHN0ZXAsIHN0YXRlLCBhbHBoYWJldCkpIHsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICB0aGlzLl9fYWN0aW9uc19fKHN0ZXAsIHN0YXRlLCBhbHBoYWJldCk7XG5cbiAgICBpZiAoYWxwaGFiZXQgPT09IDB4MCkgeyBicmVhazsgfVxuICAgIHN0YXRlID0gdGhpcy5fX3RyYW5zaXRpb25zX19bc3RhdGVdW2FscGhhYmV0XSB8fCAweDA7XG4gIH1cbiAgcmV0dXJuICEhdGhpcy5fX2FjY2VwdF9zdGF0ZXNfX1tzdGF0ZV07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERGQTtcblxuLyogdmltOiBzZXQgdHM9MiBzdz0yIGV0OiAqL1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtYXJrZG93bkl0VW5kZXJsaW5lIChtZCkge1xuXG4gIGZ1bmN0aW9uIHJlbmRlckVtICh0b2tlbnMsIGlkeCwgb3B0cywgXywgc2xmKSB7XG4gICAgdmFyIHRva2VuID0gdG9rZW5zW2lkeF07XG4gICAgaWYgKHRva2VuLm1hcmt1cCA9PT0gJ18nKSB7XG4gICAgICB0b2tlbi50YWcgPSAndSc7XG4gICAgfVxuICAgIHJldHVybiBzbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdHMpO1xuICB9XG5cbiAgbWQucmVuZGVyZXIucnVsZXMuZW1fb3BlbiA9IHJlbmRlckVtO1xuICBtZC5yZW5kZXJlci5ydWxlcy5lbV9jbG9zZSA9IHJlbmRlckVtO1xufTtcbiIsIi8qIVxuICogbWltZS1kYlxuICogQ29weXJpZ2h0KGMpIDIwMTQgSm9uYXRoYW4gT25nXG4gKiBNSVQgTGljZW5zZWRcbiAqL1xuXG4vKipcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kYi5qc29uJylcbiIsIid1c2Ugc3RyaWN0JztcblxuXG4vLyBtaW1lIGZpbGVzIGRhdGFcbnZhciBkYiA9IHJlcXVpcmUoJ21pbWUtZGInKTtcblxuXG4vLyBNZXJnZSBvYmplY3RzXG4vL1xuZnVuY3Rpb24gYXNzaWduKG9iaiAvKmZyb20xLCBmcm9tMiwgZnJvbTMsIC4uLiovKSB7XG4gIHZhciBzb3VyY2VzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBzb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBvYmpba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gb2JqO1xufVxuXG5cbi8vIGxlYXZlcyBvbmx5IGV4dGVuc2lvbiBmcm9tIHRoZSBnaXZlbiBzdHJpbmdcbi8vICAgbm9ybWFsaXplKCdmb28vYmFyLmpzJykgIC8vIC0+ICcuanMnXG4vLyAgIG5vcm1hbGl6ZSgnYmFyLmpzJykgICAgICAvLyAtPiAnLmpzJ1xuLy8gICBub3JtYWxpemUoJy5qcycpICAgICAgICAgLy8gLT4gJy5qcydcbi8vICAgbm9ybWFsaXplKCdqcycpICAgICAgICAgIC8vIC0+ICcuanMnXG5mdW5jdGlvbiBub3JtYWxpemUocGF0aCkge1xuICAvLyBlZGdlIGNhc2U6ICcvdHh0JyAmICdcXHR4dCcgYXJlIG5vdCByZXNvbHZlYWJsZVxuICBpZiAoL1tcXFxcL11bXlxcXFwvLl0rJC8udGVzdChwYXRoKSkgeyByZXR1cm4gJyc7IH1cblxuICByZXR1cm4gJy4nICsgcGF0aC5yZXBsYWNlKC8uKltcXC5cXC9cXFxcXS8sICcnKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vLyBSZW1vdmUgY2hhcnNldC90eXBlcy9zcGFjZXMsIGNvbnZlbmVudCBmb3IgZXh0ZXJuYWwgZGF0YSBjaGVja1xuLy8gXCIgdEV4dC9odE1sIDsgY2hhcnNldD1VVEYtOCA7IHR5cGU9Zm9vIFwiIC0+IFwidGV4dC9odG1sXCJcbmZ1bmN0aW9uIGNsZWFyTWltZShtaW1lVHlwZSkge1xuICBpZiAoIW1pbWVUeXBlIHx8IChTdHJpbmcobWltZVR5cGUpICE9PSBtaW1lVHlwZSkpIHsgcmV0dXJuICcnOyB9XG4gIHJldHVybiBtaW1lVHlwZS5zcGxpdCgnOycpWzBdLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xufVxuXG5cbi8qKlxuICogY2xhc3MgTWltb3phXG4gKiovXG5cbi8qKlxuICogIG5ldyBNaW1vemEoW29wdGlvbnNdKVxuICpcbiAqICBJbml0aWF0ZXMgbmV3IGluc3RhbmNlIG9mIE1pbW96YS5cbiAqXG4gKiAgIyMjIyMgT3B0aW9uc1xuICpcbiAqICAtICoqZGVmYXVsdFR5cGUqKiBfKFN0cmluZyk6XyBEZWZhdWx0IG1pbWUgdHlwZSB1c2VkIGFzIGxhc3QtcmVzb3J0XG4gKiAgICBmb3IgW1tNaW1vemEjZ2V0TWltZVR5cGVdXS4gQnkgZGVmYXVsdDogYHVuZGVmaW5lZGAuXG4gKiAgLSAqKnByZWxvYWRlZCoqIF8oQm9vbGVhbik6XyBJbml0IGluc3RhbmNlIHdpdGggZGVmYXVsdCBtaW1lIHJ1bGVzXG4gKiovXG52YXIgTWltb3phID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBNaW1vemEob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBNYXAgb2YgYGV4dGVuc2lvbiAtPiBtaW1lVHlwZWAgcGFpcnMuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAndHlwZXMnLCAgICAgICAgICB7IHZhbHVlOiBPYmplY3QuY3JlYXRlKG51bGwpIH0pO1xuXG4gIC8vIE1hcCBvZiBgbWltZVR5cGUgLT4gZXh0ZW5zaW9uc2AgcGFpcnMuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZXh0ZW5zaW9ucycsICAgICB7IHZhbHVlOiBPYmplY3QuY3JlYXRlKG51bGwpIH0pO1xuXG4gIC8vIFVzZWQgYXMgbGFzdC1yZXNvcnQgZm9yIFtbTWltb3phI2dldE1pbWVUeXBlXV0uXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZGVmYXVsdFR5cGUnLCAgICB7IHZhbHVlOiBvcHRpb25zLmRlZmF1bHRUeXBlIH0pO1xuXG5cbiAgaWYgKG9wdGlvbnMucHJlbG9hZGVkKSB7XG4gICAgT2JqZWN0LmtleXMoZGIpLmZvckVhY2goZnVuY3Rpb24gKG1pbWUpIHtcbiAgICAgIHZhciB2YWwgPSBkYlttaW1lXTtcblxuICAgICAgaWYgKHZhbC5leHRlbnNpb25zKSB7XG4gICAgICAgIHRoaXMucmVnaXN0ZXIobWltZSwgdmFsLmV4dGVuc2lvbnMpO1xuICAgICAgfVxuICAgIH0sIHRoaXMpO1xuICB9XG59O1xuXG5cbi8qKlxuICogIE1pbW96YSNjbG9uZSgpIC0+IE9iamVjdFxuICpcbiAqICBDcmVhdGVzIGNvcHkgb2YgY3VycmVudCBNaW1vemEgaW5zdGFuc2VcbiAqKi9cbk1pbW96YS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiBjbG9uZSgpIHtcbiAgdmFyIG0gPSBuZXcgTWltb3phKHsgZGVmYXVsdFR5cGU6IHRoaXMuZGVmYXVsdFR5cGUgfSk7XG5cbiAgYXNzaWduKG0udHlwZXMsIHRoaXMudHlwZXMpO1xuICBhc3NpZ24obS5leHRlbnNpb25zLCB0aGlzLmV4dGVuc2lvbnMpO1xuXG4gIHJldHVybiBtO1xufTtcblxuXG4vKipcbiAqICBNaW1vemEjcmVnaXN0ZXIobWltZVR5cGUsIGV4dGVuc2lvbnNbLCBvdmVycmlkZURlZmF1bHQgPSBmYWxzZV0pIC0+IFZvaWRcbiAqICAtIG1pbWVUeXBlIChTdHJpbmcpOlxuICogIC0gZXh0ZW5zaW9ucyAoU3RyaW5nfEFycmF5KTpcbiAqICAtIG92ZXJyaWRlRGVmYXVsdCAoQm9vbGVhbik6XG4gKlxuICogIFJlZ2lzdGVyIGdpdmVuIGBleHRlbnNpb25zYCBhcyByZXByZXNlbnRhdGl2ZXMgb2YgYG1pbWVUeXBlYCBhbmQgcmVnaXN0ZXJcbiAqICBmaXJzdCBlbGVtZW50IG9mIGBleHRlbnNpb25zYCBhcyBkZWZhdWx0IGV4dGVuc2lvbiBmb3IgdGhlIGBtaW1lVHlwZWAuXG4gKlxuICpcbiAqICAjIyMjIyBFeGFtcGxlXG4gKlxuICogIGBgYGphdmFzY3JpcHRcbiAqICBtaW1lLnJlZ2lzdGVyKCdhdWRpby9vZ2cnLCBbJ29nYScsICdvZ2cnLCAnc3B4J10pO1xuICpcbiAqICBtaW1lLmdldE1pbWVUeXBlKCcub2dhJyk7ICAgICAgIC8vIC0+ICdhdWRpby9vZ2cnXG4gKiAgbWltZS5nZXRNaW1lVHlwZSgnLm9nZycpOyAgICAgICAvLyAtPiAnYXVkaW8vb2dnJ1xuICogIG1pbWUuZ2V0RXh0ZW5zaW9uKCdhdWRpby9vZ2cnKTsgLy8gLT4gJy5vZ2EnXG4gKiAgYGBgXG4gKlxuICogICMjIyMjIE92ZXJyaWRpbmcgZGVmYXVsdCBleHRlbnNpb25cbiAqXG4gKiAgYG1pbWVUeXBlIC0+IGV4dGVuc2lvbmAgaXMgc2V0IG9ubHkgb25jZSwgaWYgeW91IHdudCB0byBvdmVycmlkZSBpdCxcbiAqICBwYXNzIGBvdmVycmlkZURlZmF1bHRgIGZsYWcgYXMgdHJ1ZS4gU2VlIGV4YW1wbGUgYmVsb3c6XG4gKlxuICogIGBgYGphdmFzY3JpcHRcbiAqICBtaW1lLnJlZ2lzdGVyKCdhdWRpby9vZ2cnLCBbJ29nYSddKTtcbiAqICBtaW1lLmdldEV4dGVuc2lvbignYXVkaW8vb2dnJyk7XG4gKiAgLy8gLT4gJy5vZ2EnXG4gKlxuICogIG1pbWUucmVnaXN0ZXIoJ2F1ZGlvL29nZycsIFsnc3B4J10pO1xuICogIG1pbWUuZ2V0RXh0ZW5zaW9uKCdhdWRpby9vZ2cnKTtcbiAqICAvLyAtPiAnLm9nYSdcbiAqXG4gKiAgbWltZS5yZWdpc3RlcignYXVkaW8vb2dnJywgWydvZ2cnXSwgdHJ1ZSk7XG4gKiAgbWltZS5nZXRFeHRlbnNpb24oJ2F1ZGlvL29nZycpO1xuICogIC8vIC0+ICcub2dnJ1xuICogIGBgYFxuICoqL1xuTWltb3phLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIHJlZ2lzdGVyKG1pbWVUeXBlLCBleHRlbnNpb25zLCBvdmVycmlkZURlZmF1bHQpIHtcbiAgZXh0ZW5zaW9ucyA9IEFycmF5LmlzQXJyYXkoZXh0ZW5zaW9ucykgPyBleHRlbnNpb25zIDogWyBleHRlbnNpb25zIF07XG5cbiAgLy8gcG9sbHV0ZSBgZXh0ZW5zaW9uIC0+IG1pbWVUeXBlYCBtYXBcbiAgZXh0ZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uIChleHQpIHtcbiAgICB0aGlzLnR5cGVzW25vcm1hbGl6ZShleHQpXSA9IG1pbWVUeXBlO1xuICB9LCB0aGlzKTtcblxuICAvLyB1c2UgY2FzZSBpbnNlbnNpdGl2ZSBtaW1lIHR5cGVzIGZvciBleHRlbnRpb24gcmVzb2x2ZVxuICBpZiAob3ZlcnJpZGVEZWZhdWx0IHx8IHR5cGVvZiB0aGlzLmV4dGVuc2lvbnNbbWltZVR5cGUudG9Mb3dlckNhc2UoKV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgdGhpcy5leHRlbnNpb25zW21pbWVUeXBlLnRvTG93ZXJDYXNlKCldID0gbm9ybWFsaXplKGV4dGVuc2lvbnNbMF0pO1xuICB9XG59O1xuXG5cbi8qKlxuICogIE1pbW96YSNnZXRNaW1lVHlwZShwYXRoWywgZmFsbGJhY2tdKSAtPiBTdHJpbmdcbiAqXG4gKiAgTG9va3VwIGEgbWltZSB0eXBlIGJhc2VkIG9uIGV4dGVuc2lvblxuICoqL1xuTWltb3phLnByb3RvdHlwZS5nZXRNaW1lVHlwZSA9IGZ1bmN0aW9uIGdldE1pbWVUeXBlKHBhdGgsIGZhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLnR5cGVzW25vcm1hbGl6ZShwYXRoKV0gfHwgZmFsbGJhY2sgfHwgdGhpcy5kZWZhdWx0VHlwZTtcbn07XG5cblxuLyoqXG4gKiAgTWltb3phI2dldEV4dGVuc2lvbihtaW1lVHlwZSkgLT4gU3RyaW5nXG4gKlxuICogIFJldHVybiBmaWxlIGV4dGVuc2lvbiBhc3NvY2lhdGVkIHdpdGggYSBtaW1lIHR5cGUuXG4gKiovXG5NaW1vemEucHJvdG90eXBlLmdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uIGdldEV4dGVuc2lvbihtaW1lVHlwZSkge1xuICByZXR1cm4gdGhpcy5leHRlbnNpb25zW2NsZWFyTWltZShtaW1lVHlwZSldO1xufTtcblxuXG4vLyBSZXR1cm5zIHdoZW5ldmVyIGFuIGFzc2V0IGlzIHRleHQgb3Igbm90XG52YXIgVEVYVF9NSU1FX1JFID0gbmV3IFJlZ0V4cChbXG4gICdedGV4dC8nLFxuICAnL2pzb24kJyxcbiAgJy9qYXZhc2NyaXB0JCdcbl0uam9pbignfCcpKTtcblxuLyoqXG4gKiAgTWltb3phI2lzVGV4dChtaW1lVHlwZSkgLT4gQm9vbGVhblxuICpcbiAqICBDaGVjayBpZiBtaW1lIHR5cGUgcHJvdmlkZXMgdGV4dCBjb250ZW50LiBDYW4gYmUgdXNlZCB0byBhZGQgZW5jb2RpbmcuXG4gKiovXG5NaW1vemEucHJvdG90eXBlLmlzVGV4dCA9IGZ1bmN0aW9uIGlzVGV4dChtaW1lVHlwZSkge1xuICByZXR1cm4gVEVYVF9NSU1FX1JFLnRlc3QoY2xlYXJNaW1lKG1pbWVUeXBlKSk7XG59O1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vL1xuLy8gUHVibGljIG1ldGhvZHMgdG8gd29yayB3aXRoIG1vZHVsZSB3aXRob3V0IGNyZWF0aW5nIG5ldyBpbnN0YW5jZSwgaWYgZGVmYXVsdFxuLy8gY29uZmlncyBhcmUgb2sgZm9yIHlvdS5cbi8vXG5cblxuLy8gYnVpbHRpbiBpbnN0YW5jZSBvZiBtaW1vemFcbnZhciBidWlsdGluID0gbmV3IE1pbW96YSh7IHByZWxvYWRlZDogdHJ1ZSB9KTtcblxuLyoqXG4gKiAgTWltb3phLmdldE1pbWVUeXBlKHBhdGgsIGZhbGxiYWNrKSAtPiBTdHJpbmdcbiAqXG4gKiAgUHJveHkgdG8gW1tNaW1vemEjZ2V0TWltZVR5cGVdXSBvZiBpbnRlcm5hbCwgYnVpbHQtaW4gaW5zdGFuY2Ugb2YgW1tNaW1vemFdXVxuICogIGZpbGxlZCB3aXRoIHNvbWUgZGVmYXVsdCB0eXBlcy5cbiAqKi9cbk1pbW96YS5nZXRNaW1lVHlwZSA9IGZ1bmN0aW9uIF9nZXRNaW1lVHlwZShwYXRoLCBmYWxsYmFjaykge1xuICByZXR1cm4gYnVpbHRpbi5nZXRNaW1lVHlwZShwYXRoLCBmYWxsYmFjayk7XG59O1xuXG4vKipcbiAqICBNaW1vemEuZ2V0RXh0ZW5zaW9uKG1pbWVUeXBlKSAtPiBTdHJpbmdcbiAqXG4gKiAgUHJveHkgdG8gW1tNaW1vemEjZ2V0RXh0ZW5zaW9uXV0gb2YgaW50ZXJuYWwsIGJ1aWx0LWluIGluc3RhbmNlIG9mIFtbTWltb3phXV1cbiAqICBmaWxsZWQgd2l0aCBzb21lIGRlZmF1bHQgdHlwZXMuXG4gKiovXG5NaW1vemEuZ2V0RXh0ZW5zaW9uID0gZnVuY3Rpb24gX2dldEV4dGVuc2lvbihtaW1lVHlwZSkge1xuICByZXR1cm4gYnVpbHRpbi5nZXRFeHRlbnNpb24obWltZVR5cGUpO1xufTtcblxuLyoqXG4gKiAgTWltb3phLmlzVGV4dChtaW1lVHlwZSkgLT4gQm9vbGVhblxuICpcbiAqICBQcm94eSB0byBbW01pbW96YSNpc1RleHRdXSBvZiBpbnRlcm5hbCwgYnVpbHQtaW4gaW5zdGFuY2VcbiAqICBvZiBbW01pbW96YV1dLlxuICoqL1xuTWltb3phLmlzVGV4dCA9IGZ1bmN0aW9uIF9pc1RleHQobWltZVR5cGUpIHtcbiAgcmV0dXJuIGJ1aWx0aW4uaXNUZXh0KG1pbWVUeXBlKTtcbn07XG4iLCJleHBvcnQgZGVmYXVsdCBcIlwiOyIsImltcG9ydCBtYXJrZG93bkl0QXR0cnMgZnJvbSBcIm1hcmtkb3duLWl0LWF0dHJzXCI7XG5pbXBvcnQgbWFya2Rvd25JdENoZWNrYm94IGZyb20gXCJtYXJrZG93bi1pdC1jaGVja2JveFwiO1xuaW1wb3J0IG1hcmtkb3duSXRDb250YWluZXIgZnJvbSBcIm1hcmtkb3duLWl0LWNvbnRhaW5lclwiO1xuaW1wb3J0IG1hcmtkb3duSXREZWZsaXN0IGZyb20gXCJtYXJrZG93bi1pdC1kZWZsaXN0XCI7XG5pbXBvcnQgbWFya2Rvd25JdEVtb2ppIGZyb20gXCJtYXJrZG93bi1pdC1lbW9qaVwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdEZvb3Rub3RlIGZyb20gXCJtYXJrZG93bi1pdC1mb290bm90ZVwiO1xuaW1wb3J0IG1hcmtkb3duSXRIVE1MNUVtYmVkIGZyb20gXCJtYXJrZG93bi1pdC1odG1sNS1lbWJlZFwiO1xuLy8gaW1wb3J0IG1hcmtkb3duSXRLYmQgZnJvbSBcIm1hcmtkb3duLWl0LWtiZFwiO1xuaW1wb3J0IG1hcmtkb3duSXRNYXJrIGZyb20gXCJtYXJrZG93bi1pdC1tYXJrXCI7XG5pbXBvcnQgbWFya2Rvd25JdE11bHRpbWRUYWJsZSBmcm9tIFwibWFya2Rvd24taXQtbXVsdGltZC10YWJsZVwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdFN1YiBmcm9tIFwibWFya2Rvd24taXQtc3ViXCI7XG4vLyBpbXBvcnQgKiBhcyBtYXJrZG93bkl0U3VwIGZyb20gXCJtYXJrZG93bi1pdC1zdXBcIjtcbi8vIC8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRUb2MgZnJvbSBcIm1hcmtkb3duLWl0LXRvY1wiO1xuaW1wb3J0IG1hcmtkb3duSXRVbmRlcmxpbmUgZnJvbSBcIm1hcmtkb3duLWl0LXVuZGVybGluZVwiO1xuaW1wb3J0IE1hcmtkb3duSXQgZnJvbSBcIm1hcmtkb3duLWl0XCI7XG5cbmNvbnN0IGFkZEF0dHIgPSAobWQ6IE1hcmtkb3duSXQpID0+IHtcbiAgLy8gQWxsb3cgey5jbGFzcyAjaWQgZGF0YS1vdGhlcj1cImZvb1wifSB0YWdzXG4gIG1kLnVzZShtYXJrZG93bkl0QXR0cnMsIHtcbiAgICBsZWZ0RGVsaW1pdGVyOiBcIntcIixcbiAgICByaWdodERlbGltaXRlcjogXCJ9XCIsXG4gICAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtcImNsYXNzXCIsIFwiaWRcIiwgL14oPyFvbikuKiQvZ2ltXSxcbiAgfSk7XG5cbiAgLy8gY2hhbmdlIHRoZSBydWxlIGFwcGxpZWQgdG8gd3JpdGUgYSBjdXN0b20gbmFtZSBhdHRyIG9uIGhlYWRlcnMgaW4gTUVNRVxuICBtZC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfb3BlblwiXSA9ICh0b2tlbnMsIGlkeCwgb3B0aW9ucywgX2Vudiwgc2VsZikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2lkeF07XG4gICAgY29uc3QgbmV4dFRva2VuID0gdG9rZW5zW2lkeCArIDFdO1xuICAgIGNvbnN0IGxpbmsgPSBuZXh0VG9rZW4/LmNvbnRlbnQgfHwgXCJcIjtcblxuICAgIHRva2VuLmF0dHJTZXQoXCJuYW1lXCIsIGAke3Rva2VuLm1hcmt1cH0ke2xpbmt9YCk7XG5cbiAgICByZXR1cm4gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG4gIH07XG5cbiAgcmV0dXJuIG1kO1xufTtcblxuZXhwb3J0IGNvbnN0IGFkZEV4dHJhcyA9IChtZDogTWFya2Rvd25JdCkgPT4ge1xuICAvLyBUT0RPOiByZWZlcmVuY2Ugc2V0dGluZ3NcbiAgYWRkQXR0cihtZCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRDaGVja2JveCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXREZWZsaXN0KTtcblxuICBtZC51c2UobWFya2Rvd25JdEVtb2ppKTtcblxuICBtZC51c2UobWFya2Rvd25JdERlZmxpc3QpO1xuXG4gIG1kLnVzZShtYXJrZG93bkl0RW1vamkpO1xuXG4gIG1kLnVzZShtYXJrZG93bkl0SFRNTDVFbWJlZCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRNYXJrKTtcblxuICBtZC51c2UobWFya2Rvd25JdE11bHRpbWRUYWJsZSk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRVbmRlcmxpbmUpO1xuXG4gIC8qIDo6OiB3b3JkIHN0YXJ0cyBhIGJsb2NrIHdpdGggY2xhc3MgLndvcmQ7IDo6OiBlbmRzIGl0ICovXG4gIG1kLnVzZShtYXJrZG93bkl0Q29udGFpbmVyLCBcImFueVwiLCB7XG4gICAgdmFsaWRhdGU6ICgpID0+IHRydWUsXG5cbiAgICByZW5kZXI6ICh0b2tlbnMsIGlkeCwgb3B0aW9ucywgX2Vudiwgc2VsZikgPT4ge1xuICAgICAgY29uc3QgbSA9IHRva2Vuc1tpZHhdLmluZm8udHJpbSgpLm1hdGNoKC9eKC4qKSQvKTtcblxuICAgICAgaWYgKHRva2Vuc1tpZHhdLm5lc3RpbmcgPT09IDEpIHtcbiAgICAgICAgdG9rZW5zW2lkeF0uYXR0clB1c2goW1wiY2xhc3NcIiwgbVsxXV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIG1kO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYWRkRXh0cmFzO1xuIiwiaW1wb3J0IFwiLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlcy9ibGFuay5odG1sXCI7XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVByZWxvYWRlciB7XG4gICAgLyoqXG4gICAgICogUHJlbG9hZCBhIHNldCBvZiB0ZW1wbGF0ZXMgdG8gY29tcGlsZSBhbmQgY2FjaGUgdGhlbSBmb3IgZmFzdCBhY2Nlc3MgZHVyaW5nIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHN0YXRpYyBhc3luYyBwcmVsb2FkSGFuZGxlYmFyc1RlbXBsYXRlcygpIHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVQYXRocyA9IFtcIm1vZHVsZXMvdGVtcGxhdGUvdGVtcGxhdGVzL2JsYW5rLmh0bWxcIl07XG4gICAgICAgIHJldHVybiBsb2FkVGVtcGxhdGVzKHRlbXBsYXRlUGF0aHMpO1xuICAgIH1cbn1cbiIsIihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcbiAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKCd1bmRlcnNjb3JlJywgZmFjdG9yeSkgOlxuICAoZ2xvYmFsID0gdHlwZW9mIGdsb2JhbFRoaXMgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsVGhpcyA6IGdsb2JhbCB8fCBzZWxmLCAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjdXJyZW50ID0gZ2xvYmFsLl87XG4gICAgdmFyIGV4cG9ydHMgPSBnbG9iYWwuXyA9IGZhY3RvcnkoKTtcbiAgICBleHBvcnRzLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7IGdsb2JhbC5fID0gY3VycmVudDsgcmV0dXJuIGV4cG9ydHM7IH07XG4gIH0oKSkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuICAvLyAgICAgVW5kZXJzY29yZS5qcyAxLjEzLjFcbiAgLy8gICAgIGh0dHBzOi8vdW5kZXJzY29yZWpzLm9yZ1xuICAvLyAgICAgKGMpIDIwMDktMjAyMSBKZXJlbXkgQXNoa2VuYXMsIEp1bGlhbiBHb25nZ3JpanAsIGFuZCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAgLy8gICAgIFVuZGVyc2NvcmUgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICB2YXIgVkVSU0lPTiA9ICcxLjEzLjEnO1xuXG4gIC8vIEVzdGFibGlzaCB0aGUgcm9vdCBvYmplY3QsIGB3aW5kb3dgIChgc2VsZmApIGluIHRoZSBicm93c2VyLCBgZ2xvYmFsYFxuICAvLyBvbiB0aGUgc2VydmVyLCBvciBgdGhpc2AgaW4gc29tZSB2aXJ0dWFsIG1hY2hpbmVzLiBXZSB1c2UgYHNlbGZgXG4gIC8vIGluc3RlYWQgb2YgYHdpbmRvd2AgZm9yIGBXZWJXb3JrZXJgIHN1cHBvcnQuXG4gIHZhciByb290ID0gdHlwZW9mIHNlbGYgPT0gJ29iamVjdCcgJiYgc2VsZi5zZWxmID09PSBzZWxmICYmIHNlbGYgfHxcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsLmdsb2JhbCA9PT0gZ2xvYmFsICYmIGdsb2JhbCB8fFxuICAgICAgICAgICAgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKSB8fFxuICAgICAgICAgICAge307XG5cbiAgLy8gU2F2ZSBieXRlcyBpbiB0aGUgbWluaWZpZWQgKGJ1dCBub3QgZ3ppcHBlZCkgdmVyc2lvbjpcbiAgdmFyIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsIE9ialByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcbiAgdmFyIFN5bWJvbFByb3RvID0gdHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgPyBTeW1ib2wucHJvdG90eXBlIDogbnVsbDtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyIHB1c2ggPSBBcnJheVByb3RvLnB1c2gsXG4gICAgICBzbGljZSA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgICB0b1N0cmluZyA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBNb2Rlcm4gZmVhdHVyZSBkZXRlY3Rpb24uXG4gIHZhciBzdXBwb3J0c0FycmF5QnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyxcbiAgICAgIHN1cHBvcnRzRGF0YVZpZXcgPSB0eXBlb2YgRGF0YVZpZXcgIT09ICd1bmRlZmluZWQnO1xuXG4gIC8vIEFsbCAqKkVDTUFTY3JpcHQgNSsqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhciBuYXRpdmVJc0FycmF5ID0gQXJyYXkuaXNBcnJheSxcbiAgICAgIG5hdGl2ZUtleXMgPSBPYmplY3Qua2V5cyxcbiAgICAgIG5hdGl2ZUNyZWF0ZSA9IE9iamVjdC5jcmVhdGUsXG4gICAgICBuYXRpdmVJc1ZpZXcgPSBzdXBwb3J0c0FycmF5QnVmZmVyICYmIEFycmF5QnVmZmVyLmlzVmlldztcblxuICAvLyBDcmVhdGUgcmVmZXJlbmNlcyB0byB0aGVzZSBidWlsdGluIGZ1bmN0aW9ucyBiZWNhdXNlIHdlIG92ZXJyaWRlIHRoZW0uXG4gIHZhciBfaXNOYU4gPSBpc05hTixcbiAgICAgIF9pc0Zpbml0ZSA9IGlzRmluaXRlO1xuXG4gIC8vIEtleXMgaW4gSUUgPCA5IHRoYXQgd29uJ3QgYmUgaXRlcmF0ZWQgYnkgYGZvciBrZXkgaW4gLi4uYCBhbmQgdGh1cyBtaXNzZWQuXG4gIHZhciBoYXNFbnVtQnVnID0gIXt0b1N0cmluZzogbnVsbH0ucHJvcGVydHlJc0VudW1lcmFibGUoJ3RvU3RyaW5nJyk7XG4gIHZhciBub25FbnVtZXJhYmxlUHJvcHMgPSBbJ3ZhbHVlT2YnLCAnaXNQcm90b3R5cGVPZicsICd0b1N0cmluZycsXG4gICAgJ3Byb3BlcnR5SXNFbnVtZXJhYmxlJywgJ2hhc093blByb3BlcnR5JywgJ3RvTG9jYWxlU3RyaW5nJ107XG5cbiAgLy8gVGhlIGxhcmdlc3QgaW50ZWdlciB0aGF0IGNhbiBiZSByZXByZXNlbnRlZCBleGFjdGx5LlxuICB2YXIgTUFYX0FSUkFZX0lOREVYID0gTWF0aC5wb3coMiwgNTMpIC0gMTtcblxuICAvLyBTb21lIGZ1bmN0aW9ucyB0YWtlIGEgdmFyaWFibGUgbnVtYmVyIG9mIGFyZ3VtZW50cywgb3IgYSBmZXcgZXhwZWN0ZWRcbiAgLy8gYXJndW1lbnRzIGF0IHRoZSBiZWdpbm5pbmcgYW5kIHRoZW4gYSB2YXJpYWJsZSBudW1iZXIgb2YgdmFsdWVzIHRvIG9wZXJhdGVcbiAgLy8gb24uIFRoaXMgaGVscGVyIGFjY3VtdWxhdGVzIGFsbCByZW1haW5pbmcgYXJndW1lbnRzIHBhc3QgdGhlIGZ1bmN0aW9u4oCZc1xuICAvLyBhcmd1bWVudCBsZW5ndGggKG9yIGFuIGV4cGxpY2l0IGBzdGFydEluZGV4YCksIGludG8gYW4gYXJyYXkgdGhhdCBiZWNvbWVzXG4gIC8vIHRoZSBsYXN0IGFyZ3VtZW50LiBTaW1pbGFyIHRvIEVTNuKAmXMgXCJyZXN0IHBhcmFtZXRlclwiLlxuICBmdW5jdGlvbiByZXN0QXJndW1lbnRzKGZ1bmMsIHN0YXJ0SW5kZXgpIHtcbiAgICBzdGFydEluZGV4ID0gc3RhcnRJbmRleCA9PSBudWxsID8gZnVuYy5sZW5ndGggLSAxIDogK3N0YXJ0SW5kZXg7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KGFyZ3VtZW50cy5sZW5ndGggLSBzdGFydEluZGV4LCAwKSxcbiAgICAgICAgICByZXN0ID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgICAgICBpbmRleCA9IDA7XG4gICAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgcmVzdFtpbmRleF0gPSBhcmd1bWVudHNbaW5kZXggKyBzdGFydEluZGV4XTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoc3RhcnRJbmRleCkge1xuICAgICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmd1bWVudHNbMF0sIHJlc3QpO1xuICAgICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIHJlc3QpO1xuICAgICAgfVxuICAgICAgdmFyIGFyZ3MgPSBBcnJheShzdGFydEluZGV4ICsgMSk7XG4gICAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBzdGFydEluZGV4OyBpbmRleCsrKSB7XG4gICAgICAgIGFyZ3NbaW5kZXhdID0gYXJndW1lbnRzW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIGFyZ3Nbc3RhcnRJbmRleF0gPSByZXN0O1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgYW4gb2JqZWN0P1xuICBmdW5jdGlvbiBpc09iamVjdChvYmopIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG4gIH1cblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIGZ1bmN0aW9uIGlzTnVsbChvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSB1bmRlZmluZWQ/XG4gIGZ1bmN0aW9uIGlzVW5kZWZpbmVkKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBmdW5jdGlvbiBpc0Jvb2xlYW4ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBmdW5jdGlvbiBpc0VsZW1lbnQob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgYHRvU3RyaW5nYC1iYXNlZCB0eXBlIHRlc3Rlci5cbiAgZnVuY3Rpb24gdGFnVGVzdGVyKG5hbWUpIHtcbiAgICB2YXIgdGFnID0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gdGFnO1xuICAgIH07XG4gIH1cblxuICB2YXIgaXNTdHJpbmcgPSB0YWdUZXN0ZXIoJ1N0cmluZycpO1xuXG4gIHZhciBpc051bWJlciA9IHRhZ1Rlc3RlcignTnVtYmVyJyk7XG5cbiAgdmFyIGlzRGF0ZSA9IHRhZ1Rlc3RlcignRGF0ZScpO1xuXG4gIHZhciBpc1JlZ0V4cCA9IHRhZ1Rlc3RlcignUmVnRXhwJyk7XG5cbiAgdmFyIGlzRXJyb3IgPSB0YWdUZXN0ZXIoJ0Vycm9yJyk7XG5cbiAgdmFyIGlzU3ltYm9sID0gdGFnVGVzdGVyKCdTeW1ib2wnKTtcblxuICB2YXIgaXNBcnJheUJ1ZmZlciA9IHRhZ1Rlc3RlcignQXJyYXlCdWZmZXInKTtcblxuICB2YXIgaXNGdW5jdGlvbiA9IHRhZ1Rlc3RlcignRnVuY3Rpb24nKTtcblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuIFdvcmsgYXJvdW5kIHNvbWUgYHR5cGVvZmAgYnVncyBpbiBvbGRcbiAgLy8gdjgsIElFIDExICgjMTYyMSksIFNhZmFyaSA4ICgjMTkyOSksIGFuZCBQaGFudG9tSlMgKCMyMjM2KS5cbiAgdmFyIG5vZGVsaXN0ID0gcm9vdC5kb2N1bWVudCAmJiByb290LmRvY3VtZW50LmNoaWxkTm9kZXM7XG4gIGlmICh0eXBlb2YgLy4vICE9ICdmdW5jdGlvbicgJiYgdHlwZW9mIEludDhBcnJheSAhPSAnb2JqZWN0JyAmJiB0eXBlb2Ygbm9kZWxpc3QgIT0gJ2Z1bmN0aW9uJykge1xuICAgIGlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09ICdmdW5jdGlvbicgfHwgZmFsc2U7XG4gICAgfTtcbiAgfVxuXG4gIHZhciBpc0Z1bmN0aW9uJDEgPSBpc0Z1bmN0aW9uO1xuXG4gIHZhciBoYXNPYmplY3RUYWcgPSB0YWdUZXN0ZXIoJ09iamVjdCcpO1xuXG4gIC8vIEluIElFIDEwIC0gRWRnZSAxMywgYERhdGFWaWV3YCBoYXMgc3RyaW5nIHRhZyBgJ1tvYmplY3QgT2JqZWN0XSdgLlxuICAvLyBJbiBJRSAxMSwgdGhlIG1vc3QgY29tbW9uIGFtb25nIHRoZW0sIHRoaXMgcHJvYmxlbSBhbHNvIGFwcGxpZXMgdG9cbiAgLy8gYE1hcGAsIGBXZWFrTWFwYCBhbmQgYFNldGAuXG4gIHZhciBoYXNTdHJpbmdUYWdCdWcgPSAoXG4gICAgICAgIHN1cHBvcnRzRGF0YVZpZXcgJiYgaGFzT2JqZWN0VGFnKG5ldyBEYXRhVmlldyhuZXcgQXJyYXlCdWZmZXIoOCkpKVxuICAgICAgKSxcbiAgICAgIGlzSUUxMSA9ICh0eXBlb2YgTWFwICE9PSAndW5kZWZpbmVkJyAmJiBoYXNPYmplY3RUYWcobmV3IE1hcCkpO1xuXG4gIHZhciBpc0RhdGFWaWV3ID0gdGFnVGVzdGVyKCdEYXRhVmlldycpO1xuXG4gIC8vIEluIElFIDEwIC0gRWRnZSAxMywgd2UgbmVlZCBhIGRpZmZlcmVudCBoZXVyaXN0aWNcbiAgLy8gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYW4gb2JqZWN0IGlzIGEgYERhdGFWaWV3YC5cbiAgZnVuY3Rpb24gaWUxMElzRGF0YVZpZXcob2JqKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIGlzRnVuY3Rpb24kMShvYmouZ2V0SW50OCkgJiYgaXNBcnJheUJ1ZmZlcihvYmouYnVmZmVyKTtcbiAgfVxuXG4gIHZhciBpc0RhdGFWaWV3JDEgPSAoaGFzU3RyaW5nVGFnQnVnID8gaWUxMElzRGF0YVZpZXcgOiBpc0RhdGFWaWV3KTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgYEFycmF5LmlzQXJyYXlgLlxuICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgdGFnVGVzdGVyKCdBcnJheScpO1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgYGtleWAgaXMgYW4gb3duIHByb3BlcnR5IG5hbWUgb2YgYG9iamAuXG4gIGZ1bmN0aW9uIGhhcyQxKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICB9XG5cbiAgdmFyIGlzQXJndW1lbnRzID0gdGFnVGVzdGVyKCdBcmd1bWVudHMnKTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFIDwgOSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIChmdW5jdGlvbigpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICAgIGlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBoYXMkMShvYmosICdjYWxsZWUnKTtcbiAgICAgIH07XG4gICAgfVxuICB9KCkpO1xuXG4gIHZhciBpc0FyZ3VtZW50cyQxID0gaXNBcmd1bWVudHM7XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBmdW5jdGlvbiBpc0Zpbml0ZSQxKG9iaikge1xuICAgIHJldHVybiAhaXNTeW1ib2wob2JqKSAmJiBfaXNGaW5pdGUob2JqKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChvYmopKTtcbiAgfVxuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD9cbiAgZnVuY3Rpb24gaXNOYU4kMShvYmopIHtcbiAgICByZXR1cm4gaXNOdW1iZXIob2JqKSAmJiBfaXNOYU4ob2JqKTtcbiAgfVxuXG4gIC8vIFByZWRpY2F0ZS1nZW5lcmF0aW5nIGZ1bmN0aW9uLiBPZnRlbiB1c2VmdWwgb3V0c2lkZSBvZiBVbmRlcnNjb3JlLlxuICBmdW5jdGlvbiBjb25zdGFudCh2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQ29tbW9uIGludGVybmFsIGxvZ2ljIGZvciBgaXNBcnJheUxpa2VgIGFuZCBgaXNCdWZmZXJMaWtlYC5cbiAgZnVuY3Rpb24gY3JlYXRlU2l6ZVByb3BlcnR5Q2hlY2soZ2V0U2l6ZVByb3BlcnR5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICAgIHZhciBzaXplUHJvcGVydHkgPSBnZXRTaXplUHJvcGVydHkoY29sbGVjdGlvbik7XG4gICAgICByZXR1cm4gdHlwZW9mIHNpemVQcm9wZXJ0eSA9PSAnbnVtYmVyJyAmJiBzaXplUHJvcGVydHkgPj0gMCAmJiBzaXplUHJvcGVydHkgPD0gTUFYX0FSUkFZX0lOREVYO1xuICAgIH1cbiAgfVxuXG4gIC8vIEludGVybmFsIGhlbHBlciB0byBnZW5lcmF0ZSBhIGZ1bmN0aW9uIHRvIG9idGFpbiBwcm9wZXJ0eSBga2V5YCBmcm9tIGBvYmpgLlxuICBmdW5jdGlvbiBzaGFsbG93UHJvcGVydHkoa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9iaiA9PSBudWxsID8gdm9pZCAwIDogb2JqW2tleV07XG4gICAgfTtcbiAgfVxuXG4gIC8vIEludGVybmFsIGhlbHBlciB0byBvYnRhaW4gdGhlIGBieXRlTGVuZ3RoYCBwcm9wZXJ0eSBvZiBhbiBvYmplY3QuXG4gIHZhciBnZXRCeXRlTGVuZ3RoID0gc2hhbGxvd1Byb3BlcnR5KCdieXRlTGVuZ3RoJyk7XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGRldGVybWluZSB3aGV0aGVyIHdlIHNob3VsZCBzcGVuZCBleHRlbnNpdmUgY2hlY2tzIGFnYWluc3RcbiAgLy8gYEFycmF5QnVmZmVyYCBldCBhbC5cbiAgdmFyIGlzQnVmZmVyTGlrZSA9IGNyZWF0ZVNpemVQcm9wZXJ0eUNoZWNrKGdldEJ5dGVMZW5ndGgpO1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSB0eXBlZCBhcnJheT9cbiAgdmFyIHR5cGVkQXJyYXlQYXR0ZXJuID0gL1xcW29iamVjdCAoKEl8VWkpbnQoOHwxNnwzMil8RmxvYXQoMzJ8NjQpfFVpbnQ4Q2xhbXBlZHxCaWcoSXxVaSludDY0KUFycmF5XFxdLztcbiAgZnVuY3Rpb24gaXNUeXBlZEFycmF5KG9iaikge1xuICAgIC8vIGBBcnJheUJ1ZmZlci5pc1ZpZXdgIGlzIHRoZSBtb3N0IGZ1dHVyZS1wcm9vZiwgc28gdXNlIGl0IHdoZW4gYXZhaWxhYmxlLlxuICAgIC8vIE90aGVyd2lzZSwgZmFsbCBiYWNrIG9uIHRoZSBhYm92ZSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAgcmV0dXJuIG5hdGl2ZUlzVmlldyA/IChuYXRpdmVJc1ZpZXcob2JqKSAmJiAhaXNEYXRhVmlldyQxKG9iaikpIDpcbiAgICAgICAgICAgICAgICAgIGlzQnVmZmVyTGlrZShvYmopICYmIHR5cGVkQXJyYXlQYXR0ZXJuLnRlc3QodG9TdHJpbmcuY2FsbChvYmopKTtcbiAgfVxuXG4gIHZhciBpc1R5cGVkQXJyYXkkMSA9IHN1cHBvcnRzQXJyYXlCdWZmZXIgPyBpc1R5cGVkQXJyYXkgOiBjb25zdGFudChmYWxzZSk7XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIG9idGFpbiB0aGUgYGxlbmd0aGAgcHJvcGVydHkgb2YgYW4gb2JqZWN0LlxuICB2YXIgZ2V0TGVuZ3RoID0gc2hhbGxvd1Byb3BlcnR5KCdsZW5ndGgnKTtcblxuICAvLyBJbnRlcm5hbCBoZWxwZXIgdG8gY3JlYXRlIGEgc2ltcGxlIGxvb2t1cCBzdHJ1Y3R1cmUuXG4gIC8vIGBjb2xsZWN0Tm9uRW51bVByb3BzYCB1c2VkIHRvIGRlcGVuZCBvbiBgXy5jb250YWluc2AsIGJ1dCB0aGlzIGxlZCB0b1xuICAvLyBjaXJjdWxhciBpbXBvcnRzLiBgZW11bGF0ZWRTZXRgIGlzIGEgb25lLW9mZiBzb2x1dGlvbiB0aGF0IG9ubHkgd29ya3MgZm9yXG4gIC8vIGFycmF5cyBvZiBzdHJpbmdzLlxuICBmdW5jdGlvbiBlbXVsYXRlZFNldChrZXlzKSB7XG4gICAgdmFyIGhhc2ggPSB7fTtcbiAgICBmb3IgKHZhciBsID0ga2V5cy5sZW5ndGgsIGkgPSAwOyBpIDwgbDsgKytpKSBoYXNoW2tleXNbaV1dID0gdHJ1ZTtcbiAgICByZXR1cm4ge1xuICAgICAgY29udGFpbnM6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gaGFzaFtrZXldOyB9LFxuICAgICAgcHVzaDogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGhhc2hba2V5XSA9IHRydWU7XG4gICAgICAgIHJldHVybiBrZXlzLnB1c2goa2V5KTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyLiBDaGVja3MgYGtleXNgIGZvciB0aGUgcHJlc2VuY2Ugb2Yga2V5cyBpbiBJRSA8IDkgdGhhdCB3b24ndFxuICAvLyBiZSBpdGVyYXRlZCBieSBgZm9yIGtleSBpbiAuLi5gIGFuZCB0aHVzIG1pc3NlZC4gRXh0ZW5kcyBga2V5c2AgaW4gcGxhY2UgaWZcbiAgLy8gbmVlZGVkLlxuICBmdW5jdGlvbiBjb2xsZWN0Tm9uRW51bVByb3BzKG9iaiwga2V5cykge1xuICAgIGtleXMgPSBlbXVsYXRlZFNldChrZXlzKTtcbiAgICB2YXIgbm9uRW51bUlkeCA9IG5vbkVudW1lcmFibGVQcm9wcy5sZW5ndGg7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gb2JqLmNvbnN0cnVjdG9yO1xuICAgIHZhciBwcm90byA9IGlzRnVuY3Rpb24kMShjb25zdHJ1Y3RvcikgJiYgY29uc3RydWN0b3IucHJvdG90eXBlIHx8IE9ialByb3RvO1xuXG4gICAgLy8gQ29uc3RydWN0b3IgaXMgYSBzcGVjaWFsIGNhc2UuXG4gICAgdmFyIHByb3AgPSAnY29uc3RydWN0b3InO1xuICAgIGlmIChoYXMkMShvYmosIHByb3ApICYmICFrZXlzLmNvbnRhaW5zKHByb3ApKSBrZXlzLnB1c2gocHJvcCk7XG5cbiAgICB3aGlsZSAobm9uRW51bUlkeC0tKSB7XG4gICAgICBwcm9wID0gbm9uRW51bWVyYWJsZVByb3BzW25vbkVudW1JZHhdO1xuICAgICAgaWYgKHByb3AgaW4gb2JqICYmIG9ialtwcm9wXSAhPT0gcHJvdG9bcHJvcF0gJiYgIWtleXMuY29udGFpbnMocHJvcCkpIHtcbiAgICAgICAga2V5cy5wdXNoKHByb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYC5cbiAgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoIWlzT2JqZWN0KG9iaikpIHJldHVybiBbXTtcbiAgICBpZiAobmF0aXZlS2V5cykgcmV0dXJuIG5hdGl2ZUtleXMob2JqKTtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChoYXMkMShvYmosIGtleSkpIGtleXMucHVzaChrZXkpO1xuICAgIC8vIEFoZW0sIElFIDwgOS5cbiAgICBpZiAoaGFzRW51bUJ1ZykgY29sbGVjdE5vbkVudW1Qcm9wcyhvYmosIGtleXMpO1xuICAgIHJldHVybiBrZXlzO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIGZ1bmN0aW9uIGlzRW1wdHkob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICAvLyBTa2lwIHRoZSBtb3JlIGV4cGVuc2l2ZSBgdG9TdHJpbmdgLWJhc2VkIHR5cGUgY2hlY2tzIGlmIGBvYmpgIGhhcyBub1xuICAgIC8vIGAubGVuZ3RoYC5cbiAgICB2YXIgbGVuZ3RoID0gZ2V0TGVuZ3RoKG9iaik7XG4gICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgJiYgKFxuICAgICAgaXNBcnJheShvYmopIHx8IGlzU3RyaW5nKG9iaikgfHwgaXNBcmd1bWVudHMkMShvYmopXG4gICAgKSkgcmV0dXJuIGxlbmd0aCA9PT0gMDtcbiAgICByZXR1cm4gZ2V0TGVuZ3RoKGtleXMob2JqKSkgPT09IDA7XG4gIH1cblxuICAvLyBSZXR1cm5zIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgZnVuY3Rpb24gaXNNYXRjaChvYmplY3QsIGF0dHJzKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhhdHRycyksIGxlbmd0aCA9IF9rZXlzLmxlbmd0aDtcbiAgICBpZiAob2JqZWN0ID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgIHZhciBvYmogPSBPYmplY3Qob2JqZWN0KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXNbaV07XG4gICAgICBpZiAoYXR0cnNba2V5XSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0IGNhblxuICAvLyBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgZnVuY3Rpb25zIGFkZGVkXG4gIC8vIHRocm91Z2ggYF8ubWl4aW5gLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG4gIGZ1bmN0aW9uIF8kMShvYmopIHtcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgXyQxKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfJDEpKSByZXR1cm4gbmV3IF8kMShvYmopO1xuICAgIHRoaXMuX3dyYXBwZWQgPSBvYmo7XG4gIH1cblxuICBfJDEuVkVSU0lPTiA9IFZFUlNJT047XG5cbiAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gIF8kMS5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgfTtcblxuICAvLyBQcm92aWRlIHVud3JhcHBpbmcgcHJveGllcyBmb3Igc29tZSBtZXRob2RzIHVzZWQgaW4gZW5naW5lIG9wZXJhdGlvbnNcbiAgLy8gc3VjaCBhcyBhcml0aG1ldGljIGFuZCBKU09OIHN0cmluZ2lmaWNhdGlvbi5cbiAgXyQxLnByb3RvdHlwZS52YWx1ZU9mID0gXyQxLnByb3RvdHlwZS50b0pTT04gPSBfJDEucHJvdG90eXBlLnZhbHVlO1xuXG4gIF8kMS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gU3RyaW5nKHRoaXMuX3dyYXBwZWQpO1xuICB9O1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIHdyYXAgb3Igc2hhbGxvdy1jb3B5IGFuIEFycmF5QnVmZmVyLFxuICAvLyB0eXBlZCBhcnJheSBvciBEYXRhVmlldyB0byBhIG5ldyB2aWV3LCByZXVzaW5nIHRoZSBidWZmZXIuXG4gIGZ1bmN0aW9uIHRvQnVmZmVyVmlldyhidWZmZXJTb3VyY2UpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICBidWZmZXJTb3VyY2UuYnVmZmVyIHx8IGJ1ZmZlclNvdXJjZSxcbiAgICAgIGJ1ZmZlclNvdXJjZS5ieXRlT2Zmc2V0IHx8IDAsXG4gICAgICBnZXRCeXRlTGVuZ3RoKGJ1ZmZlclNvdXJjZSlcbiAgICApO1xuICB9XG5cbiAgLy8gV2UgdXNlIHRoaXMgc3RyaW5nIHR3aWNlLCBzbyBnaXZlIGl0IGEgbmFtZSBmb3IgbWluaWZpY2F0aW9uLlxuICB2YXIgdGFnRGF0YVZpZXcgPSAnW29iamVjdCBEYXRhVmlld10nO1xuXG4gIC8vIEludGVybmFsIHJlY3Vyc2l2ZSBjb21wYXJpc29uIGZ1bmN0aW9uIGZvciBgXy5pc0VxdWFsYC5cbiAgZnVuY3Rpb24gZXEoYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHBzOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmVnYWwpLlxuICAgIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PT0gMSAvIGI7XG4gICAgLy8gYG51bGxgIG9yIGB1bmRlZmluZWRgIG9ubHkgZXF1YWwgdG8gaXRzZWxmIChzdHJpY3QgY29tcGFyaXNvbikuXG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLlxuICAgIGlmIChhICE9PSBhKSByZXR1cm4gYiAhPT0gYjtcbiAgICAvLyBFeGhhdXN0IHByaW1pdGl2ZSBjaGVja3NcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBhO1xuICAgIGlmICh0eXBlICE9PSAnZnVuY3Rpb24nICYmIHR5cGUgIT09ICdvYmplY3QnICYmIHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIGRlZXBFcShhLCBiLCBhU3RhY2ssIGJTdGFjayk7XG4gIH1cblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYF8uaXNFcXVhbGAuXG4gIGZ1bmN0aW9uIGRlZXBFcShhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAgIGlmIChhIGluc3RhbmNlb2YgXyQxKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8kMSkgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9PSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gV29yayBhcm91bmQgYSBidWcgaW4gSUUgMTAgLSBFZGdlIDEzLlxuICAgIGlmIChoYXNTdHJpbmdUYWdCdWcgJiYgY2xhc3NOYW1lID09ICdbb2JqZWN0IE9iamVjdF0nICYmIGlzRGF0YVZpZXckMShhKSkge1xuICAgICAgaWYgKCFpc0RhdGFWaWV3JDEoYikpIHJldHVybiBmYWxzZTtcbiAgICAgIGNsYXNzTmFtZSA9IHRhZ0RhdGFWaWV3O1xuICAgIH1cbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gVGhlc2UgdHlwZXMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgICAgY2FzZSAnW29iamVjdCBSZWdFeHBdJzpcbiAgICAgICAgLy8gUmVnRXhwcyBhcmUgY29lcmNlZCB0byBzdHJpbmdzIGZvciBjb21wYXJpc29uIChOb3RlOiAnJyArIC9hL2kgPT09ICcvYS9pJylcbiAgICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gYG5ldyBTdHJpbmcoXCI1XCIpYC5cbiAgICAgICAgcmV0dXJuICcnICsgYSA9PT0gJycgKyBiO1xuICAgICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgICAgLy8gYE5hTmBzIGFyZSBlcXVpdmFsZW50LCBidXQgbm9uLXJlZmxleGl2ZS5cbiAgICAgICAgLy8gT2JqZWN0KE5hTikgaXMgZXF1aXZhbGVudCB0byBOYU4uXG4gICAgICAgIGlmICgrYSAhPT0gK2EpIHJldHVybiArYiAhPT0gK2I7XG4gICAgICAgIC8vIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3Igb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiArYSA9PT0gMCA/IDEgLyArYSA9PT0gMSAvIGIgOiArYSA9PT0gK2I7XG4gICAgICBjYXNlICdbb2JqZWN0IERhdGVdJzpcbiAgICAgIGNhc2UgJ1tvYmplY3QgQm9vbGVhbl0nOlxuICAgICAgICAvLyBDb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWVyaWMgcHJpbWl0aXZlIHZhbHVlcy4gRGF0ZXMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyXG4gICAgICAgIC8vIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9ucy4gTm90ZSB0aGF0IGludmFsaWQgZGF0ZXMgd2l0aCBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnNcbiAgICAgICAgLy8gb2YgYE5hTmAgYXJlIG5vdCBlcXVpdmFsZW50LlxuICAgICAgICByZXR1cm4gK2EgPT09ICtiO1xuICAgICAgY2FzZSAnW29iamVjdCBTeW1ib2xdJzpcbiAgICAgICAgcmV0dXJuIFN5bWJvbFByb3RvLnZhbHVlT2YuY2FsbChhKSA9PT0gU3ltYm9sUHJvdG8udmFsdWVPZi5jYWxsKGIpO1xuICAgICAgY2FzZSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nOlxuICAgICAgY2FzZSB0YWdEYXRhVmlldzpcbiAgICAgICAgLy8gQ29lcmNlIHRvIHR5cGVkIGFycmF5IHNvIHdlIGNhbiBmYWxsIHRocm91Z2guXG4gICAgICAgIHJldHVybiBkZWVwRXEodG9CdWZmZXJWaWV3KGEpLCB0b0J1ZmZlclZpZXcoYiksIGFTdGFjaywgYlN0YWNrKTtcbiAgICB9XG5cbiAgICB2YXIgYXJlQXJyYXlzID0gY2xhc3NOYW1lID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIGlmICghYXJlQXJyYXlzICYmIGlzVHlwZWRBcnJheSQxKGEpKSB7XG4gICAgICAgIHZhciBieXRlTGVuZ3RoID0gZ2V0Qnl0ZUxlbmd0aChhKTtcbiAgICAgICAgaWYgKGJ5dGVMZW5ndGggIT09IGdldEJ5dGVMZW5ndGgoYikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGEuYnVmZmVyID09PSBiLmJ1ZmZlciAmJiBhLmJ5dGVPZmZzZXQgPT09IGIuYnl0ZU9mZnNldCkgcmV0dXJuIHRydWU7XG4gICAgICAgIGFyZUFycmF5cyA9IHRydWU7XG4gICAgfVxuICAgIGlmICghYXJlQXJyYXlzKSB7XG4gICAgICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcblxuICAgICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzIG9yIGBBcnJheWBzXG4gICAgICAvLyBmcm9tIGRpZmZlcmVudCBmcmFtZXMgYXJlLlxuICAgICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgICAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKGlzRnVuY3Rpb24kMShhQ3RvcikgJiYgYUN0b3IgaW5zdGFuY2VvZiBhQ3RvciAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRnVuY3Rpb24kMShiQ3RvcikgJiYgYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKCdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuXG4gICAgLy8gSW5pdGlhbGl6aW5nIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIC8vIEl0J3MgZG9uZSBoZXJlIHNpbmNlIHdlIG9ubHkgbmVlZCB0aGVtIGZvciBvYmplY3RzIGFuZCBhcnJheXMgY29tcGFyaXNvbi5cbiAgICBhU3RhY2sgPSBhU3RhY2sgfHwgW107XG4gICAgYlN0YWNrID0gYlN0YWNrIHx8IFtdO1xuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PT0gYjtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoYXJlQXJyYXlzKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIGxlbmd0aCA9IGEubGVuZ3RoO1xuICAgICAgaWYgKGxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICAgIC8vIERlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXMuXG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgaWYgKCFlcShhW2xlbmd0aF0sIGJbbGVuZ3RoXSwgYVN0YWNrLCBiU3RhY2spKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgdmFyIF9rZXlzID0ga2V5cyhhKSwga2V5O1xuICAgICAgbGVuZ3RoID0gX2tleXMubGVuZ3RoO1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMgYmVmb3JlIGNvbXBhcmluZyBkZWVwIGVxdWFsaXR5LlxuICAgICAgaWYgKGtleXMoYikubGVuZ3RoICE9PSBsZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXJcbiAgICAgICAga2V5ID0gX2tleXNbbGVuZ3RoXTtcbiAgICAgICAgaWYgKCEoaGFzJDEoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucG9wKCk7XG4gICAgYlN0YWNrLnBvcCgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUGVyZm9ybSBhIGRlZXAgY29tcGFyaXNvbiB0byBjaGVjayBpZiB0d28gb2JqZWN0cyBhcmUgZXF1YWwuXG4gIGZ1bmN0aW9uIGlzRXF1YWwoYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiKTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlIGFsbCB0aGUgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QuXG4gIGZ1bmN0aW9uIGFsbEtleXMob2JqKSB7XG4gICAgaWYgKCFpc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgICAvLyBBaGVtLCBJRSA8IDkuXG4gICAgaWYgKGhhc0VudW1CdWcpIGNvbGxlY3ROb25FbnVtUHJvcHMob2JqLCBrZXlzKTtcbiAgICByZXR1cm4ga2V5cztcbiAgfVxuXG4gIC8vIFNpbmNlIHRoZSByZWd1bGFyIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYCB0eXBlIHRlc3RzIGRvbid0IHdvcmsgZm9yXG4gIC8vIHNvbWUgdHlwZXMgaW4gSUUgMTEsIHdlIHVzZSBhIGZpbmdlcnByaW50aW5nIGhldXJpc3RpYyBpbnN0ZWFkLCBiYXNlZFxuICAvLyBvbiB0aGUgbWV0aG9kcy4gSXQncyBub3QgZ3JlYXQsIGJ1dCBpdCdzIHRoZSBiZXN0IHdlIGdvdC5cbiAgLy8gVGhlIGZpbmdlcnByaW50IG1ldGhvZCBsaXN0cyBhcmUgZGVmaW5lZCBiZWxvdy5cbiAgZnVuY3Rpb24gaWUxMWZpbmdlcnByaW50KG1ldGhvZHMpIHtcbiAgICB2YXIgbGVuZ3RoID0gZ2V0TGVuZ3RoKG1ldGhvZHMpO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgICAgLy8gYE1hcGAsIGBXZWFrTWFwYCBhbmQgYFNldGAgaGF2ZSBubyBlbnVtZXJhYmxlIGtleXMuXG4gICAgICB2YXIga2V5cyA9IGFsbEtleXMob2JqKTtcbiAgICAgIGlmIChnZXRMZW5ndGgoa2V5cykpIHJldHVybiBmYWxzZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCFpc0Z1bmN0aW9uJDEob2JqW21ldGhvZHNbaV1dKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgLy8gSWYgd2UgYXJlIHRlc3RpbmcgYWdhaW5zdCBgV2Vha01hcGAsIHdlIG5lZWQgdG8gZW5zdXJlIHRoYXRcbiAgICAgIC8vIGBvYmpgIGRvZXNuJ3QgaGF2ZSBhIGBmb3JFYWNoYCBtZXRob2QgaW4gb3JkZXIgdG8gZGlzdGluZ3Vpc2hcbiAgICAgIC8vIGl0IGZyb20gYSByZWd1bGFyIGBNYXBgLlxuICAgICAgcmV0dXJuIG1ldGhvZHMgIT09IHdlYWtNYXBNZXRob2RzIHx8ICFpc0Z1bmN0aW9uJDEob2JqW2ZvckVhY2hOYW1lXSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEluIHRoZSBpbnRlcmVzdCBvZiBjb21wYWN0IG1pbmlmaWNhdGlvbiwgd2Ugd3JpdGVcbiAgLy8gZWFjaCBzdHJpbmcgaW4gdGhlIGZpbmdlcnByaW50cyBvbmx5IG9uY2UuXG4gIHZhciBmb3JFYWNoTmFtZSA9ICdmb3JFYWNoJyxcbiAgICAgIGhhc05hbWUgPSAnaGFzJyxcbiAgICAgIGNvbW1vbkluaXQgPSBbJ2NsZWFyJywgJ2RlbGV0ZSddLFxuICAgICAgbWFwVGFpbCA9IFsnZ2V0JywgaGFzTmFtZSwgJ3NldCddO1xuXG4gIC8vIGBNYXBgLCBgV2Vha01hcGAgYW5kIGBTZXRgIGVhY2ggaGF2ZSBzbGlnaHRseSBkaWZmZXJlbnRcbiAgLy8gY29tYmluYXRpb25zIG9mIHRoZSBhYm92ZSBzdWJsaXN0cy5cbiAgdmFyIG1hcE1ldGhvZHMgPSBjb21tb25Jbml0LmNvbmNhdChmb3JFYWNoTmFtZSwgbWFwVGFpbCksXG4gICAgICB3ZWFrTWFwTWV0aG9kcyA9IGNvbW1vbkluaXQuY29uY2F0KG1hcFRhaWwpLFxuICAgICAgc2V0TWV0aG9kcyA9IFsnYWRkJ10uY29uY2F0KGNvbW1vbkluaXQsIGZvckVhY2hOYW1lLCBoYXNOYW1lKTtcblxuICB2YXIgaXNNYXAgPSBpc0lFMTEgPyBpZTExZmluZ2VycHJpbnQobWFwTWV0aG9kcykgOiB0YWdUZXN0ZXIoJ01hcCcpO1xuXG4gIHZhciBpc1dlYWtNYXAgPSBpc0lFMTEgPyBpZTExZmluZ2VycHJpbnQod2Vha01hcE1ldGhvZHMpIDogdGFnVGVzdGVyKCdXZWFrTWFwJyk7XG5cbiAgdmFyIGlzU2V0ID0gaXNJRTExID8gaWUxMWZpbmdlcnByaW50KHNldE1ldGhvZHMpIDogdGFnVGVzdGVyKCdTZXQnKTtcblxuICB2YXIgaXNXZWFrU2V0ID0gdGFnVGVzdGVyKCdXZWFrU2V0Jyk7XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBmdW5jdGlvbiB2YWx1ZXMob2JqKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBfa2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW19rZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfVxuXG4gIC8vIENvbnZlcnQgYW4gb2JqZWN0IGludG8gYSBsaXN0IG9mIGBba2V5LCB2YWx1ZV1gIHBhaXJzLlxuICAvLyBUaGUgb3Bwb3NpdGUgb2YgYF8ub2JqZWN0YCB3aXRoIG9uZSBhcmd1bWVudC5cbiAgZnVuY3Rpb24gcGFpcnMob2JqKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBfa2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtfa2V5c1tpXSwgb2JqW19rZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbiAgfVxuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgZnVuY3Rpb24gaW52ZXJ0KG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIgX2tleXMgPSBrZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9rZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW19rZXlzW2ldXV0gPSBfa2V5c1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgZnVuY3Rpb24gZnVuY3Rpb25zKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChpc0Z1bmN0aW9uJDEob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYXNzaWduZXIgZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihrZXlzRnVuYywgZGVmYXVsdHMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIGlmIChkZWZhdWx0cykgb2JqID0gT2JqZWN0KG9iaik7XG4gICAgICBpZiAobGVuZ3RoIDwgMiB8fCBvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF0sXG4gICAgICAgICAgICBrZXlzID0ga2V5c0Z1bmMoc291cmNlKSxcbiAgICAgICAgICAgIGwgPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICBpZiAoIWRlZmF1bHRzIHx8IG9ialtrZXldID09PSB2b2lkIDApIG9ialtrZXldID0gc291cmNlW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICB2YXIgZXh0ZW5kID0gY3JlYXRlQXNzaWduZXIoYWxsS2V5cyk7XG5cbiAgLy8gQXNzaWducyBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgb3duIHByb3BlcnRpZXMgaW4gdGhlIHBhc3NlZC1pblxuICAvLyBvYmplY3QocykuXG4gIC8vIChodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvYXNzaWduKVxuICB2YXIgZXh0ZW5kT3duID0gY3JlYXRlQXNzaWduZXIoa2V5cyk7XG5cbiAgLy8gRmlsbCBpbiBhIGdpdmVuIG9iamVjdCB3aXRoIGRlZmF1bHQgcHJvcGVydGllcy5cbiAgdmFyIGRlZmF1bHRzID0gY3JlYXRlQXNzaWduZXIoYWxsS2V5cywgdHJ1ZSk7XG5cbiAgLy8gQ3JlYXRlIGEgbmFrZWQgZnVuY3Rpb24gcmVmZXJlbmNlIGZvciBzdXJyb2dhdGUtcHJvdG90eXBlLXN3YXBwaW5nLlxuICBmdW5jdGlvbiBjdG9yKCkge1xuICAgIHJldHVybiBmdW5jdGlvbigpe307XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IHRoYXQgaW5oZXJpdHMgZnJvbSBhbm90aGVyLlxuICBmdW5jdGlvbiBiYXNlQ3JlYXRlKHByb3RvdHlwZSkge1xuICAgIGlmICghaXNPYmplY3QocHJvdG90eXBlKSkgcmV0dXJuIHt9O1xuICAgIGlmIChuYXRpdmVDcmVhdGUpIHJldHVybiBuYXRpdmVDcmVhdGUocHJvdG90eXBlKTtcbiAgICB2YXIgQ3RvciA9IGN0b3IoKTtcbiAgICBDdG9yLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEN0b3I7XG4gICAgQ3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBDcmVhdGVzIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gdGhlIGdpdmVuIHByb3RvdHlwZSBvYmplY3QuXG4gIC8vIElmIGFkZGl0aW9uYWwgcHJvcGVydGllcyBhcmUgcHJvdmlkZWQgdGhlbiB0aGV5IHdpbGwgYmUgYWRkZWQgdG8gdGhlXG4gIC8vIGNyZWF0ZWQgb2JqZWN0LlxuICBmdW5jdGlvbiBjcmVhdGUocHJvdG90eXBlLCBwcm9wcykge1xuICAgIHZhciByZXN1bHQgPSBiYXNlQ3JlYXRlKHByb3RvdHlwZSk7XG4gICAgaWYgKHByb3BzKSBleHRlbmRPd24ocmVzdWx0LCBwcm9wcyk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgZnVuY3Rpb24gY2xvbmUob2JqKSB7XG4gICAgaWYgKCFpc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBpc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IGV4dGVuZCh7fSwgb2JqKTtcbiAgfVxuXG4gIC8vIEludm9rZXMgYGludGVyY2VwdG9yYCB3aXRoIHRoZSBgb2JqYCBhbmQgdGhlbiByZXR1cm5zIGBvYmpgLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIGZ1bmN0aW9uIHRhcChvYmosIGludGVyY2VwdG9yKSB7XG4gICAgaW50ZXJjZXB0b3Iob2JqKTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLy8gTm9ybWFsaXplIGEgKGRlZXApIHByb3BlcnR5IGBwYXRoYCB0byBhcnJheS5cbiAgLy8gTGlrZSBgXy5pdGVyYXRlZWAsIHRoaXMgZnVuY3Rpb24gY2FuIGJlIGN1c3RvbWl6ZWQuXG4gIGZ1bmN0aW9uIHRvUGF0aCQxKHBhdGgpIHtcbiAgICByZXR1cm4gaXNBcnJheShwYXRoKSA/IHBhdGggOiBbcGF0aF07XG4gIH1cbiAgXyQxLnRvUGF0aCA9IHRvUGF0aCQxO1xuXG4gIC8vIEludGVybmFsIHdyYXBwZXIgZm9yIGBfLnRvUGF0aGAgdG8gZW5hYmxlIG1pbmlmaWNhdGlvbi5cbiAgLy8gU2ltaWxhciB0byBgY2JgIGZvciBgXy5pdGVyYXRlZWAuXG4gIGZ1bmN0aW9uIHRvUGF0aChwYXRoKSB7XG4gICAgcmV0dXJuIF8kMS50b1BhdGgocGF0aCk7XG4gIH1cblxuICAvLyBJbnRlcm5hbCBmdW5jdGlvbiB0byBvYnRhaW4gYSBuZXN0ZWQgcHJvcGVydHkgaW4gYG9iamAgYWxvbmcgYHBhdGhgLlxuICBmdW5jdGlvbiBkZWVwR2V0KG9iaiwgcGF0aCkge1xuICAgIHZhciBsZW5ndGggPSBwYXRoLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgICBvYmogPSBvYmpbcGF0aFtpXV07XG4gICAgfVxuICAgIHJldHVybiBsZW5ndGggPyBvYmogOiB2b2lkIDA7XG4gIH1cblxuICAvLyBHZXQgdGhlIHZhbHVlIG9mIHRoZSAoZGVlcCkgcHJvcGVydHkgb24gYHBhdGhgIGZyb20gYG9iamVjdGAuXG4gIC8vIElmIGFueSBwcm9wZXJ0eSBpbiBgcGF0aGAgZG9lcyBub3QgZXhpc3Qgb3IgaWYgdGhlIHZhbHVlIGlzXG4gIC8vIGB1bmRlZmluZWRgLCByZXR1cm4gYGRlZmF1bHRWYWx1ZWAgaW5zdGVhZC5cbiAgLy8gVGhlIGBwYXRoYCBpcyBub3JtYWxpemVkIHRocm91Z2ggYF8udG9QYXRoYC5cbiAgZnVuY3Rpb24gZ2V0KG9iamVjdCwgcGF0aCwgZGVmYXVsdFZhbHVlKSB7XG4gICAgdmFyIHZhbHVlID0gZGVlcEdldChvYmplY3QsIHRvUGF0aChwYXRoKSk7XG4gICAgcmV0dXJuIGlzVW5kZWZpbmVkKHZhbHVlKSA/IGRlZmF1bHRWYWx1ZSA6IHZhbHVlO1xuICB9XG5cbiAgLy8gU2hvcnRjdXQgZnVuY3Rpb24gZm9yIGNoZWNraW5nIGlmIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBwcm9wZXJ0eSBkaXJlY3RseSBvblxuICAvLyBpdHNlbGYgKGluIG90aGVyIHdvcmRzLCBub3Qgb24gYSBwcm90b3R5cGUpLiBVbmxpa2UgdGhlIGludGVybmFsIGBoYXNgXG4gIC8vIGZ1bmN0aW9uLCB0aGlzIHB1YmxpYyB2ZXJzaW9uIGNhbiBhbHNvIHRyYXZlcnNlIG5lc3RlZCBwcm9wZXJ0aWVzLlxuICBmdW5jdGlvbiBoYXMob2JqLCBwYXRoKSB7XG4gICAgcGF0aCA9IHRvUGF0aChwYXRoKTtcbiAgICB2YXIgbGVuZ3RoID0gcGF0aC5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGtleSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhcyQxKG9iaiwga2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgb2JqID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiAhIWxlbmd0aDtcbiAgfVxuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRlZXMuXG4gIGZ1bmN0aW9uIGlkZW50aXR5KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByZWRpY2F0ZSBmb3IgY2hlY2tpbmcgd2hldGhlciBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gc2V0IG9mXG4gIC8vIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiBtYXRjaGVyKGF0dHJzKSB7XG4gICAgYXR0cnMgPSBleHRlbmRPd24oe30sIGF0dHJzKTtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gaXNNYXRjaChvYmosIGF0dHJzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gcGFzc2VkIGFuIG9iamVjdCwgd2lsbCB0cmF2ZXJzZSB0aGF0IG9iamVjdOKAmXNcbiAgLy8gcHJvcGVydGllcyBkb3duIHRoZSBnaXZlbiBgcGF0aGAsIHNwZWNpZmllZCBhcyBhbiBhcnJheSBvZiBrZXlzIG9yIGluZGljZXMuXG4gIGZ1bmN0aW9uIHByb3BlcnR5KHBhdGgpIHtcbiAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBkZWVwR2V0KG9iaiwgcGF0aCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgLy8gZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBvcHRpbWl6ZUNiKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgICAvLyBUaGUgMi1hcmd1bWVudCBjYXNlIGlzIG9taXR0ZWQgYmVjYXVzZSB3ZeKAmXJlIG5vdCB1c2luZyBpdC5cbiAgICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICB9O1xuICAgICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgY2FsbGJhY2tzIHRoYXQgY2FuIGJlIGFwcGxpZWQgdG8gZWFjaFxuICAvLyBlbGVtZW50IGluIGEgY29sbGVjdGlvbiwgcmV0dXJuaW5nIHRoZSBkZXNpcmVkIHJlc3VsdCDigJQgZWl0aGVyIGBfLmlkZW50aXR5YCxcbiAgLy8gYW4gYXJiaXRyYXJ5IGNhbGxiYWNrLCBhIHByb3BlcnR5IG1hdGNoZXIsIG9yIGEgcHJvcGVydHkgYWNjZXNzb3IuXG4gIGZ1bmN0aW9uIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIGlkZW50aXR5O1xuICAgIGlmIChpc0Z1bmN0aW9uJDEodmFsdWUpKSByZXR1cm4gb3B0aW1pemVDYih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChpc09iamVjdCh2YWx1ZSkgJiYgIWlzQXJyYXkodmFsdWUpKSByZXR1cm4gbWF0Y2hlcih2YWx1ZSk7XG4gICAgcmV0dXJuIHByb3BlcnR5KHZhbHVlKTtcbiAgfVxuXG4gIC8vIEV4dGVybmFsIHdyYXBwZXIgZm9yIG91ciBjYWxsYmFjayBnZW5lcmF0b3IuIFVzZXJzIG1heSBjdXN0b21pemVcbiAgLy8gYF8uaXRlcmF0ZWVgIGlmIHRoZXkgd2FudCBhZGRpdGlvbmFsIHByZWRpY2F0ZS9pdGVyYXRlZSBzaG9ydGhhbmQgc3R5bGVzLlxuICAvLyBUaGlzIGFic3RyYWN0aW9uIGhpZGVzIHRoZSBpbnRlcm5hbC1vbmx5IGBhcmdDb3VudGAgYXJndW1lbnQuXG4gIGZ1bmN0aW9uIGl0ZXJhdGVlKHZhbHVlLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgSW5maW5pdHkpO1xuICB9XG4gIF8kMS5pdGVyYXRlZSA9IGl0ZXJhdGVlO1xuXG4gIC8vIFRoZSBmdW5jdGlvbiB3ZSBjYWxsIGludGVybmFsbHkgdG8gZ2VuZXJhdGUgYSBjYWxsYmFjay4gSXQgaW52b2tlc1xuICAvLyBgXy5pdGVyYXRlZWAgaWYgb3ZlcnJpZGRlbiwgb3RoZXJ3aXNlIGBiYXNlSXRlcmF0ZWVgLlxuICBmdW5jdGlvbiBjYih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAoXyQxLml0ZXJhdGVlICE9PSBpdGVyYXRlZSkgcmV0dXJuIF8kMS5pdGVyYXRlZSh2YWx1ZSwgY29udGV4dCk7XG4gICAgcmV0dXJuIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgYGl0ZXJhdGVlYCB0byBlYWNoIGVsZW1lbnQgb2YgYG9iamAuXG4gIC8vIEluIGNvbnRyYXN0IHRvIGBfLm1hcGAgaXQgcmV0dXJucyBhbiBvYmplY3QuXG4gIGZ1bmN0aW9uIG1hcE9iamVjdChvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSBfa2V5cy5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgY3VycmVudEtleSA9IF9rZXlzW2luZGV4XTtcbiAgICAgIHJlc3VsdHNbY3VycmVudEtleV0gPSBpdGVyYXRlZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgLy8gUHJlZGljYXRlLWdlbmVyYXRpbmcgZnVuY3Rpb24uIE9mdGVuIHVzZWZ1bCBvdXRzaWRlIG9mIFVuZGVyc2NvcmUuXG4gIGZ1bmN0aW9uIG5vb3AoKXt9XG5cbiAgLy8gR2VuZXJhdGVzIGEgZnVuY3Rpb24gZm9yIGEgZ2l2ZW4gb2JqZWN0IHRoYXQgcmV0dXJucyBhIGdpdmVuIHByb3BlcnR5LlxuICBmdW5jdGlvbiBwcm9wZXJ0eU9mKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG5vb3A7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgIHJldHVybiBnZXQob2JqLCBwYXRoKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIGZ1bmN0aW9uIHRpbWVzKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgIGl0ZXJhdGVlID0gb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBgbWluYCBhbmQgYG1heGAgKGluY2x1c2l2ZSkuXG4gIGZ1bmN0aW9uIHJhbmRvbShtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH1cblxuICAvLyBBIChwb3NzaWJseSBmYXN0ZXIpIHdheSB0byBnZXQgdGhlIGN1cnJlbnQgdGltZXN0YW1wIGFzIGFuIGludGVnZXIuXG4gIHZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGdlbmVyYXRlIGZ1bmN0aW9ucyBmb3IgZXNjYXBpbmcgYW5kIHVuZXNjYXBpbmcgc3RyaW5nc1xuICAvLyB0by9mcm9tIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgZnVuY3Rpb24gY3JlYXRlRXNjYXBlcihtYXApIHtcbiAgICB2YXIgZXNjYXBlciA9IGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgICByZXR1cm4gbWFwW21hdGNoXTtcbiAgICB9O1xuICAgIC8vIFJlZ2V4ZXMgZm9yIGlkZW50aWZ5aW5nIGEga2V5IHRoYXQgbmVlZHMgdG8gYmUgZXNjYXBlZC5cbiAgICB2YXIgc291cmNlID0gJyg/OicgKyBrZXlzKG1hcCkuam9pbignfCcpICsgJyknO1xuICAgIHZhciB0ZXN0UmVnZXhwID0gUmVnRXhwKHNvdXJjZSk7XG4gICAgdmFyIHJlcGxhY2VSZWdleHAgPSBSZWdFeHAoc291cmNlLCAnZycpO1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgICAgIHJldHVybiB0ZXN0UmVnZXhwLnRlc3Qoc3RyaW5nKSA/IHN0cmluZy5yZXBsYWNlKHJlcGxhY2VSZWdleHAsIGVzY2FwZXIpIDogc3RyaW5nO1xuICAgIH07XG4gIH1cblxuICAvLyBJbnRlcm5hbCBsaXN0IG9mIEhUTUwgZW50aXRpZXMgZm9yIGVzY2FwaW5nLlxuICB2YXIgZXNjYXBlTWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjeDI3OycsXG4gICAgJ2AnOiAnJiN4NjA7J1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIGZvciBlc2NhcGluZyBzdHJpbmdzIHRvIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgdmFyIF9lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKGVzY2FwZU1hcCk7XG5cbiAgLy8gSW50ZXJuYWwgbGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciB1bmVzY2FwaW5nLlxuICB2YXIgdW5lc2NhcGVNYXAgPSBpbnZlcnQoZXNjYXBlTWFwKTtcblxuICAvLyBGdW5jdGlvbiBmb3IgdW5lc2NhcGluZyBzdHJpbmdzIGZyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICB2YXIgX3VuZXNjYXBlID0gY3JlYXRlRXNjYXBlcih1bmVzY2FwZU1hcCk7XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLiBDaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgdmFyIHRlbXBsYXRlU2V0dGluZ3MgPSBfJDEudGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZTogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZTogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gICAgZXNjYXBlOiAvPCUtKFtcXHNcXFNdKz8pJT4vZ1xuICB9O1xuXG4gIC8vIFdoZW4gY3VzdG9taXppbmcgYF8udGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6IFwiJ1wiLFxuICAgICdcXFxcJzogJ1xcXFwnLFxuICAgICdcXHInOiAncicsXG4gICAgJ1xcbic6ICduJyxcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXG4gICAgJ1xcdTIwMjknOiAndTIwMjknXG4gIH07XG5cbiAgdmFyIGVzY2FwZVJlZ0V4cCA9IC9cXFxcfCd8XFxyfFxcbnxcXHUyMDI4fFxcdTIwMjkvZztcblxuICBmdW5jdGlvbiBlc2NhcGVDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdO1xuICB9XG5cbiAgLy8gSW4gb3JkZXIgdG8gcHJldmVudCB0aGlyZC1wYXJ0eSBjb2RlIGluamVjdGlvbiB0aHJvdWdoXG4gIC8vIGBfLnRlbXBsYXRlU2V0dGluZ3MudmFyaWFibGVgLCB3ZSB0ZXN0IGl0IGFnYWluc3QgdGhlIGZvbGxvd2luZyByZWd1bGFyXG4gIC8vIGV4cHJlc3Npb24uIEl0IGlzIGludGVudGlvbmFsbHkgYSBiaXQgbW9yZSBsaWJlcmFsIHRoYW4ganVzdCBtYXRjaGluZyB2YWxpZFxuICAvLyBpZGVudGlmaWVycywgYnV0IHN0aWxsIHByZXZlbnRzIHBvc3NpYmxlIGxvb3Bob2xlcyB0aHJvdWdoIGRlZmF1bHRzIG9yXG4gIC8vIGRlc3RydWN0dXJpbmcgYXNzaWdubWVudC5cbiAgdmFyIGJhcmVJZGVudGlmaWVyID0gL15cXHMqKFxcd3xcXCQpK1xccyokLztcblxuICAvLyBKYXZhU2NyaXB0IG1pY3JvLXRlbXBsYXRpbmcsIHNpbWlsYXIgdG8gSm9obiBSZXNpZydzIGltcGxlbWVudGF0aW9uLlxuICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRpbmcgaGFuZGxlcyBhcmJpdHJhcnkgZGVsaW1pdGVycywgcHJlc2VydmVzIHdoaXRlc3BhY2UsXG4gIC8vIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICAvLyBOQjogYG9sZFNldHRpbmdzYCBvbmx5IGV4aXN0cyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG4gIGZ1bmN0aW9uIHRlbXBsYXRlKHRleHQsIHNldHRpbmdzLCBvbGRTZXR0aW5ncykge1xuICAgIGlmICghc2V0dGluZ3MgJiYgb2xkU2V0dGluZ3MpIHNldHRpbmdzID0gb2xkU2V0dGluZ3M7XG4gICAgc2V0dGluZ3MgPSBkZWZhdWx0cyh7fSwgc2V0dGluZ3MsIF8kMS50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKGVzY2FwZVJlZ0V4cCwgZXNjYXBlQ2hhcik7XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfSBlbHNlIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cblxuICAgICAgLy8gQWRvYmUgVk1zIG5lZWQgdGhlIG1hdGNoIHJldHVybmVkIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3Qgb2Zmc2V0LlxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICB2YXIgYXJndW1lbnQgPSBzZXR0aW5ncy52YXJpYWJsZTtcbiAgICBpZiAoYXJndW1lbnQpIHtcbiAgICAgIC8vIEluc3VyZSBhZ2FpbnN0IHRoaXJkLXBhcnR5IGNvZGUgaW5qZWN0aW9uLiAoQ1ZFLTIwMjEtMjMzNTgpXG4gICAgICBpZiAoIWJhcmVJZGVudGlmaWVyLnRlc3QoYXJndW1lbnQpKSB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICd2YXJpYWJsZSBpcyBub3QgYSBiYXJlIGlkZW50aWZpZXI6ICcgKyBhcmd1bWVudFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICAgIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG4gICAgICBhcmd1bWVudCA9ICdvYmonO1xuICAgIH1cblxuICAgIHNvdXJjZSA9IFwidmFyIF9fdCxfX3A9JycsX19qPUFycmF5LnByb3RvdHlwZS5qb2luLFwiICtcbiAgICAgIFwicHJpbnQ9ZnVuY3Rpb24oKXtfX3ArPV9fai5jYWxsKGFyZ3VtZW50cywnJyk7fTtcXG5cIiArXG4gICAgICBzb3VyY2UgKyAncmV0dXJuIF9fcDtcXG4nO1xuXG4gICAgdmFyIHJlbmRlcjtcbiAgICB0cnkge1xuICAgICAgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKGFyZ3VtZW50LCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfJDEpO1xuICAgIH07XG5cbiAgICAvLyBQcm92aWRlIHRoZSBjb21waWxlZCBzb3VyY2UgYXMgYSBjb252ZW5pZW5jZSBmb3IgcHJlY29tcGlsYXRpb24uXG4gICAgdGVtcGxhdGUuc291cmNlID0gJ2Z1bmN0aW9uKCcgKyBhcmd1bWVudCArICcpe1xcbicgKyBzb3VyY2UgKyAnfSc7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICAvLyBUcmF2ZXJzZXMgdGhlIGNoaWxkcmVuIG9mIGBvYmpgIGFsb25nIGBwYXRoYC4gSWYgYSBjaGlsZCBpcyBhIGZ1bmN0aW9uLCBpdFxuICAvLyBpcyBpbnZva2VkIHdpdGggaXRzIHBhcmVudCBhcyBjb250ZXh0LiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZmluYWxcbiAgLy8gY2hpbGQsIG9yIGBmYWxsYmFja2AgaWYgYW55IGNoaWxkIGlzIHVuZGVmaW5lZC5cbiAgZnVuY3Rpb24gcmVzdWx0KG9iaiwgcGF0aCwgZmFsbGJhY2spIHtcbiAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgIHZhciBsZW5ndGggPSBwYXRoLmxlbmd0aDtcbiAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgcmV0dXJuIGlzRnVuY3Rpb24kMShmYWxsYmFjaykgPyBmYWxsYmFjay5jYWxsKG9iaikgOiBmYWxsYmFjaztcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHByb3AgPSBvYmogPT0gbnVsbCA/IHZvaWQgMCA6IG9ialtwYXRoW2ldXTtcbiAgICAgIGlmIChwcm9wID09PSB2b2lkIDApIHtcbiAgICAgICAgcHJvcCA9IGZhbGxiYWNrO1xuICAgICAgICBpID0gbGVuZ3RoOyAvLyBFbnN1cmUgd2UgZG9uJ3QgY29udGludWUgaXRlcmF0aW5nLlxuICAgICAgfVxuICAgICAgb2JqID0gaXNGdW5jdGlvbiQxKHByb3ApID8gcHJvcC5jYWxsKG9iaikgOiBwcm9wO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH1cblxuICAvLyBTdGFydCBjaGFpbmluZyBhIHdyYXBwZWQgVW5kZXJzY29yZSBvYmplY3QuXG4gIGZ1bmN0aW9uIGNoYWluKG9iaikge1xuICAgIHZhciBpbnN0YW5jZSA9IF8kMShvYmopO1xuICAgIGluc3RhbmNlLl9jaGFpbiA9IHRydWU7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdG8gZXhlY3V0ZSBgc291cmNlRnVuY2AgYm91bmQgdG8gYGNvbnRleHRgIHdpdGggb3B0aW9uYWxcbiAgLy8gYGFyZ3NgLiBEZXRlcm1pbmVzIHdoZXRoZXIgdG8gZXhlY3V0ZSBhIGZ1bmN0aW9uIGFzIGEgY29uc3RydWN0b3Igb3IgYXMgYVxuICAvLyBub3JtYWwgZnVuY3Rpb24uXG4gIGZ1bmN0aW9uIGV4ZWN1dGVCb3VuZChzb3VyY2VGdW5jLCBib3VuZEZ1bmMsIGNvbnRleHQsIGNhbGxpbmdDb250ZXh0LCBhcmdzKSB7XG4gICAgaWYgKCEoY2FsbGluZ0NvbnRleHQgaW5zdGFuY2VvZiBib3VuZEZ1bmMpKSByZXR1cm4gc291cmNlRnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB2YXIgc2VsZiA9IGJhc2VDcmVhdGUoc291cmNlRnVuYy5wcm90b3R5cGUpO1xuICAgIHZhciByZXN1bHQgPSBzb3VyY2VGdW5jLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIGlmIChpc09iamVjdChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAvLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gYF9gIGFjdHNcbiAgLy8gYXMgYSBwbGFjZWhvbGRlciBieSBkZWZhdWx0LCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlXG4gIC8vIHByZS1maWxsZWQuIFNldCBgXy5wYXJ0aWFsLnBsYWNlaG9sZGVyYCBmb3IgYSBjdXN0b20gcGxhY2Vob2xkZXIgYXJndW1lbnQuXG4gIHZhciBwYXJ0aWFsID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihmdW5jLCBib3VuZEFyZ3MpIHtcbiAgICB2YXIgcGxhY2Vob2xkZXIgPSBwYXJ0aWFsLnBsYWNlaG9sZGVyO1xuICAgIHZhciBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gMCwgbGVuZ3RoID0gYm91bmRBcmdzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJnc1tpXSA9IGJvdW5kQXJnc1tpXSA9PT0gcGxhY2Vob2xkZXIgPyBhcmd1bWVudHNbcG9zaXRpb24rK10gOiBib3VuZEFyZ3NbaV07XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBleGVjdXRlQm91bmQoZnVuYywgYm91bmQsIHRoaXMsIHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9KTtcblxuICBwYXJ0aWFsLnBsYWNlaG9sZGVyID0gXyQxO1xuXG4gIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAvLyBvcHRpb25hbGx5KS5cbiAgdmFyIGJpbmQgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQsIGFyZ3MpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb24kMShmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQmluZCBtdXN0IGJlIGNhbGxlZCBvbiBhIGZ1bmN0aW9uJyk7XG4gICAgdmFyIGJvdW5kID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihjYWxsQXJncykge1xuICAgICAgcmV0dXJuIGV4ZWN1dGVCb3VuZChmdW5jLCBib3VuZCwgY29udGV4dCwgdGhpcywgYXJncy5jb25jYXQoY2FsbEFyZ3MpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH0pO1xuXG4gIC8vIEludGVybmFsIGhlbHBlciBmb3IgY29sbGVjdGlvbiBtZXRob2RzIHRvIGRldGVybWluZSB3aGV0aGVyIGEgY29sbGVjdGlvblxuICAvLyBzaG91bGQgYmUgaXRlcmF0ZWQgYXMgYW4gYXJyYXkgb3IgYXMgYW4gb2JqZWN0LlxuICAvLyBSZWxhdGVkOiBodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtdG9sZW5ndGhcbiAgLy8gQXZvaWRzIGEgdmVyeSBuYXN0eSBpT1MgOCBKSVQgYnVnIG9uIEFSTS02NC4gIzIwOTRcbiAgdmFyIGlzQXJyYXlMaWtlID0gY3JlYXRlU2l6ZVByb3BlcnR5Q2hlY2soZ2V0TGVuZ3RoKTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIGZ1bmN0aW9uIGZsYXR0ZW4kMShpbnB1dCwgZGVwdGgsIHN0cmljdCwgb3V0cHV0KSB7XG4gICAgb3V0cHV0ID0gb3V0cHV0IHx8IFtdO1xuICAgIGlmICghZGVwdGggJiYgZGVwdGggIT09IDApIHtcbiAgICAgIGRlcHRoID0gSW5maW5pdHk7XG4gICAgfSBlbHNlIGlmIChkZXB0aCA8PSAwKSB7XG4gICAgICByZXR1cm4gb3V0cHV0LmNvbmNhdChpbnB1dCk7XG4gICAgfVxuICAgIHZhciBpZHggPSBvdXRwdXQubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBnZXRMZW5ndGgoaW5wdXQpOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGlucHV0W2ldO1xuICAgICAgaWYgKGlzQXJyYXlMaWtlKHZhbHVlKSAmJiAoaXNBcnJheSh2YWx1ZSkgfHwgaXNBcmd1bWVudHMkMSh2YWx1ZSkpKSB7XG4gICAgICAgIC8vIEZsYXR0ZW4gY3VycmVudCBsZXZlbCBvZiBhcnJheSBvciBhcmd1bWVudHMgb2JqZWN0LlxuICAgICAgICBpZiAoZGVwdGggPiAxKSB7XG4gICAgICAgICAgZmxhdHRlbiQxKHZhbHVlLCBkZXB0aCAtIDEsIHN0cmljdCwgb3V0cHV0KTtcbiAgICAgICAgICBpZHggPSBvdXRwdXQubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBqID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICAgIHdoaWxlIChqIDwgbGVuKSBvdXRwdXRbaWR4KytdID0gdmFsdWVbaisrXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghc3RyaWN0KSB7XG4gICAgICAgIG91dHB1dFtpZHgrK10gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG4gIC8vIEJpbmQgYSBudW1iZXIgb2YgYW4gb2JqZWN0J3MgbWV0aG9kcyB0byB0aGF0IG9iamVjdC4gUmVtYWluaW5nIGFyZ3VtZW50c1xuICAvLyBhcmUgdGhlIG1ldGhvZCBuYW1lcyB0byBiZSBib3VuZC4gVXNlZnVsIGZvciBlbnN1cmluZyB0aGF0IGFsbCBjYWxsYmFja3NcbiAgLy8gZGVmaW5lZCBvbiBhbiBvYmplY3QgYmVsb25nIHRvIGl0LlxuICB2YXIgYmluZEFsbCA9IHJlc3RBcmd1bWVudHMoZnVuY3Rpb24ob2JqLCBrZXlzKSB7XG4gICAga2V5cyA9IGZsYXR0ZW4kMShrZXlzLCBmYWxzZSwgZmFsc2UpO1xuICAgIHZhciBpbmRleCA9IGtleXMubGVuZ3RoO1xuICAgIGlmIChpbmRleCA8IDEpIHRocm93IG5ldyBFcnJvcignYmluZEFsbCBtdXN0IGJlIHBhc3NlZCBmdW5jdGlvbiBuYW1lcycpO1xuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICB2YXIga2V5ID0ga2V5c1tpbmRleF07XG4gICAgICBvYmpba2V5XSA9IGJpbmQob2JqW2tleV0sIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH0pO1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIGZ1bmN0aW9uIG1lbW9pemUoZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW9pemUgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHZhciBjYWNoZSA9IG1lbW9pemUuY2FjaGU7XG4gICAgICB2YXIgYWRkcmVzcyA9ICcnICsgKGhhc2hlciA/IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5KTtcbiAgICAgIGlmICghaGFzJDEoY2FjaGUsIGFkZHJlc3MpKSBjYWNoZVthZGRyZXNzXSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBjYWNoZVthZGRyZXNzXTtcbiAgICB9O1xuICAgIG1lbW9pemUuY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gbWVtb2l6ZTtcbiAgfVxuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICB2YXIgZGVsYXkgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGFyZ3MpIHtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH0sIHdhaXQpO1xuICB9KTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgdmFyIGRlZmVyID0gcGFydGlhbChkZWxheSwgXyQxLCAxKTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIGZ1bmN0aW9uIHRocm90dGxlKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGltZW91dCwgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciBwcmV2aW91cyA9IDA7XG4gICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XG5cbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBub3coKTtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGlmICghdGltZW91dCkgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH07XG5cbiAgICB2YXIgdGhyb3R0bGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgX25vdyA9IG5vdygpO1xuICAgICAgaWYgKCFwcmV2aW91cyAmJiBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlKSBwcmV2aW91cyA9IF9ub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChfbm93IC0gcHJldmlvdXMpO1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgaWYgKHJlbWFpbmluZyA8PSAwIHx8IHJlbWFpbmluZyA+IHdhaXQpIHtcbiAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcHJldmlvdXMgPSBfbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICB0aHJvdHRsZWQuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICBwcmV2aW91cyA9IDA7XG4gICAgICB0aW1lb3V0ID0gY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH07XG5cbiAgICByZXR1cm4gdGhyb3R0bGVkO1xuICB9XG5cbiAgLy8gV2hlbiBhIHNlcXVlbmNlIG9mIGNhbGxzIG9mIHRoZSByZXR1cm5lZCBmdW5jdGlvbiBlbmRzLCB0aGUgYXJndW1lbnRcbiAgLy8gZnVuY3Rpb24gaXMgdHJpZ2dlcmVkLiBUaGUgZW5kIG9mIGEgc2VxdWVuY2UgaXMgZGVmaW5lZCBieSB0aGUgYHdhaXRgXG4gIC8vIHBhcmFtZXRlci4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0aGUgYXJndW1lbnQgZnVuY3Rpb24gd2lsbCBiZVxuICAvLyB0cmlnZ2VyZWQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc2VxdWVuY2UgaW5zdGVhZCBvZiBhdCB0aGUgZW5kLlxuICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICB2YXIgdGltZW91dCwgcHJldmlvdXMsIGFyZ3MsIHJlc3VsdCwgY29udGV4dDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhc3NlZCA9IG5vdygpIC0gcHJldmlvdXM7XG4gICAgICBpZiAod2FpdCA+IHBhc3NlZCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIHBhc3NlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIC8vIFRoaXMgY2hlY2sgaXMgbmVlZGVkIGJlY2F1c2UgYGZ1bmNgIGNhbiByZWN1cnNpdmVseSBpbnZva2UgYGRlYm91bmNlZGAuXG4gICAgICAgIGlmICghdGltZW91dCkgYXJncyA9IGNvbnRleHQgPSBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgZGVib3VuY2VkID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihfYXJncykge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gX2FyZ3M7XG4gICAgICBwcmV2aW91cyA9IG5vdygpO1xuICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgICAgaWYgKGltbWVkaWF0ZSkgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG5cbiAgICBkZWJvdW5jZWQuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICB0aW1lb3V0ID0gYXJncyA9IGNvbnRleHQgPSBudWxsO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVib3VuY2VkO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3QgZnVuY3Rpb24gcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBzZWNvbmQsXG4gIC8vIGFsbG93aW5nIHlvdSB0byBhZGp1c3QgYXJndW1lbnRzLCBydW4gY29kZSBiZWZvcmUgYW5kIGFmdGVyLCBhbmRcbiAgLy8gY29uZGl0aW9uYWxseSBleGVjdXRlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi5cbiAgZnVuY3Rpb24gd3JhcChmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIHBhcnRpYWwod3JhcHBlciwgZnVuYyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgbmVnYXRlZCB2ZXJzaW9uIG9mIHRoZSBwYXNzZWQtaW4gcHJlZGljYXRlLlxuICBmdW5jdGlvbiBuZWdhdGUocHJlZGljYXRlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICFwcmVkaWNhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIGEgbGlzdCBvZiBmdW5jdGlvbnMsIGVhY2hcbiAgLy8gY29uc3VtaW5nIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgZnVuY3Rpb24gY29tcG9zZSgpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICB2YXIgc3RhcnQgPSBhcmdzLmxlbmd0aCAtIDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGkgPSBzdGFydDtcbiAgICAgIHZhciByZXN1bHQgPSBhcmdzW3N0YXJ0XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgd2hpbGUgKGktLSkgcmVzdWx0ID0gYXJnc1tpXS5jYWxsKHRoaXMsIHJlc3VsdCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb24gYW5kIGFmdGVyIHRoZSBOdGggY2FsbC5cbiAgZnVuY3Rpb24gYWZ0ZXIodGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIHVwIHRvIChidXQgbm90IGluY2x1ZGluZykgdGhlXG4gIC8vIE50aCBjYWxsLlxuICBmdW5jdGlvbiBiZWZvcmUodGltZXMsIGZ1bmMpIHtcbiAgICB2YXIgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA+IDApIHtcbiAgICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aW1lcyA8PSAxKSBmdW5jID0gbnVsbDtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH07XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgdmFyIG9uY2UgPSBwYXJ0aWFsKGJlZm9yZSwgMik7XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3Qga2V5IG9uIGFuIG9iamVjdCB0aGF0IHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIGZpbmRLZXkob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9IGtleXMob2JqKSwga2V5O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBfa2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAga2V5ID0gX2tleXNbaV07XG4gICAgICBpZiAocHJlZGljYXRlKG9ialtrZXldLCBrZXksIG9iaikpIHJldHVybiBrZXk7XG4gICAgfVxuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgYF8uZmluZEluZGV4YCBhbmQgYF8uZmluZExhc3RJbmRleGAuXG4gIGZ1bmN0aW9uIGNyZWF0ZVByZWRpY2F0ZUluZGV4RmluZGVyKGRpcikge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnJheSwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgICAgdmFyIGxlbmd0aCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgICB2YXIgaW5kZXggPSBkaXIgPiAwID8gMCA6IGxlbmd0aCAtIDE7XG4gICAgICBmb3IgKDsgaW5kZXggPj0gMCAmJiBpbmRleCA8IGxlbmd0aDsgaW5kZXggKz0gZGlyKSB7XG4gICAgICAgIGlmIChwcmVkaWNhdGUoYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSByZXR1cm4gaW5kZXg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGluZGV4IG9uIGFuIGFycmF5LWxpa2UgdGhhdCBwYXNzZXMgYSB0cnV0aCB0ZXN0LlxuICB2YXIgZmluZEluZGV4ID0gY3JlYXRlUHJlZGljYXRlSW5kZXhGaW5kZXIoMSk7XG5cbiAgLy8gUmV0dXJucyB0aGUgbGFzdCBpbmRleCBvbiBhbiBhcnJheS1saWtlIHRoYXQgcGFzc2VzIGEgdHJ1dGggdGVzdC5cbiAgdmFyIGZpbmRMYXN0SW5kZXggPSBjcmVhdGVQcmVkaWNhdGVJbmRleEZpbmRlcigtMSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIGZ1bmN0aW9uIHNvcnRlZEluZGV4KGFycmF5LCBvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0ZWUob2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpO1xuICAgICAgaWYgKGl0ZXJhdGVlKGFycmF5W21pZF0pIDwgdmFsdWUpIGxvdyA9IG1pZCArIDE7IGVsc2UgaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfVxuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSBgXy5pbmRleE9mYCBhbmQgYF8ubGFzdEluZGV4T2ZgIGZ1bmN0aW9ucy5cbiAgZnVuY3Rpb24gY3JlYXRlSW5kZXhGaW5kZXIoZGlyLCBwcmVkaWNhdGVGaW5kLCBzb3J0ZWRJbmRleCkge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnJheSwgaXRlbSwgaWR4KSB7XG4gICAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgICBpZiAodHlwZW9mIGlkeCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoZGlyID4gMCkge1xuICAgICAgICAgIGkgPSBpZHggPj0gMCA/IGlkeCA6IE1hdGgubWF4KGlkeCArIGxlbmd0aCwgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGVuZ3RoID0gaWR4ID49IDAgPyBNYXRoLm1pbihpZHggKyAxLCBsZW5ndGgpIDogaWR4ICsgbGVuZ3RoICsgMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzb3J0ZWRJbmRleCAmJiBpZHggJiYgbGVuZ3RoKSB7XG4gICAgICAgIGlkeCA9IHNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2lkeF0gPT09IGl0ZW0gPyBpZHggOiAtMTtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtICE9PSBpdGVtKSB7XG4gICAgICAgIGlkeCA9IHByZWRpY2F0ZUZpbmQoc2xpY2UuY2FsbChhcnJheSwgaSwgbGVuZ3RoKSwgaXNOYU4kMSk7XG4gICAgICAgIHJldHVybiBpZHggPj0gMCA/IGlkeCArIGkgOiAtMTtcbiAgICAgIH1cbiAgICAgIGZvciAoaWR4ID0gZGlyID4gMCA/IGkgOiBsZW5ndGggLSAxOyBpZHggPj0gMCAmJiBpZHggPCBsZW5ndGg7IGlkeCArPSBkaXIpIHtcbiAgICAgICAgaWYgKGFycmF5W2lkeF0gPT09IGl0ZW0pIHJldHVybiBpZHg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYW4gaXRlbSBpbiBhbiBhcnJheSxcbiAgLy8gb3IgLTEgaWYgdGhlIGl0ZW0gaXMgbm90IGluY2x1ZGVkIGluIHRoZSBhcnJheS5cbiAgLy8gSWYgdGhlIGFycmF5IGlzIGxhcmdlIGFuZCBhbHJlYWR5IGluIHNvcnQgb3JkZXIsIHBhc3MgYHRydWVgXG4gIC8vIGZvciAqKmlzU29ydGVkKiogdG8gdXNlIGJpbmFyeSBzZWFyY2guXG4gIHZhciBpbmRleE9mID0gY3JlYXRlSW5kZXhGaW5kZXIoMSwgZmluZEluZGV4LCBzb3J0ZWRJbmRleCk7XG5cbiAgLy8gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIGFuIGl0ZW0gaW4gYW4gYXJyYXksXG4gIC8vIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIHZhciBsYXN0SW5kZXhPZiA9IGNyZWF0ZUluZGV4RmluZGVyKC0xLCBmaW5kTGFzdEluZGV4KTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIGZpbmQob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIga2V5RmluZGVyID0gaXNBcnJheUxpa2Uob2JqKSA/IGZpbmRJbmRleCA6IGZpbmRLZXk7XG4gICAgdmFyIGtleSA9IGtleUZpbmRlcihvYmosIHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgaWYgKGtleSAhPT0gdm9pZCAwICYmIGtleSAhPT0gLTEpIHJldHVybiBvYmpba2V5XTtcbiAgfVxuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYF8uZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0XG4gIC8vIG9iamVjdCBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiBmaW5kV2hlcmUob2JqLCBhdHRycykge1xuICAgIHJldHVybiBmaW5kKG9iaiwgbWF0Y2hlcihhdHRycykpO1xuICB9XG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lIGZvciBjb2xsZWN0aW9uIGZ1bmN0aW9ucywgYW4gYGVhY2hgXG4gIC8vIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIHJhdyBvYmplY3RzIGluIGFkZGl0aW9uIHRvIGFycmF5LWxpa2VzLiBUcmVhdHMgYWxsXG4gIC8vIHNwYXJzZSBhcnJheS1saWtlcyBhcyBpZiB0aGV5IHdlcmUgZGVuc2UuXG4gIGZ1bmN0aW9uIGVhY2gob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGl0ZXJhdGVlID0gb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGksIGxlbmd0aDtcbiAgICBpZiAoaXNBcnJheUxpa2Uob2JqKSkge1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdGVlKG9ialtpXSwgaSwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0gX2tleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW19rZXlzW2ldXSwgX2tleXNbaV0sIG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdGVlIHRvIGVhY2ggZWxlbWVudC5cbiAgZnVuY3Rpb24gbWFwKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgX2tleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBrZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChfa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIGN1cnJlbnRLZXkgPSBfa2V5cyA/IF9rZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgcmVzdWx0c1tpbmRleF0gPSBpdGVyYXRlZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGNyZWF0ZSBhIHJlZHVjaW5nIGZ1bmN0aW9uLCBpdGVyYXRpbmcgbGVmdCBvciByaWdodC5cbiAgZnVuY3Rpb24gY3JlYXRlUmVkdWNlKGRpcikge1xuICAgIC8vIFdyYXAgY29kZSB0aGF0IHJlYXNzaWducyBhcmd1bWVudCB2YXJpYWJsZXMgaW4gYSBzZXBhcmF0ZSBmdW5jdGlvbiB0aGFuXG4gICAgLy8gdGhlIG9uZSB0aGF0IGFjY2Vzc2VzIGBhcmd1bWVudHMubGVuZ3RoYCB0byBhdm9pZCBhIHBlcmYgaGl0LiAoIzE5OTEpXG4gICAgdmFyIHJlZHVjZXIgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBpbml0aWFsKSB7XG4gICAgICB2YXIgX2tleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBrZXlzKG9iaiksXG4gICAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICAgIGluZGV4ID0gZGlyID4gMCA/IDAgOiBsZW5ndGggLSAxO1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSBvYmpbX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleF07XG4gICAgICAgIGluZGV4ICs9IGRpcjtcbiAgICAgIH1cbiAgICAgIGZvciAoOyBpbmRleCA+PSAwICYmIGluZGV4IDwgbGVuZ3RoOyBpbmRleCArPSBkaXIpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRLZXkgPSBfa2V5cyA/IF9rZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgICBtZW1vID0gaXRlcmF0ZWUobWVtbywgb2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPj0gMztcbiAgICAgIHJldHVybiByZWR1Y2VyKG9iaiwgb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCwgNCksIG1lbW8sIGluaXRpYWwpO1xuICAgIH07XG4gIH1cblxuICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gIC8vIG9yIGBmb2xkbGAuXG4gIHZhciByZWR1Y2UgPSBjcmVhdGVSZWR1Y2UoMSk7XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIHZhciByZWR1Y2VSaWdodCA9IGNyZWF0ZVJlZHVjZSgtMSk7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgZnVuY3Rpb24gZmlsdGVyKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUodmFsdWUsIGluZGV4LCBsaXN0KSkgcmVzdWx0cy5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIGZ1bmN0aW9uIHJlamVjdChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHJldHVybiBmaWx0ZXIob2JqLCBuZWdhdGUoY2IocHJlZGljYXRlKSksIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgYWxsIG9mIHRoZSBlbGVtZW50cyBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgZnVuY3Rpb24gZXZlcnkob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9ICFpc0FycmF5TGlrZShvYmopICYmIGtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBjdXJyZW50S2V5ID0gX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmICghcHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIERldGVybWluZSBpZiBhdCBsZWFzdCBvbmUgZWxlbWVudCBpbiB0aGUgb2JqZWN0IHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIHNvbWUob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9ICFpc0FycmF5TGlrZShvYmopICYmIGtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBjdXJyZW50S2V5ID0gX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmIChwcmVkaWNhdGUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiBpdGVtICh1c2luZyBgPT09YCkuXG4gIGZ1bmN0aW9uIGNvbnRhaW5zKG9iaiwgaXRlbSwgZnJvbUluZGV4LCBndWFyZCkge1xuICAgIGlmICghaXNBcnJheUxpa2Uob2JqKSkgb2JqID0gdmFsdWVzKG9iaik7XG4gICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggIT0gJ251bWJlcicgfHwgZ3VhcmQpIGZyb21JbmRleCA9IDA7XG4gICAgcmV0dXJuIGluZGV4T2Yob2JqLCBpdGVtLCBmcm9tSW5kZXgpID49IDA7XG4gIH1cblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgdmFyIGludm9rZSA9IHJlc3RBcmd1bWVudHMoZnVuY3Rpb24ob2JqLCBwYXRoLCBhcmdzKSB7XG4gICAgdmFyIGNvbnRleHRQYXRoLCBmdW5jO1xuICAgIGlmIChpc0Z1bmN0aW9uJDEocGF0aCkpIHtcbiAgICAgIGZ1bmMgPSBwYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgICAgY29udGV4dFBhdGggPSBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgICAgIHBhdGggPSBwYXRoW3BhdGgubGVuZ3RoIC0gMV07XG4gICAgfVxuICAgIHJldHVybiBtYXAob2JqLCBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgICB2YXIgbWV0aG9kID0gZnVuYztcbiAgICAgIGlmICghbWV0aG9kKSB7XG4gICAgICAgIGlmIChjb250ZXh0UGF0aCAmJiBjb250ZXh0UGF0aC5sZW5ndGgpIHtcbiAgICAgICAgICBjb250ZXh0ID0gZGVlcEdldChjb250ZXh0LCBjb250ZXh0UGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRleHQgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICAgICAgbWV0aG9kID0gY29udGV4dFtwYXRoXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXRob2QgPT0gbnVsbCA/IG1ldGhvZCA6IG1ldGhvZC5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgXy5tYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuICBmdW5jdGlvbiBwbHVjayhvYmosIGtleSkge1xuICAgIHJldHVybiBtYXAob2JqLCBwcm9wZXJ0eShrZXkpKTtcbiAgfVxuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYF8uZmlsdGVyYDogc2VsZWN0aW5nIG9ubHlcbiAgLy8gb2JqZWN0cyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiB3aGVyZShvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIGZpbHRlcihvYmosIG1hdGNoZXIoYXR0cnMpKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgZnVuY3Rpb24gbWF4KG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCB8fCB0eXBlb2YgaXRlcmF0ZWUgPT0gJ251bWJlcicgJiYgdHlwZW9mIG9ialswXSAhPSAnb2JqZWN0JyAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gaXNBcnJheUxpa2Uob2JqKSA/IG9iaiA6IHZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlICE9IG51bGwgJiYgdmFsdWUgPiByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGVhY2gob2JqLCBmdW5jdGlvbih2LCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHYsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSAtSW5maW5pdHkgJiYgcmVzdWx0ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICByZXN1bHQgPSB2O1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgZnVuY3Rpb24gbWluKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IEluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgfHwgdHlwZW9mIGl0ZXJhdGVlID09ICdudW1iZXInICYmIHR5cGVvZiBvYmpbMF0gIT0gJ29iamVjdCcgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgIG9iaiA9IGlzQXJyYXlMaWtlKG9iaikgPyBvYmogOiB2YWx1ZXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgIGlmICh2YWx1ZSAhPSBudWxsICYmIHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBlYWNoKG9iaiwgZnVuY3Rpb24odiwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2LCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA8IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gSW5maW5pdHkgJiYgcmVzdWx0ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHY7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2FtcGxlICoqbioqIHJhbmRvbSB2YWx1ZXMgZnJvbSBhIGNvbGxlY3Rpb24gdXNpbmcgdGhlIG1vZGVybiB2ZXJzaW9uIG9mIHRoZVxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlcuKAk1lhdGVzX3NodWZmbGUpLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIGZ1bmN0aW9uIHNhbXBsZShvYmosIG4sIGd1YXJkKSB7XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xuICAgICAgaWYgKCFpc0FycmF5TGlrZShvYmopKSBvYmogPSB2YWx1ZXMob2JqKTtcbiAgICAgIHJldHVybiBvYmpbcmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHZhciBzYW1wbGUgPSBpc0FycmF5TGlrZShvYmopID8gY2xvbmUob2JqKSA6IHZhbHVlcyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBnZXRMZW5ndGgoc2FtcGxlKTtcbiAgICBuID0gTWF0aC5tYXgoTWF0aC5taW4obiwgbGVuZ3RoKSwgMCk7XG4gICAgdmFyIGxhc3QgPSBsZW5ndGggLSAxO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBuOyBpbmRleCsrKSB7XG4gICAgICB2YXIgcmFuZCA9IHJhbmRvbShpbmRleCwgbGFzdCk7XG4gICAgICB2YXIgdGVtcCA9IHNhbXBsZVtpbmRleF07XG4gICAgICBzYW1wbGVbaW5kZXhdID0gc2FtcGxlW3JhbmRdO1xuICAgICAgc2FtcGxlW3JhbmRdID0gdGVtcDtcbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZS5zbGljZSgwLCBuKTtcbiAgfVxuXG4gIC8vIFNodWZmbGUgYSBjb2xsZWN0aW9uLlxuICBmdW5jdGlvbiBzaHVmZmxlKG9iaikge1xuICAgIHJldHVybiBzYW1wbGUob2JqLCBJbmZpbml0eSk7XG4gIH1cblxuICAvLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0ZWUuXG4gIGZ1bmN0aW9uIHNvcnRCeShvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gcGx1Y2sobWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGtleSwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgrKyxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdGVlKHZhbHVlLCBrZXksIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIGZ1bmN0aW9uIGdyb3VwKGJlaGF2aW9yLCBwYXJ0aXRpb24pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHBhcnRpdGlvbiA/IFtbXSwgW11dIDoge307XG4gICAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGtleSA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCB2YWx1ZSwga2V5KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9XG5cbiAgLy8gR3JvdXBzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24uIFBhc3MgZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZVxuICAvLyB0byBncm91cCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNyaXRlcmlvbi5cbiAgdmFyIGdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoaGFzJDEocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XS5wdXNoKHZhbHVlKTsgZWxzZSByZXN1bHRba2V5XSA9IFt2YWx1ZV07XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgXy5ncm91cEJ5YCwgYnV0IGZvclxuICAvLyB3aGVuIHlvdSBrbm93IHRoYXQgeW91ciBpbmRleCB2YWx1ZXMgd2lsbCBiZSB1bmlxdWUuXG4gIHZhciBpbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIHZhciBjb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgaWYgKGhhcyQxKHJlc3VsdCwga2V5KSkgcmVzdWx0W2tleV0rKzsgZWxzZSByZXN1bHRba2V5XSA9IDE7XG4gIH0pO1xuXG4gIC8vIFNwbGl0IGEgY29sbGVjdGlvbiBpbnRvIHR3byBhcnJheXM6IG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgcGFzcyB0aGUgZ2l2ZW5cbiAgLy8gdHJ1dGggdGVzdCwgYW5kIG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgZG8gbm90IHBhc3MgdGhlIHRydXRoIHRlc3QuXG4gIHZhciBwYXJ0aXRpb24gPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBwYXNzKSB7XG4gICAgcmVzdWx0W3Bhc3MgPyAwIDogMV0ucHVzaCh2YWx1ZSk7XG4gIH0sIHRydWUpO1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIHZhciByZVN0clN5bWJvbCA9IC9bXlxcdWQ4MDAtXFx1ZGZmZl18W1xcdWQ4MDAtXFx1ZGJmZl1bXFx1ZGMwMC1cXHVkZmZmXXxbXFx1ZDgwMC1cXHVkZmZmXS9nO1xuICBmdW5jdGlvbiB0b0FycmF5KG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKGlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAoaXNTdHJpbmcob2JqKSkge1xuICAgICAgLy8gS2VlcCBzdXJyb2dhdGUgcGFpciBjaGFyYWN0ZXJzIHRvZ2V0aGVyLlxuICAgICAgcmV0dXJuIG9iai5tYXRjaChyZVN0clN5bWJvbCk7XG4gICAgfVxuICAgIGlmIChpc0FycmF5TGlrZShvYmopKSByZXR1cm4gbWFwKG9iaiwgaWRlbnRpdHkpO1xuICAgIHJldHVybiB2YWx1ZXMob2JqKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGEgY29sbGVjdGlvbi5cbiAgZnVuY3Rpb24gc2l6ZShvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiBpc0FycmF5TGlrZShvYmopID8gb2JqLmxlbmd0aCA6IGtleXMob2JqKS5sZW5ndGg7XG4gIH1cblxuICAvLyBJbnRlcm5hbCBgXy5waWNrYCBoZWxwZXIgZnVuY3Rpb24gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYGtleWAgaXMgYW4gZW51bWVyYWJsZVxuICAvLyBwcm9wZXJ0eSBuYW1lIG9mIGBvYmpgLlxuICBmdW5jdGlvbiBrZXlJbk9iaih2YWx1ZSwga2V5LCBvYmopIHtcbiAgICByZXR1cm4ga2V5IGluIG9iajtcbiAgfVxuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCBvbmx5IGNvbnRhaW5pbmcgdGhlIGFsbG93ZWQgcHJvcGVydGllcy5cbiAgdmFyIHBpY2sgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKG9iaiwga2V5cykge1xuICAgIHZhciByZXN1bHQgPSB7fSwgaXRlcmF0ZWUgPSBrZXlzWzBdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAoaXNGdW5jdGlvbiQxKGl0ZXJhdGVlKSkge1xuICAgICAgaWYgKGtleXMubGVuZ3RoID4gMSkgaXRlcmF0ZWUgPSBvcHRpbWl6ZUNiKGl0ZXJhdGVlLCBrZXlzWzFdKTtcbiAgICAgIGtleXMgPSBhbGxLZXlzKG9iaik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZXJhdGVlID0ga2V5SW5PYmo7XG4gICAgICBrZXlzID0gZmxhdHRlbiQxKGtleXMsIGZhbHNlLCBmYWxzZSk7XG4gICAgICBvYmogPSBPYmplY3Qob2JqKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgdmFyIHZhbHVlID0gb2JqW2tleV07XG4gICAgICBpZiAoaXRlcmF0ZWUodmFsdWUsIGtleSwgb2JqKSkgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGRpc2FsbG93ZWQgcHJvcGVydGllcy5cbiAgdmFyIG9taXQgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKG9iaiwga2V5cykge1xuICAgIHZhciBpdGVyYXRlZSA9IGtleXNbMF0sIGNvbnRleHQ7XG4gICAgaWYgKGlzRnVuY3Rpb24kMShpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gbmVnYXRlKGl0ZXJhdGVlKTtcbiAgICAgIGlmIChrZXlzLmxlbmd0aCA+IDEpIGNvbnRleHQgPSBrZXlzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXlzID0gbWFwKGZsYXR0ZW4kMShrZXlzLCBmYWxzZSwgZmFsc2UpLCBTdHJpbmcpO1xuICAgICAgaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJldHVybiAhY29udGFpbnMoa2V5cywga2V5KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBwaWNrKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpO1xuICB9KTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBsYXN0IGVudHJ5IG9mIHRoZSBhcnJheS4gRXNwZWNpYWxseSB1c2VmdWwgb25cbiAgLy8gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gYWxsIHRoZSB2YWx1ZXMgaW5cbiAgLy8gdGhlIGFycmF5LCBleGNsdWRpbmcgdGhlIGxhc3QgTi5cbiAgZnVuY3Rpb24gaW5pdGlhbChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gKG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKSkpO1xuICB9XG5cbiAgLy8gR2V0IHRoZSBmaXJzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBmaXJzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBmdW5jdGlvbiBmaXJzdChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCB8fCBhcnJheS5sZW5ndGggPCAxKSByZXR1cm4gbiA9PSBudWxsIHx8IGd1YXJkID8gdm9pZCAwIDogW107XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkgcmV0dXJuIGFycmF5WzBdO1xuICAgIHJldHVybiBpbml0aWFsKGFycmF5LCBhcnJheS5sZW5ndGggLSBuKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBgYXJyYXlgLiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYGFyZ3VtZW50c2Agb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZVxuICAvLyBgYXJyYXlgLlxuICBmdW5jdGlvbiByZXN0KGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH1cblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuXG4gIGZ1bmN0aW9uIGxhc3QoYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwgfHwgYXJyYXkubGVuZ3RoIDwgMSkgcmV0dXJuIG4gPT0gbnVsbCB8fCBndWFyZCA/IHZvaWQgMCA6IFtdO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gcmVzdChhcnJheSwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gbikpO1xuICB9XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBmdW5jdGlvbiBjb21wYWN0KGFycmF5KSB7XG4gICAgcmV0dXJuIGZpbHRlcihhcnJheSwgQm9vbGVhbik7XG4gIH1cblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IgdXAgdG8gYGRlcHRoYC5cbiAgLy8gUGFzc2luZyBgdHJ1ZWAgb3IgYGZhbHNlYCBhcyBgZGVwdGhgIG1lYW5zIGAxYCBvciBgSW5maW5pdHlgLCByZXNwZWN0aXZlbHkuXG4gIGZ1bmN0aW9uIGZsYXR0ZW4oYXJyYXksIGRlcHRoKSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4kMShhcnJheSwgZGVwdGgsIGZhbHNlKTtcbiAgfVxuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgdmFyIGRpZmZlcmVuY2UgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGFycmF5LCByZXN0KSB7XG4gICAgcmVzdCA9IGZsYXR0ZW4kMShyZXN0LCB0cnVlLCB0cnVlKTtcbiAgICByZXR1cm4gZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICByZXR1cm4gIWNvbnRhaW5zKHJlc3QsIHZhbHVlKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIHZhciB3aXRob3V0ID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihhcnJheSwgb3RoZXJBcnJheXMpIHtcbiAgICByZXR1cm4gZGlmZmVyZW5jZShhcnJheSwgb3RoZXJBcnJheXMpO1xuICB9KTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIFRoZSBmYXN0ZXIgYWxnb3JpdGhtIHdpbGwgbm90IHdvcmsgd2l0aCBhbiBpdGVyYXRlZSBpZiB0aGUgaXRlcmF0ZWVcbiAgLy8gaXMgbm90IGEgb25lLXRvLW9uZSBmdW5jdGlvbiwgc28gcHJvdmlkaW5nIGFuIGl0ZXJhdGVlIHdpbGwgZGlzYWJsZVxuICAvLyB0aGUgZmFzdGVyIGFsZ29yaXRobS5cbiAgZnVuY3Rpb24gdW5pcShhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpc0Jvb2xlYW4oaXNTb3J0ZWQpKSB7XG4gICAgICBjb250ZXh0ID0gaXRlcmF0ZWU7XG4gICAgICBpdGVyYXRlZSA9IGlzU29ydGVkO1xuICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGl0ZXJhdGVlICE9IG51bGwpIGl0ZXJhdGVlID0gY2IoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBnZXRMZW5ndGgoYXJyYXkpOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldLFxuICAgICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUgPyBpdGVyYXRlZSh2YWx1ZSwgaSwgYXJyYXkpIDogdmFsdWU7XG4gICAgICBpZiAoaXNTb3J0ZWQgJiYgIWl0ZXJhdGVlKSB7XG4gICAgICAgIGlmICghaSB8fCBzZWVuICE9PSBjb21wdXRlZCkgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICBzZWVuID0gY29tcHV0ZWQ7XG4gICAgICB9IGVsc2UgaWYgKGl0ZXJhdGVlKSB7XG4gICAgICAgIGlmICghY29udGFpbnMoc2VlbiwgY29tcHV0ZWQpKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWNvbnRhaW5zKHJlc3VsdCwgdmFsdWUpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgdmFyIHVuaW9uID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihhcnJheXMpIHtcbiAgICByZXR1cm4gdW5pcShmbGF0dGVuJDEoYXJyYXlzLCB0cnVlLCB0cnVlKSk7XG4gIH0pO1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyBldmVyeSBpdGVtIHNoYXJlZCBiZXR3ZWVuIGFsbCB0aGVcbiAgLy8gcGFzc2VkLWluIGFycmF5cy5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHZhciBhcmdzTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gZ2V0TGVuZ3RoKGFycmF5KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgICAgaWYgKGNvbnRhaW5zKHJlc3VsdCwgaXRlbSkpIGNvbnRpbnVlO1xuICAgICAgdmFyIGo7XG4gICAgICBmb3IgKGogPSAxOyBqIDwgYXJnc0xlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmICghY29udGFpbnMoYXJndW1lbnRzW2pdLCBpdGVtKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaiA9PT0gYXJnc0xlbmd0aCkgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBDb21wbGVtZW50IG9mIHppcC4gVW56aXAgYWNjZXB0cyBhbiBhcnJheSBvZiBhcnJheXMgYW5kIGdyb3Vwc1xuICAvLyBlYWNoIGFycmF5J3MgZWxlbWVudHMgb24gc2hhcmVkIGluZGljZXMuXG4gIGZ1bmN0aW9uIHVuemlwKGFycmF5KSB7XG4gICAgdmFyIGxlbmd0aCA9IGFycmF5ICYmIG1heChhcnJheSwgZ2V0TGVuZ3RoKS5sZW5ndGggfHwgMDtcbiAgICB2YXIgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBwbHVjayhhcnJheSwgaW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgdmFyIHppcCA9IHJlc3RBcmd1bWVudHModW56aXApO1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy4gUGFzc2luZyBieSBwYWlycyBpcyB0aGUgcmV2ZXJzZSBvZiBgXy5wYWlyc2AuXG4gIGZ1bmN0aW9uIG9iamVjdChsaXN0LCB2YWx1ZXMpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChsaXN0KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBhbiBpbnRlZ2VyIEFycmF5IGNvbnRhaW5pbmcgYW4gYXJpdGhtZXRpYyBwcm9ncmVzc2lvbi4gQSBwb3J0IG9mXG4gIC8vIHRoZSBuYXRpdmUgUHl0aG9uIGByYW5nZSgpYCBmdW5jdGlvbi4gU2VlXG4gIC8vIFt0aGUgUHl0aG9uIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UpLlxuICBmdW5jdGlvbiByYW5nZShzdGFydCwgc3RvcCwgc3RlcCkge1xuICAgIGlmIChzdG9wID09IG51bGwpIHtcbiAgICAgIHN0b3AgPSBzdGFydCB8fCAwO1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH1cbiAgICBpZiAoIXN0ZXApIHtcbiAgICAgIHN0ZXAgPSBzdG9wIDwgc3RhcnQgPyAtMSA6IDE7XG4gICAgfVxuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgcmFuZ2UgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgbGVuZ3RoOyBpZHgrKywgc3RhcnQgKz0gc3RlcCkge1xuICAgICAgcmFuZ2VbaWR4XSA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfVxuXG4gIC8vIENodW5rIGEgc2luZ2xlIGFycmF5IGludG8gbXVsdGlwbGUgYXJyYXlzLCBlYWNoIGNvbnRhaW5pbmcgYGNvdW50YCBvciBmZXdlclxuICAvLyBpdGVtcy5cbiAgZnVuY3Rpb24gY2h1bmsoYXJyYXksIGNvdW50KSB7XG4gICAgaWYgKGNvdW50ID09IG51bGwgfHwgY291bnQgPCAxKSByZXR1cm4gW107XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChpIDwgbGVuZ3RoKSB7XG4gICAgICByZXN1bHQucHVzaChzbGljZS5jYWxsKGFycmF5LCBpLCBpICs9IGNvdW50KSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIGZ1bmN0aW9uIGNoYWluUmVzdWx0KGluc3RhbmNlLCBvYmopIHtcbiAgICByZXR1cm4gaW5zdGFuY2UuX2NoYWluID8gXyQxKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfVxuXG4gIC8vIEFkZCB5b3VyIG93biBjdXN0b20gZnVuY3Rpb25zIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgZnVuY3Rpb24gbWl4aW4ob2JqKSB7XG4gICAgZWFjaChmdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfJDFbbmFtZV0gPSBvYmpbbmFtZV07XG4gICAgICBfJDEucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBjaGFpblJlc3VsdCh0aGlzLCBmdW5jLmFwcGx5KF8kMSwgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gXyQxO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIGBBcnJheWAgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfJDEucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgb2JqID0gdGhpcy5fd3JhcHBlZDtcbiAgICAgIGlmIChvYmogIT0gbnVsbCkge1xuICAgICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICBpZiAoKG5hbWUgPT09ICdzaGlmdCcgfHwgbmFtZSA9PT0gJ3NwbGljZScpICYmIG9iai5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgb2JqWzBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhaW5SZXN1bHQodGhpcywgb2JqKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBBZGQgYWxsIGFjY2Vzc29yIGBBcnJheWAgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8kMS5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgaWYgKG9iaiAhPSBudWxsKSBvYmogPSBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGNoYWluUmVzdWx0KHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gTmFtZWQgRXhwb3J0c1xuXG4gIHZhciBhbGxFeHBvcnRzID0ge1xuICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICBWRVJTSU9OOiBWRVJTSU9OLFxuICAgIHJlc3RBcmd1bWVudHM6IHJlc3RBcmd1bWVudHMsXG4gICAgaXNPYmplY3Q6IGlzT2JqZWN0LFxuICAgIGlzTnVsbDogaXNOdWxsLFxuICAgIGlzVW5kZWZpbmVkOiBpc1VuZGVmaW5lZCxcbiAgICBpc0Jvb2xlYW46IGlzQm9vbGVhbixcbiAgICBpc0VsZW1lbnQ6IGlzRWxlbWVudCxcbiAgICBpc1N0cmluZzogaXNTdHJpbmcsXG4gICAgaXNOdW1iZXI6IGlzTnVtYmVyLFxuICAgIGlzRGF0ZTogaXNEYXRlLFxuICAgIGlzUmVnRXhwOiBpc1JlZ0V4cCxcbiAgICBpc0Vycm9yOiBpc0Vycm9yLFxuICAgIGlzU3ltYm9sOiBpc1N5bWJvbCxcbiAgICBpc0FycmF5QnVmZmVyOiBpc0FycmF5QnVmZmVyLFxuICAgIGlzRGF0YVZpZXc6IGlzRGF0YVZpZXckMSxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24kMSxcbiAgICBpc0FyZ3VtZW50czogaXNBcmd1bWVudHMkMSxcbiAgICBpc0Zpbml0ZTogaXNGaW5pdGUkMSxcbiAgICBpc05hTjogaXNOYU4kMSxcbiAgICBpc1R5cGVkQXJyYXk6IGlzVHlwZWRBcnJheSQxLFxuICAgIGlzRW1wdHk6IGlzRW1wdHksXG4gICAgaXNNYXRjaDogaXNNYXRjaCxcbiAgICBpc0VxdWFsOiBpc0VxdWFsLFxuICAgIGlzTWFwOiBpc01hcCxcbiAgICBpc1dlYWtNYXA6IGlzV2Vha01hcCxcbiAgICBpc1NldDogaXNTZXQsXG4gICAgaXNXZWFrU2V0OiBpc1dlYWtTZXQsXG4gICAga2V5czoga2V5cyxcbiAgICBhbGxLZXlzOiBhbGxLZXlzLFxuICAgIHZhbHVlczogdmFsdWVzLFxuICAgIHBhaXJzOiBwYWlycyxcbiAgICBpbnZlcnQ6IGludmVydCxcbiAgICBmdW5jdGlvbnM6IGZ1bmN0aW9ucyxcbiAgICBtZXRob2RzOiBmdW5jdGlvbnMsXG4gICAgZXh0ZW5kOiBleHRlbmQsXG4gICAgZXh0ZW5kT3duOiBleHRlbmRPd24sXG4gICAgYXNzaWduOiBleHRlbmRPd24sXG4gICAgZGVmYXVsdHM6IGRlZmF1bHRzLFxuICAgIGNyZWF0ZTogY3JlYXRlLFxuICAgIGNsb25lOiBjbG9uZSxcbiAgICB0YXA6IHRhcCxcbiAgICBnZXQ6IGdldCxcbiAgICBoYXM6IGhhcyxcbiAgICBtYXBPYmplY3Q6IG1hcE9iamVjdCxcbiAgICBpZGVudGl0eTogaWRlbnRpdHksXG4gICAgY29uc3RhbnQ6IGNvbnN0YW50LFxuICAgIG5vb3A6IG5vb3AsXG4gICAgdG9QYXRoOiB0b1BhdGgkMSxcbiAgICBwcm9wZXJ0eTogcHJvcGVydHksXG4gICAgcHJvcGVydHlPZjogcHJvcGVydHlPZixcbiAgICBtYXRjaGVyOiBtYXRjaGVyLFxuICAgIG1hdGNoZXM6IG1hdGNoZXIsXG4gICAgdGltZXM6IHRpbWVzLFxuICAgIHJhbmRvbTogcmFuZG9tLFxuICAgIG5vdzogbm93LFxuICAgIGVzY2FwZTogX2VzY2FwZSxcbiAgICB1bmVzY2FwZTogX3VuZXNjYXBlLFxuICAgIHRlbXBsYXRlU2V0dGluZ3M6IHRlbXBsYXRlU2V0dGluZ3MsXG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIHJlc3VsdDogcmVzdWx0LFxuICAgIHVuaXF1ZUlkOiB1bmlxdWVJZCxcbiAgICBjaGFpbjogY2hhaW4sXG4gICAgaXRlcmF0ZWU6IGl0ZXJhdGVlLFxuICAgIHBhcnRpYWw6IHBhcnRpYWwsXG4gICAgYmluZDogYmluZCxcbiAgICBiaW5kQWxsOiBiaW5kQWxsLFxuICAgIG1lbW9pemU6IG1lbW9pemUsXG4gICAgZGVsYXk6IGRlbGF5LFxuICAgIGRlZmVyOiBkZWZlcixcbiAgICB0aHJvdHRsZTogdGhyb3R0bGUsXG4gICAgZGVib3VuY2U6IGRlYm91bmNlLFxuICAgIHdyYXA6IHdyYXAsXG4gICAgbmVnYXRlOiBuZWdhdGUsXG4gICAgY29tcG9zZTogY29tcG9zZSxcbiAgICBhZnRlcjogYWZ0ZXIsXG4gICAgYmVmb3JlOiBiZWZvcmUsXG4gICAgb25jZTogb25jZSxcbiAgICBmaW5kS2V5OiBmaW5kS2V5LFxuICAgIGZpbmRJbmRleDogZmluZEluZGV4LFxuICAgIGZpbmRMYXN0SW5kZXg6IGZpbmRMYXN0SW5kZXgsXG4gICAgc29ydGVkSW5kZXg6IHNvcnRlZEluZGV4LFxuICAgIGluZGV4T2Y6IGluZGV4T2YsXG4gICAgbGFzdEluZGV4T2Y6IGxhc3RJbmRleE9mLFxuICAgIGZpbmQ6IGZpbmQsXG4gICAgZGV0ZWN0OiBmaW5kLFxuICAgIGZpbmRXaGVyZTogZmluZFdoZXJlLFxuICAgIGVhY2g6IGVhY2gsXG4gICAgZm9yRWFjaDogZWFjaCxcbiAgICBtYXA6IG1hcCxcbiAgICBjb2xsZWN0OiBtYXAsXG4gICAgcmVkdWNlOiByZWR1Y2UsXG4gICAgZm9sZGw6IHJlZHVjZSxcbiAgICBpbmplY3Q6IHJlZHVjZSxcbiAgICByZWR1Y2VSaWdodDogcmVkdWNlUmlnaHQsXG4gICAgZm9sZHI6IHJlZHVjZVJpZ2h0LFxuICAgIGZpbHRlcjogZmlsdGVyLFxuICAgIHNlbGVjdDogZmlsdGVyLFxuICAgIHJlamVjdDogcmVqZWN0LFxuICAgIGV2ZXJ5OiBldmVyeSxcbiAgICBhbGw6IGV2ZXJ5LFxuICAgIHNvbWU6IHNvbWUsXG4gICAgYW55OiBzb21lLFxuICAgIGNvbnRhaW5zOiBjb250YWlucyxcbiAgICBpbmNsdWRlczogY29udGFpbnMsXG4gICAgaW5jbHVkZTogY29udGFpbnMsXG4gICAgaW52b2tlOiBpbnZva2UsXG4gICAgcGx1Y2s6IHBsdWNrLFxuICAgIHdoZXJlOiB3aGVyZSxcbiAgICBtYXg6IG1heCxcbiAgICBtaW46IG1pbixcbiAgICBzaHVmZmxlOiBzaHVmZmxlLFxuICAgIHNhbXBsZTogc2FtcGxlLFxuICAgIHNvcnRCeTogc29ydEJ5LFxuICAgIGdyb3VwQnk6IGdyb3VwQnksXG4gICAgaW5kZXhCeTogaW5kZXhCeSxcbiAgICBjb3VudEJ5OiBjb3VudEJ5LFxuICAgIHBhcnRpdGlvbjogcGFydGl0aW9uLFxuICAgIHRvQXJyYXk6IHRvQXJyYXksXG4gICAgc2l6ZTogc2l6ZSxcbiAgICBwaWNrOiBwaWNrLFxuICAgIG9taXQ6IG9taXQsXG4gICAgZmlyc3Q6IGZpcnN0LFxuICAgIGhlYWQ6IGZpcnN0LFxuICAgIHRha2U6IGZpcnN0LFxuICAgIGluaXRpYWw6IGluaXRpYWwsXG4gICAgbGFzdDogbGFzdCxcbiAgICByZXN0OiByZXN0LFxuICAgIHRhaWw6IHJlc3QsXG4gICAgZHJvcDogcmVzdCxcbiAgICBjb21wYWN0OiBjb21wYWN0LFxuICAgIGZsYXR0ZW46IGZsYXR0ZW4sXG4gICAgd2l0aG91dDogd2l0aG91dCxcbiAgICB1bmlxOiB1bmlxLFxuICAgIHVuaXF1ZTogdW5pcSxcbiAgICB1bmlvbjogdW5pb24sXG4gICAgaW50ZXJzZWN0aW9uOiBpbnRlcnNlY3Rpb24sXG4gICAgZGlmZmVyZW5jZTogZGlmZmVyZW5jZSxcbiAgICB1bnppcDogdW56aXAsXG4gICAgdHJhbnNwb3NlOiB1bnppcCxcbiAgICB6aXA6IHppcCxcbiAgICBvYmplY3Q6IG9iamVjdCxcbiAgICByYW5nZTogcmFuZ2UsXG4gICAgY2h1bms6IGNodW5rLFxuICAgIG1peGluOiBtaXhpbixcbiAgICAnZGVmYXVsdCc6IF8kMVxuICB9O1xuXG4gIC8vIERlZmF1bHQgRXhwb3J0XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICB2YXIgXyA9IG1peGluKGFsbEV4cG9ydHMpO1xuICAvLyBMZWdhY3kgTm9kZS5qcyBBUEkuXG4gIF8uXyA9IF87XG5cbiAgcmV0dXJuIF87XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD11bmRlcnNjb3JlLXVtZC5qcy5tYXBcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuX193ZWJwYWNrX3JlcXVpcmVfXy5uID0gKG1vZHVsZSkgPT4ge1xuXHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cblx0XHQoKSA9PiAobW9kdWxlWydkZWZhdWx0J10pIDpcblx0XHQoKSA9PiAobW9kdWxlKTtcblx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgeyBhOiBnZXR0ZXIgfSk7XG5cdHJldHVybiBnZXR0ZXI7XG59OyIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18uZyA9IChmdW5jdGlvbigpIHtcblx0aWYgKHR5cGVvZiBnbG9iYWxUaGlzID09PSAnb2JqZWN0JykgcmV0dXJuIGdsb2JhbFRoaXM7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIHRoaXMgfHwgbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHJldHVybiB3aW5kb3c7XG5cdH1cbn0pKCk7IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsIi8vIGltcG9ydCBcIi4vbW9kdWxlLnNjc3NcIjtcblxuaW1wb3J0IHsgVGVtcGxhdGVQcmVsb2FkZXIgfSBmcm9tIFwiLi9tb2R1bGUvaGVscGVyL1RlbXBsYXRlUHJlbG9hZGVyXCI7XG5cbmltcG9ydCBNYXJrZG93bkl0IGZyb20gXCJtYXJrZG93bi1pdFwiO1xuXG5pbXBvcnQgYWRkRXh0cmFzIGZyb20gXCIuL2FkZEV4dHJhc1wiO1xuXG4vLyBVc2UgcHJldHR5IHF1b3Rlc1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUVkaXRvclwiLCBhc3luYyAob3B0aW9uczogTWFya2Rvd25JdC5PcHRpb25zKSA9PiB7XG4gIG9wdGlvbnMudHlwb2dyYXBoZXIgPSB0cnVlO1xuICByZXR1cm4gb3B0aW9ucztcbn0pO1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUNoYXRcIiwgYXN5bmMgKG9wdGlvbnM6IE1hcmtkb3duSXQuT3B0aW9ucykgPT4ge1xuICBvcHRpb25zLnR5cG9ncmFwaGVyID0gdHJ1ZTtcbiAgcmV0dXJuIG9wdGlvbnM7XG59KTtcbkhvb2tzLm9uY2UoXCJpbml0XCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgeyBtYXJrZG93bkl0IH0gPSB3aW5kb3cuTUVNRTtcblxuICBhZGRFeHRyYXMobWFya2Rvd25JdCk7XG59KTtcblxuSG9va3Mub25jZShcIk1lbWVSZW5kZXJFZGl0b3JcIiwgYXN5bmMgKGEsIGIpID0+IHtcbiAgY29uc29sZS5sb2coXCJtYXJrZG93bi1lZGl0b3ItZXh0cmFzIGhlYXJkIE1lbWVSZW5kZXJFZGl0b3IgZXZlbnQuXCIsIGEsIGIpO1xufSk7XG5cbkhvb2tzLm9uY2UoXCJyZWFkeVwiLCBhc3luYyAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKFwibWFya2Rvd24tZWRpdG9yLWV4dHJhcyByZWFkeVwiKTtcbn0pO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIikge1xuICBpZiAobW9kdWxlLmhvdCkge1xuICAgIG1vZHVsZS5ob3QuYWNjZXB0KCk7XG5cbiAgICBpZiAobW9kdWxlLmhvdC5zdGF0dXMoKSA9PT0gXCJhcHBseVwiKSB7XG4gICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIGluIF90ZW1wbGF0ZUNhY2hlKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoX3RlbXBsYXRlQ2FjaGUsIHRlbXBsYXRlKSkge1xuICAgICAgICAgIGRlbGV0ZSBfdGVtcGxhdGVDYWNoZVt0ZW1wbGF0ZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgVGVtcGxhdGVQcmVsb2FkZXIucHJlbG9hZEhhbmRsZWJhcnNUZW1wbGF0ZXMoKS50aGVuKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHBsaWNhdGlvbiBpbiB1aS53aW5kb3dzKSB7XG4gICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh1aS53aW5kb3dzLCBhcHBsaWNhdGlvbikpIHtcbiAgICAgICAgICAgIHVpLndpbmRvd3NbYXBwbGljYXRpb25dLnJlbmRlcih0cnVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==