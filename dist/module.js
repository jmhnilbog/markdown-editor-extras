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
/* harmony import */ var markdown_it_mark__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! markdown-it-mark */ "./node_modules/markdown-it-mark/index.js");
/* harmony import */ var markdown_it_mark__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(markdown_it_mark__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! markdown-it-multimd-table */ "./node_modules/markdown-it-multimd-table/index.js");
/* harmony import */ var markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var markdown_it_underline__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! markdown-it-underline */ "./node_modules/markdown-it-underline/index.js");
/* harmony import */ var markdown_it_underline__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(markdown_it_underline__WEBPACK_IMPORTED_MODULE_7__);





// import * as markdownItFootnote from "markdown-it-footnote";
// import markdownItHTML5Embed from "markdown-it-html5-embed";
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
    // md.use(markdownItHTML5Embed);
    md.use((markdown_it_mark__WEBPACK_IMPORTED_MODULE_5___default()));
    md.use((markdown_it_multimd_table__WEBPACK_IMPORTED_MODULE_6___default()));
    md.use((markdown_it_underline__WEBPACK_IMPORTED_MODULE_7___default()));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtYXR0cnMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWF0dHJzL3BhdHRlcm5zLmpzIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1hdHRycy91dGlscy5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtY2hlY2tib3gvaW5kZXguanMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWNvbnRhaW5lci9pbmRleC5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtZGVmbGlzdC9pbmRleC5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtZW1vamkvYmFyZS5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtZW1vamkvaW5kZXguanMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWVtb2ppL2xpYi9kYXRhL3Nob3J0Y3V0cy5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtZW1vamkvbGliL25vcm1hbGl6ZV9vcHRzLmpzIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1lbW9qaS9saWIvcmVuZGVyLmpzIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1lbW9qaS9saWIvcmVwbGFjZS5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtbWFyay9pbmRleC5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtbXVsdGltZC10YWJsZS9pbmRleC5qcyIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtbXVsdGltZC10YWJsZS9saWIvZGZhLmpzIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC11bmRlcmxpbmUvaW5kZXguanMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vc3RhdGljL3RlbXBsYXRlcy9ibGFuay5odG1sIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL3NyYy9hZGRFeHRyYXMudHMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vc3JjL21vZHVsZS9oZWxwZXIvVGVtcGxhdGVQcmVsb2FkZXIudHMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhLy4vbm9kZV9tb2R1bGVzL3VuZGVyc2NvcmUvdW5kZXJzY29yZS11bWQuanMiLCJ3ZWJwYWNrOi8vc2FpbG9ycy1vbi10aGUtc3Rhcmxlc3Mtc2VhL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS93ZWJwYWNrL3J1bnRpbWUvY29tcGF0IGdldCBkZWZhdWx0IGV4cG9ydCIsIndlYnBhY2s6Ly9zYWlsb3JzLW9uLXRoZS1zdGFybGVzcy1zZWEvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS93ZWJwYWNrL3J1bnRpbWUvZ2xvYmFsIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3NhaWxvcnMtb24tdGhlLXN0YXJsZXNzLXNlYS8uL3NyYy9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBYTs7QUFFYix1QkFBdUIsbUJBQU8sQ0FBQyxtRUFBZTs7QUFFOUM7QUFDQSxtQkFBbUI7QUFDbkIsb0JBQW9CO0FBQ3BCO0FBQ0E7O0FBRUE7QUFDQSxnQ0FBZ0M7QUFDaEM7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQSxtQkFBbUIsbUJBQW1CO0FBQ3RDLHFCQUFxQixxQkFBcUI7QUFDMUM7QUFDQSxxQkFBcUI7QUFDckI7QUFDQTtBQUNBLCtCQUErQixXQUFXO0FBQzFDO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsV0FBVyxNQUFNO0FBQ2pCLFdBQVcsT0FBTztBQUNsQixXQUFXLE9BQU87QUFDbEIsWUFBWSxPQUFPLEVBQUU7QUFDckI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLDhCQUE4Qjs7O0FBRzlCLDRCQUE0QixZQUFZOztBQUV4QztB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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFNLEtBQXdCO0FBQzlCO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9DQUFvQyxPQUFPO0FBQzNDO0FBQ0EsK0JBQStCLGtCQUFrQixFQUFFO0FBQ25EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsbUJBQW1CLFlBQVk7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2RUFBNkU7QUFDN0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxx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O0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsWUFBWTtBQUMxRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0wsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPLGVBQWU7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsWUFBWTtBQUMxRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBOEMsWUFBWTtBQUMxRDtBQUNBO0FBQ0E7QUFDQSxpQkFBaUIsZ0JBQWdCO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHVCQUF1QixnQkFBZ0I7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2Q0FBNkMsWUFBWTtBQUN6RDtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBLHFCQUFxQixjQUFjO0FBQ25DO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBLENBQUM7QUFDRDs7Ozs7OztVQ3ovREE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7V0N0QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLGdDQUFnQyxZQUFZO1dBQzVDO1dBQ0EsRTs7Ozs7V0NQQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLHdDQUF3Qyx5Q0FBeUM7V0FDakY7V0FDQTtXQUNBLEU7Ozs7O1dDUEE7V0FDQTtXQUNBO1dBQ0E7V0FDQSxFQUFFO1dBQ0Y7V0FDQTtXQUNBLENBQUMsSTs7Ozs7V0NQRCx3Rjs7Ozs7V0NBQTtXQUNBO1dBQ0E7V0FDQSxzREFBc0Qsa0JBQWtCO1dBQ3hFO1dBQ0EsK0NBQStDLGNBQWM7V0FDN0QsRTs7Ozs7Ozs7Ozs7Ozs7QUNOQSwwQkFBMEI7QUFFNEM7QUFJbEM7QUFFcEMsb0JBQW9CO0FBQ3BCLEtBQUssQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxFQUFFLE9BQTJCLEVBQUUsRUFBRTtJQUNyRSxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMzQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDLENBQUMsQ0FBQztBQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLE9BQTJCLEVBQUUsRUFBRTtJQUNuRSxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMzQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDLENBQUMsQ0FBQztBQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssSUFBSSxFQUFFO0lBQzVCLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0lBRW5DLG1EQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDeEIsQ0FBQyxDQUFDLENBQUM7QUFFSCxLQUFLLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzREFBc0QsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUUsQ0FBQyxDQUFDLENBQUM7QUFFSCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLElBQUksRUFBRTtJQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLElBQXNDLEVBQUU7SUFDMUMsSUFBSSxLQUFVLEVBQUUsRUFrQmY7Q0FDRiIsImZpbGUiOiJtb2R1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdHRlcm5zQ29uZmlnID0gcmVxdWlyZSgnLi9wYXR0ZXJucy5qcycpO1xuXG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgbGVmdERlbGltaXRlcjogJ3snLFxuICByaWdodERlbGltaXRlcjogJ30nLFxuICBhbGxvd2VkQXR0cmlidXRlczogW11cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXR0cmlidXRlcyhtZCwgb3B0aW9uc18pIHtcbiAgbGV0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKG9wdGlvbnMsIG9wdGlvbnNfKTtcblxuICBjb25zdCBwYXR0ZXJucyA9IHBhdHRlcm5zQ29uZmlnKG9wdGlvbnMpO1xuXG4gIGZ1bmN0aW9uIGN1cmx5QXR0cnMoc3RhdGUpIHtcbiAgICBsZXQgdG9rZW5zID0gc3RhdGUudG9rZW5zO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IHAgPSAwOyBwIDwgcGF0dGVybnMubGVuZ3RoOyBwKyspIHtcbiAgICAgICAgbGV0IHBhdHRlcm4gPSBwYXR0ZXJuc1twXTtcbiAgICAgICAgbGV0IGogPSBudWxsOyAvLyBwb3NpdGlvbiBvZiBjaGlsZCB3aXRoIG9mZnNldCAwXG4gICAgICAgIGxldCBtYXRjaCA9IHBhdHRlcm4udGVzdHMuZXZlcnkodCA9PiB7XG4gICAgICAgICAgbGV0IHJlcyA9IHRlc3QodG9rZW5zLCBpLCB0KTtcbiAgICAgICAgICBpZiAocmVzLmogIT09IG51bGwpIHsgaiA9IHJlcy5qOyB9XG4gICAgICAgICAgcmV0dXJuIHJlcy5tYXRjaDtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHBhdHRlcm4udHJhbnNmb3JtKHRva2VucywgaSwgaik7XG4gICAgICAgICAgaWYgKHBhdHRlcm4ubmFtZSA9PT0gJ2lubGluZSBhdHRyaWJ1dGVzJyB8fCBwYXR0ZXJuLm5hbWUgPT09ICdpbmxpbmUgbmVzdGluZyAwJykge1xuICAgICAgICAgICAgLy8gcmV0cnksIG1heSBiZSBzZXZlcmFsIGlubGluZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBwLS07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbWQuY29yZS5ydWxlci5iZWZvcmUoJ2xpbmtpZnknLCAnY3VybHlfYXR0cmlidXRlcycsIGN1cmx5QXR0cnMpO1xufTtcblxuLyoqXG4gKiBUZXN0IGlmIHQgbWF0Y2hlcyB0b2tlbiBzdHJlYW0uXG4gKlxuICogQHBhcmFtIHthcnJheX0gdG9rZW5zXG4gKiBAcGFyYW0ge251bWJlcn0gaVxuICogQHBhcmFtIHtvYmplY3R9IHQgVGVzdCB0byBtYXRjaC5cbiAqIEByZXR1cm4ge29iamVjdH0geyBtYXRjaDogdHJ1ZXxmYWxzZSwgajogbnVsbHxudW1iZXIgfVxuICovXG5mdW5jdGlvbiB0ZXN0KHRva2VucywgaSwgdCkge1xuICBsZXQgcmVzID0ge1xuICAgIG1hdGNoOiBmYWxzZSxcbiAgICBqOiBudWxsICAvLyBwb3NpdGlvbiBvZiBjaGlsZFxuICB9O1xuXG4gIGxldCBpaSA9IHQuc2hpZnQgIT09IHVuZGVmaW5lZFxuICAgID8gaSArIHQuc2hpZnRcbiAgICA6IHQucG9zaXRpb247XG4gIGxldCB0b2tlbiA9IGdldCh0b2tlbnMsIGlpKTsgIC8vIHN1cHBvcnRzIG5lZ2F0aXZlIGlpXG5cblxuICBpZiAodG9rZW4gPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gcmVzOyB9XG5cbiAgZm9yIChsZXQga2V5IGluIHQpIHtcbiAgICBpZiAoa2V5ID09PSAnc2hpZnQnIHx8IGtleSA9PT0gJ3Bvc2l0aW9uJykgeyBjb250aW51ZTsgfVxuXG4gICAgaWYgKHRva2VuW2tleV0gPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gcmVzOyB9XG5cbiAgICBpZiAoa2V5ID09PSAnY2hpbGRyZW4nICYmIGlzQXJyYXlPZk9iamVjdHModC5jaGlsZHJlbikpIHtcbiAgICAgIGlmICh0b2tlbi5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICAgIGxldCBtYXRjaDtcbiAgICAgIGxldCBjaGlsZFRlc3RzID0gdC5jaGlsZHJlbjtcbiAgICAgIGxldCBjaGlsZHJlbiA9IHRva2VuLmNoaWxkcmVuO1xuICAgICAgaWYgKGNoaWxkVGVzdHMuZXZlcnkodHQgPT4gdHQucG9zaXRpb24gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gcG9zaXRpb25zIGluc3RlYWQgb2Ygc2hpZnRzLCBkbyBub3QgbG9vcCBhbGwgY2hpbGRyZW5cbiAgICAgICAgbWF0Y2ggPSBjaGlsZFRlc3RzLmV2ZXJ5KHR0ID0+IHRlc3QoY2hpbGRyZW4sIHR0LnBvc2l0aW9uLCB0dCkubWF0Y2gpO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAvLyB3ZSBtYXkgbmVlZCBwb3NpdGlvbiBvZiBjaGlsZCBpbiB0cmFuc2Zvcm1cbiAgICAgICAgICBsZXQgaiA9IGxhc3QoY2hpbGRUZXN0cykucG9zaXRpb247XG4gICAgICAgICAgcmVzLmogPSBqID49IDAgPyBqIDogY2hpbGRyZW4ubGVuZ3RoICsgajtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjaGlsZHJlbi5sZW5ndGg7IGorKykge1xuICAgICAgICAgIG1hdGNoID0gY2hpbGRUZXN0cy5ldmVyeSh0dCA9PiB0ZXN0KGNoaWxkcmVuLCBqLCB0dCkubWF0Y2gpO1xuICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgcmVzLmogPSBqO1xuICAgICAgICAgICAgLy8gYWxsIHRlc3RzIHRydWUsIGNvbnRpbnVlIHdpdGggbmV4dCBrZXkgb2YgcGF0dGVybiB0XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG1hdGNoID09PSBmYWxzZSkgeyByZXR1cm4gcmVzOyB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN3aXRjaCAodHlwZW9mIHRba2V5XSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIGlmICh0b2tlbltrZXldICE9PSB0W2tleV0pIHsgcmV0dXJuIHJlczsgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgaWYgKCF0W2tleV0odG9rZW5ba2V5XSkpIHsgcmV0dXJuIHJlczsgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGlmIChpc0FycmF5T2ZGdW5jdGlvbnModFtrZXldKSkge1xuICAgICAgICBsZXQgciA9IHRba2V5XS5ldmVyeSh0dCA9PiB0dCh0b2tlbltrZXldKSk7XG4gICAgICAgIGlmIChyID09PSBmYWxzZSkgeyByZXR1cm4gcmVzOyB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIC8vIGZhbGwgdGhyb3VnaCBmb3Igb2JqZWN0cyAhPT0gYXJyYXlzIG9mIGZ1bmN0aW9uc1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHlwZSBvZiBwYXR0ZXJuIHRlc3QgKGtleTogJHtrZXl9KS4gVGVzdCBzaG91bGQgYmUgb2YgdHlwZSBib29sZWFuLCBudW1iZXIsIHN0cmluZywgZnVuY3Rpb24gb3IgYXJyYXkgb2YgZnVuY3Rpb25zLmApO1xuICAgIH1cbiAgfVxuXG4gIC8vIG5vIHRlc3RzIHJldHVybmVkIGZhbHNlIC0+IGFsbCB0ZXN0cyByZXR1cm5zIHRydWVcbiAgcmVzLm1hdGNoID0gdHJ1ZTtcbiAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gaXNBcnJheU9mT2JqZWN0cyhhcnIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXJyKSAmJiBhcnIubGVuZ3RoICYmIGFyci5ldmVyeShpID0+IHR5cGVvZiBpID09PSAnb2JqZWN0Jyk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPZkZ1bmN0aW9ucyhhcnIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXJyKSAmJiBhcnIubGVuZ3RoICYmIGFyci5ldmVyeShpID0+IHR5cGVvZiBpID09PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBHZXQgbiBpdGVtIG9mIGFycmF5LiBTdXBwb3J0cyBuZWdhdGl2ZSBuLCB3aGVyZSAtMSBpcyBsYXN0XG4gKiBlbGVtZW50IGluIGFycmF5LlxuICogQHBhcmFtIHthcnJheX0gYXJyXG4gKiBAcGFyYW0ge251bWJlcn0gblxuICovXG5mdW5jdGlvbiBnZXQoYXJyLCBuKSB7XG4gIHJldHVybiBuID49IDAgPyBhcnJbbl0gOiBhcnJbYXJyLmxlbmd0aCArIG5dO1xufVxuXG4vLyBnZXQgbGFzdCBlbGVtZW50IG9mIGFycmF5LCBzYWZlIC0gcmV0dXJucyB7fSBpZiBub3QgZm91bmRcbmZ1bmN0aW9uIGxhc3QoYXJyKSB7XG4gIHJldHVybiBhcnIuc2xpY2UoLTEpWzBdIHx8IHt9O1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLyoqXG4gKiBJZiBhIHBhdHRlcm4gbWF0Y2hlcyB0aGUgdG9rZW4gc3RyZWFtLFxuICogdGhlbiBydW4gdHJhbnNmb3JtLlxuICovXG5cbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscy5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9wdGlvbnMgPT4ge1xuICBjb25zdCBfX2hyID0gbmV3IFJlZ0V4cCgnXiB7MCwzfVstKl9dezMsfSA/J1xuICAgICAgICAgICAgICAgICAgICAgICAgICArIHV0aWxzLmVzY2FwZVJlZ0V4cChvcHRpb25zLmxlZnREZWxpbWl0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICsgJ1teJyArIHV0aWxzLmVzY2FwZVJlZ0V4cChvcHRpb25zLnJpZ2h0RGVsaW1pdGVyKSArICddJyk7XG5cbiAgcmV0dXJuIChbXG4gICAge1xuICAgICAgLyoqXG4gICAgICAgKiBgYGBweXRob24gey5jbHN9XG4gICAgICAgKiBmb3IgaSBpbiByYW5nZSgxMCk6XG4gICAgICAgKiAgICAgcHJpbnQoaSlcbiAgICAgICAqIGBgYFxuICAgICAgICovXG4gICAgICBuYW1lOiAnZmVuY2VkIGNvZGUgYmxvY2tzJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICBibG9jazogdHJ1ZSxcbiAgICAgICAgICBpbmZvOiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdlbmQnLCBvcHRpb25zKVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgbGV0IHN0YXJ0ID0gdG9rZW4uaW5mby5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpO1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyh0b2tlbi5pbmZvLCBzdGFydCwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCB0b2tlbik7XG4gICAgICAgIHRva2VuLmluZm8gPSB1dGlscy5yZW1vdmVEZWxpbWl0ZXIodG9rZW4uaW5mbywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiBibGEgYGNsaWNrKClgey5jfSAhW10oaW1nLnBuZyl7LmR9XG4gICAgICAgKlxuICAgICAgICogZGlmZmVycyBmcm9tICdpbmxpbmUgYXR0cmlidXRlcycgYXMgaXQgZG9lc1xuICAgICAgICogbm90IGhhdmUgYSBjbG9zaW5nIHRhZyAobmVzdGluZzogLTEpXG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdpbmxpbmUgbmVzdGluZyAwJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaGlmdDogLTEsXG4gICAgICAgICAgICAgIHR5cGU6IChzdHIpID0+IHN0ciA9PT0gJ2ltYWdlJyB8fCBzdHIgPT09ICdjb2RlX2lubGluZSdcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnc3RhcnQnLCBvcHRpb25zKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSwgaikgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW5bal07XG4gICAgICAgIGxldCBlbmRDaGFyID0gdG9rZW4uY29udGVudC5pbmRleE9mKG9wdGlvbnMucmlnaHREZWxpbWl0ZXIpO1xuICAgICAgICBsZXQgYXR0clRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2ogLSAxXTtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnModG9rZW4uY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBhdHRyVG9rZW4pO1xuICAgICAgICBpZiAodG9rZW4uY29udGVudC5sZW5ndGggPT09IChlbmRDaGFyICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpKSB7XG4gICAgICAgICAgdG9rZW5zW2ldLmNoaWxkcmVuLnNwbGljZShqLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b2tlbi5jb250ZW50ID0gdG9rZW4uY29udGVudC5zbGljZShlbmRDaGFyICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiB8IGgxIHxcbiAgICAgICAqIHwgLS0gfFxuICAgICAgICogfCBjMSB8XG4gICAgICAgKlxuICAgICAgICogey5jfVxuICAgICAgICovXG4gICAgICBuYW1lOiAndGFibGVzJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBsZXQgdGhpcyB0b2tlbiBiZSBpLCBzdWNoIHRoYXQgZm9yLWxvb3AgY29udGludWVzIGF0XG4gICAgICAgICAgLy8gbmV4dCB0b2tlbiBhZnRlciB0b2tlbnMuc3BsaWNlXG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ3RhYmxlX2Nsb3NlJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDEsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDIsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGkpID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2kgKyAyXTtcbiAgICAgICAgbGV0IHRhYmxlT3BlbiA9IHV0aWxzLmdldE1hdGNoaW5nT3BlbmluZ1Rva2VuKHRva2VucywgaSk7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKHRva2VuLmNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICAvLyBhZGQgYXR0cmlidXRlc1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdGFibGVPcGVuKTtcbiAgICAgICAgLy8gcmVtb3ZlIDxwPnsuY308L3A+XG4gICAgICAgIHRva2Vucy5zcGxpY2UoaSArIDEsIDMpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogKmVtcGhhc2lzKnsud2l0aCBhdHRycz0xfVxuICAgICAgICovXG4gICAgICBuYW1lOiAnaW5saW5lIGF0dHJpYnV0ZXMnLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNoaWZ0OiAtMSxcbiAgICAgICAgICAgICAgbmVzdGluZzogLTEgIC8vIGNsb3NpbmcgaW5saW5lIHRhZywgPC9lbT57LmF9XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ3N0YXJ0Jywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zW2ldLmNoaWxkcmVuLCBqIC0gMSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gY29udGVudC5zbGljZShjb250ZW50LmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlcikgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiAtIGl0ZW1cbiAgICAgICAqIHsuYX1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3Qgc29mdGJyZWFrJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogLTIsXG4gICAgICAgICAgdHlwZTogJ2xpc3RfaXRlbV9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0yLFxuICAgICAgICAgICAgICB0eXBlOiAnc29mdGJyZWFrJ1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTEsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgbGV0IGlpID0gaSAtIDI7XG4gICAgICAgIHdoaWxlICh0b2tlbnNbaWkgLSAxXSAmJlxuICAgICAgICAgIHRva2Vuc1tpaSAtIDFdLnR5cGUgIT09ICdvcmRlcmVkX2xpc3Rfb3BlbicgJiZcbiAgICAgICAgICB0b2tlbnNbaWkgLSAxXS50eXBlICE9PSAnYnVsbGV0X2xpc3Rfb3BlbicpIHsgaWktLTsgfVxuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdG9rZW5zW2lpIC0gMV0pO1xuICAgICAgICB0b2tlbnNbaV0uY2hpbGRyZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW4uc2xpY2UoMCwgLTIpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogLSBuZXN0ZWQgbGlzdFxuICAgICAgICogICAtIHdpdGggZG91YmxlIFxcblxuICAgICAgICogICB7LmF9IDwtLSBhcHBseSB0byBuZXN0ZWQgdWxcbiAgICAgICAqXG4gICAgICAgKiB7LmJ9IDwtLSBhcHBseSB0byByb290IDx1bD5cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3QgZG91YmxlIHNvZnRicmVhaycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gbGV0IHRoaXMgdG9rZW4gYmUgaSA9IDAgc28gdGhhdCB3ZSBjYW4gZXJhc2VcbiAgICAgICAgICAvLyB0aGUgPHA+ey5hfTwvcD4gdG9rZW5zIGJlbG93XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogKHN0cikgPT5cbiAgICAgICAgICAgIHN0ciA9PT0gJ2J1bGxldF9saXN0X2Nsb3NlJyB8fFxuICAgICAgICAgICAgc3RyID09PSAnb3JkZXJlZF9saXN0X2Nsb3NlJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDEsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDIsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpLFxuICAgICAgICAgIGNoaWxkcmVuOiAoYXJyKSA9PiBhcnIubGVuZ3RoID09PSAxXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBzaGlmdDogMyxcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX2Nsb3NlJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpICsgMl07XG4gICAgICAgIGxldCBjb250ZW50ID0gdG9rZW4uY29udGVudDtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnMoY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBvcGVuaW5nVG9rZW4gPSB1dGlscy5nZXRNYXRjaGluZ09wZW5pbmdUb2tlbih0b2tlbnMsIGkpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgb3BlbmluZ1Rva2VuKTtcbiAgICAgICAgdG9rZW5zLnNwbGljZShpICsgMSwgMyk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiAtIGVuZCBvZiB7Lmxpc3QtaXRlbX1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3QgaXRlbSBlbmQnLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNoaWZ0OiAtMixcbiAgICAgICAgICB0eXBlOiAnbGlzdF9pdGVtX29wZW4nXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTEsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnZW5kJywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCB0b2tlbnNbaSAtIDJdKTtcbiAgICAgICAgbGV0IHRyaW1tZWQgPSBjb250ZW50LnNsaWNlKDAsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSk7XG4gICAgICAgIHRva2VuLmNvbnRlbnQgPSBsYXN0KHRyaW1tZWQpICE9PSAnICcgP1xuICAgICAgICAgIHRyaW1tZWQgOiB0cmltbWVkLnNsaWNlKDAsIC0xKTtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICAvKipcbiAgICAgICAqIHNvbWV0aGluZyB3aXRoIHNvZnRicmVha1xuICAgICAgICogey5jbHN9XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdcXG57LmF9IHNvZnRicmVhayB0aGVuIGN1cmx5IGluIHN0YXJ0JyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTIsXG4gICAgICAgICAgICAgIHR5cGU6ICdzb2Z0YnJlYWsnXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAtMSxcbiAgICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgICBjb250ZW50OiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdvbmx5Jywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyh0b2tlbi5jb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgLy8gZmluZCBsYXN0IGNsb3NpbmcgdGFnXG4gICAgICAgIGxldCBpaSA9IGkgKyAxO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2lpICsgMV0gJiYgdG9rZW5zW2lpICsgMV0ubmVzdGluZyA9PT0gLTEpIHsgaWkrKzsgfVxuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zLCBpaSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICB0b2tlbnNbaV0uY2hpbGRyZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW4uc2xpY2UoMCwgLTIpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogaG9yaXpvbnRhbCBydWxlIC0tLSB7I2lkfVxuICAgICAgICovXG4gICAgICBuYW1lOiAnaG9yaXpvbnRhbCBydWxlJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX29wZW4nXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMSxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogKGFycikgPT4gYXJyLmxlbmd0aCA9PT0gMSxcbiAgICAgICAgICBjb250ZW50OiAoc3RyKSA9PiBzdHIubWF0Y2goX19ocikgIT09IG51bGwsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMixcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX2Nsb3NlJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgdG9rZW4udHlwZSA9ICdocic7XG4gICAgICAgIHRva2VuLnRhZyA9ICdocic7XG4gICAgICAgIHRva2VuLm5lc3RpbmcgPSAwO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2Vuc1tpICsgMV0uY29udGVudDtcbiAgICAgICAgbGV0IHN0YXJ0ID0gY29udGVudC5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpO1xuICAgICAgICB0b2tlbi5hdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIHN0YXJ0LCBvcHRpb25zKTtcbiAgICAgICAgdG9rZW4ubWFya3VwID0gY29udGVudDtcbiAgICAgICAgdG9rZW5zLnNwbGljZShpICsgMSwgMik7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiBlbmQgb2Ygey5ibG9ja31cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2VuZCBvZiBibG9jaycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0xLFxuICAgICAgICAgICAgICBjb250ZW50OiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdlbmQnLCBvcHRpb25zKSxcbiAgICAgICAgICAgICAgdHlwZTogKHQpID0+IHQgIT09ICdjb2RlX2lubGluZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBpaSA9IGkgKyAxO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2lpICsgMV0gJiYgdG9rZW5zW2lpICsgMV0ubmVzdGluZyA9PT0gLTEpIHsgaWkrKzsgfVxuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zLCBpaSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICBsZXQgdHJpbW1lZCA9IGNvbnRlbnQuc2xpY2UoMCwgY29udGVudC5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpKTtcbiAgICAgICAgdG9rZW4uY29udGVudCA9IGxhc3QodHJpbW1lZCkgIT09ICcgJyA/XG4gICAgICAgICAgdHJpbW1lZCA6IHRyaW1tZWQuc2xpY2UoMCwgLTEpO1xuICAgICAgfVxuICAgIH1cbiAgXSk7XG59O1xuXG4vLyBnZXQgbGFzdCBlbGVtZW50IG9mIGFycmF5IG9yIHN0cmluZ1xuZnVuY3Rpb24gbGFzdChhcnIpIHtcbiAgcmV0dXJuIGFyci5zbGljZSgtMSlbMF07XG59XG4iLCIndXNlIHN0cmljdCc7XG4vKipcbiAqIHBhcnNlIHsuY2xhc3MgI2lkIGtleT12YWx9IHN0cmluZ3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHI6IHN0cmluZyB0byBwYXJzZVxuICogQHBhcmFtIHtpbnR9IHN0YXJ0OiB3aGVyZSB0byBzdGFydCBwYXJzaW5nIChpbmNsdWRpbmcgeylcbiAqIEByZXR1cm5zIHsyZCBhcnJheX06IFtbJ2tleScsICd2YWwnXSwgWydjbGFzcycsICdyZWQnXV1cbiAqL1xuZXhwb3J0cy5nZXRBdHRycyA9IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBvcHRpb25zKSB7XG4gIC8vIG5vdCB0YWIsIGxpbmUgZmVlZCwgZm9ybSBmZWVkLCBzcGFjZSwgc29saWR1cywgZ3JlYXRlciB0aGFuIHNpZ24sIHF1b3RhdGlvbiBtYXJrLCBhcG9zdHJvcGhlIGFuZCBlcXVhbHMgc2lnblxuICBjb25zdCBhbGxvd2VkS2V5Q2hhcnMgPSAvW15cXHRcXG5cXGYgLz5cIic9XS87XG4gIGNvbnN0IHBhaXJTZXBhcmF0b3IgPSAnICc7XG4gIGNvbnN0IGtleVNlcGFyYXRvciA9ICc9JztcbiAgY29uc3QgY2xhc3NDaGFyID0gJy4nO1xuICBjb25zdCBpZENoYXIgPSAnIyc7XG5cbiAgY29uc3QgYXR0cnMgPSBbXTtcbiAgbGV0IGtleSA9ICcnO1xuICBsZXQgdmFsdWUgPSAnJztcbiAgbGV0IHBhcnNpbmdLZXkgPSB0cnVlO1xuICBsZXQgdmFsdWVJbnNpZGVRdW90ZXMgPSBmYWxzZTtcblxuICAvLyByZWFkIGluc2lkZSB7fVxuICAvLyBzdGFydCArIGxlZnQgZGVsaW1pdGVyIGxlbmd0aCB0byBhdm9pZCBiZWdpbm5pbmcge1xuICAvLyBicmVha3Mgd2hlbiB9IGlzIGZvdW5kIG9yIGVuZCBvZiBzdHJpbmdcbiAgZm9yIChsZXQgaSA9IHN0YXJ0ICsgb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzdHIuc2xpY2UoaSwgaSArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKSA9PT0gb3B0aW9ucy5yaWdodERlbGltaXRlcikge1xuICAgICAgaWYgKGtleSAhPT0gJycpIHsgYXR0cnMucHVzaChba2V5LCB2YWx1ZV0pOyB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgbGV0IGNoYXJfID0gc3RyLmNoYXJBdChpKTtcblxuICAgIC8vIHN3aXRjaCB0byByZWFkaW5nIHZhbHVlIGlmIGVxdWFsIHNpZ25cbiAgICBpZiAoY2hhcl8gPT09IGtleVNlcGFyYXRvciAmJiBwYXJzaW5nS2V5KSB7XG4gICAgICBwYXJzaW5nS2V5ID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB7LmNsYXNzfSB7Li5jc3MtbW9kdWxlfVxuICAgIGlmIChjaGFyXyA9PT0gY2xhc3NDaGFyICYmIGtleSA9PT0gJycpIHtcbiAgICAgIGlmIChzdHIuY2hhckF0KGkgKyAxKSA9PT0gY2xhc3NDaGFyKSB7XG4gICAgICAgIGtleSA9ICdjc3MtbW9kdWxlJztcbiAgICAgICAgaSArPSAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gJ2NsYXNzJztcbiAgICAgIH1cbiAgICAgIHBhcnNpbmdLZXkgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHsjaWR9XG4gICAgaWYgKGNoYXJfID09PSBpZENoYXIgJiYga2V5ID09PSAnJykge1xuICAgICAga2V5ID0gJ2lkJztcbiAgICAgIHBhcnNpbmdLZXkgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHt2YWx1ZT1cImluc2lkZSBxdW90ZXNcIn1cbiAgICBpZiAoY2hhcl8gPT09ICdcIicgJiYgdmFsdWUgPT09ICcnKSB7XG4gICAgICB2YWx1ZUluc2lkZVF1b3RlcyA9IHRydWU7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGNoYXJfID09PSAnXCInICYmIHZhbHVlSW5zaWRlUXVvdGVzKSB7XG4gICAgICB2YWx1ZUluc2lkZVF1b3RlcyA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gcmVhZCBuZXh0IGtleS92YWx1ZSBwYWlyXG4gICAgaWYgKChjaGFyXyA9PT0gcGFpclNlcGFyYXRvciAmJiAhdmFsdWVJbnNpZGVRdW90ZXMpKSB7XG4gICAgICBpZiAoa2V5ID09PSAnJykge1xuICAgICAgICAvLyBiZWdpbm5pbmcgb3IgZW5kaW5nIHNwYWNlOiB7IC5yZWQgfSB2cyB7LnJlZH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBhdHRycy5wdXNoKFtrZXksIHZhbHVlXSk7XG4gICAgICBrZXkgPSAnJztcbiAgICAgIHZhbHVlID0gJyc7XG4gICAgICBwYXJzaW5nS2V5ID0gdHJ1ZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGNvbnRpbnVlIGlmIGNoYXJhY3RlciBub3QgYWxsb3dlZFxuICAgIGlmIChwYXJzaW5nS2V5ICYmIGNoYXJfLnNlYXJjaChhbGxvd2VkS2V5Q2hhcnMpID09PSAtMSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gbm8gb3RoZXIgY29uZGl0aW9ucyBtZXQ7IGFwcGVuZCB0byBrZXkvdmFsdWVcbiAgICBpZiAocGFyc2luZ0tleSkge1xuICAgICAga2V5ICs9IGNoYXJfO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhbHVlICs9IGNoYXJfO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuYWxsb3dlZEF0dHJpYnV0ZXMgJiYgb3B0aW9ucy5hbGxvd2VkQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICBsZXQgYWxsb3dlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmFsbG93ZWRBdHRyaWJ1dGVzO1xuXG4gICAgcmV0dXJuIGF0dHJzLmZpbHRlcihmdW5jdGlvbiAoYXR0clBhaXIpIHtcbiAgICAgIGxldCBhdHRyID0gYXR0clBhaXJbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGlzQWxsb3dlZEF0dHJpYnV0ZSAoYWxsb3dlZEF0dHJpYnV0ZSkge1xuICAgICAgICByZXR1cm4gKGF0dHIgPT09IGFsbG93ZWRBdHRyaWJ1dGVcbiAgICAgICAgICB8fCAoYWxsb3dlZEF0dHJpYnV0ZSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBhbGxvd2VkQXR0cmlidXRlLnRlc3QoYXR0cikpXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhbGxvd2VkQXR0cmlidXRlcy5zb21lKGlzQWxsb3dlZEF0dHJpYnV0ZSk7XG4gICAgfSk7XG5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cnM7XG4gIH1cbn07XG5cbi8qKlxuICogYWRkIGF0dHJpYnV0ZXMgZnJvbSBbWydrZXknLCAndmFsJ11dIGxpc3RcbiAqIEBwYXJhbSB7YXJyYXl9IGF0dHJzOiBbWydrZXknLCAndmFsJ11dXG4gKiBAcGFyYW0ge3Rva2VufSB0b2tlbjogd2hpY2ggdG9rZW4gdG8gYWRkIGF0dHJpYnV0ZXNcbiAqIEByZXR1cm5zIHRva2VuXG4gKi9cbmV4cG9ydHMuYWRkQXR0cnMgPSBmdW5jdGlvbiAoYXR0cnMsIHRva2VuKSB7XG4gIGZvciAobGV0IGogPSAwLCBsID0gYXR0cnMubGVuZ3RoOyBqIDwgbDsgKytqKSB7XG4gICAgbGV0IGtleSA9IGF0dHJzW2pdWzBdO1xuICAgIGlmIChrZXkgPT09ICdjbGFzcycpIHtcbiAgICAgIHRva2VuLmF0dHJKb2luKCdjbGFzcycsIGF0dHJzW2pdWzFdKTtcbiAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2Nzcy1tb2R1bGUnKSB7XG4gICAgICB0b2tlbi5hdHRySm9pbignY3NzLW1vZHVsZScsIGF0dHJzW2pdWzFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9rZW4uYXR0clB1c2goYXR0cnNbal0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdG9rZW47XG59O1xuXG4vKipcbiAqIERvZXMgc3RyaW5nIGhhdmUgcHJvcGVybHkgZm9ybWF0dGVkIGN1cmx5P1xuICpcbiAqIHN0YXJ0OiAney5hfSBhc2RmJ1xuICogbWlkZGxlOiAnYXsuYn1jJ1xuICogZW5kOiAnYXNkZiB7LmF9J1xuICogb25seTogJ3suYX0nXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHdoZXJlIHRvIGV4cGVjdCB7fSBjdXJseS4gc3RhcnQsIG1pZGRsZSwgZW5kIG9yIG9ubHkuXG4gKiBAcmV0dXJuIHtmdW5jdGlvbihzdHJpbmcpfSBGdW5jdGlvbiB3aGljaCB0ZXN0ZXMgaWYgc3RyaW5nIGhhcyBjdXJseS5cbiAqL1xuZXhwb3J0cy5oYXNEZWxpbWl0ZXJzID0gZnVuY3Rpb24gKHdoZXJlLCBvcHRpb25zKSB7XG5cbiAgaWYgKCF3aGVyZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVyIGB3aGVyZWAgbm90IHBhc3NlZC4gU2hvdWxkIGJlIFwic3RhcnRcIiwgXCJtaWRkbGVcIiwgXCJlbmRcIiBvciBcIm9ubHlcIi4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICByZXR1cm4gZnVuY3Rpb24gKHN0cikge1xuICAgIC8vIHdlIG5lZWQgbWluaW11bSB0aHJlZSBjaGFycywgZm9yIGV4YW1wbGUge2J9XG4gICAgbGV0IG1pbkN1cmx5TGVuZ3RoID0gb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCArIDEgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aDtcbiAgICBpZiAoIXN0ciB8fCB0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJyB8fCBzdHIubGVuZ3RoIDwgbWluQ3VybHlMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZEN1cmx5TGVuZ3RoIChjdXJseSkge1xuICAgICAgbGV0IGlzQ2xhc3MgPSBjdXJseS5jaGFyQXQob3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCkgPT09ICcuJztcbiAgICAgIGxldCBpc0lkID0gY3VybHkuY2hhckF0KG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGgpID09PSAnIyc7XG4gICAgICByZXR1cm4gKGlzQ2xhc3MgfHwgaXNJZClcbiAgICAgICAgPyBjdXJseS5sZW5ndGggPj0gKG1pbkN1cmx5TGVuZ3RoICsgMSlcbiAgICAgICAgOiBjdXJseS5sZW5ndGggPj0gbWluQ3VybHlMZW5ndGg7XG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0LCBlbmQsIHNsaWNlLCBuZXh0Q2hhcjtcbiAgICBsZXQgcmlnaHREZWxpbWl0ZXJNaW5pbXVtU2hpZnQgPSBtaW5DdXJseUxlbmd0aCAtIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoO1xuICAgIHN3aXRjaCAod2hlcmUpIHtcbiAgICBjYXNlICdzdGFydCc6XG4gICAgICAvLyBmaXJzdCBjaGFyIHNob3VsZCBiZSB7LCB9IGZvdW5kIGluIGNoYXIgMiBvciBtb3JlXG4gICAgICBzbGljZSA9IHN0ci5zbGljZSgwLCBvcHRpb25zLmxlZnREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgIHN0YXJ0ID0gc2xpY2UgPT09IG9wdGlvbnMubGVmdERlbGltaXRlciA/IDAgOiAtMTtcbiAgICAgIGVuZCA9IHN0YXJ0ID09PSAtMSA/IC0xIDogc3RyLmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlciwgcmlnaHREZWxpbWl0ZXJNaW5pbXVtU2hpZnQpO1xuICAgICAgLy8gY2hlY2sgaWYgbmV4dCBjaGFyYWN0ZXIgaXMgbm90IG9uZSBvZiB0aGUgZGVsaW1pdGVyc1xuICAgICAgbmV4dENoYXIgPSBzdHIuY2hhckF0KGVuZCArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgIGlmIChuZXh0Q2hhciAmJiBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmluZGV4T2YobmV4dENoYXIpICE9PSAtMSkge1xuICAgICAgICBlbmQgPSAtMTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnZW5kJzpcbiAgICAgIC8vIGxhc3QgY2hhciBzaG91bGQgYmUgfVxuICAgICAgc3RhcnQgPSBzdHIubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKTtcbiAgICAgIGVuZCA9IHN0YXJ0ID09PSAtMSA/IC0xIDogc3RyLmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlciwgc3RhcnQgKyByaWdodERlbGltaXRlck1pbmltdW1TaGlmdCk7XG4gICAgICBlbmQgPSBlbmQgPT09IHN0ci5sZW5ndGggLSBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCA/IGVuZCA6IC0xO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdvbmx5JzpcbiAgICAgIC8vICd7LmF9J1xuICAgICAgc2xpY2UgPSBzdHIuc2xpY2UoMCwgb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICBzdGFydCA9IHNsaWNlID09PSBvcHRpb25zLmxlZnREZWxpbWl0ZXIgPyAwIDogLTE7XG4gICAgICBzbGljZSA9IHN0ci5zbGljZShzdHIubGVuZ3RoIC0gb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgZW5kID0gc2xpY2UgPT09IG9wdGlvbnMucmlnaHREZWxpbWl0ZXIgPyBzdHIubGVuZ3RoIC0gb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGggOiAtMTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBzdGFydCAhPT0gLTEgJiYgZW5kICE9PSAtMSAmJiB2YWxpZEN1cmx5TGVuZ3RoKHN0ci5zdWJzdHJpbmcoc3RhcnQsIGVuZCArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKSk7XG4gIH07XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgbGFzdCBjdXJseSBmcm9tIHN0cmluZy5cbiAqL1xuZXhwb3J0cy5yZW1vdmVEZWxpbWl0ZXIgPSBmdW5jdGlvbiAoc3RyLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN0YXJ0ID0gZXNjYXBlUmVnRXhwKG9wdGlvbnMubGVmdERlbGltaXRlcik7XG4gIGNvbnN0IGVuZCA9IGVzY2FwZVJlZ0V4cChvcHRpb25zLnJpZ2h0RGVsaW1pdGVyKTtcblxuICBsZXQgY3VybHkgPSBuZXcgUmVnRXhwKFxuICAgICdbIFxcXFxuXT8nICsgc3RhcnQgKyAnW14nICsgc3RhcnQgKyBlbmQgKyAnXSsnICsgZW5kICsgJyQnXG4gICk7XG4gIGxldCBwb3MgPSBzdHIuc2VhcmNoKGN1cmx5KTtcblxuICByZXR1cm4gcG9zICE9PSAtMSA/IHN0ci5zbGljZSgwLCBwb3MpIDogc3RyO1xufTtcblxuLyoqXG4gKiBFc2NhcGVzIHNwZWNpYWwgY2hhcmFjdGVycyBpbiBzdHJpbmcgcyBzdWNoIHRoYXQgdGhlIHN0cmluZ1xuICogY2FuIGJlIHVzZWQgaW4gYG5ldyBSZWdFeHBgLiBGb3IgZXhhbXBsZSBcIltcIiBiZWNvbWVzIFwiXFxcXFtcIi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gcyBSZWdleCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IEVzY2FwZWQgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAgKHMpIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvWy0vXFxcXF4kKis/LigpfFtcXF17fV0vZywgJ1xcXFwkJicpO1xufVxuZXhwb3J0cy5lc2NhcGVSZWdFeHAgPSBlc2NhcGVSZWdFeHA7XG5cbi8qKlxuICogZmluZCBjb3JyZXNwb25kaW5nIG9wZW5pbmcgYmxvY2tcbiAqL1xuZXhwb3J0cy5nZXRNYXRjaGluZ09wZW5pbmdUb2tlbiA9IGZ1bmN0aW9uICh0b2tlbnMsIGkpIHtcbiAgaWYgKHRva2Vuc1tpXS50eXBlID09PSAnc29mdGJyZWFrJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBub24gY2xvc2luZyBibG9ja3MsIGV4YW1wbGUgaW1nXG4gIGlmICh0b2tlbnNbaV0ubmVzdGluZyA9PT0gMCkge1xuICAgIHJldHVybiB0b2tlbnNbaV07XG4gIH1cblxuICBsZXQgbGV2ZWwgPSB0b2tlbnNbaV0ubGV2ZWw7XG4gIGxldCB0eXBlID0gdG9rZW5zW2ldLnR5cGUucmVwbGFjZSgnX2Nsb3NlJywgJ19vcGVuJyk7XG5cbiAgZm9yICg7IGkgPj0gMDsgLS1pKSB7XG4gICAgaWYgKHRva2Vuc1tpXS50eXBlID09PSB0eXBlICYmIHRva2Vuc1tpXS5sZXZlbCA9PT0gbGV2ZWwpIHtcbiAgICAgIHJldHVybiB0b2tlbnNbaV07XG4gICAgfVxuICB9XG59O1xuXG5cbi8qKlxuICogZnJvbSBodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbWFya2Rvd24taXQvYmxvYi9tYXN0ZXIvbGliL2NvbW1vbi91dGlscy5qc1xuICovXG5sZXQgSFRNTF9FU0NBUEVfVEVTVF9SRSA9IC9bJjw+XCJdLztcbmxldCBIVE1MX0VTQ0FQRV9SRVBMQUNFX1JFID0gL1smPD5cIl0vZztcbmxldCBIVE1MX1JFUExBQ0VNRU5UUyA9IHtcbiAgJyYnOiAnJmFtcDsnLFxuICAnPCc6ICcmbHQ7JyxcbiAgJz4nOiAnJmd0OycsXG4gICdcIic6ICcmcXVvdDsnXG59O1xuXG5mdW5jdGlvbiByZXBsYWNlVW5zYWZlQ2hhcihjaCkge1xuICByZXR1cm4gSFRNTF9SRVBMQUNFTUVOVFNbY2hdO1xufVxuXG5leHBvcnRzLmVzY2FwZUh0bWwgPSBmdW5jdGlvbiAoc3RyKSB7XG4gIGlmIChIVE1MX0VTQ0FQRV9URVNUX1JFLnRlc3Qoc3RyKSkge1xuICAgIHJldHVybiBzdHIucmVwbGFjZShIVE1MX0VTQ0FQRV9SRVBMQUNFX1JFLCByZXBsYWNlVW5zYWZlQ2hhcik7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG4iLCJ2YXIgXywgY2hlY2tib3hSZXBsYWNlO1xuXG5fID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xuXG5jaGVja2JveFJlcGxhY2UgPSBmdW5jdGlvbihtZCwgb3B0aW9ucywgVG9rZW4pIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG4gIHZhciBhcnJheVJlcGxhY2VBdCwgY3JlYXRlVG9rZW5zLCBkZWZhdWx0cywgbGFzdElkLCBwYXR0ZXJuLCBzcGxpdFRleHRUb2tlbjtcbiAgYXJyYXlSZXBsYWNlQXQgPSBtZC51dGlscy5hcnJheVJlcGxhY2VBdDtcbiAgbGFzdElkID0gMDtcbiAgZGVmYXVsdHMgPSB7XG4gICAgZGl2V3JhcDogZmFsc2UsXG4gICAgZGl2Q2xhc3M6ICdjaGVja2JveCcsXG4gICAgaWRQcmVmaXg6ICdjaGVja2JveCdcbiAgfTtcbiAgb3B0aW9ucyA9IF8uZXh0ZW5kKGRlZmF1bHRzLCBvcHRpb25zKTtcbiAgcGF0dGVybiA9IC9cXFsoWHxcXHN8XFxffFxcLSlcXF1cXHMoLiopL2k7XG4gIGNyZWF0ZVRva2VucyA9IGZ1bmN0aW9uKGNoZWNrZWQsIGxhYmVsLCBUb2tlbikge1xuICAgIHZhciBpZCwgbm9kZXMsIHRva2VuO1xuICAgIG5vZGVzID0gW107XG5cbiAgICAvKipcbiAgICAgKiA8ZGl2IGNsYXNzPVwiY2hlY2tib3hcIj5cbiAgICAgKi9cbiAgICBpZiAob3B0aW9ucy5kaXZXcmFwKSB7XG4gICAgICB0b2tlbiA9IG5ldyBUb2tlbihcImNoZWNrYm94X29wZW5cIiwgXCJkaXZcIiwgMSk7XG4gICAgICB0b2tlbi5hdHRycyA9IFtbXCJjbGFzc1wiLCBvcHRpb25zLmRpdkNsYXNzXV07XG4gICAgICBub2Rlcy5wdXNoKHRva2VuKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJjaGVja2JveHtufVwiIGNoZWNrZWQ9XCJ0cnVlXCI+XG4gICAgICovXG4gICAgaWQgPSBvcHRpb25zLmlkUHJlZml4ICsgbGFzdElkO1xuICAgIGxhc3RJZCArPSAxO1xuICAgIHRva2VuID0gbmV3IFRva2VuKFwiY2hlY2tib3hfaW5wdXRcIiwgXCJpbnB1dFwiLCAwKTtcbiAgICB0b2tlbi5hdHRycyA9IFtbXCJ0eXBlXCIsIFwiY2hlY2tib3hcIl0sIFtcImlkXCIsIGlkXV07XG4gICAgaWYgKGNoZWNrZWQgPT09IHRydWUpIHtcbiAgICAgIHRva2VuLmF0dHJzLnB1c2goW1wiY2hlY2tlZFwiLCBcInRydWVcIl0pO1xuICAgIH1cbiAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgIC8qKlxuICAgICAqIDxsYWJlbCBmb3I9XCJjaGVja2JveHtufVwiPlxuICAgICAqL1xuICAgIHRva2VuID0gbmV3IFRva2VuKFwibGFiZWxfb3BlblwiLCBcImxhYmVsXCIsIDEpO1xuICAgIHRva2VuLmF0dHJzID0gW1tcImZvclwiLCBpZF1dO1xuICAgIG5vZGVzLnB1c2godG9rZW4pO1xuXG4gICAgLyoqXG4gICAgICogY29udGVudCBvZiBsYWJlbCB0YWdcbiAgICAgKi9cbiAgICB0b2tlbiA9IG5ldyBUb2tlbihcInRleHRcIiwgXCJcIiwgMCk7XG4gICAgdG9rZW4uY29udGVudCA9IGxhYmVsO1xuICAgIG5vZGVzLnB1c2godG9rZW4pO1xuXG4gICAgLyoqXG4gICAgICogY2xvc2luZyB0YWdzXG4gICAgICovXG4gICAgbm9kZXMucHVzaChuZXcgVG9rZW4oXCJsYWJlbF9jbG9zZVwiLCBcImxhYmVsXCIsIC0xKSk7XG4gICAgaWYgKG9wdGlvbnMuZGl2V3JhcCkge1xuICAgICAgbm9kZXMucHVzaChuZXcgVG9rZW4oXCJjaGVja2JveF9jbG9zZVwiLCBcImRpdlwiLCAtMSkpO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZXM7XG4gIH07XG4gIHNwbGl0VGV4dFRva2VuID0gZnVuY3Rpb24ob3JpZ2luYWwsIFRva2VuKSB7XG4gICAgdmFyIGNoZWNrZWQsIGxhYmVsLCBtYXRjaGVzLCB0ZXh0LCB2YWx1ZTtcbiAgICB0ZXh0ID0gb3JpZ2luYWwuY29udGVudDtcbiAgICBtYXRjaGVzID0gdGV4dC5tYXRjaChwYXR0ZXJuKTtcbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG9yaWdpbmFsO1xuICAgIH1cbiAgICBjaGVja2VkID0gZmFsc2U7XG4gICAgdmFsdWUgPSBtYXRjaGVzWzFdO1xuICAgIGxhYmVsID0gbWF0Y2hlc1syXTtcbiAgICBpZiAodmFsdWUgPT09IFwiWFwiIHx8IHZhbHVlID09PSBcInhcIikge1xuICAgICAgY2hlY2tlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBjcmVhdGVUb2tlbnMoY2hlY2tlZCwgbGFiZWwsIFRva2VuKTtcbiAgfTtcbiAgcmV0dXJuIGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgdmFyIGJsb2NrVG9rZW5zLCBpLCBqLCBsLCB0b2tlbiwgdG9rZW5zO1xuICAgIGJsb2NrVG9rZW5zID0gc3RhdGUudG9rZW5zO1xuICAgIGogPSAwO1xuICAgIGwgPSBibG9ja1Rva2Vucy5sZW5ndGg7XG4gICAgd2hpbGUgKGogPCBsKSB7XG4gICAgICBpZiAoYmxvY2tUb2tlbnNbal0udHlwZSAhPT0gXCJpbmxpbmVcIikge1xuICAgICAgICBqKys7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdG9rZW5zID0gYmxvY2tUb2tlbnNbal0uY2hpbGRyZW47XG4gICAgICBpID0gdG9rZW5zLmxlbmd0aCAtIDE7XG4gICAgICB3aGlsZSAoaSA+PSAwKSB7XG4gICAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgICBibG9ja1Rva2Vuc1tqXS5jaGlsZHJlbiA9IHRva2VucyA9IGFycmF5UmVwbGFjZUF0KHRva2VucywgaSwgc3BsaXRUZXh0VG9rZW4odG9rZW4sIHN0YXRlLlRva2VuKSk7XG4gICAgICAgIGktLTtcbiAgICAgIH1cbiAgICAgIGorKztcbiAgICB9XG4gIH07XG59O1xuXG5cbi8qZ2xvYmFsIG1vZHVsZSAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1kLCBvcHRpb25zKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuICBtZC5jb3JlLnJ1bGVyLnB1c2goXCJjaGVja2JveFwiLCBjaGVja2JveFJlcGxhY2UobWQsIG9wdGlvbnMpKTtcbn07XG4iLCIvLyBQcm9jZXNzIGJsb2NrLWxldmVsIGN1c3RvbSBjb250YWluZXJzXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29udGFpbmVyX3BsdWdpbihtZCwgbmFtZSwgb3B0aW9ucykge1xuXG4gIC8vIFNlY29uZCBwYXJhbSBtYXkgYmUgdXNlZnVsIGlmIHlvdSBkZWNpZGVcbiAgLy8gdG8gaW5jcmVhc2UgbWluaW1hbCBhbGxvd2VkIG1hcmtlciBsZW5ndGhcbiAgZnVuY3Rpb24gdmFsaWRhdGVEZWZhdWx0KHBhcmFtcy8qLCBtYXJrdXAqLykge1xuICAgIHJldHVybiBwYXJhbXMudHJpbSgpLnNwbGl0KCcgJywgMilbMF0gPT09IG5hbWU7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJEZWZhdWx0KHRva2VucywgaWR4LCBfb3B0aW9ucywgZW52LCBzbGYpIHtcblxuICAgIC8vIGFkZCBhIGNsYXNzIHRvIHRoZSBvcGVuaW5nIHRhZ1xuICAgIGlmICh0b2tlbnNbaWR4XS5uZXN0aW5nID09PSAxKSB7XG4gICAgICB0b2tlbnNbaWR4XS5hdHRySm9pbignY2xhc3MnLCBuYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2xmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBfb3B0aW9ucywgZW52LCBzbGYpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgdmFyIG1pbl9tYXJrZXJzID0gMyxcbiAgICAgIG1hcmtlcl9zdHIgID0gb3B0aW9ucy5tYXJrZXIgfHwgJzonLFxuICAgICAgbWFya2VyX2NoYXIgPSBtYXJrZXJfc3RyLmNoYXJDb2RlQXQoMCksXG4gICAgICBtYXJrZXJfbGVuICA9IG1hcmtlcl9zdHIubGVuZ3RoLFxuICAgICAgdmFsaWRhdGUgICAgPSBvcHRpb25zLnZhbGlkYXRlIHx8IHZhbGlkYXRlRGVmYXVsdCxcbiAgICAgIHJlbmRlciAgICAgID0gb3B0aW9ucy5yZW5kZXIgfHwgcmVuZGVyRGVmYXVsdDtcblxuICBmdW5jdGlvbiBjb250YWluZXIoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gICAgdmFyIHBvcywgbmV4dExpbmUsIG1hcmtlcl9jb3VudCwgbWFya3VwLCBwYXJhbXMsIHRva2VuLFxuICAgICAgICBvbGRfcGFyZW50LCBvbGRfbGluZV9tYXgsXG4gICAgICAgIGF1dG9fY2xvc2VkID0gZmFsc2UsXG4gICAgICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSxcbiAgICAgICAgbWF4ID0gc3RhdGUuZU1hcmtzW3N0YXJ0TGluZV07XG5cbiAgICAvLyBDaGVjayBvdXQgdGhlIGZpcnN0IGNoYXJhY3RlciBxdWlja2x5LFxuICAgIC8vIHRoaXMgc2hvdWxkIGZpbHRlciBvdXQgbW9zdCBvZiBub24tY29udGFpbmVyc1xuICAgIC8vXG4gICAgaWYgKG1hcmtlcl9jaGFyICE9PSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvLyBDaGVjayBvdXQgdGhlIHJlc3Qgb2YgdGhlIG1hcmtlciBzdHJpbmdcbiAgICAvL1xuICAgIGZvciAocG9zID0gc3RhcnQgKyAxOyBwb3MgPD0gbWF4OyBwb3MrKykge1xuICAgICAgaWYgKG1hcmtlcl9zdHJbKHBvcyAtIHN0YXJ0KSAlIG1hcmtlcl9sZW5dICE9PSBzdGF0ZS5zcmNbcG9zXSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtYXJrZXJfY291bnQgPSBNYXRoLmZsb29yKChwb3MgLSBzdGFydCkgLyBtYXJrZXJfbGVuKTtcbiAgICBpZiAobWFya2VyX2NvdW50IDwgbWluX21hcmtlcnMpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcG9zIC09IChwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuO1xuXG4gICAgbWFya3VwID0gc3RhdGUuc3JjLnNsaWNlKHN0YXJ0LCBwb3MpO1xuICAgIHBhcmFtcyA9IHN0YXRlLnNyYy5zbGljZShwb3MsIG1heCk7XG4gICAgaWYgKCF2YWxpZGF0ZShwYXJhbXMsIG1hcmt1cCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvLyBTaW5jZSBzdGFydCBpcyBmb3VuZCwgd2UgY2FuIHJlcG9ydCBzdWNjZXNzIGhlcmUgaW4gdmFsaWRhdGlvbiBtb2RlXG4gICAgLy9cbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgICAvLyBTZWFyY2ggZm9yIHRoZSBlbmQgb2YgdGhlIGJsb2NrXG4gICAgLy9cbiAgICBuZXh0TGluZSA9IHN0YXJ0TGluZTtcblxuICAgIGZvciAoOzspIHtcbiAgICAgIG5leHRMaW5lKys7XG4gICAgICBpZiAobmV4dExpbmUgPj0gZW5kTGluZSkge1xuICAgICAgICAvLyB1bmNsb3NlZCBibG9jayBzaG91bGQgYmUgYXV0b2Nsb3NlZCBieSBlbmQgb2YgZG9jdW1lbnQuXG4gICAgICAgIC8vIGFsc28gYmxvY2sgc2VlbXMgdG8gYmUgYXV0b2Nsb3NlZCBieSBlbmQgb2YgcGFyZW50XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBzdGFydCA9IHN0YXRlLmJNYXJrc1tuZXh0TGluZV0gKyBzdGF0ZS50U2hpZnRbbmV4dExpbmVdO1xuICAgICAgbWF4ID0gc3RhdGUuZU1hcmtzW25leHRMaW5lXTtcblxuICAgICAgaWYgKHN0YXJ0IDwgbWF4ICYmIHN0YXRlLnNDb3VudFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHtcbiAgICAgICAgLy8gbm9uLWVtcHR5IGxpbmUgd2l0aCBuZWdhdGl2ZSBpbmRlbnQgc2hvdWxkIHN0b3AgdGhlIGxpc3Q6XG4gICAgICAgIC8vIC0gYGBgXG4gICAgICAgIC8vICB0ZXN0XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAobWFya2VyX2NoYXIgIT09IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXJ0KSkgeyBjb250aW51ZTsgfVxuXG4gICAgICBpZiAoc3RhdGUuc0NvdW50W25leHRMaW5lXSAtIHN0YXRlLmJsa0luZGVudCA+PSA0KSB7XG4gICAgICAgIC8vIGNsb3NpbmcgZmVuY2Ugc2hvdWxkIGJlIGluZGVudGVkIGxlc3MgdGhhbiA0IHNwYWNlc1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZm9yIChwb3MgPSBzdGFydCArIDE7IHBvcyA8PSBtYXg7IHBvcysrKSB7XG4gICAgICAgIGlmIChtYXJrZXJfc3RyWyhwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuXSAhPT0gc3RhdGUuc3JjW3Bvc10pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBjbG9zaW5nIGNvZGUgZmVuY2UgbXVzdCBiZSBhdCBsZWFzdCBhcyBsb25nIGFzIHRoZSBvcGVuaW5nIG9uZVxuICAgICAgaWYgKE1hdGguZmxvb3IoKHBvcyAtIHN0YXJ0KSAvIG1hcmtlcl9sZW4pIDwgbWFya2VyX2NvdW50KSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgIC8vIG1ha2Ugc3VyZSB0YWlsIGhhcyBzcGFjZXMgb25seVxuICAgICAgcG9zIC09IChwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuO1xuICAgICAgcG9zID0gc3RhdGUuc2tpcFNwYWNlcyhwb3MpO1xuXG4gICAgICBpZiAocG9zIDwgbWF4KSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgIC8vIGZvdW5kIVxuICAgICAgYXV0b19jbG9zZWQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgb2xkX3BhcmVudCA9IHN0YXRlLnBhcmVudFR5cGU7XG4gICAgb2xkX2xpbmVfbWF4ID0gc3RhdGUubGluZU1heDtcbiAgICBzdGF0ZS5wYXJlbnRUeXBlID0gJ2NvbnRhaW5lcic7XG5cbiAgICAvLyB0aGlzIHdpbGwgcHJldmVudCBsYXp5IGNvbnRpbnVhdGlvbnMgZnJvbSBldmVyIGdvaW5nIHBhc3Qgb3VyIGVuZCBtYXJrZXJcbiAgICBzdGF0ZS5saW5lTWF4ID0gbmV4dExpbmU7XG5cbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdjb250YWluZXJfJyArIG5hbWUgKyAnX29wZW4nLCAnZGl2JywgMSk7XG4gICAgdG9rZW4ubWFya3VwID0gbWFya3VwO1xuICAgIHRva2VuLmJsb2NrICA9IHRydWU7XG4gICAgdG9rZW4uaW5mbyAgID0gcGFyYW1zO1xuICAgIHRva2VuLm1hcCAgICA9IFsgc3RhcnRMaW5lLCBuZXh0TGluZSBdO1xuXG4gICAgc3RhdGUubWQuYmxvY2sudG9rZW5pemUoc3RhdGUsIHN0YXJ0TGluZSArIDEsIG5leHRMaW5lKTtcblxuICAgIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2NvbnRhaW5lcl8nICsgbmFtZSArICdfY2xvc2UnLCAnZGl2JywgLTEpO1xuICAgIHRva2VuLm1hcmt1cCA9IHN0YXRlLnNyYy5zbGljZShzdGFydCwgcG9zKTtcbiAgICB0b2tlbi5ibG9jayAgPSB0cnVlO1xuXG4gICAgc3RhdGUucGFyZW50VHlwZSA9IG9sZF9wYXJlbnQ7XG4gICAgc3RhdGUubGluZU1heCA9IG9sZF9saW5lX21heDtcbiAgICBzdGF0ZS5saW5lID0gbmV4dExpbmUgKyAoYXV0b19jbG9zZWQgPyAxIDogMCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG1kLmJsb2NrLnJ1bGVyLmJlZm9yZSgnZmVuY2UnLCAnY29udGFpbmVyXycgKyBuYW1lLCBjb250YWluZXIsIHtcbiAgICBhbHQ6IFsgJ3BhcmFncmFwaCcsICdyZWZlcmVuY2UnLCAnYmxvY2txdW90ZScsICdsaXN0JyBdXG4gIH0pO1xuICBtZC5yZW5kZXJlci5ydWxlc1snY29udGFpbmVyXycgKyBuYW1lICsgJ19vcGVuJ10gPSByZW5kZXI7XG4gIG1kLnJlbmRlcmVyLnJ1bGVzWydjb250YWluZXJfJyArIG5hbWUgKyAnX2Nsb3NlJ10gPSByZW5kZXI7XG59O1xuIiwiLy8gUHJvY2VzcyBkZWZpbml0aW9uIGxpc3RzXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVmbGlzdF9wbHVnaW4obWQpIHtcbiAgdmFyIGlzU3BhY2UgPSBtZC51dGlscy5pc1NwYWNlO1xuXG4gIC8vIFNlYXJjaCBgWzp+XVtcXG4gXWAsIHJldHVybnMgbmV4dCBwb3MgYWZ0ZXIgbWFya2VyIG9uIHN1Y2Nlc3NcbiAgLy8gb3IgLTEgb24gZmFpbC5cbiAgZnVuY3Rpb24gc2tpcE1hcmtlcihzdGF0ZSwgbGluZSkge1xuICAgIHZhciBwb3MsIG1hcmtlcixcbiAgICAgICAgc3RhcnQgPSBzdGF0ZS5iTWFya3NbbGluZV0gKyBzdGF0ZS50U2hpZnRbbGluZV0sXG4gICAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tsaW5lXTtcblxuICAgIGlmIChzdGFydCA+PSBtYXgpIHsgcmV0dXJuIC0xOyB9XG5cbiAgICAvLyBDaGVjayBidWxsZXRcbiAgICBtYXJrZXIgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCsrKTtcbiAgICBpZiAobWFya2VyICE9PSAweDdFLyogfiAqLyAmJiBtYXJrZXIgIT09IDB4M0EvKiA6ICovKSB7IHJldHVybiAtMTsgfVxuXG4gICAgcG9zID0gc3RhdGUuc2tpcFNwYWNlcyhzdGFydCk7XG5cbiAgICAvLyByZXF1aXJlIHNwYWNlIGFmdGVyIFwiOlwiXG4gICAgaWYgKHN0YXJ0ID09PSBwb3MpIHsgcmV0dXJuIC0xOyB9XG5cbiAgICAvLyBubyBlbXB0eSBkZWZpbml0aW9ucywgZS5nLiBcIiAgOiBcIlxuICAgIGlmIChwb3MgPj0gbWF4KSB7IHJldHVybiAtMTsgfVxuXG4gICAgcmV0dXJuIHN0YXJ0O1xuICB9XG5cbiAgZnVuY3Rpb24gbWFya1RpZ2h0UGFyYWdyYXBocyhzdGF0ZSwgaWR4KSB7XG4gICAgdmFyIGksIGwsXG4gICAgICAgIGxldmVsID0gc3RhdGUubGV2ZWwgKyAyO1xuXG4gICAgZm9yIChpID0gaWR4ICsgMiwgbCA9IHN0YXRlLnRva2Vucy5sZW5ndGggLSAyOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAoc3RhdGUudG9rZW5zW2ldLmxldmVsID09PSBsZXZlbCAmJiBzdGF0ZS50b2tlbnNbaV0udHlwZSA9PT0gJ3BhcmFncmFwaF9vcGVuJykge1xuICAgICAgICBzdGF0ZS50b2tlbnNbaSArIDJdLmhpZGRlbiA9IHRydWU7XG4gICAgICAgIHN0YXRlLnRva2Vuc1tpXS5oaWRkZW4gPSB0cnVlO1xuICAgICAgICBpICs9IDI7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVmbGlzdChzdGF0ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLCBzaWxlbnQpIHtcbiAgICB2YXIgY2gsXG4gICAgICAgIGNvbnRlbnRTdGFydCxcbiAgICAgICAgZGRMaW5lLFxuICAgICAgICBkdExpbmUsXG4gICAgICAgIGl0ZW1MaW5lcyxcbiAgICAgICAgbGlzdExpbmVzLFxuICAgICAgICBsaXN0VG9rSWR4LFxuICAgICAgICBtYXgsXG4gICAgICAgIG5leHRMaW5lLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIG9sZERESW5kZW50LFxuICAgICAgICBvbGRJbmRlbnQsXG4gICAgICAgIG9sZFBhcmVudFR5cGUsXG4gICAgICAgIG9sZFNDb3VudCxcbiAgICAgICAgb2xkVFNoaWZ0LFxuICAgICAgICBvbGRUaWdodCxcbiAgICAgICAgcG9zLFxuICAgICAgICBwcmV2RW1wdHlFbmQsXG4gICAgICAgIHRpZ2h0LFxuICAgICAgICB0b2tlbjtcblxuICAgIGlmIChzaWxlbnQpIHtcbiAgICAgIC8vIHF1aXJrOiB2YWxpZGF0aW9uIG1vZGUgdmFsaWRhdGVzIGEgZGQgYmxvY2sgb25seSwgbm90IGEgd2hvbGUgZGVmbGlzdFxuICAgICAgaWYgKHN0YXRlLmRkSW5kZW50IDwgMCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgIHJldHVybiBza2lwTWFya2VyKHN0YXRlLCBzdGFydExpbmUpID49IDA7XG4gICAgfVxuXG4gICAgbmV4dExpbmUgPSBzdGFydExpbmUgKyAxO1xuICAgIGlmIChuZXh0TGluZSA+PSBlbmRMaW5lKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgaWYgKHN0YXRlLmlzRW1wdHkobmV4dExpbmUpKSB7XG4gICAgICBuZXh0TGluZSsrO1xuICAgICAgaWYgKG5leHRMaW5lID49IGVuZExpbmUpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgfVxuXG4gICAgaWYgKHN0YXRlLnNDb3VudFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgY29udGVudFN0YXJ0ID0gc2tpcE1hcmtlcihzdGF0ZSwgbmV4dExpbmUpO1xuICAgIGlmIChjb250ZW50U3RhcnQgPCAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgLy8gU3RhcnQgbGlzdFxuICAgIGxpc3RUb2tJZHggPSBzdGF0ZS50b2tlbnMubGVuZ3RoO1xuICAgIHRpZ2h0ID0gdHJ1ZTtcblxuICAgIHRva2VuICAgICA9IHN0YXRlLnB1c2goJ2RsX29wZW4nLCAnZGwnLCAxKTtcbiAgICB0b2tlbi5tYXAgPSBsaXN0TGluZXMgPSBbIHN0YXJ0TGluZSwgMCBdO1xuXG4gICAgLy9cbiAgICAvLyBJdGVyYXRlIGxpc3QgaXRlbXNcbiAgICAvL1xuXG4gICAgZHRMaW5lID0gc3RhcnRMaW5lO1xuICAgIGRkTGluZSA9IG5leHRMaW5lO1xuXG4gICAgLy8gT25lIGRlZmluaXRpb24gbGlzdCBjYW4gY29udGFpbiBtdWx0aXBsZSBEVHMsXG4gICAgLy8gYW5kIG9uZSBEVCBjYW4gYmUgZm9sbG93ZWQgYnkgbXVsdGlwbGUgRERzLlxuICAgIC8vXG4gICAgLy8gVGh1cywgdGhlcmUgaXMgdHdvIGxvb3BzIGhlcmUsIGFuZCBsYWJlbCBpc1xuICAgIC8vIG5lZWRlZCB0byBicmVhayBvdXQgb2YgdGhlIHNlY29uZCBvbmVcbiAgICAvL1xuICAgIC8qZXNsaW50IG5vLWxhYmVsczowLGJsb2NrLXNjb3BlZC12YXI6MCovXG4gICAgT1VURVI6XG4gICAgZm9yICg7Oykge1xuICAgICAgcHJldkVtcHR5RW5kID0gZmFsc2U7XG5cbiAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnZHRfb3BlbicsICdkdCcsIDEpO1xuICAgICAgdG9rZW4ubWFwICAgICAgPSBbIGR0TGluZSwgZHRMaW5lIF07XG5cbiAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnaW5saW5lJywgJycsIDApO1xuICAgICAgdG9rZW4ubWFwICAgICAgPSBbIGR0TGluZSwgZHRMaW5lIF07XG4gICAgICB0b2tlbi5jb250ZW50ICA9IHN0YXRlLmdldExpbmVzKGR0TGluZSwgZHRMaW5lICsgMSwgc3RhdGUuYmxrSW5kZW50LCBmYWxzZSkudHJpbSgpO1xuICAgICAgdG9rZW4uY2hpbGRyZW4gPSBbXTtcblxuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdkdF9jbG9zZScsICdkdCcsIC0xKTtcblxuICAgICAgZm9yICg7Oykge1xuICAgICAgICB0b2tlbiAgICAgPSBzdGF0ZS5wdXNoKCdkZF9vcGVuJywgJ2RkJywgMSk7XG4gICAgICAgIHRva2VuLm1hcCA9IGl0ZW1MaW5lcyA9IFsgbmV4dExpbmUsIDAgXTtcblxuICAgICAgICBwb3MgPSBjb250ZW50U3RhcnQ7XG4gICAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tkZExpbmVdO1xuICAgICAgICBvZmZzZXQgPSBzdGF0ZS5zQ291bnRbZGRMaW5lXSArIGNvbnRlbnRTdGFydCAtIChzdGF0ZS5iTWFya3NbZGRMaW5lXSArIHN0YXRlLnRTaGlmdFtkZExpbmVdKTtcblxuICAgICAgICB3aGlsZSAocG9zIDwgbWF4KSB7XG4gICAgICAgICAgY2ggPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuXG4gICAgICAgICAgaWYgKGlzU3BhY2UoY2gpKSB7XG4gICAgICAgICAgICBpZiAoY2ggPT09IDB4MDkpIHtcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDQgLSBvZmZzZXQgJSA0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBvcysrO1xuICAgICAgICB9XG5cbiAgICAgICAgY29udGVudFN0YXJ0ID0gcG9zO1xuXG4gICAgICAgIG9sZFRpZ2h0ID0gc3RhdGUudGlnaHQ7XG4gICAgICAgIG9sZERESW5kZW50ID0gc3RhdGUuZGRJbmRlbnQ7XG4gICAgICAgIG9sZEluZGVudCA9IHN0YXRlLmJsa0luZGVudDtcbiAgICAgICAgb2xkVFNoaWZ0ID0gc3RhdGUudFNoaWZ0W2RkTGluZV07XG4gICAgICAgIG9sZFNDb3VudCA9IHN0YXRlLnNDb3VudFtkZExpbmVdO1xuICAgICAgICBvbGRQYXJlbnRUeXBlID0gc3RhdGUucGFyZW50VHlwZTtcbiAgICAgICAgc3RhdGUuYmxrSW5kZW50ID0gc3RhdGUuZGRJbmRlbnQgPSBzdGF0ZS5zQ291bnRbZGRMaW5lXSArIDI7XG4gICAgICAgIHN0YXRlLnRTaGlmdFtkZExpbmVdID0gY29udGVudFN0YXJ0IC0gc3RhdGUuYk1hcmtzW2RkTGluZV07XG4gICAgICAgIHN0YXRlLnNDb3VudFtkZExpbmVdID0gb2Zmc2V0O1xuICAgICAgICBzdGF0ZS50aWdodCA9IHRydWU7XG4gICAgICAgIHN0YXRlLnBhcmVudFR5cGUgPSAnZGVmbGlzdCc7XG5cbiAgICAgICAgc3RhdGUubWQuYmxvY2sudG9rZW5pemUoc3RhdGUsIGRkTGluZSwgZW5kTGluZSwgdHJ1ZSk7XG5cbiAgICAgICAgLy8gSWYgYW55IG9mIGxpc3QgaXRlbSBpcyB0aWdodCwgbWFyayBsaXN0IGFzIHRpZ2h0XG4gICAgICAgIGlmICghc3RhdGUudGlnaHQgfHwgcHJldkVtcHR5RW5kKSB7XG4gICAgICAgICAgdGlnaHQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJdGVtIGJlY29tZSBsb29zZSBpZiBmaW5pc2ggd2l0aCBlbXB0eSBsaW5lLFxuICAgICAgICAvLyBidXQgd2Ugc2hvdWxkIGZpbHRlciBsYXN0IGVsZW1lbnQsIGJlY2F1c2UgaXQgbWVhbnMgbGlzdCBmaW5pc2hcbiAgICAgICAgcHJldkVtcHR5RW5kID0gKHN0YXRlLmxpbmUgLSBkZExpbmUpID4gMSAmJiBzdGF0ZS5pc0VtcHR5KHN0YXRlLmxpbmUgLSAxKTtcblxuICAgICAgICBzdGF0ZS50U2hpZnRbZGRMaW5lXSA9IG9sZFRTaGlmdDtcbiAgICAgICAgc3RhdGUuc0NvdW50W2RkTGluZV0gPSBvbGRTQ291bnQ7XG4gICAgICAgIHN0YXRlLnRpZ2h0ID0gb2xkVGlnaHQ7XG4gICAgICAgIHN0YXRlLnBhcmVudFR5cGUgPSBvbGRQYXJlbnRUeXBlO1xuICAgICAgICBzdGF0ZS5ibGtJbmRlbnQgPSBvbGRJbmRlbnQ7XG4gICAgICAgIHN0YXRlLmRkSW5kZW50ID0gb2xkRERJbmRlbnQ7XG5cbiAgICAgICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCdkZF9jbG9zZScsICdkZCcsIC0xKTtcblxuICAgICAgICBpdGVtTGluZXNbMV0gPSBuZXh0TGluZSA9IHN0YXRlLmxpbmU7XG5cbiAgICAgICAgaWYgKG5leHRMaW5lID49IGVuZExpbmUpIHsgYnJlYWsgT1VURVI7IH1cblxuICAgICAgICBpZiAoc3RhdGUuc0NvdW50W25leHRMaW5lXSA8IHN0YXRlLmJsa0luZGVudCkgeyBicmVhayBPVVRFUjsgfVxuICAgICAgICBjb250ZW50U3RhcnQgPSBza2lwTWFya2VyKHN0YXRlLCBuZXh0TGluZSk7XG4gICAgICAgIGlmIChjb250ZW50U3RhcnQgPCAwKSB7IGJyZWFrOyB9XG5cbiAgICAgICAgZGRMaW5lID0gbmV4dExpbmU7XG5cbiAgICAgICAgLy8gZ28gdG8gdGhlIG5leHQgbG9vcCBpdGVyYXRpb246XG4gICAgICAgIC8vIGluc2VydCBERCB0YWcgYW5kIHJlcGVhdCBjaGVja2luZ1xuICAgICAgfVxuXG4gICAgICBpZiAobmV4dExpbmUgPj0gZW5kTGluZSkgeyBicmVhazsgfVxuICAgICAgZHRMaW5lID0gbmV4dExpbmU7XG5cbiAgICAgIGlmIChzdGF0ZS5pc0VtcHR5KGR0TGluZSkpIHsgYnJlYWs7IH1cbiAgICAgIGlmIChzdGF0ZS5zQ291bnRbZHRMaW5lXSA8IHN0YXRlLmJsa0luZGVudCkgeyBicmVhazsgfVxuXG4gICAgICBkZExpbmUgPSBkdExpbmUgKyAxO1xuICAgICAgaWYgKGRkTGluZSA+PSBlbmRMaW5lKSB7IGJyZWFrOyB9XG4gICAgICBpZiAoc3RhdGUuaXNFbXB0eShkZExpbmUpKSB7IGRkTGluZSsrOyB9XG4gICAgICBpZiAoZGRMaW5lID49IGVuZExpbmUpIHsgYnJlYWs7IH1cblxuICAgICAgaWYgKHN0YXRlLnNDb3VudFtkZExpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7IGJyZWFrOyB9XG4gICAgICBjb250ZW50U3RhcnQgPSBza2lwTWFya2VyKHN0YXRlLCBkZExpbmUpO1xuICAgICAgaWYgKGNvbnRlbnRTdGFydCA8IDApIHsgYnJlYWs7IH1cblxuICAgICAgLy8gZ28gdG8gdGhlIG5leHQgbG9vcCBpdGVyYXRpb246XG4gICAgICAvLyBpbnNlcnQgRFQgYW5kIEREIHRhZ3MgYW5kIHJlcGVhdCBjaGVja2luZ1xuICAgIH1cblxuICAgIC8vIEZpbmlsaXplIGxpc3RcbiAgICB0b2tlbiA9IHN0YXRlLnB1c2goJ2RsX2Nsb3NlJywgJ2RsJywgLTEpO1xuXG4gICAgbGlzdExpbmVzWzFdID0gbmV4dExpbmU7XG5cbiAgICBzdGF0ZS5saW5lID0gbmV4dExpbmU7XG5cbiAgICAvLyBtYXJrIHBhcmFncmFwaHMgdGlnaHQgaWYgbmVlZGVkXG4gICAgaWYgKHRpZ2h0KSB7XG4gICAgICBtYXJrVGlnaHRQYXJhZ3JhcGhzKHN0YXRlLCBsaXN0VG9rSWR4KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG5cbiAgbWQuYmxvY2sucnVsZXIuYmVmb3JlKCdwYXJhZ3JhcGgnLCAnZGVmbGlzdCcsIGRlZmxpc3QsIHsgYWx0OiBbICdwYXJhZ3JhcGgnLCAncmVmZXJlbmNlJywgJ2Jsb2NrcXVvdGUnIF0gfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBlbW9qaV9odG1sICAgICAgICA9IHJlcXVpcmUoJy4vbGliL3JlbmRlcicpO1xudmFyIGVtb2ppX3JlcGxhY2UgICAgID0gcmVxdWlyZSgnLi9saWIvcmVwbGFjZScpO1xudmFyIG5vcm1hbGl6ZV9vcHRzICAgID0gcmVxdWlyZSgnLi9saWIvbm9ybWFsaXplX29wdHMnKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtb2ppX3BsdWdpbihtZCwgb3B0aW9ucykge1xuICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgZGVmczoge30sXG4gICAgc2hvcnRjdXRzOiB7fSxcbiAgICBlbmFibGVkOiBbXVxuICB9O1xuXG4gIHZhciBvcHRzID0gbm9ybWFsaXplX29wdHMobWQudXRpbHMuYXNzaWduKHt9LCBkZWZhdWx0cywgb3B0aW9ucyB8fCB7fSkpO1xuXG4gIG1kLnJlbmRlcmVyLnJ1bGVzLmVtb2ppID0gZW1vamlfaHRtbDtcblxuICBtZC5jb3JlLnJ1bGVyLnB1c2goJ2Vtb2ppJywgZW1vamlfcmVwbGFjZShtZCwgb3B0cy5kZWZzLCBvcHRzLnNob3J0Y3V0cywgb3B0cy5zY2FuUkUsIG9wdHMucmVwbGFjZVJFKSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBlbW9qaWVzX2RlZnMgICAgICA9IHJlcXVpcmUoJy4vbGliL2RhdGEvZnVsbC5qc29uJyk7XG52YXIgZW1vamllc19zaG9ydGN1dHMgPSByZXF1aXJlKCcuL2xpYi9kYXRhL3Nob3J0Y3V0cycpO1xudmFyIGJhcmVfZW1vamlfcGx1Z2luID0gcmVxdWlyZSgnLi9iYXJlJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbW9qaV9wbHVnaW4obWQsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmF1bHRzID0ge1xuICAgIGRlZnM6IGVtb2ppZXNfZGVmcyxcbiAgICBzaG9ydGN1dHM6IGVtb2ppZXNfc2hvcnRjdXRzLFxuICAgIGVuYWJsZWQ6IFtdXG4gIH07XG5cbiAgdmFyIG9wdHMgPSBtZC51dGlscy5hc3NpZ24oe30sIGRlZmF1bHRzLCBvcHRpb25zIHx8IHt9KTtcblxuICBiYXJlX2Vtb2ppX3BsdWdpbihtZCwgb3B0cyk7XG59O1xuIiwiLy8gRW1vdGljb25zIC0+IEVtb2ppIG1hcHBpbmcuXG4vL1xuLy8gKCEpIFNvbWUgcGF0dGVybnMgc2tpcHBlZCwgdG8gYXZvaWQgY29sbGlzaW9uc1xuLy8gd2l0aG91dCBpbmNyZWFzZSBtYXRjaGVyIGNvbXBsaWNpdHkuIFRoYW4gY2FuIGNoYW5nZSBpbiBmdXR1cmUuXG4vL1xuLy8gUGxhY2VzIHRvIGxvb2sgZm9yIG1vcmUgZW1vdGljb25zIGluZm86XG4vL1xuLy8gLSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0xpc3Rfb2ZfZW1vdGljb25zI1dlc3Rlcm5cbi8vIC0gaHR0cHM6Ly9naXRodWIuY29tL3dvb29ybS9lbW90aWNvbi9ibG9iL21hc3Rlci9TdXBwb3J0Lm1kXG4vLyAtIGh0dHA6Ly9mYWN0b3J5am9lLmNvbS9wcm9qZWN0cy9lbW90aWNvbnMvXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYW5ncnk6ICAgICAgICAgICAgWyAnPjooJywgJz46LSgnIF0sXG4gIGJsdXNoOiAgICAgICAgICAgIFsgJzpcIiknLCAnOi1cIiknIF0sXG4gIGJyb2tlbl9oZWFydDogICAgIFsgJzwvMycsICc8XFxcXDMnIF0sXG4gIC8vIDpcXCBhbmQgOi1cXCBub3QgdXNlZCBiZWNhdXNlIG9mIGNvbmZsaWN0IHdpdGggbWFya2Rvd24gZXNjYXBpbmdcbiAgY29uZnVzZWQ6ICAgICAgICAgWyAnOi8nLCAnOi0vJyBdLCAvLyB0d2Vtb2ppIHNob3dzIHF1ZXN0aW9uXG4gIGNyeTogICAgICAgICAgICAgIFsgXCI6JyhcIiwgXCI6Jy0oXCIsICc6LCgnLCAnOiwtKCcgXSxcbiAgZnJvd25pbmc6ICAgICAgICAgWyAnOignLCAnOi0oJyBdLFxuICBoZWFydDogICAgICAgICAgICBbICc8MycgXSxcbiAgaW1wOiAgICAgICAgICAgICAgWyAnXTooJywgJ106LSgnIF0sXG4gIGlubm9jZW50OiAgICAgICAgIFsgJ286KScsICdPOiknLCAnbzotKScsICdPOi0pJywgJzA6KScsICcwOi0pJyBdLFxuICBqb3k6ICAgICAgICAgICAgICBbIFwiOicpXCIsIFwiOictKVwiLCAnOiwpJywgJzosLSknLCBcIjonRFwiLCBcIjonLURcIiwgJzosRCcsICc6LC1EJyBdLFxuICBraXNzaW5nOiAgICAgICAgICBbICc6KicsICc6LSonIF0sXG4gIGxhdWdoaW5nOiAgICAgICAgIFsgJ3gtKScsICdYLSknIF0sXG4gIG5ldXRyYWxfZmFjZTogICAgIFsgJzp8JywgJzotfCcgXSxcbiAgb3Blbl9tb3V0aDogICAgICAgWyAnOm8nLCAnOi1vJywgJzpPJywgJzotTycgXSxcbiAgcmFnZTogICAgICAgICAgICAgWyAnOkAnLCAnOi1AJyBdLFxuICBzbWlsZTogICAgICAgICAgICBbICc6RCcsICc6LUQnIF0sXG4gIHNtaWxleTogICAgICAgICAgIFsgJzopJywgJzotKScgXSxcbiAgc21pbGluZ19pbXA6ICAgICAgWyAnXTopJywgJ106LSknIF0sXG4gIHNvYjogICAgICAgICAgICAgIFsgXCI6LCcoXCIsIFwiOiwnLShcIiwgJzsoJywgJzstKCcgXSxcbiAgc3R1Y2tfb3V0X3Rvbmd1ZTogWyAnOlAnLCAnOi1QJyBdLFxuICBzdW5nbGFzc2VzOiAgICAgICBbICc4LSknLCAnQi0pJyBdLFxuICBzd2VhdDogICAgICAgICAgICBbICcsOignLCAnLDotKCcgXSxcbiAgc3dlYXRfc21pbGU6ICAgICAgWyAnLDopJywgJyw6LSknIF0sXG4gIHVuYW11c2VkOiAgICAgICAgIFsgJzpzJywgJzotUycsICc6eicsICc6LVonLCAnOiQnLCAnOi0kJyBdLFxuICB3aW5rOiAgICAgICAgICAgICBbICc7KScsICc7LSknIF1cbn07XG4iLCIvLyBDb252ZXJ0IGlucHV0IG9wdGlvbnMgdG8gbW9yZSB1c2VhYmxlIGZvcm1hdFxuLy8gYW5kIGNvbXBpbGUgc2VhcmNoIHJlZ2V4cFxuXG4ndXNlIHN0cmljdCc7XG5cblxuZnVuY3Rpb24gcXVvdGVSRShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bLj8qK14kW1xcXVxcXFwoKXt9fC1dL2csICdcXFxcJCYnKTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG5vcm1hbGl6ZV9vcHRzKG9wdGlvbnMpIHtcbiAgdmFyIGVtb2ppZXMgPSBvcHRpb25zLmRlZnMsXG4gICAgICBzaG9ydGN1dHM7XG5cbiAgLy8gRmlsdGVyIGVtb2ppZXMgYnkgd2hpdGVsaXN0LCBpZiBuZWVkZWRcbiAgaWYgKG9wdGlvbnMuZW5hYmxlZC5sZW5ndGgpIHtcbiAgICBlbW9qaWVzID0gT2JqZWN0LmtleXMoZW1vamllcykucmVkdWNlKGZ1bmN0aW9uIChhY2MsIGtleSkge1xuICAgICAgaWYgKG9wdGlvbnMuZW5hYmxlZC5pbmRleE9mKGtleSkgPj0gMCkge1xuICAgICAgICBhY2Nba2V5XSA9IGVtb2ppZXNba2V5XTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuICB9XG5cbiAgLy8gRmxhdHRlbiBzaG9ydGN1dHMgdG8gc2ltcGxlIG9iamVjdDogeyBhbGlhczogZW1vamlfbmFtZSB9XG4gIHNob3J0Y3V0cyA9IE9iamVjdC5rZXlzKG9wdGlvbnMuc2hvcnRjdXRzKS5yZWR1Y2UoZnVuY3Rpb24gKGFjYywga2V5KSB7XG4gICAgLy8gU2tpcCBhbGlhc2VzIGZvciBmaWx0ZXJlZCBlbW9qaWVzLCB0byByZWR1Y2UgcmVnZXhwXG4gICAgaWYgKCFlbW9qaWVzW2tleV0pIHsgcmV0dXJuIGFjYzsgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob3B0aW9ucy5zaG9ydGN1dHNba2V5XSkpIHtcbiAgICAgIG9wdGlvbnMuc2hvcnRjdXRzW2tleV0uZm9yRWFjaChmdW5jdGlvbiAoYWxpYXMpIHtcbiAgICAgICAgYWNjW2FsaWFzXSA9IGtleTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGFjYztcbiAgICB9XG5cbiAgICBhY2Nbb3B0aW9ucy5zaG9ydGN1dHNba2V5XV0gPSBrZXk7XG4gICAgcmV0dXJuIGFjYztcbiAgfSwge30pO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZW1vamllcyksXG4gICAgICBuYW1lcztcblxuICAvLyBJZiBubyBkZWZpbml0aW9ucyBhcmUgZ2l2ZW4sIHJldHVybiBlbXB0eSByZWdleCB0byBhdm9pZCByZXBsYWNlbWVudHMgd2l0aCAndW5kZWZpbmVkJy5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgbmFtZXMgPSAnXiQnO1xuICB9IGVsc2Uge1xuICAgIC8vIENvbXBpbGUgcmVnZXhwXG4gICAgbmFtZXMgPSBrZXlzXG4gICAgICAubWFwKGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiAnOicgKyBuYW1lICsgJzonOyB9KVxuICAgICAgLmNvbmNhdChPYmplY3Qua2V5cyhzaG9ydGN1dHMpKVxuICAgICAgLnNvcnQoKVxuICAgICAgLnJldmVyc2UoKVxuICAgICAgLm1hcChmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gcXVvdGVSRShuYW1lKTsgfSlcbiAgICAgIC5qb2luKCd8Jyk7XG4gIH1cbiAgdmFyIHNjYW5SRSA9IFJlZ0V4cChuYW1lcyk7XG4gIHZhciByZXBsYWNlUkUgPSBSZWdFeHAobmFtZXMsICdnJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZWZzOiBlbW9qaWVzLFxuICAgIHNob3J0Y3V0czogc2hvcnRjdXRzLFxuICAgIHNjYW5SRTogc2NhblJFLFxuICAgIHJlcGxhY2VSRTogcmVwbGFjZVJFXG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtb2ppX2h0bWwodG9rZW5zLCBpZHggLyosIG9wdGlvbnMsIGVudiAqLykge1xuICByZXR1cm4gdG9rZW5zW2lkeF0uY29udGVudDtcbn07XG4iLCIvLyBFbW9qaWVzICYgc2hvcnRjdXRzIHJlcGxhY2VtZW50IGxvZ2ljLlxuLy9cbi8vIE5vdGU6IEluIHRoZW9yeSwgaXQgY291bGQgYmUgZmFzdGVyIHRvIHBhcnNlIDpzbWlsZTogaW4gaW5saW5lIGNoYWluIGFuZFxuLy8gbGVhdmUgb25seSBzaG9ydGN1dHMgaGVyZS4gQnV0LCB3aG8gY2FyZS4uLlxuLy9cblxuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlX3J1bGUobWQsIGVtb2ppZXMsIHNob3J0Y3V0cywgc2NhblJFLCByZXBsYWNlUkUpIHtcbiAgdmFyIGFycmF5UmVwbGFjZUF0ID0gbWQudXRpbHMuYXJyYXlSZXBsYWNlQXQsXG4gICAgICB1Y20gPSBtZC51dGlscy5saWIudWNtaWNybyxcbiAgICAgIFpQQ2MgPSBuZXcgUmVnRXhwKFsgdWNtLlouc291cmNlLCB1Y20uUC5zb3VyY2UsIHVjbS5DYy5zb3VyY2UgXS5qb2luKCd8JykpO1xuXG4gIGZ1bmN0aW9uIHNwbGl0VGV4dFRva2VuKHRleHQsIGxldmVsLCBUb2tlbikge1xuICAgIHZhciB0b2tlbiwgbGFzdF9wb3MgPSAwLCBub2RlcyA9IFtdO1xuXG4gICAgdGV4dC5yZXBsYWNlKHJlcGxhY2VSRSwgZnVuY3Rpb24gKG1hdGNoLCBvZmZzZXQsIHNyYykge1xuICAgICAgdmFyIGVtb2ppX25hbWU7XG4gICAgICAvLyBWYWxpZGF0ZSBlbW9qaSBuYW1lXG4gICAgICBpZiAoc2hvcnRjdXRzLmhhc093blByb3BlcnR5KG1hdGNoKSkge1xuICAgICAgICAvLyByZXBsYWNlIHNob3J0Y3V0IHdpdGggZnVsbCBuYW1lXG4gICAgICAgIGVtb2ppX25hbWUgPSBzaG9ydGN1dHNbbWF0Y2hdO1xuXG4gICAgICAgIC8vIERvbid0IGFsbG93IGxldHRlcnMgYmVmb3JlIGFueSBzaG9ydGN1dCAoYXMgaW4gbm8gXCI6L1wiIGluIGh0dHA6Ly8pXG4gICAgICAgIGlmIChvZmZzZXQgPiAwICYmICFaUENjLnRlc3Qoc3JjW29mZnNldCAtIDFdKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERvbid0IGFsbG93IGxldHRlcnMgYWZ0ZXIgYW55IHNob3J0Y3V0XG4gICAgICAgIGlmIChvZmZzZXQgKyBtYXRjaC5sZW5ndGggPCBzcmMubGVuZ3RoICYmICFaUENjLnRlc3Qoc3JjW29mZnNldCArIG1hdGNoLmxlbmd0aF0pKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbW9qaV9uYW1lID0gbWF0Y2guc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgbmV3IHRva2VucyB0byBwZW5kaW5nIGxpc3RcbiAgICAgIGlmIChvZmZzZXQgPiBsYXN0X3Bvcykge1xuICAgICAgICB0b2tlbiAgICAgICAgID0gbmV3IFRva2VuKCd0ZXh0JywgJycsIDApO1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gdGV4dC5zbGljZShsYXN0X3Bvcywgb2Zmc2V0KTtcbiAgICAgICAgbm9kZXMucHVzaCh0b2tlbik7XG4gICAgICB9XG5cbiAgICAgIHRva2VuICAgICAgICAgPSBuZXcgVG9rZW4oJ2Vtb2ppJywgJycsIDApO1xuICAgICAgdG9rZW4ubWFya3VwICA9IGVtb2ppX25hbWU7XG4gICAgICB0b2tlbi5jb250ZW50ID0gZW1vamllc1tlbW9qaV9uYW1lXTtcbiAgICAgIG5vZGVzLnB1c2godG9rZW4pO1xuXG4gICAgICBsYXN0X3BvcyA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcbiAgICB9KTtcblxuICAgIGlmIChsYXN0X3BvcyA8IHRleHQubGVuZ3RoKSB7XG4gICAgICB0b2tlbiAgICAgICAgID0gbmV3IFRva2VuKCd0ZXh0JywgJycsIDApO1xuICAgICAgdG9rZW4uY29udGVudCA9IHRleHQuc2xpY2UobGFzdF9wb3MpO1xuICAgICAgbm9kZXMucHVzaCh0b2tlbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGVtb2ppX3JlcGxhY2Uoc3RhdGUpIHtcbiAgICB2YXIgaSwgaiwgbCwgdG9rZW5zLCB0b2tlbixcbiAgICAgICAgYmxvY2tUb2tlbnMgPSBzdGF0ZS50b2tlbnMsXG4gICAgICAgIGF1dG9saW5rTGV2ZWwgPSAwO1xuXG4gICAgZm9yIChqID0gMCwgbCA9IGJsb2NrVG9rZW5zLmxlbmd0aDsgaiA8IGw7IGorKykge1xuICAgICAgaWYgKGJsb2NrVG9rZW5zW2pdLnR5cGUgIT09ICdpbmxpbmUnKSB7IGNvbnRpbnVlOyB9XG4gICAgICB0b2tlbnMgPSBibG9ja1Rva2Vuc1tqXS5jaGlsZHJlbjtcblxuICAgICAgLy8gV2Ugc2NhbiBmcm9tIHRoZSBlbmQsIHRvIGtlZXAgcG9zaXRpb24gd2hlbiBuZXcgdGFncyBhZGRlZC5cbiAgICAgIC8vIFVzZSByZXZlcnNlZCBsb2dpYyBpbiBsaW5rcyBzdGFydC9lbmQgbWF0Y2hcbiAgICAgIGZvciAoaSA9IHRva2Vucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgICBpZiAodG9rZW4udHlwZSA9PT0gJ2xpbmtfb3BlbicgfHwgdG9rZW4udHlwZSA9PT0gJ2xpbmtfY2xvc2UnKSB7XG4gICAgICAgICAgaWYgKHRva2VuLmluZm8gPT09ICdhdXRvJykgeyBhdXRvbGlua0xldmVsIC09IHRva2VuLm5lc3Rpbmc7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSAndGV4dCcgJiYgYXV0b2xpbmtMZXZlbCA9PT0gMCAmJiBzY2FuUkUudGVzdCh0b2tlbi5jb250ZW50KSkge1xuICAgICAgICAgIC8vIHJlcGxhY2UgY3VycmVudCBub2RlXG4gICAgICAgICAgYmxvY2tUb2tlbnNbal0uY2hpbGRyZW4gPSB0b2tlbnMgPSBhcnJheVJlcGxhY2VBdChcbiAgICAgICAgICAgIHRva2VucywgaSwgc3BsaXRUZXh0VG9rZW4odG9rZW4uY29udGVudCwgdG9rZW4ubGV2ZWwsIHN0YXRlLlRva2VuKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5zX3BsdWdpbihtZCkge1xuICAvLyBJbnNlcnQgZWFjaCBtYXJrZXIgYXMgYSBzZXBhcmF0ZSB0ZXh0IHRva2VuLCBhbmQgYWRkIGl0IHRvIGRlbGltaXRlciBsaXN0XG4gIC8vXG4gIGZ1bmN0aW9uIHRva2VuaXplKHN0YXRlLCBzaWxlbnQpIHtcbiAgICB2YXIgaSwgc2Nhbm5lZCwgdG9rZW4sIGxlbiwgY2gsXG4gICAgICAgIHN0YXJ0ID0gc3RhdGUucG9zLFxuICAgICAgICBtYXJrZXIgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCk7XG5cbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgaWYgKG1hcmtlciAhPT0gMHgzRC8qID0gKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICBzY2FubmVkID0gc3RhdGUuc2NhbkRlbGltcyhzdGF0ZS5wb3MsIHRydWUpO1xuICAgIGxlbiA9IHNjYW5uZWQubGVuZ3RoO1xuICAgIGNoID0gU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpO1xuXG4gICAgaWYgKGxlbiA8IDIpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICBpZiAobGVuICUgMikge1xuICAgICAgdG9rZW4gICAgICAgICA9IHN0YXRlLnB1c2goJ3RleHQnLCAnJywgMCk7XG4gICAgICB0b2tlbi5jb250ZW50ID0gY2g7XG4gICAgICBsZW4tLTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICAgIHRva2VuICAgICAgICAgPSBzdGF0ZS5wdXNoKCd0ZXh0JywgJycsIDApO1xuICAgICAgdG9rZW4uY29udGVudCA9IGNoICsgY2g7XG5cbiAgICAgIGlmICghc2Nhbm5lZC5jYW5fb3BlbiAmJiAhc2Nhbm5lZC5jYW5fY2xvc2UpIHsgY29udGludWU7IH1cblxuICAgICAgc3RhdGUuZGVsaW1pdGVycy5wdXNoKHtcbiAgICAgICAgbWFya2VyOiBtYXJrZXIsXG4gICAgICAgIGxlbmd0aDogMCwgICAgIC8vIGRpc2FibGUgXCJydWxlIG9mIDNcIiBsZW5ndGggY2hlY2tzIG1lYW50IGZvciBlbXBoYXNpc1xuICAgICAgICBqdW1wOiAgIGkgLyAyLCAvLyAxIGRlbGltaXRlciA9IDIgY2hhcmFjdGVyc1xuICAgICAgICB0b2tlbjogIHN0YXRlLnRva2Vucy5sZW5ndGggLSAxLFxuICAgICAgICBlbmQ6ICAgIC0xLFxuICAgICAgICBvcGVuOiAgIHNjYW5uZWQuY2FuX29wZW4sXG4gICAgICAgIGNsb3NlOiAgc2Nhbm5lZC5jYW5fY2xvc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0YXRlLnBvcyArPSBzY2FubmVkLmxlbmd0aDtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cblxuICAvLyBXYWxrIHRocm91Z2ggZGVsaW1pdGVyIGxpc3QgYW5kIHJlcGxhY2UgdGV4dCB0b2tlbnMgd2l0aCB0YWdzXG4gIC8vXG4gIGZ1bmN0aW9uIHBvc3RQcm9jZXNzKHN0YXRlLCBkZWxpbWl0ZXJzKSB7XG4gICAgdmFyIGksIGosXG4gICAgICAgIHN0YXJ0RGVsaW0sXG4gICAgICAgIGVuZERlbGltLFxuICAgICAgICB0b2tlbixcbiAgICAgICAgbG9uZU1hcmtlcnMgPSBbXSxcbiAgICAgICAgbWF4ID0gZGVsaW1pdGVycy5sZW5ndGg7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbWF4OyBpKyspIHtcbiAgICAgIHN0YXJ0RGVsaW0gPSBkZWxpbWl0ZXJzW2ldO1xuXG4gICAgICBpZiAoc3RhcnREZWxpbS5tYXJrZXIgIT09IDB4M0QvKiA9ICovKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhcnREZWxpbS5lbmQgPT09IC0xKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbmREZWxpbSA9IGRlbGltaXRlcnNbc3RhcnREZWxpbS5lbmRdO1xuXG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUudG9rZW5zW3N0YXJ0RGVsaW0udG9rZW5dO1xuICAgICAgdG9rZW4udHlwZSAgICA9ICdtYXJrX29wZW4nO1xuICAgICAgdG9rZW4udGFnICAgICA9ICdtYXJrJztcbiAgICAgIHRva2VuLm5lc3RpbmcgPSAxO1xuICAgICAgdG9rZW4ubWFya3VwICA9ICc9PSc7XG4gICAgICB0b2tlbi5jb250ZW50ID0gJyc7XG5cbiAgICAgIHRva2VuICAgICAgICAgPSBzdGF0ZS50b2tlbnNbZW5kRGVsaW0udG9rZW5dO1xuICAgICAgdG9rZW4udHlwZSAgICA9ICdtYXJrX2Nsb3NlJztcbiAgICAgIHRva2VuLnRhZyAgICAgPSAnbWFyayc7XG4gICAgICB0b2tlbi5uZXN0aW5nID0gLTE7XG4gICAgICB0b2tlbi5tYXJrdXAgID0gJz09JztcbiAgICAgIHRva2VuLmNvbnRlbnQgPSAnJztcblxuICAgICAgaWYgKHN0YXRlLnRva2Vuc1tlbmREZWxpbS50b2tlbiAtIDFdLnR5cGUgPT09ICd0ZXh0JyAmJlxuICAgICAgICAgIHN0YXRlLnRva2Vuc1tlbmREZWxpbS50b2tlbiAtIDFdLmNvbnRlbnQgPT09ICc9Jykge1xuXG4gICAgICAgIGxvbmVNYXJrZXJzLnB1c2goZW5kRGVsaW0udG9rZW4gLSAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBhIG1hcmtlciBzZXF1ZW5jZSBoYXMgYW4gb2RkIG51bWJlciBvZiBjaGFyYWN0ZXJzLCBpdCdzIHNwbGl0dGVkXG4gICAgLy8gbGlrZSB0aGlzOiBgfn5+fn5gIC0+IGB+YCArIGB+fmAgKyBgfn5gLCBsZWF2aW5nIG9uZSBtYXJrZXIgYXQgdGhlXG4gICAgLy8gc3RhcnQgb2YgdGhlIHNlcXVlbmNlLlxuICAgIC8vXG4gICAgLy8gU28sIHdlIGhhdmUgdG8gbW92ZSBhbGwgdGhvc2UgbWFya2VycyBhZnRlciBzdWJzZXF1ZW50IHNfY2xvc2UgdGFncy5cbiAgICAvL1xuICAgIHdoaWxlIChsb25lTWFya2Vycy5sZW5ndGgpIHtcbiAgICAgIGkgPSBsb25lTWFya2Vycy5wb3AoKTtcbiAgICAgIGogPSBpICsgMTtcblxuICAgICAgd2hpbGUgKGogPCBzdGF0ZS50b2tlbnMubGVuZ3RoICYmIHN0YXRlLnRva2Vuc1tqXS50eXBlID09PSAnbWFya19jbG9zZScpIHtcbiAgICAgICAgaisrO1xuICAgICAgfVxuXG4gICAgICBqLS07XG5cbiAgICAgIGlmIChpICE9PSBqKSB7XG4gICAgICAgIHRva2VuID0gc3RhdGUudG9rZW5zW2pdO1xuICAgICAgICBzdGF0ZS50b2tlbnNbal0gPSBzdGF0ZS50b2tlbnNbaV07XG4gICAgICAgIHN0YXRlLnRva2Vuc1tpXSA9IHRva2VuO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG1kLmlubGluZS5ydWxlci5iZWZvcmUoJ2VtcGhhc2lzJywgJ21hcmsnLCB0b2tlbml6ZSk7XG4gIG1kLmlubGluZS5ydWxlcjIuYmVmb3JlKCdlbXBoYXNpcycsICdtYXJrJywgZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgdmFyIGN1cnIsXG4gICAgICAgIHRva2Vuc19tZXRhID0gc3RhdGUudG9rZW5zX21ldGEsXG4gICAgICAgIG1heCA9IChzdGF0ZS50b2tlbnNfbWV0YSB8fCBbXSkubGVuZ3RoO1xuXG4gICAgcG9zdFByb2Nlc3Moc3RhdGUsIHN0YXRlLmRlbGltaXRlcnMpO1xuXG4gICAgZm9yIChjdXJyID0gMDsgY3VyciA8IG1heDsgY3VycisrKSB7XG4gICAgICBpZiAodG9rZW5zX21ldGFbY3Vycl0gJiYgdG9rZW5zX21ldGFbY3Vycl0uZGVsaW1pdGVycykge1xuICAgICAgICBwb3N0UHJvY2VzcyhzdGF0ZSwgdG9rZW5zX21ldGFbY3Vycl0uZGVsaW1pdGVycyk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG52YXIgREZBID0gcmVxdWlyZSgnLi9saWIvZGZhLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbXVsdGltZF90YWJsZV9wbHVnaW4obWQsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmF1bHRzID0ge1xuICAgIG11bHRpbGluZTogIGZhbHNlLFxuICAgIHJvd3NwYW46ICAgIGZhbHNlLFxuICAgIGhlYWRlcmxlc3M6IGZhbHNlLFxuICAgIG11bHRpYm9keTogIHRydWVcbiAgfTtcbiAgb3B0aW9ucyA9IG1kLnV0aWxzLmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdGlvbnMgfHwge30pO1xuXG4gIGZ1bmN0aW9uIHNjYW5fYm91bmRfaW5kaWNlcyhzdGF0ZSwgbGluZSkge1xuICAgIC8qKlxuICAgICAqIE5hbWluZyBjb252ZW50aW9uIG9mIHBvc2l0aW9uYWwgdmFyaWFibGVzXG4gICAgICogLSBsaXN0LWl0ZW1cbiAgICAgKiDCt8K3wrfCt8K3wrfCt8K3wrdsb25ndGV4dMK3wrfCt8K3wrfCt1xcblxuICAgICAqICAgXmhlYWQgIF5zdGFydCAgXmVuZCAgXm1heFxuICAgICAqL1xuICAgIHZhciBzdGFydCA9IHN0YXRlLmJNYXJrc1tsaW5lXSArIHN0YXRlLnNDb3VudFtsaW5lXSxcbiAgICAgICAgaGVhZCA9IHN0YXRlLmJNYXJrc1tsaW5lXSArIHN0YXRlLmJsa0luZGVudCxcbiAgICAgICAgZW5kID0gc3RhdGUuc2tpcFNwYWNlc0JhY2soc3RhdGUuZU1hcmtzW2xpbmVdLCBoZWFkKSxcbiAgICAgICAgYm91bmRzID0gW10sIHBvcywgcG9zanVtcCxcbiAgICAgICAgZXNjYXBlID0gZmFsc2UsIGNvZGUgPSBmYWxzZTtcblxuICAgIC8qIFNjYW4gZm9yIHZhbGlkIHBpcGUgY2hhcmFjdGVyIHBvc2l0aW9uICovXG4gICAgZm9yIChwb3MgPSBzdGFydDsgcG9zIDwgZW5kOyBwb3MrKykge1xuICAgICAgc3dpdGNoIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpKSB7XG4gICAgICAgIGNhc2UgMHg1YyAvKiBcXCAqLzpcbiAgICAgICAgICBlc2NhcGUgPSB0cnVlOyBicmVhaztcbiAgICAgICAgY2FzZSAweDYwIC8qIGAgKi86XG4gICAgICAgICAgcG9zanVtcCA9IHN0YXRlLnNraXBDaGFycyhwb3MsIDB4NjApIC0gMTtcbiAgICAgICAgICAvKiBtYWtlIFxcYCBjbG9zZXMgdGhlIGNvZGUgc2VxdWVuY2UsIGJ1dCBub3Qgb3BlbiBpdDtcbiAgICAgICAgICAgICB0aGUgcmVhc29uIGlzIHRoYXQgYFxcYCBpcyBjb3JyZWN0IGNvZGUgYmxvY2sgKi9cbiAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgYnJhY2Utc3R5bGUgKi9cbiAgICAgICAgICBpZiAocG9zanVtcCA+IHBvcykgeyBwb3MgPSBwb3NqdW1wOyB9XG4gICAgICAgICAgZWxzZSBpZiAoY29kZSB8fCAhZXNjYXBlKSB7IGNvZGUgPSAhY29kZTsgfVxuICAgICAgICAgIGVzY2FwZSA9IGZhbHNlOyBicmVhaztcbiAgICAgICAgY2FzZSAweDdjIC8qIHwgKi86XG4gICAgICAgICAgaWYgKCFjb2RlICYmICFlc2NhcGUpIHsgYm91bmRzLnB1c2gocG9zKTsgfVxuICAgICAgICAgIGVzY2FwZSA9IGZhbHNlOyBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBlc2NhcGUgPSBmYWxzZTsgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChib3VuZHMubGVuZ3RoID09PSAwKSByZXR1cm4gYm91bmRzO1xuXG4gICAgLyogUGFkIGluIG5ld2xpbmUgY2hhcmFjdGVycyBvbiBsYXN0IGFuZCB0aGlzIGxpbmUgKi9cbiAgICBpZiAoYm91bmRzWzBdID4gaGVhZCkgeyBib3VuZHMudW5zaGlmdChoZWFkIC0gMSk7IH1cbiAgICBpZiAoYm91bmRzW2JvdW5kcy5sZW5ndGggLSAxXSA8IGVuZCAtIDEpIHsgYm91bmRzLnB1c2goZW5kKTsgfVxuXG4gICAgcmV0dXJuIGJvdW5kcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhYmxlX2NhcHRpb24oc3RhdGUsIHNpbGVudCwgbGluZSkge1xuICAgIHZhciBtZXRhID0geyB0ZXh0OiBudWxsLCBsYWJlbDogbnVsbCB9LFxuICAgICAgICBzdGFydCA9IHN0YXRlLmJNYXJrc1tsaW5lXSArIHN0YXRlLnNDb3VudFtsaW5lXSxcbiAgICAgICAgbWF4ID0gc3RhdGUuZU1hcmtzW2xpbmVdLFxuICAgICAgICBjYXBSRSA9IC9eXFxbKFteXFxbXFxdXSspXFxdKFxcWyhbXlxcW1xcXV0rKVxcXSk/XFxzKiQvLFxuICAgICAgICBtYXRjaGVzID0gc3RhdGUuc3JjLnNsaWNlKHN0YXJ0LCBtYXgpLm1hdGNoKGNhcFJFKTtcblxuICAgIGlmICghbWF0Y2hlcykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICBpZiAoc2lsZW50KSAgeyByZXR1cm4gdHJ1ZTsgfVxuICAgIC8vIFRPRE8gZWxpbWluYXRlIGNhcFJFIGJ5IHNpbXBsZSBjaGVja2luZ1xuXG4gICAgbWV0YS50ZXh0ICA9IG1hdGNoZXNbMV07XG4gICAgbWV0YS5sYWJlbCA9IG1hdGNoZXNbMl0gfHwgbWF0Y2hlc1sxXTtcbiAgICBtZXRhLmxhYmVsID0gbWV0YS5sYWJlbC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcVysvZywgJycpO1xuXG4gICAgcmV0dXJuIG1ldGE7XG4gIH1cblxuICBmdW5jdGlvbiB0YWJsZV9yb3coc3RhdGUsIHNpbGVudCwgbGluZSkge1xuICAgIHZhciBtZXRhID0geyBib3VuZHM6IG51bGwsIG11bHRpbGluZTogbnVsbCB9LFxuICAgICAgICBib3VuZHMgPSBzY2FuX2JvdW5kX2luZGljZXMoc3RhdGUsIGxpbmUpLFxuICAgICAgICBzdGFydCwgcG9zLCBvbGRNYXg7XG5cbiAgICBpZiAoYm91bmRzLmxlbmd0aCA8IDIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gICAgbWV0YS5ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKiBNdWx0aWxpbmUuIFNjYW4gYm91bmRhcmllcyBhZ2FpbiBzaW5jZSBpdCdzIHZlcnkgY29tcGxpY2F0ZWQgKi9cbiAgICBpZiAob3B0aW9ucy5tdWx0aWxpbmUpIHtcbiAgICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW2xpbmVdICsgc3RhdGUuc0NvdW50W2xpbmVdO1xuICAgICAgcG9zID0gc3RhdGUuZU1hcmtzW2xpbmVdIC0gMTsgLyogd2hlcmUgYmFja3NsYXNoIHNob3VsZCBiZSAqL1xuICAgICAgbWV0YS5tdWx0aWxpbmUgPSAoc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSA9PT0gMHg1Qy8qIFxcICovKTtcbiAgICAgIGlmIChtZXRhLm11bHRpbGluZSkge1xuICAgICAgICBvbGRNYXggPSBzdGF0ZS5lTWFya3NbbGluZV07XG4gICAgICAgIHN0YXRlLmVNYXJrc1tsaW5lXSA9IHN0YXRlLnNraXBTcGFjZXNCYWNrKHBvcywgc3RhcnQpO1xuICAgICAgICBtZXRhLmJvdW5kcyA9IHNjYW5fYm91bmRfaW5kaWNlcyhzdGF0ZSwgbGluZSk7XG4gICAgICAgIHN0YXRlLmVNYXJrc1tsaW5lXSA9IG9sZE1heDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWV0YTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhYmxlX3NlcGFyYXRvcihzdGF0ZSwgc2lsZW50LCBsaW5lKSB7XG4gICAgdmFyIG1ldGEgPSB7IGFsaWduczogW10sIHdyYXBzOiBbXSB9LFxuICAgICAgICBib3VuZHMgPSBzY2FuX2JvdW5kX2luZGljZXMoc3RhdGUsIGxpbmUpLFxuICAgICAgICBzZXBSRSA9IC9eOj8oLSt8PSspOj9cXCs/JC8sXG4gICAgICAgIGMsIHRleHQsIGFsaWduO1xuXG4gICAgLyogT25seSBzZXBhcmF0b3IgbmVlZHMgdG8gY2hlY2sgaW5kZW50cyAqL1xuICAgIGlmIChzdGF0ZS5zQ291bnRbbGluZV0gLSBzdGF0ZS5ibGtJbmRlbnQgPj0gNCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICBpZiAoYm91bmRzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIGZvciAoYyA9IDA7IGMgPCBib3VuZHMubGVuZ3RoIC0gMTsgYysrKSB7XG4gICAgICB0ZXh0ID0gc3RhdGUuc3JjLnNsaWNlKGJvdW5kc1tjXSArIDEsIGJvdW5kc1tjICsgMV0pLnRyaW0oKTtcbiAgICAgIGlmICghc2VwUkUudGVzdCh0ZXh0KSkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgICAgbWV0YS53cmFwcy5wdXNoKHRleHQuY2hhckNvZGVBdCh0ZXh0Lmxlbmd0aCAtIDEpID09PSAweDJCLyogKyAqLyk7XG4gICAgICBhbGlnbiA9ICgodGV4dC5jaGFyQ29kZUF0KDApID09PSAweDNBLyogOiAqLykgPDwgNCkgfFxuICAgICAgICAgICAgICAgKHRleHQuY2hhckNvZGVBdCh0ZXh0Lmxlbmd0aCAtIDEgLSBtZXRhLndyYXBzW2NdKSA9PT0gMHgzQSk7XG4gICAgICBzd2l0Y2ggKGFsaWduKSB7XG4gICAgICAgIGNhc2UgMHgwMDogbWV0YS5hbGlnbnMucHVzaCgnJyk7ICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MDE6IG1ldGEuYWxpZ25zLnB1c2goJ3JpZ2h0Jyk7ICBicmVhaztcbiAgICAgICAgY2FzZSAweDEwOiBtZXRhLmFsaWducy5wdXNoKCdsZWZ0Jyk7ICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgxMTogbWV0YS5hbGlnbnMucHVzaCgnY2VudGVyJyk7IGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG4gICAgcmV0dXJuIG1ldGE7XG4gIH1cblxuICBmdW5jdGlvbiB0YWJsZV9lbXB0eShzdGF0ZSwgc2lsZW50LCBsaW5lKSB7XG4gICAgcmV0dXJuIHN0YXRlLmlzRW1wdHkobGluZSk7XG4gIH1cblxuICBmdW5jdGlvbiB0YWJsZShzdGF0ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLCBzaWxlbnQpIHtcbiAgICAvKipcbiAgICAgKiBSZWdleCBwc2V1ZG8gY29kZSBmb3IgdGFibGU6XG4gICAgICogICAgIGNhcHRpb24/IGhlYWRlcisgc2VwYXJhdG9yIChkYXRhKyBlbXB0eSkqIGRhdGErIGNhcHRpb24/XG4gICAgICpcbiAgICAgKiBXZSB1c2UgREZBIHRvIGVtdWxhdGUgdGhpcyBwbHVnaW4uIFR5cGVzIHdpdGggbG93ZXIgcHJlY2VkZW5jZSBhcmVcbiAgICAgKiBzZXQtbWludXMgZnJvbSBhbGwgdGhlIGZvcm1lcnMuICBOb3RlZCB0aGF0IHNlcGFyYXRvciBzaG91bGQgaGF2ZSBoaWdoZXJcbiAgICAgKiBwcmVjZWRlbmNlIHRoYW4gaGVhZGVyIG9yIGRhdGEuXG4gICAgICogICB8ICBzdGF0ZSAgfCBjYXB0aW9uIHNlcGFyYXRvciBoZWFkZXIgZGF0YSBlbXB0eSB8IC0tPiBsb3dlciBwcmVjZWRlbmNlXG4gICAgICogICB8IDB4MTAxMDAgfCAgICAxICAgICAgICAwICAgICAgIDEgICAgIDAgICAgIDAgICB8XG4gICAgICovXG4gICAgdmFyIHRhYmxlREZBID0gbmV3IERGQSgpLFxuICAgICAgICBncnAgPSAweDEwLCBtdHIgPSAtMSxcbiAgICAgICAgdG9rZW4sIHRhYmxlVG9rZW4sIHRyVG9rZW4sXG4gICAgICAgIGNvbHNwYW4sIGxlZnRUb2tlbixcbiAgICAgICAgcm93c3BhbiwgdXBUb2tlbnMgPSBbXSxcbiAgICAgICAgdGFibGVMaW5lcywgdGdyb3VwTGluZXMsXG4gICAgICAgIHRhZywgdGV4dCwgcmFuZ2UsIHIsIGMsIGI7XG5cbiAgICBpZiAoc3RhcnRMaW5lICsgMiA+IGVuZExpbmUpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJzdCBwYXNzOiB2YWxpZGF0ZSBhbmQgY29sbGVjdCBpbmZvIGludG8gdGFibGUgdG9rZW4uIElSIGlzIHN0b3JlZCBpblxuICAgICAqIG1hcmtkb3duLWl0IGB0b2tlbi5tZXRhYCB0byBiZSBwdXNoZWQgbGF0ZXIuIHRhYmxlL3RyIG9wZW4gdG9rZW5zIGFyZVxuICAgICAqIGdlbmVyYXRlZCBoZXJlLlxuICAgICAqL1xuICAgIHRhYmxlVG9rZW4gICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ3RhYmxlX29wZW4nLCAndGFibGUnLCAxKTtcbiAgICB0YWJsZVRva2VuLm1ldGEgID0geyBzZXA6IG51bGwsIGNhcDogbnVsbCwgdHI6IFtdIH07XG5cbiAgICB0YWJsZURGQS5zZXRfaGlnaGVzdF9hbHBoYWJldCgweDEwMDAwKTtcbiAgICB0YWJsZURGQS5zZXRfaW5pdGlhbF9zdGF0ZSgweDEwMTAwKTtcbiAgICB0YWJsZURGQS5zZXRfYWNjZXB0X3N0YXRlcyhbIDB4MTAwMTAsIDB4MTAwMTEsIDB4MDAwMDAgXSk7XG4gICAgdGFibGVERkEuc2V0X21hdGNoX2FscGhhYmV0cyh7XG4gICAgICAweDEwMDAwOiB0YWJsZV9jYXB0aW9uLmJpbmQodGhpcywgc3RhdGUsIHRydWUpLFxuICAgICAgMHgwMTAwMDogdGFibGVfc2VwYXJhdG9yLmJpbmQodGhpcywgc3RhdGUsIHRydWUpLFxuICAgICAgMHgwMDEwMDogdGFibGVfcm93LmJpbmQodGhpcywgc3RhdGUsIHRydWUpLFxuICAgICAgMHgwMDAxMDogdGFibGVfcm93LmJpbmQodGhpcywgc3RhdGUsIHRydWUpLFxuICAgICAgMHgwMDAwMTogdGFibGVfZW1wdHkuYmluZCh0aGlzLCBzdGF0ZSwgdHJ1ZSlcbiAgICB9KTtcbiAgICB0YWJsZURGQS5zZXRfdHJhbnNpdGlvbnMoe1xuICAgICAgMHgxMDEwMDogeyAweDEwMDAwOiAweDAwMTAwLCAweDAwMTAwOiAweDAxMTAwIH0sXG4gICAgICAweDAwMTAwOiB7IDB4MDAxMDA6IDB4MDExMDAgfSxcbiAgICAgIDB4MDExMDA6IHsgMHgwMTAwMDogMHgxMDAxMCwgMHgwMDEwMDogMHgwMTEwMCB9LFxuICAgICAgMHgxMDAxMDogeyAweDEwMDAwOiAweDAwMDAwLCAweDAwMDEwOiAweDEwMDExIH0sXG4gICAgICAweDEwMDExOiB7IDB4MTAwMDA6IDB4MDAwMDAsIDB4MDAwMTA6IDB4MTAwMTEsIDB4MDAwMDE6IDB4MTAwMTAgfVxuICAgIH0pO1xuICAgIGlmIChvcHRpb25zLmhlYWRlcmxlc3MpIHtcbiAgICAgIHRhYmxlREZBLnNldF9pbml0aWFsX3N0YXRlKDB4MTExMDApO1xuICAgICAgdGFibGVERkEudXBkYXRlX3RyYW5zaXRpb24oMHgxMTEwMCxcbiAgICAgICAgeyAweDEwMDAwOiAweDAxMTAwLCAweDAxMDAwOiAweDEwMDEwLCAweDAwMTAwOiAweDAxMTAwIH1cbiAgICAgICk7XG4gICAgICB0clRva2VuICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ3RhYmxlX2Zha2VfaGVhZGVyX3JvdycsICd0cicsIDEpO1xuICAgICAgdHJUb2tlbi5tZXRhID0gT2JqZWN0KCk7ICAvLyBhdm9pZCB0clRva2VuLm1ldGEuZ3JwIHRocm93cyBleGNlcHRpb25cbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLm11bHRpYm9keSkge1xuICAgICAgdGFibGVERkEudXBkYXRlX3RyYW5zaXRpb24oMHgxMDAxMCxcbiAgICAgICAgeyAweDEwMDAwOiAweDAwMDAwLCAweDAwMDEwOiAweDEwMDEwIH0gIC8vIDB4MTAwMTEgaXMgbmV2ZXIgcmVhY2hlZFxuICAgICAgKTtcbiAgICB9XG4gICAgLyogRG9uJ3QgbWl4IHVwIERGQSBgX3N0YXRlYCBhbmQgbWFya2Rvd24taXQgYHN0YXRlYCAqL1xuICAgIHRhYmxlREZBLnNldF9hY3Rpb25zKGZ1bmN0aW9uIChfbGluZSwgX3N0YXRlLCBfdHlwZSkge1xuICAgICAgLy8gY29uc29sZS5sb2coX2xpbmUsIF9zdGF0ZS50b1N0cmluZygxNiksIF90eXBlLnRvU3RyaW5nKDE2KSkgIC8vIGZvciB0ZXN0XG4gICAgICBzd2l0Y2ggKF90eXBlKSB7XG4gICAgICAgIGNhc2UgMHgxMDAwMDpcbiAgICAgICAgICBpZiAodGFibGVUb2tlbi5tZXRhLmNhcCkgeyBicmVhazsgfVxuICAgICAgICAgIHRhYmxlVG9rZW4ubWV0YS5jYXAgICAgICAgPSB0YWJsZV9jYXB0aW9uKHN0YXRlLCBmYWxzZSwgX2xpbmUpO1xuICAgICAgICAgIHRhYmxlVG9rZW4ubWV0YS5jYXAubWFwICAgPSBbIF9saW5lLCBfbGluZSArIDEgXTtcbiAgICAgICAgICB0YWJsZVRva2VuLm1ldGEuY2FwLmZpcnN0ID0gKF9saW5lID09PSBzdGFydExpbmUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDB4MDEwMDA6XG4gICAgICAgICAgdGFibGVUb2tlbi5tZXRhLnNlcCAgICAgPSB0YWJsZV9zZXBhcmF0b3Ioc3RhdGUsIGZhbHNlLCBfbGluZSk7XG4gICAgICAgICAgdGFibGVUb2tlbi5tZXRhLnNlcC5tYXAgPSBbIF9saW5lLCBfbGluZSArIDEgXTtcbiAgICAgICAgICB0clRva2VuLm1ldGEuZ3JwIHw9IDB4MDE7ICAvLyBwcmV2aW91c2x5IGFzc2lnbmVkIGF0IGNhc2UgMHgwMDExMFxuICAgICAgICAgIGdycCAgICAgICAgICAgICAgID0gMHgxMDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAweDAwMTAwOlxuICAgICAgICBjYXNlIDB4MDAwMTA6XG4gICAgICAgICAgdHJUb2tlbiAgICAgICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ3RyX29wZW4nLCAndHInLCAxKTtcbiAgICAgICAgICB0clRva2VuLm1hcCAgICAgICA9IFsgX2xpbmUsIF9saW5lICsgMSBdO1xuICAgICAgICAgIHRyVG9rZW4ubWV0YSAgICAgID0gdGFibGVfcm93KHN0YXRlLCBmYWxzZSwgX2xpbmUpO1xuICAgICAgICAgIHRyVG9rZW4ubWV0YS50eXBlID0gX3R5cGU7XG4gICAgICAgICAgdHJUb2tlbi5tZXRhLmdycCAgPSBncnA7XG4gICAgICAgICAgZ3JwICAgICAgICAgICAgICAgPSAweDAwO1xuICAgICAgICAgIHRhYmxlVG9rZW4ubWV0YS50ci5wdXNoKHRyVG9rZW4pO1xuICAgICAgICAgIC8qIE11bHRpbGluZS4gTWVyZ2UgdHJUb2tlbnMgYXMgYW4gZW50aXJlIG11bHRpbGluZSB0clRva2VuICovXG4gICAgICAgICAgaWYgKG9wdGlvbnMubXVsdGlsaW5lKSB7XG4gICAgICAgICAgICBpZiAodHJUb2tlbi5tZXRhLm11bHRpbGluZSAmJiBtdHIgPCAwKSB7XG4gICAgICAgICAgICAgIC8qIFN0YXJ0IGxpbmUgb2YgbXVsdGlsaW5lIHJvdy4gbWFyayB0aGlzIHRyVG9rZW4gKi9cbiAgICAgICAgICAgICAgbXRyID0gdGFibGVUb2tlbi5tZXRhLnRyLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0clRva2VuLm1ldGEubXVsdGlsaW5lICYmIG10ciA+PSAwKSB7XG4gICAgICAgICAgICAgIC8qIEVuZCBsaW5lIG9mIG11bHRpbGluZSByb3cuIG1lcmdlIGZvcndhcmQgdW50aWwgdGhlIG1hcmtlZCB0clRva2VuICovXG4gICAgICAgICAgICAgIHRva2VuICAgICAgICAgICAgICAgPSB0YWJsZVRva2VuLm1ldGEudHJbbXRyXTtcbiAgICAgICAgICAgICAgdG9rZW4ubWV0YS5tYm91bmRzICA9IHRhYmxlVG9rZW4ubWV0YS50clxuICAgICAgICAgICAgICAgIC5zbGljZShtdHIpLm1hcChmdW5jdGlvbiAodGspIHsgcmV0dXJuIHRrLm1ldGEuYm91bmRzOyB9KTtcbiAgICAgICAgICAgICAgdG9rZW4ubWFwWzFdICAgICAgICA9IHRyVG9rZW4ubWFwWzFdO1xuICAgICAgICAgICAgICB0YWJsZVRva2VuLm1ldGEudHIgID0gdGFibGVUb2tlbi5tZXRhLnRyLnNsaWNlKDAsIG10ciArIDEpO1xuICAgICAgICAgICAgICBtdHIgPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMHgwMDAwMTpcbiAgICAgICAgICB0clRva2VuLm1ldGEuZ3JwIHw9IDB4MDE7XG4gICAgICAgICAgZ3JwICAgICAgICAgICAgICAgPSAweDEwO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRhYmxlREZBLmV4ZWN1dGUoc3RhcnRMaW5lLCBlbmRMaW5lKSA9PT0gZmFsc2UpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgLy8gaWYgKCF0YWJsZVRva2VuLm1ldGEuc2VwKSB7IHJldHVybiBmYWxzZTsgfSAvLyBhbHdheXMgZXZhbHVhdGVkIHRydWVcbiAgICBpZiAoIXRhYmxlVG9rZW4ubWV0YS50ci5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9IC8vIGZhbHNlIHVuZGVyIGhlYWRlcmxlc3MgY29ybmVyIGNhc2VcbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgICAvKiBMYXN0IGRhdGEgcm93IGNhbm5vdCBiZSBkZXRlY3RlZC4gbm90IHN0b3JlZCB0byB0clRva2VuIG91dHNpZGU/ICovXG4gICAgdGFibGVUb2tlbi5tZXRhLnRyW3RhYmxlVG9rZW4ubWV0YS50ci5sZW5ndGggLSAxXS5tZXRhLmdycCB8PSAweDAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBTZWNvbmQgcGFzczogYWN0dWFsbHkgcHVzaCB0aGUgdG9rZW5zIGludG8gYHN0YXRlLnRva2Vuc2AuXG4gICAgICogdGhlYWQvdGJvZHkvdGgvdGQgb3BlbiB0b2tlbnMgYW5kIGFsbCBjbG9zZWQgdG9rZW5zIGFyZSBnZW5lcmF0ZWQgaGVyZTtcbiAgICAgKiB0aGVhZC90Ym9keSBhcmUgZ2VuZXJhbGx5IGNhbGxlZCB0Z3JvdXA7IHRkL3RoIGFyZSBnZW5lcmFsbHkgY2FsbGVkIHRjb2wuXG4gICAgICovXG4gICAgdGFibGVUb2tlbi5tYXAgICA9IHRhYmxlTGluZXMgPSBbIHN0YXJ0TGluZSwgMCBdO1xuICAgIHRhYmxlVG9rZW4uYmxvY2sgPSB0cnVlO1xuICAgIHRhYmxlVG9rZW4ubGV2ZWwgPSBzdGF0ZS5sZXZlbCsrO1xuICAgIHN0YXRlLnRva2Vucy5wdXNoKHRhYmxlVG9rZW4pO1xuXG4gICAgaWYgKHRhYmxlVG9rZW4ubWV0YS5jYXApIHtcbiAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnY2FwdGlvbl9vcGVuJywgJ2NhcHRpb24nLCAxKTtcbiAgICAgIHRva2VuLm1hcCAgICAgID0gdGFibGVUb2tlbi5tZXRhLmNhcC5tYXA7XG4gICAgICB0b2tlbi5hdHRycyAgICA9IFsgWyAnaWQnLCB0YWJsZVRva2VuLm1ldGEuY2FwLmxhYmVsIF0gXTtcblxuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdpbmxpbmUnLCAnJywgMCk7XG4gICAgICB0b2tlbi5jb250ZW50ICA9IHRhYmxlVG9rZW4ubWV0YS5jYXAudGV4dDtcbiAgICAgIHRva2VuLm1hcCAgICAgID0gdGFibGVUb2tlbi5tZXRhLmNhcC5tYXA7XG4gICAgICB0b2tlbi5jaGlsZHJlbiA9IFtdO1xuXG4gICAgICB0b2tlbiAgICAgICAgICA9IHN0YXRlLnB1c2goJ2NhcHRpb25fY2xvc2UnLCAnY2FwdGlvbicsIC0xKTtcbiAgICB9XG5cbiAgICBmb3IgKHIgPSAwOyByIDwgdGFibGVUb2tlbi5tZXRhLnRyLmxlbmd0aDsgcisrKSB7XG4gICAgICBsZWZ0VG9rZW4gPSBuZXcgc3RhdGUuVG9rZW4oJ3RhYmxlX2Zha2VfdGNvbF9vcGVuJywgJycsIDEpO1xuXG4gICAgICAvKiBQdXNoIGluIHRoZWFkL3Rib2R5IGFuZCB0ciBvcGVuIHRva2VucyAqL1xuICAgICAgdHJUb2tlbiA9IHRhYmxlVG9rZW4ubWV0YS50cltyXTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKHRyVG9rZW4ubWV0YSk7IC8vIGZvciB0ZXN0XG4gICAgICBpZiAodHJUb2tlbi5tZXRhLmdycCAmIDB4MTApIHtcbiAgICAgICAgdGFnID0gKHRyVG9rZW4ubWV0YS50eXBlID09PSAweDAwMTAwKSA/ICd0aGVhZCcgOiAndGJvZHknO1xuICAgICAgICB0b2tlbiAgICAgPSBzdGF0ZS5wdXNoKHRhZyArICdfb3BlbicsIHRhZywgMSk7XG4gICAgICAgIHRva2VuLm1hcCA9IHRncm91cExpbmVzID0gWyB0clRva2VuLm1hcFswXSwgMCBdOyAgLy8gYXJyYXkgcmVmXG4gICAgICAgIHVwVG9rZW5zICA9IFtdO1xuICAgICAgfVxuICAgICAgdHJUb2tlbi5ibG9jayA9IHRydWU7XG4gICAgICB0clRva2VuLmxldmVsID0gc3RhdGUubGV2ZWwrKztcbiAgICAgIHN0YXRlLnRva2Vucy5wdXNoKHRyVG9rZW4pO1xuXG4gICAgICAvKiBQdXNoIGluIHRoL3RkIHRva2VucyAqL1xuICAgICAgZm9yIChjID0gMDsgYyA8IHRyVG9rZW4ubWV0YS5ib3VuZHMubGVuZ3RoIC0gMTsgYysrKSB7XG4gICAgICAgIHJhbmdlID0gWyB0clRva2VuLm1ldGEuYm91bmRzW2NdICsgMSwgdHJUb2tlbi5tZXRhLmJvdW5kc1tjICsgMV0gXTtcbiAgICAgICAgdGV4dCA9IHN0YXRlLnNyYy5zbGljZS5hcHBseShzdGF0ZS5zcmMsIHJhbmdlKTtcblxuICAgICAgICBpZiAodGV4dCA9PT0gJycpIHtcbiAgICAgICAgICBjb2xzcGFuID0gbGVmdFRva2VuLmF0dHJHZXQoJ2NvbHNwYW4nKTtcbiAgICAgICAgICBsZWZ0VG9rZW4uYXR0clNldCgnY29sc3BhbicsIGNvbHNwYW4gPT09IG51bGwgPyAyIDogY29sc3BhbiArIDEpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLnJvd3NwYW4gJiYgdXBUb2tlbnNbY10gJiYgdGV4dC50cmltKCkgPT09ICdeXicpIHtcbiAgICAgICAgICByb3dzcGFuID0gdXBUb2tlbnNbY10uYXR0ckdldCgncm93c3BhbicpO1xuICAgICAgICAgIHVwVG9rZW5zW2NdLmF0dHJTZXQoJ3Jvd3NwYW4nLCByb3dzcGFuID09PSBudWxsID8gMiA6IHJvd3NwYW4gKyAxKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhZyA9ICh0clRva2VuLm1ldGEudHlwZSA9PT0gMHgwMDEwMCkgPyAndGgnIDogJ3RkJztcbiAgICAgICAgdG9rZW4gICAgICAgPSBzdGF0ZS5wdXNoKHRhZyArICdfb3BlbicsIHRhZywgMSk7XG4gICAgICAgIHRva2VuLm1hcCAgID0gdHJUb2tlbi5tYXA7XG4gICAgICAgIHRva2VuLmF0dHJzID0gW107XG4gICAgICAgIGlmICh0YWJsZVRva2VuLm1ldGEuc2VwLmFsaWduc1tjXSkge1xuICAgICAgICAgIHRva2VuLmF0dHJzLnB1c2goWyAnc3R5bGUnLCAndGV4dC1hbGlnbjonICsgdGFibGVUb2tlbi5tZXRhLnNlcC5hbGlnbnNbY10gXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRhYmxlVG9rZW4ubWV0YS5zZXAud3JhcHNbY10pIHtcbiAgICAgICAgICB0b2tlbi5hdHRycy5wdXNoKFsgJ2NsYXNzJywgJ2V4dGVuZCcgXSk7XG4gICAgICAgIH1cbiAgICAgICAgbGVmdFRva2VuID0gdXBUb2tlbnNbY10gPSB0b2tlbjtcblxuICAgICAgICAvKiBNdWx0aWxpbmUuIEpvaW4gdGhlIHRleHQgYW5kIGZlZWQgaW50byBtYXJrZG93bi1pdCBibG9ja1BhcnNlci4gKi9cbiAgICAgICAgaWYgKG9wdGlvbnMubXVsdGlsaW5lICYmIHRyVG9rZW4ubWV0YS5tdWx0aWxpbmUgJiYgdHJUb2tlbi5tZXRhLm1ib3VuZHMpIHtcbiAgICAgICAgICB0ZXh0ID0gWyB0ZXh0LnRyaW1SaWdodCgpIF07XG4gICAgICAgICAgZm9yIChiID0gMTsgYiA8IHRyVG9rZW4ubWV0YS5tYm91bmRzLmxlbmd0aDsgYisrKSB7XG4gICAgICAgICAgICAvKiBMaW5lIHdpdGggTiBib3VuZHMgaGFzIGNlbGxzIGluZGV4ZWQgZnJvbSAwIHRvIE4tMiAqL1xuICAgICAgICAgICAgaWYgKGMgPiB0clRva2VuLm1ldGEubWJvdW5kc1tiXS5sZW5ndGggLSAyKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICByYW5nZSA9IFsgdHJUb2tlbi5tZXRhLm1ib3VuZHNbYl1bY10gKyAxLCB0clRva2VuLm1ldGEubWJvdW5kc1tiXVtjICsgMV0gXTtcbiAgICAgICAgICAgIHRleHQucHVzaChzdGF0ZS5zcmMuc2xpY2UuYXBwbHkoc3RhdGUuc3JjLCByYW5nZSkudHJpbVJpZ2h0KCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdGF0ZS5tZC5ibG9jay5wYXJzZSh0ZXh0LmpvaW4oJ1xcbicpLCBzdGF0ZS5tZCwgc3RhdGUuZW52LCBzdGF0ZS50b2tlbnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnaW5saW5lJywgJycsIDApO1xuICAgICAgICAgIHRva2VuLmNvbnRlbnQgID0gdGV4dC50cmltKCk7XG4gICAgICAgICAgdG9rZW4ubWFwICAgICAgPSB0clRva2VuLm1hcDtcbiAgICAgICAgICB0b2tlbi5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9rZW4gPSBzdGF0ZS5wdXNoKHRhZyArICdfY2xvc2UnLCB0YWcsIC0xKTtcbiAgICAgIH1cblxuICAgICAgLyogUHVzaCBpbiB0ciBhbmQgdGhlYWQvdGJvZHkgY2xvc2VkIHRva2VucyAqL1xuICAgICAgc3RhdGUucHVzaCgndHJfY2xvc2UnLCAndHInLCAtMSk7XG4gICAgICBpZiAodHJUb2tlbi5tZXRhLmdycCAmIDB4MDEpIHtcbiAgICAgICAgdGFnID0gKHRyVG9rZW4ubWV0YS50eXBlID09PSAweDAwMTAwKSA/ICd0aGVhZCcgOiAndGJvZHknO1xuICAgICAgICB0b2tlbiA9IHN0YXRlLnB1c2godGFnICsgJ19jbG9zZScsIHRhZywgLTEpO1xuICAgICAgICB0Z3JvdXBMaW5lc1sxXSA9IHRyVG9rZW4ubWFwWzFdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRhYmxlTGluZXNbMV0gPSBNYXRoLm1heChcbiAgICAgIHRncm91cExpbmVzWzFdLFxuICAgICAgdGFibGVUb2tlbi5tZXRhLnNlcC5tYXBbMV0sXG4gICAgICB0YWJsZVRva2VuLm1ldGEuY2FwID8gdGFibGVUb2tlbi5tZXRhLmNhcC5tYXBbMV0gOiAtMVxuICAgICk7XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0YWJsZV9jbG9zZScsICd0YWJsZScsIC0xKTtcblxuICAgIHN0YXRlLmxpbmUgPSB0YWJsZUxpbmVzWzFdO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgbWQuYmxvY2sucnVsZXIuYXQoJ3RhYmxlJywgdGFibGUsIHsgYWx0OiBbICdwYXJhZ3JhcGgnLCAncmVmZXJlbmNlJyBdIH0pO1xufTtcblxuLyogdmltOiBzZXQgdHM9MiBzdz0yIGV0OiAqL1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBjb25zdHJ1Y3RvclxuXG5mdW5jdGlvbiBERkEoKSB7XG4gIC8vIGFscGhhYmV0cyBhcmUgZW5jb2RlZCBieSBudW1iZXJzIGluIDE2Xk4gZm9ybSwgcHJlc2VudGluZyBpdHMgcHJlY2VkZW5jZVxuICB0aGlzLl9faGlnaGVzdF9hbHBoYWJldF9fID0gMHgwO1xuICB0aGlzLl9fbWF0Y2hfYWxwaGFiZXRzX18gPSB7fTtcbiAgLy8gc3RhdGVzIGFyZSB1bmlvbiAoYml0d2lzZSBPUikgb2YgaXRzIGFjY2VwdGVkIGFscGhhYmV0c1xuICB0aGlzLl9faW5pdGlhbF9zdGF0ZV9fID0gMHgwO1xuICB0aGlzLl9fYWNjZXB0X3N0YXRlc19fID0ge307XG4gIC8vIHRyYW5zaXRpb25zIGFyZSBpbiB0aGUgZm9ybToge3ByZXZfc3RhdGU6IHthbHBoYWJldDogbmV4dF9zdGF0ZX19XG4gIHRoaXMuX190cmFuc2l0aW9uc19fID0ge307XG4gIC8vIGFjdGlvbnMgdGFrZSB0d28gcGFyYW1ldGVyczogc3RlcCAobGluZSBudW1iZXIpLCBwcmV2X3N0YXRlIGFuZCBhbHBoYWJldFxuICB0aGlzLl9fYWN0aW9uc19fID0ge307XG59XG5cbi8vIHNldHRlcnNcblxuREZBLnByb3RvdHlwZS5zZXRfaGlnaGVzdF9hbHBoYWJldCA9IGZ1bmN0aW9uIChhbHBoYWJldCkge1xuICB0aGlzLl9faGlnaGVzdF9hbHBoYWJldF9fID0gYWxwaGFiZXQ7XG59O1xuXG5ERkEucHJvdG90eXBlLnNldF9tYXRjaF9hbHBoYWJldHMgPSBmdW5jdGlvbiAobWF0Y2hlcykge1xuICB0aGlzLl9fbWF0Y2hfYWxwaGFiZXRzX18gPSBtYXRjaGVzO1xufTtcblxuREZBLnByb3RvdHlwZS5zZXRfaW5pdGlhbF9zdGF0ZSA9IGZ1bmN0aW9uIChpbml0aWFsKSB7XG4gIHRoaXMuX19pbml0aWFsX3N0YXRlX18gPSBpbml0aWFsO1xufTtcblxuREZBLnByb3RvdHlwZS5zZXRfYWNjZXB0X3N0YXRlcyA9IGZ1bmN0aW9uIChhY2NlcHRzKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYWNjZXB0cy5sZW5ndGg7IGkrKykge1xuICAgIHRoaXMuX19hY2NlcHRfc3RhdGVzX19bYWNjZXB0c1tpXV0gPSB0cnVlO1xuICB9XG59O1xuXG5ERkEucHJvdG90eXBlLnNldF90cmFuc2l0aW9ucyA9IGZ1bmN0aW9uICh0cmFuc2l0aW9ucykge1xuICB0aGlzLl9fdHJhbnNpdGlvbnNfXyA9IHRyYW5zaXRpb25zO1xufTtcblxuREZBLnByb3RvdHlwZS5zZXRfYWN0aW9ucyA9IGZ1bmN0aW9uIChhY3Rpb25zKSB7XG4gIHRoaXMuX19hY3Rpb25zX18gPSBhY3Rpb25zO1xufTtcblxuREZBLnByb3RvdHlwZS51cGRhdGVfdHJhbnNpdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSwgYWxwaGFiZXRzKSB7XG4gIHRoaXMuX190cmFuc2l0aW9uc19fW3N0YXRlXSA9IE9iamVjdC5hc3NpZ24oXG4gICAgdGhpcy5fX3RyYW5zaXRpb25zX19bc3RhdGVdIHx8IE9iamVjdCgpLCBhbHBoYWJldHNcbiAgKTtcbn07XG5cbi8vIG1ldGhvZHNcblxuREZBLnByb3RvdHlwZS5leGVjdXRlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHN0YXRlLCBzdGVwLCBhbHBoYWJldDtcbiAgZm9yIChzdGF0ZSA9IHRoaXMuX19pbml0aWFsX3N0YXRlX18sIHN0ZXAgPSBzdGFydDsgc3RhdGUgJiYgc3RlcCA8IGVuZDsgc3RlcCsrKSB7XG4gICAgZm9yIChhbHBoYWJldCA9IHRoaXMuX19oaWdoZXN0X2FscGhhYmV0X187IGFscGhhYmV0ID4gMHgwOyBhbHBoYWJldCA+Pj0gNCkge1xuICAgICAgaWYgKChzdGF0ZSAmIGFscGhhYmV0KVxuICAgICAgICAgICYmIHRoaXMuX19tYXRjaF9hbHBoYWJldHNfX1thbHBoYWJldF0uY2FsbCh0aGlzLCBzdGVwLCBzdGF0ZSwgYWxwaGFiZXQpKSB7IGJyZWFrOyB9XG4gICAgfVxuXG4gICAgdGhpcy5fX2FjdGlvbnNfXyhzdGVwLCBzdGF0ZSwgYWxwaGFiZXQpO1xuXG4gICAgaWYgKGFscGhhYmV0ID09PSAweDApIHsgYnJlYWs7IH1cbiAgICBzdGF0ZSA9IHRoaXMuX190cmFuc2l0aW9uc19fW3N0YXRlXVthbHBoYWJldF0gfHwgMHgwO1xuICB9XG4gIHJldHVybiAhIXRoaXMuX19hY2NlcHRfc3RhdGVzX19bc3RhdGVdO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBERkE7XG5cbi8qIHZpbTogc2V0IHRzPTIgc3c9MiBldDogKi9cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbWFya2Rvd25JdFVuZGVybGluZSAobWQpIHtcblxuICBmdW5jdGlvbiByZW5kZXJFbSAodG9rZW5zLCBpZHgsIG9wdHMsIF8sIHNsZikge1xuICAgIHZhciB0b2tlbiA9IHRva2Vuc1tpZHhdO1xuICAgIGlmICh0b2tlbi5tYXJrdXAgPT09ICdfJykge1xuICAgICAgdG9rZW4udGFnID0gJ3UnO1xuICAgIH1cbiAgICByZXR1cm4gc2xmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRzKTtcbiAgfVxuXG4gIG1kLnJlbmRlcmVyLnJ1bGVzLmVtX29wZW4gPSByZW5kZXJFbTtcbiAgbWQucmVuZGVyZXIucnVsZXMuZW1fY2xvc2UgPSByZW5kZXJFbTtcbn07XG4iLCJleHBvcnQgZGVmYXVsdCBcIlwiOyIsImltcG9ydCBtYXJrZG93bkl0QXR0cnMgZnJvbSBcIm1hcmtkb3duLWl0LWF0dHJzXCI7XG5pbXBvcnQgbWFya2Rvd25JdENoZWNrYm94IGZyb20gXCJtYXJrZG93bi1pdC1jaGVja2JveFwiO1xuaW1wb3J0IG1hcmtkb3duSXRDb250YWluZXIgZnJvbSBcIm1hcmtkb3duLWl0LWNvbnRhaW5lclwiO1xuaW1wb3J0IG1hcmtkb3duSXREZWZsaXN0IGZyb20gXCJtYXJrZG93bi1pdC1kZWZsaXN0XCI7XG5pbXBvcnQgbWFya2Rvd25JdEVtb2ppIGZyb20gXCJtYXJrZG93bi1pdC1lbW9qaVwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdEZvb3Rub3RlIGZyb20gXCJtYXJrZG93bi1pdC1mb290bm90ZVwiO1xuLy8gaW1wb3J0IG1hcmtkb3duSXRIVE1MNUVtYmVkIGZyb20gXCJtYXJrZG93bi1pdC1odG1sNS1lbWJlZFwiO1xuLy8gaW1wb3J0IG1hcmtkb3duSXRLYmQgZnJvbSBcIm1hcmtkb3duLWl0LWtiZFwiO1xuaW1wb3J0IG1hcmtkb3duSXRNYXJrIGZyb20gXCJtYXJrZG93bi1pdC1tYXJrXCI7XG5pbXBvcnQgbWFya2Rvd25JdE11bHRpbWRUYWJsZSBmcm9tIFwibWFya2Rvd24taXQtbXVsdGltZC10YWJsZVwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdFN1YiBmcm9tIFwibWFya2Rvd24taXQtc3ViXCI7XG4vLyBpbXBvcnQgKiBhcyBtYXJrZG93bkl0U3VwIGZyb20gXCJtYXJrZG93bi1pdC1zdXBcIjtcbi8vIC8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRUb2MgZnJvbSBcIm1hcmtkb3duLWl0LXRvY1wiO1xuaW1wb3J0IG1hcmtkb3duSXRVbmRlcmxpbmUgZnJvbSBcIm1hcmtkb3duLWl0LXVuZGVybGluZVwiO1xuaW1wb3J0IE1hcmtkb3duSXQgZnJvbSBcIm1hcmtkb3duLWl0XCI7XG5cbmNvbnN0IGFkZEF0dHIgPSAobWQ6IE1hcmtkb3duSXQpID0+IHtcbiAgLy8gQWxsb3cgey5jbGFzcyAjaWQgZGF0YS1vdGhlcj1cImZvb1wifSB0YWdzXG4gIG1kLnVzZShtYXJrZG93bkl0QXR0cnMsIHtcbiAgICBsZWZ0RGVsaW1pdGVyOiBcIntcIixcbiAgICByaWdodERlbGltaXRlcjogXCJ9XCIsXG4gICAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtcImNsYXNzXCIsIFwiaWRcIiwgL14oPyFvbikuKiQvZ2ltXSxcbiAgfSk7XG5cbiAgLy8gY2hhbmdlIHRoZSBydWxlIGFwcGxpZWQgdG8gd3JpdGUgYSBjdXN0b20gbmFtZSBhdHRyIG9uIGhlYWRlcnMgaW4gTUVNRVxuICBtZC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfb3BlblwiXSA9ICh0b2tlbnMsIGlkeCwgb3B0aW9ucywgX2Vudiwgc2VsZikgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2lkeF07XG4gICAgY29uc3QgbmV4dFRva2VuID0gdG9rZW5zW2lkeCArIDFdO1xuICAgIGNvbnN0IGxpbmsgPSBuZXh0VG9rZW4/LmNvbnRlbnQgfHwgXCJcIjtcblxuICAgIHRva2VuLmF0dHJTZXQoXCJuYW1lXCIsIGAke3Rva2VuLm1hcmt1cH0ke2xpbmt9YCk7XG5cbiAgICByZXR1cm4gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG4gIH07XG5cbiAgcmV0dXJuIG1kO1xufTtcblxuZXhwb3J0IGNvbnN0IGFkZEV4dHJhcyA9IChtZDogTWFya2Rvd25JdCkgPT4ge1xuICAvLyBUT0RPOiByZWZlcmVuY2Ugc2V0dGluZ3NcbiAgYWRkQXR0cihtZCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRDaGVja2JveCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXREZWZsaXN0KTtcblxuICBtZC51c2UobWFya2Rvd25JdEVtb2ppKTtcblxuICBtZC51c2UobWFya2Rvd25JdERlZmxpc3QpO1xuXG4gIG1kLnVzZShtYXJrZG93bkl0RW1vamkpO1xuXG4gIC8vIG1kLnVzZShtYXJrZG93bkl0SFRNTDVFbWJlZCk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRNYXJrKTtcblxuICBtZC51c2UobWFya2Rvd25JdE11bHRpbWRUYWJsZSk7XG5cbiAgbWQudXNlKG1hcmtkb3duSXRVbmRlcmxpbmUpO1xuXG4gIC8qIDo6OiB3b3JkIHN0YXJ0cyBhIGJsb2NrIHdpdGggY2xhc3MgLndvcmQ7IDo6OiBlbmRzIGl0ICovXG4gIG1kLnVzZShtYXJrZG93bkl0Q29udGFpbmVyLCBcImFueVwiLCB7XG4gICAgdmFsaWRhdGU6ICgpID0+IHRydWUsXG5cbiAgICByZW5kZXI6ICh0b2tlbnMsIGlkeCwgb3B0aW9ucywgX2Vudiwgc2VsZikgPT4ge1xuICAgICAgY29uc3QgbSA9IHRva2Vuc1tpZHhdLmluZm8udHJpbSgpLm1hdGNoKC9eKC4qKSQvKTtcblxuICAgICAgaWYgKHRva2Vuc1tpZHhdLm5lc3RpbmcgPT09IDEpIHtcbiAgICAgICAgdG9rZW5zW2lkeF0uYXR0clB1c2goW1wiY2xhc3NcIiwgbVsxXV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIG1kO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYWRkRXh0cmFzO1xuIiwiaW1wb3J0IFwiLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlcy9ibGFuay5odG1sXCI7XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZVByZWxvYWRlciB7XG4gICAgLyoqXG4gICAgICogUHJlbG9hZCBhIHNldCBvZiB0ZW1wbGF0ZXMgdG8gY29tcGlsZSBhbmQgY2FjaGUgdGhlbSBmb3IgZmFzdCBhY2Nlc3MgZHVyaW5nIHJlbmRlcmluZ1xuICAgICAqL1xuICAgIHN0YXRpYyBhc3luYyBwcmVsb2FkSGFuZGxlYmFyc1RlbXBsYXRlcygpIHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVQYXRocyA9IFtcIm1vZHVsZXMvdGVtcGxhdGUvdGVtcGxhdGVzL2JsYW5rLmh0bWxcIl07XG4gICAgICAgIHJldHVybiBsb2FkVGVtcGxhdGVzKHRlbXBsYXRlUGF0aHMpO1xuICAgIH1cbn1cbiIsIihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcbiAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKCd1bmRlcnNjb3JlJywgZmFjdG9yeSkgOlxuICAoZ2xvYmFsID0gdHlwZW9mIGdsb2JhbFRoaXMgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsVGhpcyA6IGdsb2JhbCB8fCBzZWxmLCAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjdXJyZW50ID0gZ2xvYmFsLl87XG4gICAgdmFyIGV4cG9ydHMgPSBnbG9iYWwuXyA9IGZhY3RvcnkoKTtcbiAgICBleHBvcnRzLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7IGdsb2JhbC5fID0gY3VycmVudDsgcmV0dXJuIGV4cG9ydHM7IH07XG4gIH0oKSkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkge1xuICAvLyAgICAgVW5kZXJzY29yZS5qcyAxLjEzLjFcbiAgLy8gICAgIGh0dHBzOi8vdW5kZXJzY29yZWpzLm9yZ1xuICAvLyAgICAgKGMpIDIwMDktMjAyMSBKZXJlbXkgQXNoa2VuYXMsIEp1bGlhbiBHb25nZ3JpanAsIGFuZCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAgLy8gICAgIFVuZGVyc2NvcmUgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICB2YXIgVkVSU0lPTiA9ICcxLjEzLjEnO1xuXG4gIC8vIEVzdGFibGlzaCB0aGUgcm9vdCBvYmplY3QsIGB3aW5kb3dgIChgc2VsZmApIGluIHRoZSBicm93c2VyLCBgZ2xvYmFsYFxuICAvLyBvbiB0aGUgc2VydmVyLCBvciBgdGhpc2AgaW4gc29tZSB2aXJ0dWFsIG1hY2hpbmVzLiBXZSB1c2UgYHNlbGZgXG4gIC8vIGluc3RlYWQgb2YgYHdpbmRvd2AgZm9yIGBXZWJXb3JrZXJgIHN1cHBvcnQuXG4gIHZhciByb290ID0gdHlwZW9mIHNlbGYgPT0gJ29iamVjdCcgJiYgc2VsZi5zZWxmID09PSBzZWxmICYmIHNlbGYgfHxcbiAgICAgICAgICAgIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsLmdsb2JhbCA9PT0gZ2xvYmFsICYmIGdsb2JhbCB8fFxuICAgICAgICAgICAgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKSB8fFxuICAgICAgICAgICAge307XG5cbiAgLy8gU2F2ZSBieXRlcyBpbiB0aGUgbWluaWZpZWQgKGJ1dCBub3QgZ3ppcHBlZCkgdmVyc2lvbjpcbiAgdmFyIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsIE9ialByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcbiAgdmFyIFN5bWJvbFByb3RvID0gdHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgPyBTeW1ib2wucHJvdG90eXBlIDogbnVsbDtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyIHB1c2ggPSBBcnJheVByb3RvLnB1c2gsXG4gICAgICBzbGljZSA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgICB0b1N0cmluZyA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBNb2Rlcm4gZmVhdHVyZSBkZXRlY3Rpb24uXG4gIHZhciBzdXBwb3J0c0FycmF5QnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyxcbiAgICAgIHN1cHBvcnRzRGF0YVZpZXcgPSB0eXBlb2YgRGF0YVZpZXcgIT09ICd1bmRlZmluZWQnO1xuXG4gIC8vIEFsbCAqKkVDTUFTY3JpcHQgNSsqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhciBuYXRpdmVJc0FycmF5ID0gQXJyYXkuaXNBcnJheSxcbiAgICAgIG5hdGl2ZUtleXMgPSBPYmplY3Qua2V5cyxcbiAgICAgIG5hdGl2ZUNyZWF0ZSA9IE9iamVjdC5jcmVhdGUsXG4gICAgICBuYXRpdmVJc1ZpZXcgPSBzdXBwb3J0c0FycmF5QnVmZmVyICYmIEFycmF5QnVmZmVyLmlzVmlldztcblxuICAvLyBDcmVhdGUgcmVmZXJlbmNlcyB0byB0aGVzZSBidWlsdGluIGZ1bmN0aW9ucyBiZWNhdXNlIHdlIG92ZXJyaWRlIHRoZW0uXG4gIHZhciBfaXNOYU4gPSBpc05hTixcbiAgICAgIF9pc0Zpbml0ZSA9IGlzRmluaXRlO1xuXG4gIC8vIEtleXMgaW4gSUUgPCA5IHRoYXQgd29uJ3QgYmUgaXRlcmF0ZWQgYnkgYGZvciBrZXkgaW4gLi4uYCBhbmQgdGh1cyBtaXNzZWQuXG4gIHZhciBoYXNFbnVtQnVnID0gIXt0b1N0cmluZzogbnVsbH0ucHJvcGVydHlJc0VudW1lcmFibGUoJ3RvU3RyaW5nJyk7XG4gIHZhciBub25FbnVtZXJhYmxlUHJvcHMgPSBbJ3ZhbHVlT2YnLCAnaXNQcm90b3R5cGVPZicsICd0b1N0cmluZycsXG4gICAgJ3Byb3BlcnR5SXNFbnVtZXJhYmxlJywgJ2hhc093blByb3BlcnR5JywgJ3RvTG9jYWxlU3RyaW5nJ107XG5cbiAgLy8gVGhlIGxhcmdlc3QgaW50ZWdlciB0aGF0IGNhbiBiZSByZXByZXNlbnRlZCBleGFjdGx5LlxuICB2YXIgTUFYX0FSUkFZX0lOREVYID0gTWF0aC5wb3coMiwgNTMpIC0gMTtcblxuICAvLyBTb21lIGZ1bmN0aW9ucyB0YWtlIGEgdmFyaWFibGUgbnVtYmVyIG9mIGFyZ3VtZW50cywgb3IgYSBmZXcgZXhwZWN0ZWRcbiAgLy8gYXJndW1lbnRzIGF0IHRoZSBiZWdpbm5pbmcgYW5kIHRoZW4gYSB2YXJpYWJsZSBudW1iZXIgb2YgdmFsdWVzIHRvIG9wZXJhdGVcbiAgLy8gb24uIFRoaXMgaGVscGVyIGFjY3VtdWxhdGVzIGFsbCByZW1haW5pbmcgYXJndW1lbnRzIHBhc3QgdGhlIGZ1bmN0aW9u4oCZc1xuICAvLyBhcmd1bWVudCBsZW5ndGggKG9yIGFuIGV4cGxpY2l0IGBzdGFydEluZGV4YCksIGludG8gYW4gYXJyYXkgdGhhdCBiZWNvbWVzXG4gIC8vIHRoZSBsYXN0IGFyZ3VtZW50LiBTaW1pbGFyIHRvIEVTNuKAmXMgXCJyZXN0IHBhcmFtZXRlclwiLlxuICBmdW5jdGlvbiByZXN0QXJndW1lbnRzKGZ1bmMsIHN0YXJ0SW5kZXgpIHtcbiAgICBzdGFydEluZGV4ID0gc3RhcnRJbmRleCA9PSBudWxsID8gZnVuYy5sZW5ndGggLSAxIDogK3N0YXJ0SW5kZXg7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KGFyZ3VtZW50cy5sZW5ndGggLSBzdGFydEluZGV4LCAwKSxcbiAgICAgICAgICByZXN0ID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgICAgICBpbmRleCA9IDA7XG4gICAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgcmVzdFtpbmRleF0gPSBhcmd1bWVudHNbaW5kZXggKyBzdGFydEluZGV4XTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoc3RhcnRJbmRleCkge1xuICAgICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgcmVzdCk7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmd1bWVudHNbMF0sIHJlc3QpO1xuICAgICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIHJlc3QpO1xuICAgICAgfVxuICAgICAgdmFyIGFyZ3MgPSBBcnJheShzdGFydEluZGV4ICsgMSk7XG4gICAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBzdGFydEluZGV4OyBpbmRleCsrKSB7XG4gICAgICAgIGFyZ3NbaW5kZXhdID0gYXJndW1lbnRzW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIGFyZ3Nbc3RhcnRJbmRleF0gPSByZXN0O1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgYW4gb2JqZWN0P1xuICBmdW5jdGlvbiBpc09iamVjdChvYmopIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG4gIH1cblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIGZ1bmN0aW9uIGlzTnVsbChvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSB1bmRlZmluZWQ/XG4gIGZ1bmN0aW9uIGlzVW5kZWZpbmVkKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBmdW5jdGlvbiBpc0Jvb2xlYW4ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBmdW5jdGlvbiBpc0VsZW1lbnQob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgYHRvU3RyaW5nYC1iYXNlZCB0eXBlIHRlc3Rlci5cbiAgZnVuY3Rpb24gdGFnVGVzdGVyKG5hbWUpIHtcbiAgICB2YXIgdGFnID0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gdGFnO1xuICAgIH07XG4gIH1cblxuICB2YXIgaXNTdHJpbmcgPSB0YWdUZXN0ZXIoJ1N0cmluZycpO1xuXG4gIHZhciBpc051bWJlciA9IHRhZ1Rlc3RlcignTnVtYmVyJyk7XG5cbiAgdmFyIGlzRGF0ZSA9IHRhZ1Rlc3RlcignRGF0ZScpO1xuXG4gIHZhciBpc1JlZ0V4cCA9IHRhZ1Rlc3RlcignUmVnRXhwJyk7XG5cbiAgdmFyIGlzRXJyb3IgPSB0YWdUZXN0ZXIoJ0Vycm9yJyk7XG5cbiAgdmFyIGlzU3ltYm9sID0gdGFnVGVzdGVyKCdTeW1ib2wnKTtcblxuICB2YXIgaXNBcnJheUJ1ZmZlciA9IHRhZ1Rlc3RlcignQXJyYXlCdWZmZXInKTtcblxuICB2YXIgaXNGdW5jdGlvbiA9IHRhZ1Rlc3RlcignRnVuY3Rpb24nKTtcblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuIFdvcmsgYXJvdW5kIHNvbWUgYHR5cGVvZmAgYnVncyBpbiBvbGRcbiAgLy8gdjgsIElFIDExICgjMTYyMSksIFNhZmFyaSA4ICgjMTkyOSksIGFuZCBQaGFudG9tSlMgKCMyMjM2KS5cbiAgdmFyIG5vZGVsaXN0ID0gcm9vdC5kb2N1bWVudCAmJiByb290LmRvY3VtZW50LmNoaWxkTm9kZXM7XG4gIGlmICh0eXBlb2YgLy4vICE9ICdmdW5jdGlvbicgJiYgdHlwZW9mIEludDhBcnJheSAhPSAnb2JqZWN0JyAmJiB0eXBlb2Ygbm9kZWxpc3QgIT0gJ2Z1bmN0aW9uJykge1xuICAgIGlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09ICdmdW5jdGlvbicgfHwgZmFsc2U7XG4gICAgfTtcbiAgfVxuXG4gIHZhciBpc0Z1bmN0aW9uJDEgPSBpc0Z1bmN0aW9uO1xuXG4gIHZhciBoYXNPYmplY3RUYWcgPSB0YWdUZXN0ZXIoJ09iamVjdCcpO1xuXG4gIC8vIEluIElFIDEwIC0gRWRnZSAxMywgYERhdGFWaWV3YCBoYXMgc3RyaW5nIHRhZyBgJ1tvYmplY3QgT2JqZWN0XSdgLlxuICAvLyBJbiBJRSAxMSwgdGhlIG1vc3QgY29tbW9uIGFtb25nIHRoZW0sIHRoaXMgcHJvYmxlbSBhbHNvIGFwcGxpZXMgdG9cbiAgLy8gYE1hcGAsIGBXZWFrTWFwYCBhbmQgYFNldGAuXG4gIHZhciBoYXNTdHJpbmdUYWdCdWcgPSAoXG4gICAgICAgIHN1cHBvcnRzRGF0YVZpZXcgJiYgaGFzT2JqZWN0VGFnKG5ldyBEYXRhVmlldyhuZXcgQXJyYXlCdWZmZXIoOCkpKVxuICAgICAgKSxcbiAgICAgIGlzSUUxMSA9ICh0eXBlb2YgTWFwICE9PSAndW5kZWZpbmVkJyAmJiBoYXNPYmplY3RUYWcobmV3IE1hcCkpO1xuXG4gIHZhciBpc0RhdGFWaWV3ID0gdGFnVGVzdGVyKCdEYXRhVmlldycpO1xuXG4gIC8vIEluIElFIDEwIC0gRWRnZSAxMywgd2UgbmVlZCBhIGRpZmZlcmVudCBoZXVyaXN0aWNcbiAgLy8gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYW4gb2JqZWN0IGlzIGEgYERhdGFWaWV3YC5cbiAgZnVuY3Rpb24gaWUxMElzRGF0YVZpZXcob2JqKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIGlzRnVuY3Rpb24kMShvYmouZ2V0SW50OCkgJiYgaXNBcnJheUJ1ZmZlcihvYmouYnVmZmVyKTtcbiAgfVxuXG4gIHZhciBpc0RhdGFWaWV3JDEgPSAoaGFzU3RyaW5nVGFnQnVnID8gaWUxMElzRGF0YVZpZXcgOiBpc0RhdGFWaWV3KTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgYEFycmF5LmlzQXJyYXlgLlxuICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgdGFnVGVzdGVyKCdBcnJheScpO1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIGNoZWNrIHdoZXRoZXIgYGtleWAgaXMgYW4gb3duIHByb3BlcnR5IG5hbWUgb2YgYG9iamAuXG4gIGZ1bmN0aW9uIGhhcyQxKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICB9XG5cbiAgdmFyIGlzQXJndW1lbnRzID0gdGFnVGVzdGVyKCdBcmd1bWVudHMnKTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFIDwgOSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIChmdW5jdGlvbigpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICAgIGlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIHJldHVybiBoYXMkMShvYmosICdjYWxsZWUnKTtcbiAgICAgIH07XG4gICAgfVxuICB9KCkpO1xuXG4gIHZhciBpc0FyZ3VtZW50cyQxID0gaXNBcmd1bWVudHM7XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBmdW5jdGlvbiBpc0Zpbml0ZSQxKG9iaikge1xuICAgIHJldHVybiAhaXNTeW1ib2wob2JqKSAmJiBfaXNGaW5pdGUob2JqKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChvYmopKTtcbiAgfVxuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD9cbiAgZnVuY3Rpb24gaXNOYU4kMShvYmopIHtcbiAgICByZXR1cm4gaXNOdW1iZXIob2JqKSAmJiBfaXNOYU4ob2JqKTtcbiAgfVxuXG4gIC8vIFByZWRpY2F0ZS1nZW5lcmF0aW5nIGZ1bmN0aW9uLiBPZnRlbiB1c2VmdWwgb3V0c2lkZSBvZiBVbmRlcnNjb3JlLlxuICBmdW5jdGlvbiBjb25zdGFudCh2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQ29tbW9uIGludGVybmFsIGxvZ2ljIGZvciBgaXNBcnJheUxpa2VgIGFuZCBgaXNCdWZmZXJMaWtlYC5cbiAgZnVuY3Rpb24gY3JlYXRlU2l6ZVByb3BlcnR5Q2hlY2soZ2V0U2l6ZVByb3BlcnR5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGNvbGxlY3Rpb24pIHtcbiAgICAgIHZhciBzaXplUHJvcGVydHkgPSBnZXRTaXplUHJvcGVydHkoY29sbGVjdGlvbik7XG4gICAgICByZXR1cm4gdHlwZW9mIHNpemVQcm9wZXJ0eSA9PSAnbnVtYmVyJyAmJiBzaXplUHJvcGVydHkgPj0gMCAmJiBzaXplUHJvcGVydHkgPD0gTUFYX0FSUkFZX0lOREVYO1xuICAgIH1cbiAgfVxuXG4gIC8vIEludGVybmFsIGhlbHBlciB0byBnZW5lcmF0ZSBhIGZ1bmN0aW9uIHRvIG9idGFpbiBwcm9wZXJ0eSBga2V5YCBmcm9tIGBvYmpgLlxuICBmdW5jdGlvbiBzaGFsbG93UHJvcGVydHkoa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9iaiA9PSBudWxsID8gdm9pZCAwIDogb2JqW2tleV07XG4gICAgfTtcbiAgfVxuXG4gIC8vIEludGVybmFsIGhlbHBlciB0byBvYnRhaW4gdGhlIGBieXRlTGVuZ3RoYCBwcm9wZXJ0eSBvZiBhbiBvYmplY3QuXG4gIHZhciBnZXRCeXRlTGVuZ3RoID0gc2hhbGxvd1Byb3BlcnR5KCdieXRlTGVuZ3RoJyk7XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGRldGVybWluZSB3aGV0aGVyIHdlIHNob3VsZCBzcGVuZCBleHRlbnNpdmUgY2hlY2tzIGFnYWluc3RcbiAgLy8gYEFycmF5QnVmZmVyYCBldCBhbC5cbiAgdmFyIGlzQnVmZmVyTGlrZSA9IGNyZWF0ZVNpemVQcm9wZXJ0eUNoZWNrKGdldEJ5dGVMZW5ndGgpO1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSB0eXBlZCBhcnJheT9cbiAgdmFyIHR5cGVkQXJyYXlQYXR0ZXJuID0gL1xcW29iamVjdCAoKEl8VWkpbnQoOHwxNnwzMil8RmxvYXQoMzJ8NjQpfFVpbnQ4Q2xhbXBlZHxCaWcoSXxVaSludDY0KUFycmF5XFxdLztcbiAgZnVuY3Rpb24gaXNUeXBlZEFycmF5KG9iaikge1xuICAgIC8vIGBBcnJheUJ1ZmZlci5pc1ZpZXdgIGlzIHRoZSBtb3N0IGZ1dHVyZS1wcm9vZiwgc28gdXNlIGl0IHdoZW4gYXZhaWxhYmxlLlxuICAgIC8vIE90aGVyd2lzZSwgZmFsbCBiYWNrIG9uIHRoZSBhYm92ZSByZWd1bGFyIGV4cHJlc3Npb24uXG4gICAgcmV0dXJuIG5hdGl2ZUlzVmlldyA/IChuYXRpdmVJc1ZpZXcob2JqKSAmJiAhaXNEYXRhVmlldyQxKG9iaikpIDpcbiAgICAgICAgICAgICAgICAgIGlzQnVmZmVyTGlrZShvYmopICYmIHR5cGVkQXJyYXlQYXR0ZXJuLnRlc3QodG9TdHJpbmcuY2FsbChvYmopKTtcbiAgfVxuXG4gIHZhciBpc1R5cGVkQXJyYXkkMSA9IHN1cHBvcnRzQXJyYXlCdWZmZXIgPyBpc1R5cGVkQXJyYXkgOiBjb25zdGFudChmYWxzZSk7XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIG9idGFpbiB0aGUgYGxlbmd0aGAgcHJvcGVydHkgb2YgYW4gb2JqZWN0LlxuICB2YXIgZ2V0TGVuZ3RoID0gc2hhbGxvd1Byb3BlcnR5KCdsZW5ndGgnKTtcblxuICAvLyBJbnRlcm5hbCBoZWxwZXIgdG8gY3JlYXRlIGEgc2ltcGxlIGxvb2t1cCBzdHJ1Y3R1cmUuXG4gIC8vIGBjb2xsZWN0Tm9uRW51bVByb3BzYCB1c2VkIHRvIGRlcGVuZCBvbiBgXy5jb250YWluc2AsIGJ1dCB0aGlzIGxlZCB0b1xuICAvLyBjaXJjdWxhciBpbXBvcnRzLiBgZW11bGF0ZWRTZXRgIGlzIGEgb25lLW9mZiBzb2x1dGlvbiB0aGF0IG9ubHkgd29ya3MgZm9yXG4gIC8vIGFycmF5cyBvZiBzdHJpbmdzLlxuICBmdW5jdGlvbiBlbXVsYXRlZFNldChrZXlzKSB7XG4gICAgdmFyIGhhc2ggPSB7fTtcbiAgICBmb3IgKHZhciBsID0ga2V5cy5sZW5ndGgsIGkgPSAwOyBpIDwgbDsgKytpKSBoYXNoW2tleXNbaV1dID0gdHJ1ZTtcbiAgICByZXR1cm4ge1xuICAgICAgY29udGFpbnM6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gaGFzaFtrZXldOyB9LFxuICAgICAgcHVzaDogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGhhc2hba2V5XSA9IHRydWU7XG4gICAgICAgIHJldHVybiBrZXlzLnB1c2goa2V5KTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyLiBDaGVja3MgYGtleXNgIGZvciB0aGUgcHJlc2VuY2Ugb2Yga2V5cyBpbiBJRSA8IDkgdGhhdCB3b24ndFxuICAvLyBiZSBpdGVyYXRlZCBieSBgZm9yIGtleSBpbiAuLi5gIGFuZCB0aHVzIG1pc3NlZC4gRXh0ZW5kcyBga2V5c2AgaW4gcGxhY2UgaWZcbiAgLy8gbmVlZGVkLlxuICBmdW5jdGlvbiBjb2xsZWN0Tm9uRW51bVByb3BzKG9iaiwga2V5cykge1xuICAgIGtleXMgPSBlbXVsYXRlZFNldChrZXlzKTtcbiAgICB2YXIgbm9uRW51bUlkeCA9IG5vbkVudW1lcmFibGVQcm9wcy5sZW5ndGg7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gb2JqLmNvbnN0cnVjdG9yO1xuICAgIHZhciBwcm90byA9IGlzRnVuY3Rpb24kMShjb25zdHJ1Y3RvcikgJiYgY29uc3RydWN0b3IucHJvdG90eXBlIHx8IE9ialByb3RvO1xuXG4gICAgLy8gQ29uc3RydWN0b3IgaXMgYSBzcGVjaWFsIGNhc2UuXG4gICAgdmFyIHByb3AgPSAnY29uc3RydWN0b3InO1xuICAgIGlmIChoYXMkMShvYmosIHByb3ApICYmICFrZXlzLmNvbnRhaW5zKHByb3ApKSBrZXlzLnB1c2gocHJvcCk7XG5cbiAgICB3aGlsZSAobm9uRW51bUlkeC0tKSB7XG4gICAgICBwcm9wID0gbm9uRW51bWVyYWJsZVByb3BzW25vbkVudW1JZHhdO1xuICAgICAgaWYgKHByb3AgaW4gb2JqICYmIG9ialtwcm9wXSAhPT0gcHJvdG9bcHJvcF0gJiYgIWtleXMuY29udGFpbnMocHJvcCkpIHtcbiAgICAgICAga2V5cy5wdXNoKHByb3ApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYC5cbiAgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICBpZiAoIWlzT2JqZWN0KG9iaikpIHJldHVybiBbXTtcbiAgICBpZiAobmF0aXZlS2V5cykgcmV0dXJuIG5hdGl2ZUtleXMob2JqKTtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChoYXMkMShvYmosIGtleSkpIGtleXMucHVzaChrZXkpO1xuICAgIC8vIEFoZW0sIElFIDwgOS5cbiAgICBpZiAoaGFzRW51bUJ1ZykgY29sbGVjdE5vbkVudW1Qcm9wcyhvYmosIGtleXMpO1xuICAgIHJldHVybiBrZXlzO1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIGZ1bmN0aW9uIGlzRW1wdHkob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICAvLyBTa2lwIHRoZSBtb3JlIGV4cGVuc2l2ZSBgdG9TdHJpbmdgLWJhc2VkIHR5cGUgY2hlY2tzIGlmIGBvYmpgIGhhcyBub1xuICAgIC8vIGAubGVuZ3RoYC5cbiAgICB2YXIgbGVuZ3RoID0gZ2V0TGVuZ3RoKG9iaik7XG4gICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgJiYgKFxuICAgICAgaXNBcnJheShvYmopIHx8IGlzU3RyaW5nKG9iaikgfHwgaXNBcmd1bWVudHMkMShvYmopXG4gICAgKSkgcmV0dXJuIGxlbmd0aCA9PT0gMDtcbiAgICByZXR1cm4gZ2V0TGVuZ3RoKGtleXMob2JqKSkgPT09IDA7XG4gIH1cblxuICAvLyBSZXR1cm5zIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgZnVuY3Rpb24gaXNNYXRjaChvYmplY3QsIGF0dHJzKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhhdHRycyksIGxlbmd0aCA9IF9rZXlzLmxlbmd0aDtcbiAgICBpZiAob2JqZWN0ID09IG51bGwpIHJldHVybiAhbGVuZ3RoO1xuICAgIHZhciBvYmogPSBPYmplY3Qob2JqZWN0KTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXNbaV07XG4gICAgICBpZiAoYXR0cnNba2V5XSAhPT0gb2JqW2tleV0gfHwgIShrZXkgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0IGNhblxuICAvLyBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgZnVuY3Rpb25zIGFkZGVkXG4gIC8vIHRocm91Z2ggYF8ubWl4aW5gLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG4gIGZ1bmN0aW9uIF8kMShvYmopIHtcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgXyQxKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfJDEpKSByZXR1cm4gbmV3IF8kMShvYmopO1xuICAgIHRoaXMuX3dyYXBwZWQgPSBvYmo7XG4gIH1cblxuICBfJDEuVkVSU0lPTiA9IFZFUlNJT047XG5cbiAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gIF8kMS5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgfTtcblxuICAvLyBQcm92aWRlIHVud3JhcHBpbmcgcHJveGllcyBmb3Igc29tZSBtZXRob2RzIHVzZWQgaW4gZW5naW5lIG9wZXJhdGlvbnNcbiAgLy8gc3VjaCBhcyBhcml0aG1ldGljIGFuZCBKU09OIHN0cmluZ2lmaWNhdGlvbi5cbiAgXyQxLnByb3RvdHlwZS52YWx1ZU9mID0gXyQxLnByb3RvdHlwZS50b0pTT04gPSBfJDEucHJvdG90eXBlLnZhbHVlO1xuXG4gIF8kMS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gU3RyaW5nKHRoaXMuX3dyYXBwZWQpO1xuICB9O1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIHdyYXAgb3Igc2hhbGxvdy1jb3B5IGFuIEFycmF5QnVmZmVyLFxuICAvLyB0eXBlZCBhcnJheSBvciBEYXRhVmlldyB0byBhIG5ldyB2aWV3LCByZXVzaW5nIHRoZSBidWZmZXIuXG4gIGZ1bmN0aW9uIHRvQnVmZmVyVmlldyhidWZmZXJTb3VyY2UpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoXG4gICAgICBidWZmZXJTb3VyY2UuYnVmZmVyIHx8IGJ1ZmZlclNvdXJjZSxcbiAgICAgIGJ1ZmZlclNvdXJjZS5ieXRlT2Zmc2V0IHx8IDAsXG4gICAgICBnZXRCeXRlTGVuZ3RoKGJ1ZmZlclNvdXJjZSlcbiAgICApO1xuICB9XG5cbiAgLy8gV2UgdXNlIHRoaXMgc3RyaW5nIHR3aWNlLCBzbyBnaXZlIGl0IGEgbmFtZSBmb3IgbWluaWZpY2F0aW9uLlxuICB2YXIgdGFnRGF0YVZpZXcgPSAnW29iamVjdCBEYXRhVmlld10nO1xuXG4gIC8vIEludGVybmFsIHJlY3Vyc2l2ZSBjb21wYXJpc29uIGZ1bmN0aW9uIGZvciBgXy5pc0VxdWFsYC5cbiAgZnVuY3Rpb24gZXEoYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHBzOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmVnYWwpLlxuICAgIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PT0gMSAvIGI7XG4gICAgLy8gYG51bGxgIG9yIGB1bmRlZmluZWRgIG9ubHkgZXF1YWwgdG8gaXRzZWxmIChzdHJpY3QgY29tcGFyaXNvbikuXG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLlxuICAgIGlmIChhICE9PSBhKSByZXR1cm4gYiAhPT0gYjtcbiAgICAvLyBFeGhhdXN0IHByaW1pdGl2ZSBjaGVja3NcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBhO1xuICAgIGlmICh0eXBlICE9PSAnZnVuY3Rpb24nICYmIHR5cGUgIT09ICdvYmplY3QnICYmIHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIGRlZXBFcShhLCBiLCBhU3RhY2ssIGJTdGFjayk7XG4gIH1cblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYF8uaXNFcXVhbGAuXG4gIGZ1bmN0aW9uIGRlZXBFcShhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAgIGlmIChhIGluc3RhbmNlb2YgXyQxKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8kMSkgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9PSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gV29yayBhcm91bmQgYSBidWcgaW4gSUUgMTAgLSBFZGdlIDEzLlxuICAgIGlmIChoYXNTdHJpbmdUYWdCdWcgJiYgY2xhc3NOYW1lID09ICdbb2JqZWN0IE9iamVjdF0nICYmIGlzRGF0YVZpZXckMShhKSkge1xuICAgICAgaWYgKCFpc0RhdGFWaWV3JDEoYikpIHJldHVybiBmYWxzZTtcbiAgICAgIGNsYXNzTmFtZSA9IHRhZ0RhdGFWaWV3O1xuICAgIH1cbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gVGhlc2UgdHlwZXMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgICAgY2FzZSAnW29iamVjdCBSZWdFeHBdJzpcbiAgICAgICAgLy8gUmVnRXhwcyBhcmUgY29lcmNlZCB0byBzdHJpbmdzIGZvciBjb21wYXJpc29uIChOb3RlOiAnJyArIC9hL2kgPT09ICcvYS9pJylcbiAgICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gYG5ldyBTdHJpbmcoXCI1XCIpYC5cbiAgICAgICAgcmV0dXJuICcnICsgYSA9PT0gJycgKyBiO1xuICAgICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgICAgLy8gYE5hTmBzIGFyZSBlcXVpdmFsZW50LCBidXQgbm9uLXJlZmxleGl2ZS5cbiAgICAgICAgLy8gT2JqZWN0KE5hTikgaXMgZXF1aXZhbGVudCB0byBOYU4uXG4gICAgICAgIGlmICgrYSAhPT0gK2EpIHJldHVybiArYiAhPT0gK2I7XG4gICAgICAgIC8vIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3Igb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiArYSA9PT0gMCA/IDEgLyArYSA9PT0gMSAvIGIgOiArYSA9PT0gK2I7XG4gICAgICBjYXNlICdbb2JqZWN0IERhdGVdJzpcbiAgICAgIGNhc2UgJ1tvYmplY3QgQm9vbGVhbl0nOlxuICAgICAgICAvLyBDb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWVyaWMgcHJpbWl0aXZlIHZhbHVlcy4gRGF0ZXMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyXG4gICAgICAgIC8vIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9ucy4gTm90ZSB0aGF0IGludmFsaWQgZGF0ZXMgd2l0aCBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnNcbiAgICAgICAgLy8gb2YgYE5hTmAgYXJlIG5vdCBlcXVpdmFsZW50LlxuICAgICAgICByZXR1cm4gK2EgPT09ICtiO1xuICAgICAgY2FzZSAnW29iamVjdCBTeW1ib2xdJzpcbiAgICAgICAgcmV0dXJuIFN5bWJvbFByb3RvLnZhbHVlT2YuY2FsbChhKSA9PT0gU3ltYm9sUHJvdG8udmFsdWVPZi5jYWxsKGIpO1xuICAgICAgY2FzZSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nOlxuICAgICAgY2FzZSB0YWdEYXRhVmlldzpcbiAgICAgICAgLy8gQ29lcmNlIHRvIHR5cGVkIGFycmF5IHNvIHdlIGNhbiBmYWxsIHRocm91Z2guXG4gICAgICAgIHJldHVybiBkZWVwRXEodG9CdWZmZXJWaWV3KGEpLCB0b0J1ZmZlclZpZXcoYiksIGFTdGFjaywgYlN0YWNrKTtcbiAgICB9XG5cbiAgICB2YXIgYXJlQXJyYXlzID0gY2xhc3NOYW1lID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIGlmICghYXJlQXJyYXlzICYmIGlzVHlwZWRBcnJheSQxKGEpKSB7XG4gICAgICAgIHZhciBieXRlTGVuZ3RoID0gZ2V0Qnl0ZUxlbmd0aChhKTtcbiAgICAgICAgaWYgKGJ5dGVMZW5ndGggIT09IGdldEJ5dGVMZW5ndGgoYikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGEuYnVmZmVyID09PSBiLmJ1ZmZlciAmJiBhLmJ5dGVPZmZzZXQgPT09IGIuYnl0ZU9mZnNldCkgcmV0dXJuIHRydWU7XG4gICAgICAgIGFyZUFycmF5cyA9IHRydWU7XG4gICAgfVxuICAgIGlmICghYXJlQXJyYXlzKSB7XG4gICAgICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcblxuICAgICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzIG9yIGBBcnJheWBzXG4gICAgICAvLyBmcm9tIGRpZmZlcmVudCBmcmFtZXMgYXJlLlxuICAgICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgICAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKGlzRnVuY3Rpb24kMShhQ3RvcikgJiYgYUN0b3IgaW5zdGFuY2VvZiBhQ3RvciAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRnVuY3Rpb24kMShiQ3RvcikgJiYgYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKCdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuXG4gICAgLy8gSW5pdGlhbGl6aW5nIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIC8vIEl0J3MgZG9uZSBoZXJlIHNpbmNlIHdlIG9ubHkgbmVlZCB0aGVtIGZvciBvYmplY3RzIGFuZCBhcnJheXMgY29tcGFyaXNvbi5cbiAgICBhU3RhY2sgPSBhU3RhY2sgfHwgW107XG4gICAgYlN0YWNrID0gYlN0YWNrIHx8IFtdO1xuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PT0gYjtcbiAgICB9XG5cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG5cbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoYXJlQXJyYXlzKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIGxlbmd0aCA9IGEubGVuZ3RoO1xuICAgICAgaWYgKGxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICAgIC8vIERlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXMuXG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgICAgaWYgKCFlcShhW2xlbmd0aF0sIGJbbGVuZ3RoXSwgYVN0YWNrLCBiU3RhY2spKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgdmFyIF9rZXlzID0ga2V5cyhhKSwga2V5O1xuICAgICAgbGVuZ3RoID0gX2tleXMubGVuZ3RoO1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMgYmVmb3JlIGNvbXBhcmluZyBkZWVwIGVxdWFsaXR5LlxuICAgICAgaWYgKGtleXMoYikubGVuZ3RoICE9PSBsZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXJcbiAgICAgICAga2V5ID0gX2tleXNbbGVuZ3RoXTtcbiAgICAgICAgaWYgKCEoaGFzJDEoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucG9wKCk7XG4gICAgYlN0YWNrLnBvcCgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gUGVyZm9ybSBhIGRlZXAgY29tcGFyaXNvbiB0byBjaGVjayBpZiB0d28gb2JqZWN0cyBhcmUgZXF1YWwuXG4gIGZ1bmN0aW9uIGlzRXF1YWwoYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiKTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlIGFsbCB0aGUgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QuXG4gIGZ1bmN0aW9uIGFsbEtleXMob2JqKSB7XG4gICAgaWYgKCFpc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgICAvLyBBaGVtLCBJRSA8IDkuXG4gICAgaWYgKGhhc0VudW1CdWcpIGNvbGxlY3ROb25FbnVtUHJvcHMob2JqLCBrZXlzKTtcbiAgICByZXR1cm4ga2V5cztcbiAgfVxuXG4gIC8vIFNpbmNlIHRoZSByZWd1bGFyIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYCB0eXBlIHRlc3RzIGRvbid0IHdvcmsgZm9yXG4gIC8vIHNvbWUgdHlwZXMgaW4gSUUgMTEsIHdlIHVzZSBhIGZpbmdlcnByaW50aW5nIGhldXJpc3RpYyBpbnN0ZWFkLCBiYXNlZFxuICAvLyBvbiB0aGUgbWV0aG9kcy4gSXQncyBub3QgZ3JlYXQsIGJ1dCBpdCdzIHRoZSBiZXN0IHdlIGdvdC5cbiAgLy8gVGhlIGZpbmdlcnByaW50IG1ldGhvZCBsaXN0cyBhcmUgZGVmaW5lZCBiZWxvdy5cbiAgZnVuY3Rpb24gaWUxMWZpbmdlcnByaW50KG1ldGhvZHMpIHtcbiAgICB2YXIgbGVuZ3RoID0gZ2V0TGVuZ3RoKG1ldGhvZHMpO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgICAgLy8gYE1hcGAsIGBXZWFrTWFwYCBhbmQgYFNldGAgaGF2ZSBubyBlbnVtZXJhYmxlIGtleXMuXG4gICAgICB2YXIga2V5cyA9IGFsbEtleXMob2JqKTtcbiAgICAgIGlmIChnZXRMZW5ndGgoa2V5cykpIHJldHVybiBmYWxzZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKCFpc0Z1bmN0aW9uJDEob2JqW21ldGhvZHNbaV1dKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgLy8gSWYgd2UgYXJlIHRlc3RpbmcgYWdhaW5zdCBgV2Vha01hcGAsIHdlIG5lZWQgdG8gZW5zdXJlIHRoYXRcbiAgICAgIC8vIGBvYmpgIGRvZXNuJ3QgaGF2ZSBhIGBmb3JFYWNoYCBtZXRob2QgaW4gb3JkZXIgdG8gZGlzdGluZ3Vpc2hcbiAgICAgIC8vIGl0IGZyb20gYSByZWd1bGFyIGBNYXBgLlxuICAgICAgcmV0dXJuIG1ldGhvZHMgIT09IHdlYWtNYXBNZXRob2RzIHx8ICFpc0Z1bmN0aW9uJDEob2JqW2ZvckVhY2hOYW1lXSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEluIHRoZSBpbnRlcmVzdCBvZiBjb21wYWN0IG1pbmlmaWNhdGlvbiwgd2Ugd3JpdGVcbiAgLy8gZWFjaCBzdHJpbmcgaW4gdGhlIGZpbmdlcnByaW50cyBvbmx5IG9uY2UuXG4gIHZhciBmb3JFYWNoTmFtZSA9ICdmb3JFYWNoJyxcbiAgICAgIGhhc05hbWUgPSAnaGFzJyxcbiAgICAgIGNvbW1vbkluaXQgPSBbJ2NsZWFyJywgJ2RlbGV0ZSddLFxuICAgICAgbWFwVGFpbCA9IFsnZ2V0JywgaGFzTmFtZSwgJ3NldCddO1xuXG4gIC8vIGBNYXBgLCBgV2Vha01hcGAgYW5kIGBTZXRgIGVhY2ggaGF2ZSBzbGlnaHRseSBkaWZmZXJlbnRcbiAgLy8gY29tYmluYXRpb25zIG9mIHRoZSBhYm92ZSBzdWJsaXN0cy5cbiAgdmFyIG1hcE1ldGhvZHMgPSBjb21tb25Jbml0LmNvbmNhdChmb3JFYWNoTmFtZSwgbWFwVGFpbCksXG4gICAgICB3ZWFrTWFwTWV0aG9kcyA9IGNvbW1vbkluaXQuY29uY2F0KG1hcFRhaWwpLFxuICAgICAgc2V0TWV0aG9kcyA9IFsnYWRkJ10uY29uY2F0KGNvbW1vbkluaXQsIGZvckVhY2hOYW1lLCBoYXNOYW1lKTtcblxuICB2YXIgaXNNYXAgPSBpc0lFMTEgPyBpZTExZmluZ2VycHJpbnQobWFwTWV0aG9kcykgOiB0YWdUZXN0ZXIoJ01hcCcpO1xuXG4gIHZhciBpc1dlYWtNYXAgPSBpc0lFMTEgPyBpZTExZmluZ2VycHJpbnQod2Vha01hcE1ldGhvZHMpIDogdGFnVGVzdGVyKCdXZWFrTWFwJyk7XG5cbiAgdmFyIGlzU2V0ID0gaXNJRTExID8gaWUxMWZpbmdlcnByaW50KHNldE1ldGhvZHMpIDogdGFnVGVzdGVyKCdTZXQnKTtcblxuICB2YXIgaXNXZWFrU2V0ID0gdGFnVGVzdGVyKCdXZWFrU2V0Jyk7XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBmdW5jdGlvbiB2YWx1ZXMob2JqKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBfa2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW19rZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfVxuXG4gIC8vIENvbnZlcnQgYW4gb2JqZWN0IGludG8gYSBsaXN0IG9mIGBba2V5LCB2YWx1ZV1gIHBhaXJzLlxuICAvLyBUaGUgb3Bwb3NpdGUgb2YgYF8ub2JqZWN0YCB3aXRoIG9uZSBhcmd1bWVudC5cbiAgZnVuY3Rpb24gcGFpcnMob2JqKSB7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBfa2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtfa2V5c1tpXSwgb2JqW19rZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbiAgfVxuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgZnVuY3Rpb24gaW52ZXJ0KG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIgX2tleXMgPSBrZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9rZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW19rZXlzW2ldXV0gPSBfa2V5c1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgZnVuY3Rpb24gZnVuY3Rpb25zKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChpc0Z1bmN0aW9uJDEob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYXNzaWduZXIgZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihrZXlzRnVuYywgZGVmYXVsdHMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIGlmIChkZWZhdWx0cykgb2JqID0gT2JqZWN0KG9iaik7XG4gICAgICBpZiAobGVuZ3RoIDwgMiB8fCBvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF0sXG4gICAgICAgICAgICBrZXlzID0ga2V5c0Z1bmMoc291cmNlKSxcbiAgICAgICAgICAgIGwgPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICBpZiAoIWRlZmF1bHRzIHx8IG9ialtrZXldID09PSB2b2lkIDApIG9ialtrZXldID0gc291cmNlW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICB2YXIgZXh0ZW5kID0gY3JlYXRlQXNzaWduZXIoYWxsS2V5cyk7XG5cbiAgLy8gQXNzaWducyBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgb3duIHByb3BlcnRpZXMgaW4gdGhlIHBhc3NlZC1pblxuICAvLyBvYmplY3QocykuXG4gIC8vIChodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvYXNzaWduKVxuICB2YXIgZXh0ZW5kT3duID0gY3JlYXRlQXNzaWduZXIoa2V5cyk7XG5cbiAgLy8gRmlsbCBpbiBhIGdpdmVuIG9iamVjdCB3aXRoIGRlZmF1bHQgcHJvcGVydGllcy5cbiAgdmFyIGRlZmF1bHRzID0gY3JlYXRlQXNzaWduZXIoYWxsS2V5cywgdHJ1ZSk7XG5cbiAgLy8gQ3JlYXRlIGEgbmFrZWQgZnVuY3Rpb24gcmVmZXJlbmNlIGZvciBzdXJyb2dhdGUtcHJvdG90eXBlLXN3YXBwaW5nLlxuICBmdW5jdGlvbiBjdG9yKCkge1xuICAgIHJldHVybiBmdW5jdGlvbigpe307XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYSBuZXcgb2JqZWN0IHRoYXQgaW5oZXJpdHMgZnJvbSBhbm90aGVyLlxuICBmdW5jdGlvbiBiYXNlQ3JlYXRlKHByb3RvdHlwZSkge1xuICAgIGlmICghaXNPYmplY3QocHJvdG90eXBlKSkgcmV0dXJuIHt9O1xuICAgIGlmIChuYXRpdmVDcmVhdGUpIHJldHVybiBuYXRpdmVDcmVhdGUocHJvdG90eXBlKTtcbiAgICB2YXIgQ3RvciA9IGN0b3IoKTtcbiAgICBDdG9yLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEN0b3I7XG4gICAgQ3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBDcmVhdGVzIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gdGhlIGdpdmVuIHByb3RvdHlwZSBvYmplY3QuXG4gIC8vIElmIGFkZGl0aW9uYWwgcHJvcGVydGllcyBhcmUgcHJvdmlkZWQgdGhlbiB0aGV5IHdpbGwgYmUgYWRkZWQgdG8gdGhlXG4gIC8vIGNyZWF0ZWQgb2JqZWN0LlxuICBmdW5jdGlvbiBjcmVhdGUocHJvdG90eXBlLCBwcm9wcykge1xuICAgIHZhciByZXN1bHQgPSBiYXNlQ3JlYXRlKHByb3RvdHlwZSk7XG4gICAgaWYgKHByb3BzKSBleHRlbmRPd24ocmVzdWx0LCBwcm9wcyk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgZnVuY3Rpb24gY2xvbmUob2JqKSB7XG4gICAgaWYgKCFpc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBpc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IGV4dGVuZCh7fSwgb2JqKTtcbiAgfVxuXG4gIC8vIEludm9rZXMgYGludGVyY2VwdG9yYCB3aXRoIHRoZSBgb2JqYCBhbmQgdGhlbiByZXR1cm5zIGBvYmpgLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIGZ1bmN0aW9uIHRhcChvYmosIGludGVyY2VwdG9yKSB7XG4gICAgaW50ZXJjZXB0b3Iob2JqKTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLy8gTm9ybWFsaXplIGEgKGRlZXApIHByb3BlcnR5IGBwYXRoYCB0byBhcnJheS5cbiAgLy8gTGlrZSBgXy5pdGVyYXRlZWAsIHRoaXMgZnVuY3Rpb24gY2FuIGJlIGN1c3RvbWl6ZWQuXG4gIGZ1bmN0aW9uIHRvUGF0aCQxKHBhdGgpIHtcbiAgICByZXR1cm4gaXNBcnJheShwYXRoKSA/IHBhdGggOiBbcGF0aF07XG4gIH1cbiAgXyQxLnRvUGF0aCA9IHRvUGF0aCQxO1xuXG4gIC8vIEludGVybmFsIHdyYXBwZXIgZm9yIGBfLnRvUGF0aGAgdG8gZW5hYmxlIG1pbmlmaWNhdGlvbi5cbiAgLy8gU2ltaWxhciB0byBgY2JgIGZvciBgXy5pdGVyYXRlZWAuXG4gIGZ1bmN0aW9uIHRvUGF0aChwYXRoKSB7XG4gICAgcmV0dXJuIF8kMS50b1BhdGgocGF0aCk7XG4gIH1cblxuICAvLyBJbnRlcm5hbCBmdW5jdGlvbiB0byBvYnRhaW4gYSBuZXN0ZWQgcHJvcGVydHkgaW4gYG9iamAgYWxvbmcgYHBhdGhgLlxuICBmdW5jdGlvbiBkZWVwR2V0KG9iaiwgcGF0aCkge1xuICAgIHZhciBsZW5ndGggPSBwYXRoLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgICBvYmogPSBvYmpbcGF0aFtpXV07XG4gICAgfVxuICAgIHJldHVybiBsZW5ndGggPyBvYmogOiB2b2lkIDA7XG4gIH1cblxuICAvLyBHZXQgdGhlIHZhbHVlIG9mIHRoZSAoZGVlcCkgcHJvcGVydHkgb24gYHBhdGhgIGZyb20gYG9iamVjdGAuXG4gIC8vIElmIGFueSBwcm9wZXJ0eSBpbiBgcGF0aGAgZG9lcyBub3QgZXhpc3Qgb3IgaWYgdGhlIHZhbHVlIGlzXG4gIC8vIGB1bmRlZmluZWRgLCByZXR1cm4gYGRlZmF1bHRWYWx1ZWAgaW5zdGVhZC5cbiAgLy8gVGhlIGBwYXRoYCBpcyBub3JtYWxpemVkIHRocm91Z2ggYF8udG9QYXRoYC5cbiAgZnVuY3Rpb24gZ2V0KG9iamVjdCwgcGF0aCwgZGVmYXVsdFZhbHVlKSB7XG4gICAgdmFyIHZhbHVlID0gZGVlcEdldChvYmplY3QsIHRvUGF0aChwYXRoKSk7XG4gICAgcmV0dXJuIGlzVW5kZWZpbmVkKHZhbHVlKSA/IGRlZmF1bHRWYWx1ZSA6IHZhbHVlO1xuICB9XG5cbiAgLy8gU2hvcnRjdXQgZnVuY3Rpb24gZm9yIGNoZWNraW5nIGlmIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBwcm9wZXJ0eSBkaXJlY3RseSBvblxuICAvLyBpdHNlbGYgKGluIG90aGVyIHdvcmRzLCBub3Qgb24gYSBwcm90b3R5cGUpLiBVbmxpa2UgdGhlIGludGVybmFsIGBoYXNgXG4gIC8vIGZ1bmN0aW9uLCB0aGlzIHB1YmxpYyB2ZXJzaW9uIGNhbiBhbHNvIHRyYXZlcnNlIG5lc3RlZCBwcm9wZXJ0aWVzLlxuICBmdW5jdGlvbiBoYXMob2JqLCBwYXRoKSB7XG4gICAgcGF0aCA9IHRvUGF0aChwYXRoKTtcbiAgICB2YXIgbGVuZ3RoID0gcGF0aC5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGtleSA9IHBhdGhbaV07XG4gICAgICBpZiAoIWhhcyQxKG9iaiwga2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgICAgb2JqID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiAhIWxlbmd0aDtcbiAgfVxuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRlZXMuXG4gIGZ1bmN0aW9uIGlkZW50aXR5KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByZWRpY2F0ZSBmb3IgY2hlY2tpbmcgd2hldGhlciBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gc2V0IG9mXG4gIC8vIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiBtYXRjaGVyKGF0dHJzKSB7XG4gICAgYXR0cnMgPSBleHRlbmRPd24oe30sIGF0dHJzKTtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gaXNNYXRjaChvYmosIGF0dHJzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gcGFzc2VkIGFuIG9iamVjdCwgd2lsbCB0cmF2ZXJzZSB0aGF0IG9iamVjdOKAmXNcbiAgLy8gcHJvcGVydGllcyBkb3duIHRoZSBnaXZlbiBgcGF0aGAsIHNwZWNpZmllZCBhcyBhbiBhcnJheSBvZiBrZXlzIG9yIGluZGljZXMuXG4gIGZ1bmN0aW9uIHByb3BlcnR5KHBhdGgpIHtcbiAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBkZWVwR2V0KG9iaiwgcGF0aCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgLy8gZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBvcHRpbWl6ZUNiKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgICAvLyBUaGUgMi1hcmd1bWVudCBjYXNlIGlzIG9taXR0ZWQgYmVjYXVzZSB3ZeKAmXJlIG5vdCB1c2luZyBpdC5cbiAgICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICB9O1xuICAgICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgY2FsbGJhY2tzIHRoYXQgY2FuIGJlIGFwcGxpZWQgdG8gZWFjaFxuICAvLyBlbGVtZW50IGluIGEgY29sbGVjdGlvbiwgcmV0dXJuaW5nIHRoZSBkZXNpcmVkIHJlc3VsdCDigJQgZWl0aGVyIGBfLmlkZW50aXR5YCxcbiAgLy8gYW4gYXJiaXRyYXJ5IGNhbGxiYWNrLCBhIHByb3BlcnR5IG1hdGNoZXIsIG9yIGEgcHJvcGVydHkgYWNjZXNzb3IuXG4gIGZ1bmN0aW9uIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIGlkZW50aXR5O1xuICAgIGlmIChpc0Z1bmN0aW9uJDEodmFsdWUpKSByZXR1cm4gb3B0aW1pemVDYih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChpc09iamVjdCh2YWx1ZSkgJiYgIWlzQXJyYXkodmFsdWUpKSByZXR1cm4gbWF0Y2hlcih2YWx1ZSk7XG4gICAgcmV0dXJuIHByb3BlcnR5KHZhbHVlKTtcbiAgfVxuXG4gIC8vIEV4dGVybmFsIHdyYXBwZXIgZm9yIG91ciBjYWxsYmFjayBnZW5lcmF0b3IuIFVzZXJzIG1heSBjdXN0b21pemVcbiAgLy8gYF8uaXRlcmF0ZWVgIGlmIHRoZXkgd2FudCBhZGRpdGlvbmFsIHByZWRpY2F0ZS9pdGVyYXRlZSBzaG9ydGhhbmQgc3R5bGVzLlxuICAvLyBUaGlzIGFic3RyYWN0aW9uIGhpZGVzIHRoZSBpbnRlcm5hbC1vbmx5IGBhcmdDb3VudGAgYXJndW1lbnQuXG4gIGZ1bmN0aW9uIGl0ZXJhdGVlKHZhbHVlLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgSW5maW5pdHkpO1xuICB9XG4gIF8kMS5pdGVyYXRlZSA9IGl0ZXJhdGVlO1xuXG4gIC8vIFRoZSBmdW5jdGlvbiB3ZSBjYWxsIGludGVybmFsbHkgdG8gZ2VuZXJhdGUgYSBjYWxsYmFjay4gSXQgaW52b2tlc1xuICAvLyBgXy5pdGVyYXRlZWAgaWYgb3ZlcnJpZGRlbiwgb3RoZXJ3aXNlIGBiYXNlSXRlcmF0ZWVgLlxuICBmdW5jdGlvbiBjYih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAoXyQxLml0ZXJhdGVlICE9PSBpdGVyYXRlZSkgcmV0dXJuIF8kMS5pdGVyYXRlZSh2YWx1ZSwgY29udGV4dCk7XG4gICAgcmV0dXJuIGJhc2VJdGVyYXRlZSh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgYGl0ZXJhdGVlYCB0byBlYWNoIGVsZW1lbnQgb2YgYG9iamAuXG4gIC8vIEluIGNvbnRyYXN0IHRvIGBfLm1hcGAgaXQgcmV0dXJucyBhbiBvYmplY3QuXG4gIGZ1bmN0aW9uIG1hcE9iamVjdChvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIF9rZXlzID0ga2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSBfa2V5cy5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgY3VycmVudEtleSA9IF9rZXlzW2luZGV4XTtcbiAgICAgIHJlc3VsdHNbY3VycmVudEtleV0gPSBpdGVyYXRlZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgLy8gUHJlZGljYXRlLWdlbmVyYXRpbmcgZnVuY3Rpb24uIE9mdGVuIHVzZWZ1bCBvdXRzaWRlIG9mIFVuZGVyc2NvcmUuXG4gIGZ1bmN0aW9uIG5vb3AoKXt9XG5cbiAgLy8gR2VuZXJhdGVzIGEgZnVuY3Rpb24gZm9yIGEgZ2l2ZW4gb2JqZWN0IHRoYXQgcmV0dXJucyBhIGdpdmVuIHByb3BlcnR5LlxuICBmdW5jdGlvbiBwcm9wZXJ0eU9mKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG5vb3A7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgIHJldHVybiBnZXQob2JqLCBwYXRoKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIGZ1bmN0aW9uIHRpbWVzKG4sIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgIGl0ZXJhdGVlID0gb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBgbWluYCBhbmQgYG1heGAgKGluY2x1c2l2ZSkuXG4gIGZ1bmN0aW9uIHJhbmRvbShtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH1cblxuICAvLyBBIChwb3NzaWJseSBmYXN0ZXIpIHdheSB0byBnZXQgdGhlIGN1cnJlbnQgdGltZXN0YW1wIGFzIGFuIGludGVnZXIuXG4gIHZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGdlbmVyYXRlIGZ1bmN0aW9ucyBmb3IgZXNjYXBpbmcgYW5kIHVuZXNjYXBpbmcgc3RyaW5nc1xuICAvLyB0by9mcm9tIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgZnVuY3Rpb24gY3JlYXRlRXNjYXBlcihtYXApIHtcbiAgICB2YXIgZXNjYXBlciA9IGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgICByZXR1cm4gbWFwW21hdGNoXTtcbiAgICB9O1xuICAgIC8vIFJlZ2V4ZXMgZm9yIGlkZW50aWZ5aW5nIGEga2V5IHRoYXQgbmVlZHMgdG8gYmUgZXNjYXBlZC5cbiAgICB2YXIgc291cmNlID0gJyg/OicgKyBrZXlzKG1hcCkuam9pbignfCcpICsgJyknO1xuICAgIHZhciB0ZXN0UmVnZXhwID0gUmVnRXhwKHNvdXJjZSk7XG4gICAgdmFyIHJlcGxhY2VSZWdleHAgPSBSZWdFeHAoc291cmNlLCAnZycpO1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgICAgIHJldHVybiB0ZXN0UmVnZXhwLnRlc3Qoc3RyaW5nKSA/IHN0cmluZy5yZXBsYWNlKHJlcGxhY2VSZWdleHAsIGVzY2FwZXIpIDogc3RyaW5nO1xuICAgIH07XG4gIH1cblxuICAvLyBJbnRlcm5hbCBsaXN0IG9mIEhUTUwgZW50aXRpZXMgZm9yIGVzY2FwaW5nLlxuICB2YXIgZXNjYXBlTWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjeDI3OycsXG4gICAgJ2AnOiAnJiN4NjA7J1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIGZvciBlc2NhcGluZyBzdHJpbmdzIHRvIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgdmFyIF9lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKGVzY2FwZU1hcCk7XG5cbiAgLy8gSW50ZXJuYWwgbGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciB1bmVzY2FwaW5nLlxuICB2YXIgdW5lc2NhcGVNYXAgPSBpbnZlcnQoZXNjYXBlTWFwKTtcblxuICAvLyBGdW5jdGlvbiBmb3IgdW5lc2NhcGluZyBzdHJpbmdzIGZyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICB2YXIgX3VuZXNjYXBlID0gY3JlYXRlRXNjYXBlcih1bmVzY2FwZU1hcCk7XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLiBDaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgdmFyIHRlbXBsYXRlU2V0dGluZ3MgPSBfJDEudGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZTogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZTogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gICAgZXNjYXBlOiAvPCUtKFtcXHNcXFNdKz8pJT4vZ1xuICB9O1xuXG4gIC8vIFdoZW4gY3VzdG9taXppbmcgYF8udGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6IFwiJ1wiLFxuICAgICdcXFxcJzogJ1xcXFwnLFxuICAgICdcXHInOiAncicsXG4gICAgJ1xcbic6ICduJyxcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXG4gICAgJ1xcdTIwMjknOiAndTIwMjknXG4gIH07XG5cbiAgdmFyIGVzY2FwZVJlZ0V4cCA9IC9cXFxcfCd8XFxyfFxcbnxcXHUyMDI4fFxcdTIwMjkvZztcblxuICBmdW5jdGlvbiBlc2NhcGVDaGFyKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdO1xuICB9XG5cbiAgLy8gSW4gb3JkZXIgdG8gcHJldmVudCB0aGlyZC1wYXJ0eSBjb2RlIGluamVjdGlvbiB0aHJvdWdoXG4gIC8vIGBfLnRlbXBsYXRlU2V0dGluZ3MudmFyaWFibGVgLCB3ZSB0ZXN0IGl0IGFnYWluc3QgdGhlIGZvbGxvd2luZyByZWd1bGFyXG4gIC8vIGV4cHJlc3Npb24uIEl0IGlzIGludGVudGlvbmFsbHkgYSBiaXQgbW9yZSBsaWJlcmFsIHRoYW4ganVzdCBtYXRjaGluZyB2YWxpZFxuICAvLyBpZGVudGlmaWVycywgYnV0IHN0aWxsIHByZXZlbnRzIHBvc3NpYmxlIGxvb3Bob2xlcyB0aHJvdWdoIGRlZmF1bHRzIG9yXG4gIC8vIGRlc3RydWN0dXJpbmcgYXNzaWdubWVudC5cbiAgdmFyIGJhcmVJZGVudGlmaWVyID0gL15cXHMqKFxcd3xcXCQpK1xccyokLztcblxuICAvLyBKYXZhU2NyaXB0IG1pY3JvLXRlbXBsYXRpbmcsIHNpbWlsYXIgdG8gSm9obiBSZXNpZydzIGltcGxlbWVudGF0aW9uLlxuICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRpbmcgaGFuZGxlcyBhcmJpdHJhcnkgZGVsaW1pdGVycywgcHJlc2VydmVzIHdoaXRlc3BhY2UsXG4gIC8vIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICAvLyBOQjogYG9sZFNldHRpbmdzYCBvbmx5IGV4aXN0cyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG4gIGZ1bmN0aW9uIHRlbXBsYXRlKHRleHQsIHNldHRpbmdzLCBvbGRTZXR0aW5ncykge1xuICAgIGlmICghc2V0dGluZ3MgJiYgb2xkU2V0dGluZ3MpIHNldHRpbmdzID0gb2xkU2V0dGluZ3M7XG4gICAgc2V0dGluZ3MgPSBkZWZhdWx0cyh7fSwgc2V0dGluZ3MsIF8kMS50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKGVzY2FwZVJlZ0V4cCwgZXNjYXBlQ2hhcik7XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfSBlbHNlIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cblxuICAgICAgLy8gQWRvYmUgVk1zIG5lZWQgdGhlIG1hdGNoIHJldHVybmVkIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3Qgb2Zmc2V0LlxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICB2YXIgYXJndW1lbnQgPSBzZXR0aW5ncy52YXJpYWJsZTtcbiAgICBpZiAoYXJndW1lbnQpIHtcbiAgICAgIC8vIEluc3VyZSBhZ2FpbnN0IHRoaXJkLXBhcnR5IGNvZGUgaW5qZWN0aW9uLiAoQ1ZFLTIwMjEtMjMzNTgpXG4gICAgICBpZiAoIWJhcmVJZGVudGlmaWVyLnRlc3QoYXJndW1lbnQpKSB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICd2YXJpYWJsZSBpcyBub3QgYSBiYXJlIGlkZW50aWZpZXI6ICcgKyBhcmd1bWVudFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICAgIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG4gICAgICBhcmd1bWVudCA9ICdvYmonO1xuICAgIH1cblxuICAgIHNvdXJjZSA9IFwidmFyIF9fdCxfX3A9JycsX19qPUFycmF5LnByb3RvdHlwZS5qb2luLFwiICtcbiAgICAgIFwicHJpbnQ9ZnVuY3Rpb24oKXtfX3ArPV9fai5jYWxsKGFyZ3VtZW50cywnJyk7fTtcXG5cIiArXG4gICAgICBzb3VyY2UgKyAncmV0dXJuIF9fcDtcXG4nO1xuXG4gICAgdmFyIHJlbmRlcjtcbiAgICB0cnkge1xuICAgICAgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKGFyZ3VtZW50LCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfJDEpO1xuICAgIH07XG5cbiAgICAvLyBQcm92aWRlIHRoZSBjb21waWxlZCBzb3VyY2UgYXMgYSBjb252ZW5pZW5jZSBmb3IgcHJlY29tcGlsYXRpb24uXG4gICAgdGVtcGxhdGUuc291cmNlID0gJ2Z1bmN0aW9uKCcgKyBhcmd1bWVudCArICcpe1xcbicgKyBzb3VyY2UgKyAnfSc7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICAvLyBUcmF2ZXJzZXMgdGhlIGNoaWxkcmVuIG9mIGBvYmpgIGFsb25nIGBwYXRoYC4gSWYgYSBjaGlsZCBpcyBhIGZ1bmN0aW9uLCBpdFxuICAvLyBpcyBpbnZva2VkIHdpdGggaXRzIHBhcmVudCBhcyBjb250ZXh0LiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZmluYWxcbiAgLy8gY2hpbGQsIG9yIGBmYWxsYmFja2AgaWYgYW55IGNoaWxkIGlzIHVuZGVmaW5lZC5cbiAgZnVuY3Rpb24gcmVzdWx0KG9iaiwgcGF0aCwgZmFsbGJhY2spIHtcbiAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgIHZhciBsZW5ndGggPSBwYXRoLmxlbmd0aDtcbiAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgcmV0dXJuIGlzRnVuY3Rpb24kMShmYWxsYmFjaykgPyBmYWxsYmFjay5jYWxsKG9iaikgOiBmYWxsYmFjaztcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHByb3AgPSBvYmogPT0gbnVsbCA/IHZvaWQgMCA6IG9ialtwYXRoW2ldXTtcbiAgICAgIGlmIChwcm9wID09PSB2b2lkIDApIHtcbiAgICAgICAgcHJvcCA9IGZhbGxiYWNrO1xuICAgICAgICBpID0gbGVuZ3RoOyAvLyBFbnN1cmUgd2UgZG9uJ3QgY29udGludWUgaXRlcmF0aW5nLlxuICAgICAgfVxuICAgICAgb2JqID0gaXNGdW5jdGlvbiQxKHByb3ApID8gcHJvcC5jYWxsKG9iaikgOiBwcm9wO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH1cblxuICAvLyBTdGFydCBjaGFpbmluZyBhIHdyYXBwZWQgVW5kZXJzY29yZSBvYmplY3QuXG4gIGZ1bmN0aW9uIGNoYWluKG9iaikge1xuICAgIHZhciBpbnN0YW5jZSA9IF8kMShvYmopO1xuICAgIGluc3RhbmNlLl9jaGFpbiA9IHRydWU7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdG8gZXhlY3V0ZSBgc291cmNlRnVuY2AgYm91bmQgdG8gYGNvbnRleHRgIHdpdGggb3B0aW9uYWxcbiAgLy8gYGFyZ3NgLiBEZXRlcm1pbmVzIHdoZXRoZXIgdG8gZXhlY3V0ZSBhIGZ1bmN0aW9uIGFzIGEgY29uc3RydWN0b3Igb3IgYXMgYVxuICAvLyBub3JtYWwgZnVuY3Rpb24uXG4gIGZ1bmN0aW9uIGV4ZWN1dGVCb3VuZChzb3VyY2VGdW5jLCBib3VuZEZ1bmMsIGNvbnRleHQsIGNhbGxpbmdDb250ZXh0LCBhcmdzKSB7XG4gICAgaWYgKCEoY2FsbGluZ0NvbnRleHQgaW5zdGFuY2VvZiBib3VuZEZ1bmMpKSByZXR1cm4gc291cmNlRnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB2YXIgc2VsZiA9IGJhc2VDcmVhdGUoc291cmNlRnVuYy5wcm90b3R5cGUpO1xuICAgIHZhciByZXN1bHQgPSBzb3VyY2VGdW5jLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIGlmIChpc09iamVjdChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuICAgIHJldHVybiBzZWxmO1xuICB9XG5cbiAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAvLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gYF9gIGFjdHNcbiAgLy8gYXMgYSBwbGFjZWhvbGRlciBieSBkZWZhdWx0LCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlXG4gIC8vIHByZS1maWxsZWQuIFNldCBgXy5wYXJ0aWFsLnBsYWNlaG9sZGVyYCBmb3IgYSBjdXN0b20gcGxhY2Vob2xkZXIgYXJndW1lbnQuXG4gIHZhciBwYXJ0aWFsID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihmdW5jLCBib3VuZEFyZ3MpIHtcbiAgICB2YXIgcGxhY2Vob2xkZXIgPSBwYXJ0aWFsLnBsYWNlaG9sZGVyO1xuICAgIHZhciBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gMCwgbGVuZ3RoID0gYm91bmRBcmdzLmxlbmd0aDtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJnc1tpXSA9IGJvdW5kQXJnc1tpXSA9PT0gcGxhY2Vob2xkZXIgPyBhcmd1bWVudHNbcG9zaXRpb24rK10gOiBib3VuZEFyZ3NbaV07XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBleGVjdXRlQm91bmQoZnVuYywgYm91bmQsIHRoaXMsIHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9KTtcblxuICBwYXJ0aWFsLnBsYWNlaG9sZGVyID0gXyQxO1xuXG4gIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAvLyBvcHRpb25hbGx5KS5cbiAgdmFyIGJpbmQgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQsIGFyZ3MpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb24kMShmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQmluZCBtdXN0IGJlIGNhbGxlZCBvbiBhIGZ1bmN0aW9uJyk7XG4gICAgdmFyIGJvdW5kID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihjYWxsQXJncykge1xuICAgICAgcmV0dXJuIGV4ZWN1dGVCb3VuZChmdW5jLCBib3VuZCwgY29udGV4dCwgdGhpcywgYXJncy5jb25jYXQoY2FsbEFyZ3MpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH0pO1xuXG4gIC8vIEludGVybmFsIGhlbHBlciBmb3IgY29sbGVjdGlvbiBtZXRob2RzIHRvIGRldGVybWluZSB3aGV0aGVyIGEgY29sbGVjdGlvblxuICAvLyBzaG91bGQgYmUgaXRlcmF0ZWQgYXMgYW4gYXJyYXkgb3IgYXMgYW4gb2JqZWN0LlxuICAvLyBSZWxhdGVkOiBodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtdG9sZW5ndGhcbiAgLy8gQXZvaWRzIGEgdmVyeSBuYXN0eSBpT1MgOCBKSVQgYnVnIG9uIEFSTS02NC4gIzIwOTRcbiAgdmFyIGlzQXJyYXlMaWtlID0gY3JlYXRlU2l6ZVByb3BlcnR5Q2hlY2soZ2V0TGVuZ3RoKTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIGZ1bmN0aW9uIGZsYXR0ZW4kMShpbnB1dCwgZGVwdGgsIHN0cmljdCwgb3V0cHV0KSB7XG4gICAgb3V0cHV0ID0gb3V0cHV0IHx8IFtdO1xuICAgIGlmICghZGVwdGggJiYgZGVwdGggIT09IDApIHtcbiAgICAgIGRlcHRoID0gSW5maW5pdHk7XG4gICAgfSBlbHNlIGlmIChkZXB0aCA8PSAwKSB7XG4gICAgICByZXR1cm4gb3V0cHV0LmNvbmNhdChpbnB1dCk7XG4gICAgfVxuICAgIHZhciBpZHggPSBvdXRwdXQubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBnZXRMZW5ndGgoaW5wdXQpOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGlucHV0W2ldO1xuICAgICAgaWYgKGlzQXJyYXlMaWtlKHZhbHVlKSAmJiAoaXNBcnJheSh2YWx1ZSkgfHwgaXNBcmd1bWVudHMkMSh2YWx1ZSkpKSB7XG4gICAgICAgIC8vIEZsYXR0ZW4gY3VycmVudCBsZXZlbCBvZiBhcnJheSBvciBhcmd1bWVudHMgb2JqZWN0LlxuICAgICAgICBpZiAoZGVwdGggPiAxKSB7XG4gICAgICAgICAgZmxhdHRlbiQxKHZhbHVlLCBkZXB0aCAtIDEsIHN0cmljdCwgb3V0cHV0KTtcbiAgICAgICAgICBpZHggPSBvdXRwdXQubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBqID0gMCwgbGVuID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICAgIHdoaWxlIChqIDwgbGVuKSBvdXRwdXRbaWR4KytdID0gdmFsdWVbaisrXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghc3RyaWN0KSB7XG4gICAgICAgIG91dHB1dFtpZHgrK10gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG4gIC8vIEJpbmQgYSBudW1iZXIgb2YgYW4gb2JqZWN0J3MgbWV0aG9kcyB0byB0aGF0IG9iamVjdC4gUmVtYWluaW5nIGFyZ3VtZW50c1xuICAvLyBhcmUgdGhlIG1ldGhvZCBuYW1lcyB0byBiZSBib3VuZC4gVXNlZnVsIGZvciBlbnN1cmluZyB0aGF0IGFsbCBjYWxsYmFja3NcbiAgLy8gZGVmaW5lZCBvbiBhbiBvYmplY3QgYmVsb25nIHRvIGl0LlxuICB2YXIgYmluZEFsbCA9IHJlc3RBcmd1bWVudHMoZnVuY3Rpb24ob2JqLCBrZXlzKSB7XG4gICAga2V5cyA9IGZsYXR0ZW4kMShrZXlzLCBmYWxzZSwgZmFsc2UpO1xuICAgIHZhciBpbmRleCA9IGtleXMubGVuZ3RoO1xuICAgIGlmIChpbmRleCA8IDEpIHRocm93IG5ldyBFcnJvcignYmluZEFsbCBtdXN0IGJlIHBhc3NlZCBmdW5jdGlvbiBuYW1lcycpO1xuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICB2YXIga2V5ID0ga2V5c1tpbmRleF07XG4gICAgICBvYmpba2V5XSA9IGJpbmQob2JqW2tleV0sIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH0pO1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIGZ1bmN0aW9uIG1lbW9pemUoZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW9pemUgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHZhciBjYWNoZSA9IG1lbW9pemUuY2FjaGU7XG4gICAgICB2YXIgYWRkcmVzcyA9ICcnICsgKGhhc2hlciA/IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5KTtcbiAgICAgIGlmICghaGFzJDEoY2FjaGUsIGFkZHJlc3MpKSBjYWNoZVthZGRyZXNzXSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBjYWNoZVthZGRyZXNzXTtcbiAgICB9O1xuICAgIG1lbW9pemUuY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gbWVtb2l6ZTtcbiAgfVxuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICB2YXIgZGVsYXkgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGFyZ3MpIHtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH0sIHdhaXQpO1xuICB9KTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgdmFyIGRlZmVyID0gcGFydGlhbChkZWxheSwgXyQxLCAxKTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIGZ1bmN0aW9uIHRocm90dGxlKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGltZW91dCwgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciBwcmV2aW91cyA9IDA7XG4gICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XG5cbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBub3coKTtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGlmICghdGltZW91dCkgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH07XG5cbiAgICB2YXIgdGhyb3R0bGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgX25vdyA9IG5vdygpO1xuICAgICAgaWYgKCFwcmV2aW91cyAmJiBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlKSBwcmV2aW91cyA9IF9ub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChfbm93IC0gcHJldmlvdXMpO1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgaWYgKHJlbWFpbmluZyA8PSAwIHx8IHJlbWFpbmluZyA+IHdhaXQpIHtcbiAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcHJldmlvdXMgPSBfbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICB0aHJvdHRsZWQuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICBwcmV2aW91cyA9IDA7XG4gICAgICB0aW1lb3V0ID0gY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgIH07XG5cbiAgICByZXR1cm4gdGhyb3R0bGVkO1xuICB9XG5cbiAgLy8gV2hlbiBhIHNlcXVlbmNlIG9mIGNhbGxzIG9mIHRoZSByZXR1cm5lZCBmdW5jdGlvbiBlbmRzLCB0aGUgYXJndW1lbnRcbiAgLy8gZnVuY3Rpb24gaXMgdHJpZ2dlcmVkLiBUaGUgZW5kIG9mIGEgc2VxdWVuY2UgaXMgZGVmaW5lZCBieSB0aGUgYHdhaXRgXG4gIC8vIHBhcmFtZXRlci4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0aGUgYXJndW1lbnQgZnVuY3Rpb24gd2lsbCBiZVxuICAvLyB0cmlnZ2VyZWQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc2VxdWVuY2UgaW5zdGVhZCBvZiBhdCB0aGUgZW5kLlxuICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICB2YXIgdGltZW91dCwgcHJldmlvdXMsIGFyZ3MsIHJlc3VsdCwgY29udGV4dDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBhc3NlZCA9IG5vdygpIC0gcHJldmlvdXM7XG4gICAgICBpZiAod2FpdCA+IHBhc3NlZCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIHBhc3NlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIC8vIFRoaXMgY2hlY2sgaXMgbmVlZGVkIGJlY2F1c2UgYGZ1bmNgIGNhbiByZWN1cnNpdmVseSBpbnZva2UgYGRlYm91bmNlZGAuXG4gICAgICAgIGlmICghdGltZW91dCkgYXJncyA9IGNvbnRleHQgPSBudWxsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgZGVib3VuY2VkID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihfYXJncykge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gX2FyZ3M7XG4gICAgICBwcmV2aW91cyA9IG5vdygpO1xuICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgICAgaWYgKGltbWVkaWF0ZSkgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG5cbiAgICBkZWJvdW5jZWQuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICB0aW1lb3V0ID0gYXJncyA9IGNvbnRleHQgPSBudWxsO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVib3VuY2VkO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3QgZnVuY3Rpb24gcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBzZWNvbmQsXG4gIC8vIGFsbG93aW5nIHlvdSB0byBhZGp1c3QgYXJndW1lbnRzLCBydW4gY29kZSBiZWZvcmUgYW5kIGFmdGVyLCBhbmRcbiAgLy8gY29uZGl0aW9uYWxseSBleGVjdXRlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi5cbiAgZnVuY3Rpb24gd3JhcChmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIHBhcnRpYWwod3JhcHBlciwgZnVuYyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgbmVnYXRlZCB2ZXJzaW9uIG9mIHRoZSBwYXNzZWQtaW4gcHJlZGljYXRlLlxuICBmdW5jdGlvbiBuZWdhdGUocHJlZGljYXRlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICFwcmVkaWNhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIGEgbGlzdCBvZiBmdW5jdGlvbnMsIGVhY2hcbiAgLy8gY29uc3VtaW5nIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgZnVuY3Rpb24gY29tcG9zZSgpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICB2YXIgc3RhcnQgPSBhcmdzLmxlbmd0aCAtIDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGkgPSBzdGFydDtcbiAgICAgIHZhciByZXN1bHQgPSBhcmdzW3N0YXJ0XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgd2hpbGUgKGktLSkgcmVzdWx0ID0gYXJnc1tpXS5jYWxsKHRoaXMsIHJlc3VsdCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb24gYW5kIGFmdGVyIHRoZSBOdGggY2FsbC5cbiAgZnVuY3Rpb24gYWZ0ZXIodGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIHVwIHRvIChidXQgbm90IGluY2x1ZGluZykgdGhlXG4gIC8vIE50aCBjYWxsLlxuICBmdW5jdGlvbiBiZWZvcmUodGltZXMsIGZ1bmMpIHtcbiAgICB2YXIgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA+IDApIHtcbiAgICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aW1lcyA8PSAxKSBmdW5jID0gbnVsbDtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH07XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgdmFyIG9uY2UgPSBwYXJ0aWFsKGJlZm9yZSwgMik7XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3Qga2V5IG9uIGFuIG9iamVjdCB0aGF0IHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIGZpbmRLZXkob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9IGtleXMob2JqKSwga2V5O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBfa2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAga2V5ID0gX2tleXNbaV07XG4gICAgICBpZiAocHJlZGljYXRlKG9ialtrZXldLCBrZXksIG9iaikpIHJldHVybiBrZXk7XG4gICAgfVxuICB9XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdG8gZ2VuZXJhdGUgYF8uZmluZEluZGV4YCBhbmQgYF8uZmluZExhc3RJbmRleGAuXG4gIGZ1bmN0aW9uIGNyZWF0ZVByZWRpY2F0ZUluZGV4RmluZGVyKGRpcikge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnJheSwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgICAgdmFyIGxlbmd0aCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgICB2YXIgaW5kZXggPSBkaXIgPiAwID8gMCA6IGxlbmd0aCAtIDE7XG4gICAgICBmb3IgKDsgaW5kZXggPj0gMCAmJiBpbmRleCA8IGxlbmd0aDsgaW5kZXggKz0gZGlyKSB7XG4gICAgICAgIGlmIChwcmVkaWNhdGUoYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSByZXR1cm4gaW5kZXg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGluZGV4IG9uIGFuIGFycmF5LWxpa2UgdGhhdCBwYXNzZXMgYSB0cnV0aCB0ZXN0LlxuICB2YXIgZmluZEluZGV4ID0gY3JlYXRlUHJlZGljYXRlSW5kZXhGaW5kZXIoMSk7XG5cbiAgLy8gUmV0dXJucyB0aGUgbGFzdCBpbmRleCBvbiBhbiBhcnJheS1saWtlIHRoYXQgcGFzc2VzIGEgdHJ1dGggdGVzdC5cbiAgdmFyIGZpbmRMYXN0SW5kZXggPSBjcmVhdGVQcmVkaWNhdGVJbmRleEZpbmRlcigtMSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIGZ1bmN0aW9uIHNvcnRlZEluZGV4KGFycmF5LCBvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0ZWUob2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSBNYXRoLmZsb29yKChsb3cgKyBoaWdoKSAvIDIpO1xuICAgICAgaWYgKGl0ZXJhdGVlKGFycmF5W21pZF0pIDwgdmFsdWUpIGxvdyA9IG1pZCArIDE7IGVsc2UgaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfVxuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIHRoZSBgXy5pbmRleE9mYCBhbmQgYF8ubGFzdEluZGV4T2ZgIGZ1bmN0aW9ucy5cbiAgZnVuY3Rpb24gY3JlYXRlSW5kZXhGaW5kZXIoZGlyLCBwcmVkaWNhdGVGaW5kLCBzb3J0ZWRJbmRleCkge1xuICAgIHJldHVybiBmdW5jdGlvbihhcnJheSwgaXRlbSwgaWR4KSB7XG4gICAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChhcnJheSk7XG4gICAgICBpZiAodHlwZW9mIGlkeCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoZGlyID4gMCkge1xuICAgICAgICAgIGkgPSBpZHggPj0gMCA/IGlkeCA6IE1hdGgubWF4KGlkeCArIGxlbmd0aCwgaSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGVuZ3RoID0gaWR4ID49IDAgPyBNYXRoLm1pbihpZHggKyAxLCBsZW5ndGgpIDogaWR4ICsgbGVuZ3RoICsgMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChzb3J0ZWRJbmRleCAmJiBpZHggJiYgbGVuZ3RoKSB7XG4gICAgICAgIGlkeCA9IHNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2lkeF0gPT09IGl0ZW0gPyBpZHggOiAtMTtcbiAgICAgIH1cbiAgICAgIGlmIChpdGVtICE9PSBpdGVtKSB7XG4gICAgICAgIGlkeCA9IHByZWRpY2F0ZUZpbmQoc2xpY2UuY2FsbChhcnJheSwgaSwgbGVuZ3RoKSwgaXNOYU4kMSk7XG4gICAgICAgIHJldHVybiBpZHggPj0gMCA/IGlkeCArIGkgOiAtMTtcbiAgICAgIH1cbiAgICAgIGZvciAoaWR4ID0gZGlyID4gMCA/IGkgOiBsZW5ndGggLSAxOyBpZHggPj0gMCAmJiBpZHggPCBsZW5ndGg7IGlkeCArPSBkaXIpIHtcbiAgICAgICAgaWYgKGFycmF5W2lkeF0gPT09IGl0ZW0pIHJldHVybiBpZHg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYW4gaXRlbSBpbiBhbiBhcnJheSxcbiAgLy8gb3IgLTEgaWYgdGhlIGl0ZW0gaXMgbm90IGluY2x1ZGVkIGluIHRoZSBhcnJheS5cbiAgLy8gSWYgdGhlIGFycmF5IGlzIGxhcmdlIGFuZCBhbHJlYWR5IGluIHNvcnQgb3JkZXIsIHBhc3MgYHRydWVgXG4gIC8vIGZvciAqKmlzU29ydGVkKiogdG8gdXNlIGJpbmFyeSBzZWFyY2guXG4gIHZhciBpbmRleE9mID0gY3JlYXRlSW5kZXhGaW5kZXIoMSwgZmluZEluZGV4LCBzb3J0ZWRJbmRleCk7XG5cbiAgLy8gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIGFuIGl0ZW0gaW4gYW4gYXJyYXksXG4gIC8vIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIHZhciBsYXN0SW5kZXhPZiA9IGNyZWF0ZUluZGV4RmluZGVyKC0xLCBmaW5kTGFzdEluZGV4KTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIGZpbmQob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIga2V5RmluZGVyID0gaXNBcnJheUxpa2Uob2JqKSA/IGZpbmRJbmRleCA6IGZpbmRLZXk7XG4gICAgdmFyIGtleSA9IGtleUZpbmRlcihvYmosIHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgaWYgKGtleSAhPT0gdm9pZCAwICYmIGtleSAhPT0gLTEpIHJldHVybiBvYmpba2V5XTtcbiAgfVxuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYF8uZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0XG4gIC8vIG9iamVjdCBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiBmaW5kV2hlcmUob2JqLCBhdHRycykge1xuICAgIHJldHVybiBmaW5kKG9iaiwgbWF0Y2hlcihhdHRycykpO1xuICB9XG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lIGZvciBjb2xsZWN0aW9uIGZ1bmN0aW9ucywgYW4gYGVhY2hgXG4gIC8vIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIHJhdyBvYmplY3RzIGluIGFkZGl0aW9uIHRvIGFycmF5LWxpa2VzLiBUcmVhdHMgYWxsXG4gIC8vIHNwYXJzZSBhcnJheS1saWtlcyBhcyBpZiB0aGV5IHdlcmUgZGVuc2UuXG4gIGZ1bmN0aW9uIGVhY2gob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGl0ZXJhdGVlID0gb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGksIGxlbmd0aDtcbiAgICBpZiAoaXNBcnJheUxpa2Uob2JqKSkge1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdGVlKG9ialtpXSwgaSwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIF9rZXlzID0ga2V5cyhvYmopO1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0gX2tleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW19rZXlzW2ldXSwgX2tleXNbaV0sIG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdGVlIHRvIGVhY2ggZWxlbWVudC5cbiAgZnVuY3Rpb24gbWFwKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgX2tleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBrZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChfa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIGN1cnJlbnRLZXkgPSBfa2V5cyA/IF9rZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgcmVzdWx0c1tpbmRleF0gPSBpdGVyYXRlZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgLy8gSW50ZXJuYWwgaGVscGVyIHRvIGNyZWF0ZSBhIHJlZHVjaW5nIGZ1bmN0aW9uLCBpdGVyYXRpbmcgbGVmdCBvciByaWdodC5cbiAgZnVuY3Rpb24gY3JlYXRlUmVkdWNlKGRpcikge1xuICAgIC8vIFdyYXAgY29kZSB0aGF0IHJlYXNzaWducyBhcmd1bWVudCB2YXJpYWJsZXMgaW4gYSBzZXBhcmF0ZSBmdW5jdGlvbiB0aGFuXG4gICAgLy8gdGhlIG9uZSB0aGF0IGFjY2Vzc2VzIGBhcmd1bWVudHMubGVuZ3RoYCB0byBhdm9pZCBhIHBlcmYgaGl0LiAoIzE5OTEpXG4gICAgdmFyIHJlZHVjZXIgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBpbml0aWFsKSB7XG4gICAgICB2YXIgX2tleXMgPSAhaXNBcnJheUxpa2Uob2JqKSAmJiBrZXlzKG9iaiksXG4gICAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICAgIGluZGV4ID0gZGlyID4gMCA/IDAgOiBsZW5ndGggLSAxO1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSBvYmpbX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleF07XG4gICAgICAgIGluZGV4ICs9IGRpcjtcbiAgICAgIH1cbiAgICAgIGZvciAoOyBpbmRleCA+PSAwICYmIGluZGV4IDwgbGVuZ3RoOyBpbmRleCArPSBkaXIpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRLZXkgPSBfa2V5cyA/IF9rZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgICBtZW1vID0gaXRlcmF0ZWUobWVtbywgb2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPj0gMztcbiAgICAgIHJldHVybiByZWR1Y2VyKG9iaiwgb3B0aW1pemVDYihpdGVyYXRlZSwgY29udGV4dCwgNCksIG1lbW8sIGluaXRpYWwpO1xuICAgIH07XG4gIH1cblxuICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gIC8vIG9yIGBmb2xkbGAuXG4gIHZhciByZWR1Y2UgPSBjcmVhdGVSZWR1Y2UoMSk7XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIHZhciByZWR1Y2VSaWdodCA9IGNyZWF0ZVJlZHVjZSgtMSk7XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgZnVuY3Rpb24gZmlsdGVyKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUodmFsdWUsIGluZGV4LCBsaXN0KSkgcmVzdWx0cy5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfVxuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIGZ1bmN0aW9uIHJlamVjdChvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHJldHVybiBmaWx0ZXIob2JqLCBuZWdhdGUoY2IocHJlZGljYXRlKSksIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgYWxsIG9mIHRoZSBlbGVtZW50cyBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgZnVuY3Rpb24gZXZlcnkob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9ICFpc0FycmF5TGlrZShvYmopICYmIGtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBjdXJyZW50S2V5ID0gX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmICghcHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIERldGVybWluZSBpZiBhdCBsZWFzdCBvbmUgZWxlbWVudCBpbiB0aGUgb2JqZWN0IHBhc3NlcyBhIHRydXRoIHRlc3QuXG4gIGZ1bmN0aW9uIHNvbWUob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBjYihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBfa2V5cyA9ICFpc0FycmF5TGlrZShvYmopICYmIGtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKF9rZXlzIHx8IG9iaikubGVuZ3RoO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBjdXJyZW50S2V5ID0gX2tleXMgPyBfa2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmIChwcmVkaWNhdGUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiBpdGVtICh1c2luZyBgPT09YCkuXG4gIGZ1bmN0aW9uIGNvbnRhaW5zKG9iaiwgaXRlbSwgZnJvbUluZGV4LCBndWFyZCkge1xuICAgIGlmICghaXNBcnJheUxpa2Uob2JqKSkgb2JqID0gdmFsdWVzKG9iaik7XG4gICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggIT0gJ251bWJlcicgfHwgZ3VhcmQpIGZyb21JbmRleCA9IDA7XG4gICAgcmV0dXJuIGluZGV4T2Yob2JqLCBpdGVtLCBmcm9tSW5kZXgpID49IDA7XG4gIH1cblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgdmFyIGludm9rZSA9IHJlc3RBcmd1bWVudHMoZnVuY3Rpb24ob2JqLCBwYXRoLCBhcmdzKSB7XG4gICAgdmFyIGNvbnRleHRQYXRoLCBmdW5jO1xuICAgIGlmIChpc0Z1bmN0aW9uJDEocGF0aCkpIHtcbiAgICAgIGZ1bmMgPSBwYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXRoID0gdG9QYXRoKHBhdGgpO1xuICAgICAgY29udGV4dFBhdGggPSBwYXRoLnNsaWNlKDAsIC0xKTtcbiAgICAgIHBhdGggPSBwYXRoW3BhdGgubGVuZ3RoIC0gMV07XG4gICAgfVxuICAgIHJldHVybiBtYXAob2JqLCBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgICB2YXIgbWV0aG9kID0gZnVuYztcbiAgICAgIGlmICghbWV0aG9kKSB7XG4gICAgICAgIGlmIChjb250ZXh0UGF0aCAmJiBjb250ZXh0UGF0aC5sZW5ndGgpIHtcbiAgICAgICAgICBjb250ZXh0ID0gZGVlcEdldChjb250ZXh0LCBjb250ZXh0UGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRleHQgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICAgICAgbWV0aG9kID0gY29udGV4dFtwYXRoXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXRob2QgPT0gbnVsbCA/IG1ldGhvZCA6IG1ldGhvZC5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgXy5tYXBgOiBmZXRjaGluZyBhIHByb3BlcnR5LlxuICBmdW5jdGlvbiBwbHVjayhvYmosIGtleSkge1xuICAgIHJldHVybiBtYXAob2JqLCBwcm9wZXJ0eShrZXkpKTtcbiAgfVxuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYF8uZmlsdGVyYDogc2VsZWN0aW5nIG9ubHlcbiAgLy8gb2JqZWN0cyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBmdW5jdGlvbiB3aGVyZShvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIGZpbHRlcihvYmosIG1hdGNoZXIoYXR0cnMpKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgZnVuY3Rpb24gbWF4KG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCB8fCB0eXBlb2YgaXRlcmF0ZWUgPT0gJ251bWJlcicgJiYgdHlwZW9mIG9ialswXSAhPSAnb2JqZWN0JyAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gaXNBcnJheUxpa2Uob2JqKSA/IG9iaiA6IHZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlICE9IG51bGwgJiYgdmFsdWUgPiByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGVhY2gob2JqLCBmdW5jdGlvbih2LCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHYsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSAtSW5maW5pdHkgJiYgcmVzdWx0ID09PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICByZXN1bHQgPSB2O1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgZnVuY3Rpb24gbWluKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IEluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgfHwgdHlwZW9mIGl0ZXJhdGVlID09ICdudW1iZXInICYmIHR5cGVvZiBvYmpbMF0gIT0gJ29iamVjdCcgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgIG9iaiA9IGlzQXJyYXlMaWtlKG9iaikgPyBvYmogOiB2YWx1ZXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgIGlmICh2YWx1ZSAhPSBudWxsICYmIHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBjYihpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBlYWNoKG9iaiwgZnVuY3Rpb24odiwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2LCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA8IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gSW5maW5pdHkgJiYgcmVzdWx0ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHY7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gU2FtcGxlICoqbioqIHJhbmRvbSB2YWx1ZXMgZnJvbSBhIGNvbGxlY3Rpb24gdXNpbmcgdGhlIG1vZGVybiB2ZXJzaW9uIG9mIHRoZVxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlcuKAk1lhdGVzX3NodWZmbGUpLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIGZ1bmN0aW9uIHNhbXBsZShvYmosIG4sIGd1YXJkKSB7XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xuICAgICAgaWYgKCFpc0FycmF5TGlrZShvYmopKSBvYmogPSB2YWx1ZXMob2JqKTtcbiAgICAgIHJldHVybiBvYmpbcmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHZhciBzYW1wbGUgPSBpc0FycmF5TGlrZShvYmopID8gY2xvbmUob2JqKSA6IHZhbHVlcyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBnZXRMZW5ndGgoc2FtcGxlKTtcbiAgICBuID0gTWF0aC5tYXgoTWF0aC5taW4obiwgbGVuZ3RoKSwgMCk7XG4gICAgdmFyIGxhc3QgPSBsZW5ndGggLSAxO1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBuOyBpbmRleCsrKSB7XG4gICAgICB2YXIgcmFuZCA9IHJhbmRvbShpbmRleCwgbGFzdCk7XG4gICAgICB2YXIgdGVtcCA9IHNhbXBsZVtpbmRleF07XG4gICAgICBzYW1wbGVbaW5kZXhdID0gc2FtcGxlW3JhbmRdO1xuICAgICAgc2FtcGxlW3JhbmRdID0gdGVtcDtcbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZS5zbGljZSgwLCBuKTtcbiAgfVxuXG4gIC8vIFNodWZmbGUgYSBjb2xsZWN0aW9uLlxuICBmdW5jdGlvbiBzaHVmZmxlKG9iaikge1xuICAgIHJldHVybiBzYW1wbGUob2JqLCBJbmZpbml0eSk7XG4gIH1cblxuICAvLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0ZWUuXG4gIGZ1bmN0aW9uIHNvcnRCeShvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gcGx1Y2sobWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGtleSwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgrKyxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdGVlKHZhbHVlLCBrZXksIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH1cblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIGZ1bmN0aW9uIGdyb3VwKGJlaGF2aW9yLCBwYXJ0aXRpb24pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHBhcnRpdGlvbiA/IFtbXSwgW11dIDoge307XG4gICAgICBpdGVyYXRlZSA9IGNiKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGtleSA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCB2YWx1ZSwga2V5KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9XG5cbiAgLy8gR3JvdXBzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24uIFBhc3MgZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZVxuICAvLyB0byBncm91cCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNyaXRlcmlvbi5cbiAgdmFyIGdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoaGFzJDEocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XS5wdXNoKHZhbHVlKTsgZWxzZSByZXN1bHRba2V5XSA9IFt2YWx1ZV07XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgXy5ncm91cEJ5YCwgYnV0IGZvclxuICAvLyB3aGVuIHlvdSBrbm93IHRoYXQgeW91ciBpbmRleCB2YWx1ZXMgd2lsbCBiZSB1bmlxdWUuXG4gIHZhciBpbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIHZhciBjb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgaWYgKGhhcyQxKHJlc3VsdCwga2V5KSkgcmVzdWx0W2tleV0rKzsgZWxzZSByZXN1bHRba2V5XSA9IDE7XG4gIH0pO1xuXG4gIC8vIFNwbGl0IGEgY29sbGVjdGlvbiBpbnRvIHR3byBhcnJheXM6IG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgcGFzcyB0aGUgZ2l2ZW5cbiAgLy8gdHJ1dGggdGVzdCwgYW5kIG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgZG8gbm90IHBhc3MgdGhlIHRydXRoIHRlc3QuXG4gIHZhciBwYXJ0aXRpb24gPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBwYXNzKSB7XG4gICAgcmVzdWx0W3Bhc3MgPyAwIDogMV0ucHVzaCh2YWx1ZSk7XG4gIH0sIHRydWUpO1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIHZhciByZVN0clN5bWJvbCA9IC9bXlxcdWQ4MDAtXFx1ZGZmZl18W1xcdWQ4MDAtXFx1ZGJmZl1bXFx1ZGMwMC1cXHVkZmZmXXxbXFx1ZDgwMC1cXHVkZmZmXS9nO1xuICBmdW5jdGlvbiB0b0FycmF5KG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKGlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAoaXNTdHJpbmcob2JqKSkge1xuICAgICAgLy8gS2VlcCBzdXJyb2dhdGUgcGFpciBjaGFyYWN0ZXJzIHRvZ2V0aGVyLlxuICAgICAgcmV0dXJuIG9iai5tYXRjaChyZVN0clN5bWJvbCk7XG4gICAgfVxuICAgIGlmIChpc0FycmF5TGlrZShvYmopKSByZXR1cm4gbWFwKG9iaiwgaWRlbnRpdHkpO1xuICAgIHJldHVybiB2YWx1ZXMob2JqKTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGEgY29sbGVjdGlvbi5cbiAgZnVuY3Rpb24gc2l6ZShvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiBpc0FycmF5TGlrZShvYmopID8gb2JqLmxlbmd0aCA6IGtleXMob2JqKS5sZW5ndGg7XG4gIH1cblxuICAvLyBJbnRlcm5hbCBgXy5waWNrYCBoZWxwZXIgZnVuY3Rpb24gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgYGtleWAgaXMgYW4gZW51bWVyYWJsZVxuICAvLyBwcm9wZXJ0eSBuYW1lIG9mIGBvYmpgLlxuICBmdW5jdGlvbiBrZXlJbk9iaih2YWx1ZSwga2V5LCBvYmopIHtcbiAgICByZXR1cm4ga2V5IGluIG9iajtcbiAgfVxuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCBvbmx5IGNvbnRhaW5pbmcgdGhlIGFsbG93ZWQgcHJvcGVydGllcy5cbiAgdmFyIHBpY2sgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKG9iaiwga2V5cykge1xuICAgIHZhciByZXN1bHQgPSB7fSwgaXRlcmF0ZWUgPSBrZXlzWzBdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAoaXNGdW5jdGlvbiQxKGl0ZXJhdGVlKSkge1xuICAgICAgaWYgKGtleXMubGVuZ3RoID4gMSkgaXRlcmF0ZWUgPSBvcHRpbWl6ZUNiKGl0ZXJhdGVlLCBrZXlzWzFdKTtcbiAgICAgIGtleXMgPSBhbGxLZXlzKG9iaik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZXJhdGVlID0ga2V5SW5PYmo7XG4gICAgICBrZXlzID0gZmxhdHRlbiQxKGtleXMsIGZhbHNlLCBmYWxzZSk7XG4gICAgICBvYmogPSBPYmplY3Qob2JqKTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgdmFyIHZhbHVlID0gb2JqW2tleV07XG4gICAgICBpZiAoaXRlcmF0ZWUodmFsdWUsIGtleSwgb2JqKSkgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGRpc2FsbG93ZWQgcHJvcGVydGllcy5cbiAgdmFyIG9taXQgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKG9iaiwga2V5cykge1xuICAgIHZhciBpdGVyYXRlZSA9IGtleXNbMF0sIGNvbnRleHQ7XG4gICAgaWYgKGlzRnVuY3Rpb24kMShpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gbmVnYXRlKGl0ZXJhdGVlKTtcbiAgICAgIGlmIChrZXlzLmxlbmd0aCA+IDEpIGNvbnRleHQgPSBrZXlzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXlzID0gbWFwKGZsYXR0ZW4kMShrZXlzLCBmYWxzZSwgZmFsc2UpLCBTdHJpbmcpO1xuICAgICAgaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJldHVybiAhY29udGFpbnMoa2V5cywga2V5KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBwaWNrKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpO1xuICB9KTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBsYXN0IGVudHJ5IG9mIHRoZSBhcnJheS4gRXNwZWNpYWxseSB1c2VmdWwgb25cbiAgLy8gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gYWxsIHRoZSB2YWx1ZXMgaW5cbiAgLy8gdGhlIGFycmF5LCBleGNsdWRpbmcgdGhlIGxhc3QgTi5cbiAgZnVuY3Rpb24gaW5pdGlhbChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gKG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKSkpO1xuICB9XG5cbiAgLy8gR2V0IHRoZSBmaXJzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBmaXJzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBmdW5jdGlvbiBmaXJzdChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCB8fCBhcnJheS5sZW5ndGggPCAxKSByZXR1cm4gbiA9PSBudWxsIHx8IGd1YXJkID8gdm9pZCAwIDogW107XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkgcmV0dXJuIGFycmF5WzBdO1xuICAgIHJldHVybiBpbml0aWFsKGFycmF5LCBhcnJheS5sZW5ndGggLSBuKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBgYXJyYXlgLiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYGFyZ3VtZW50c2Agb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZVxuICAvLyBgYXJyYXlgLlxuICBmdW5jdGlvbiByZXN0KGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH1cblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuXG4gIGZ1bmN0aW9uIGxhc3QoYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwgfHwgYXJyYXkubGVuZ3RoIDwgMSkgcmV0dXJuIG4gPT0gbnVsbCB8fCBndWFyZCA/IHZvaWQgMCA6IFtdO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gcmVzdChhcnJheSwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gbikpO1xuICB9XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBmdW5jdGlvbiBjb21wYWN0KGFycmF5KSB7XG4gICAgcmV0dXJuIGZpbHRlcihhcnJheSwgQm9vbGVhbik7XG4gIH1cblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IgdXAgdG8gYGRlcHRoYC5cbiAgLy8gUGFzc2luZyBgdHJ1ZWAgb3IgYGZhbHNlYCBhcyBgZGVwdGhgIG1lYW5zIGAxYCBvciBgSW5maW5pdHlgLCByZXNwZWN0aXZlbHkuXG4gIGZ1bmN0aW9uIGZsYXR0ZW4oYXJyYXksIGRlcHRoKSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4kMShhcnJheSwgZGVwdGgsIGZhbHNlKTtcbiAgfVxuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgdmFyIGRpZmZlcmVuY2UgPSByZXN0QXJndW1lbnRzKGZ1bmN0aW9uKGFycmF5LCByZXN0KSB7XG4gICAgcmVzdCA9IGZsYXR0ZW4kMShyZXN0LCB0cnVlLCB0cnVlKTtcbiAgICByZXR1cm4gZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICByZXR1cm4gIWNvbnRhaW5zKHJlc3QsIHZhbHVlKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIHZhciB3aXRob3V0ID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihhcnJheSwgb3RoZXJBcnJheXMpIHtcbiAgICByZXR1cm4gZGlmZmVyZW5jZShhcnJheSwgb3RoZXJBcnJheXMpO1xuICB9KTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIFRoZSBmYXN0ZXIgYWxnb3JpdGhtIHdpbGwgbm90IHdvcmsgd2l0aCBhbiBpdGVyYXRlZSBpZiB0aGUgaXRlcmF0ZWVcbiAgLy8gaXMgbm90IGEgb25lLXRvLW9uZSBmdW5jdGlvbiwgc28gcHJvdmlkaW5nIGFuIGl0ZXJhdGVlIHdpbGwgZGlzYWJsZVxuICAvLyB0aGUgZmFzdGVyIGFsZ29yaXRobS5cbiAgZnVuY3Rpb24gdW5pcShhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpc0Jvb2xlYW4oaXNTb3J0ZWQpKSB7XG4gICAgICBjb250ZXh0ID0gaXRlcmF0ZWU7XG4gICAgICBpdGVyYXRlZSA9IGlzU29ydGVkO1xuICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGl0ZXJhdGVlICE9IG51bGwpIGl0ZXJhdGVlID0gY2IoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBnZXRMZW5ndGgoYXJyYXkpOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldLFxuICAgICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUgPyBpdGVyYXRlZSh2YWx1ZSwgaSwgYXJyYXkpIDogdmFsdWU7XG4gICAgICBpZiAoaXNTb3J0ZWQgJiYgIWl0ZXJhdGVlKSB7XG4gICAgICAgIGlmICghaSB8fCBzZWVuICE9PSBjb21wdXRlZCkgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICBzZWVuID0gY29tcHV0ZWQ7XG4gICAgICB9IGVsc2UgaWYgKGl0ZXJhdGVlKSB7XG4gICAgICAgIGlmICghY29udGFpbnMoc2VlbiwgY29tcHV0ZWQpKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWNvbnRhaW5zKHJlc3VsdCwgdmFsdWUpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgdmFyIHVuaW9uID0gcmVzdEFyZ3VtZW50cyhmdW5jdGlvbihhcnJheXMpIHtcbiAgICByZXR1cm4gdW5pcShmbGF0dGVuJDEoYXJyYXlzLCB0cnVlLCB0cnVlKSk7XG4gIH0pO1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyBldmVyeSBpdGVtIHNoYXJlZCBiZXR3ZWVuIGFsbCB0aGVcbiAgLy8gcGFzc2VkLWluIGFycmF5cy5cbiAgZnVuY3Rpb24gaW50ZXJzZWN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHZhciBhcmdzTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gZ2V0TGVuZ3RoKGFycmF5KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgICAgaWYgKGNvbnRhaW5zKHJlc3VsdCwgaXRlbSkpIGNvbnRpbnVlO1xuICAgICAgdmFyIGo7XG4gICAgICBmb3IgKGogPSAxOyBqIDwgYXJnc0xlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmICghY29udGFpbnMoYXJndW1lbnRzW2pdLCBpdGVtKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaiA9PT0gYXJnc0xlbmd0aCkgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBDb21wbGVtZW50IG9mIHppcC4gVW56aXAgYWNjZXB0cyBhbiBhcnJheSBvZiBhcnJheXMgYW5kIGdyb3Vwc1xuICAvLyBlYWNoIGFycmF5J3MgZWxlbWVudHMgb24gc2hhcmVkIGluZGljZXMuXG4gIGZ1bmN0aW9uIHVuemlwKGFycmF5KSB7XG4gICAgdmFyIGxlbmd0aCA9IGFycmF5ICYmIG1heChhcnJheSwgZ2V0TGVuZ3RoKS5sZW5ndGggfHwgMDtcbiAgICB2YXIgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBwbHVjayhhcnJheSwgaW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgdmFyIHppcCA9IHJlc3RBcmd1bWVudHModW56aXApO1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy4gUGFzc2luZyBieSBwYWlycyBpcyB0aGUgcmV2ZXJzZSBvZiBgXy5wYWlyc2AuXG4gIGZ1bmN0aW9uIG9iamVjdChsaXN0LCB2YWx1ZXMpIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGdldExlbmd0aChsaXN0KTsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBHZW5lcmF0ZSBhbiBpbnRlZ2VyIEFycmF5IGNvbnRhaW5pbmcgYW4gYXJpdGhtZXRpYyBwcm9ncmVzc2lvbi4gQSBwb3J0IG9mXG4gIC8vIHRoZSBuYXRpdmUgUHl0aG9uIGByYW5nZSgpYCBmdW5jdGlvbi4gU2VlXG4gIC8vIFt0aGUgUHl0aG9uIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UpLlxuICBmdW5jdGlvbiByYW5nZShzdGFydCwgc3RvcCwgc3RlcCkge1xuICAgIGlmIChzdG9wID09IG51bGwpIHtcbiAgICAgIHN0b3AgPSBzdGFydCB8fCAwO1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH1cbiAgICBpZiAoIXN0ZXApIHtcbiAgICAgIHN0ZXAgPSBzdG9wIDwgc3RhcnQgPyAtMSA6IDE7XG4gICAgfVxuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgcmFuZ2UgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgbGVuZ3RoOyBpZHgrKywgc3RhcnQgKz0gc3RlcCkge1xuICAgICAgcmFuZ2VbaWR4XSA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfVxuXG4gIC8vIENodW5rIGEgc2luZ2xlIGFycmF5IGludG8gbXVsdGlwbGUgYXJyYXlzLCBlYWNoIGNvbnRhaW5pbmcgYGNvdW50YCBvciBmZXdlclxuICAvLyBpdGVtcy5cbiAgZnVuY3Rpb24gY2h1bmsoYXJyYXksIGNvdW50KSB7XG4gICAgaWYgKGNvdW50ID09IG51bGwgfHwgY291bnQgPCAxKSByZXR1cm4gW107XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChpIDwgbGVuZ3RoKSB7XG4gICAgICByZXN1bHQucHVzaChzbGljZS5jYWxsKGFycmF5LCBpLCBpICs9IGNvdW50KSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIGZ1bmN0aW9uIGNoYWluUmVzdWx0KGluc3RhbmNlLCBvYmopIHtcbiAgICByZXR1cm4gaW5zdGFuY2UuX2NoYWluID8gXyQxKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfVxuXG4gIC8vIEFkZCB5b3VyIG93biBjdXN0b20gZnVuY3Rpb25zIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgZnVuY3Rpb24gbWl4aW4ob2JqKSB7XG4gICAgZWFjaChmdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfJDFbbmFtZV0gPSBvYmpbbmFtZV07XG4gICAgICBfJDEucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiBjaGFpblJlc3VsdCh0aGlzLCBmdW5jLmFwcGx5KF8kMSwgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgICByZXR1cm4gXyQxO1xuICB9XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIGBBcnJheWAgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfJDEucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgb2JqID0gdGhpcy5fd3JhcHBlZDtcbiAgICAgIGlmIChvYmogIT0gbnVsbCkge1xuICAgICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgICBpZiAoKG5hbWUgPT09ICdzaGlmdCcgfHwgbmFtZSA9PT0gJ3NwbGljZScpICYmIG9iai5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgb2JqWzBdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hhaW5SZXN1bHQodGhpcywgb2JqKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBBZGQgYWxsIGFjY2Vzc29yIGBBcnJheWAgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8kMS5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgaWYgKG9iaiAhPSBudWxsKSBvYmogPSBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGNoYWluUmVzdWx0KHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gTmFtZWQgRXhwb3J0c1xuXG4gIHZhciBhbGxFeHBvcnRzID0ge1xuICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICBWRVJTSU9OOiBWRVJTSU9OLFxuICAgIHJlc3RBcmd1bWVudHM6IHJlc3RBcmd1bWVudHMsXG4gICAgaXNPYmplY3Q6IGlzT2JqZWN0LFxuICAgIGlzTnVsbDogaXNOdWxsLFxuICAgIGlzVW5kZWZpbmVkOiBpc1VuZGVmaW5lZCxcbiAgICBpc0Jvb2xlYW46IGlzQm9vbGVhbixcbiAgICBpc0VsZW1lbnQ6IGlzRWxlbWVudCxcbiAgICBpc1N0cmluZzogaXNTdHJpbmcsXG4gICAgaXNOdW1iZXI6IGlzTnVtYmVyLFxuICAgIGlzRGF0ZTogaXNEYXRlLFxuICAgIGlzUmVnRXhwOiBpc1JlZ0V4cCxcbiAgICBpc0Vycm9yOiBpc0Vycm9yLFxuICAgIGlzU3ltYm9sOiBpc1N5bWJvbCxcbiAgICBpc0FycmF5QnVmZmVyOiBpc0FycmF5QnVmZmVyLFxuICAgIGlzRGF0YVZpZXc6IGlzRGF0YVZpZXckMSxcbiAgICBpc0FycmF5OiBpc0FycmF5LFxuICAgIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24kMSxcbiAgICBpc0FyZ3VtZW50czogaXNBcmd1bWVudHMkMSxcbiAgICBpc0Zpbml0ZTogaXNGaW5pdGUkMSxcbiAgICBpc05hTjogaXNOYU4kMSxcbiAgICBpc1R5cGVkQXJyYXk6IGlzVHlwZWRBcnJheSQxLFxuICAgIGlzRW1wdHk6IGlzRW1wdHksXG4gICAgaXNNYXRjaDogaXNNYXRjaCxcbiAgICBpc0VxdWFsOiBpc0VxdWFsLFxuICAgIGlzTWFwOiBpc01hcCxcbiAgICBpc1dlYWtNYXA6IGlzV2Vha01hcCxcbiAgICBpc1NldDogaXNTZXQsXG4gICAgaXNXZWFrU2V0OiBpc1dlYWtTZXQsXG4gICAga2V5czoga2V5cyxcbiAgICBhbGxLZXlzOiBhbGxLZXlzLFxuICAgIHZhbHVlczogdmFsdWVzLFxuICAgIHBhaXJzOiBwYWlycyxcbiAgICBpbnZlcnQ6IGludmVydCxcbiAgICBmdW5jdGlvbnM6IGZ1bmN0aW9ucyxcbiAgICBtZXRob2RzOiBmdW5jdGlvbnMsXG4gICAgZXh0ZW5kOiBleHRlbmQsXG4gICAgZXh0ZW5kT3duOiBleHRlbmRPd24sXG4gICAgYXNzaWduOiBleHRlbmRPd24sXG4gICAgZGVmYXVsdHM6IGRlZmF1bHRzLFxuICAgIGNyZWF0ZTogY3JlYXRlLFxuICAgIGNsb25lOiBjbG9uZSxcbiAgICB0YXA6IHRhcCxcbiAgICBnZXQ6IGdldCxcbiAgICBoYXM6IGhhcyxcbiAgICBtYXBPYmplY3Q6IG1hcE9iamVjdCxcbiAgICBpZGVudGl0eTogaWRlbnRpdHksXG4gICAgY29uc3RhbnQ6IGNvbnN0YW50LFxuICAgIG5vb3A6IG5vb3AsXG4gICAgdG9QYXRoOiB0b1BhdGgkMSxcbiAgICBwcm9wZXJ0eTogcHJvcGVydHksXG4gICAgcHJvcGVydHlPZjogcHJvcGVydHlPZixcbiAgICBtYXRjaGVyOiBtYXRjaGVyLFxuICAgIG1hdGNoZXM6IG1hdGNoZXIsXG4gICAgdGltZXM6IHRpbWVzLFxuICAgIHJhbmRvbTogcmFuZG9tLFxuICAgIG5vdzogbm93LFxuICAgIGVzY2FwZTogX2VzY2FwZSxcbiAgICB1bmVzY2FwZTogX3VuZXNjYXBlLFxuICAgIHRlbXBsYXRlU2V0dGluZ3M6IHRlbXBsYXRlU2V0dGluZ3MsXG4gICAgdGVtcGxhdGU6IHRlbXBsYXRlLFxuICAgIHJlc3VsdDogcmVzdWx0LFxuICAgIHVuaXF1ZUlkOiB1bmlxdWVJZCxcbiAgICBjaGFpbjogY2hhaW4sXG4gICAgaXRlcmF0ZWU6IGl0ZXJhdGVlLFxuICAgIHBhcnRpYWw6IHBhcnRpYWwsXG4gICAgYmluZDogYmluZCxcbiAgICBiaW5kQWxsOiBiaW5kQWxsLFxuICAgIG1lbW9pemU6IG1lbW9pemUsXG4gICAgZGVsYXk6IGRlbGF5LFxuICAgIGRlZmVyOiBkZWZlcixcbiAgICB0aHJvdHRsZTogdGhyb3R0bGUsXG4gICAgZGVib3VuY2U6IGRlYm91bmNlLFxuICAgIHdyYXA6IHdyYXAsXG4gICAgbmVnYXRlOiBuZWdhdGUsXG4gICAgY29tcG9zZTogY29tcG9zZSxcbiAgICBhZnRlcjogYWZ0ZXIsXG4gICAgYmVmb3JlOiBiZWZvcmUsXG4gICAgb25jZTogb25jZSxcbiAgICBmaW5kS2V5OiBmaW5kS2V5LFxuICAgIGZpbmRJbmRleDogZmluZEluZGV4LFxuICAgIGZpbmRMYXN0SW5kZXg6IGZpbmRMYXN0SW5kZXgsXG4gICAgc29ydGVkSW5kZXg6IHNvcnRlZEluZGV4LFxuICAgIGluZGV4T2Y6IGluZGV4T2YsXG4gICAgbGFzdEluZGV4T2Y6IGxhc3RJbmRleE9mLFxuICAgIGZpbmQ6IGZpbmQsXG4gICAgZGV0ZWN0OiBmaW5kLFxuICAgIGZpbmRXaGVyZTogZmluZFdoZXJlLFxuICAgIGVhY2g6IGVhY2gsXG4gICAgZm9yRWFjaDogZWFjaCxcbiAgICBtYXA6IG1hcCxcbiAgICBjb2xsZWN0OiBtYXAsXG4gICAgcmVkdWNlOiByZWR1Y2UsXG4gICAgZm9sZGw6IHJlZHVjZSxcbiAgICBpbmplY3Q6IHJlZHVjZSxcbiAgICByZWR1Y2VSaWdodDogcmVkdWNlUmlnaHQsXG4gICAgZm9sZHI6IHJlZHVjZVJpZ2h0LFxuICAgIGZpbHRlcjogZmlsdGVyLFxuICAgIHNlbGVjdDogZmlsdGVyLFxuICAgIHJlamVjdDogcmVqZWN0LFxuICAgIGV2ZXJ5OiBldmVyeSxcbiAgICBhbGw6IGV2ZXJ5LFxuICAgIHNvbWU6IHNvbWUsXG4gICAgYW55OiBzb21lLFxuICAgIGNvbnRhaW5zOiBjb250YWlucyxcbiAgICBpbmNsdWRlczogY29udGFpbnMsXG4gICAgaW5jbHVkZTogY29udGFpbnMsXG4gICAgaW52b2tlOiBpbnZva2UsXG4gICAgcGx1Y2s6IHBsdWNrLFxuICAgIHdoZXJlOiB3aGVyZSxcbiAgICBtYXg6IG1heCxcbiAgICBtaW46IG1pbixcbiAgICBzaHVmZmxlOiBzaHVmZmxlLFxuICAgIHNhbXBsZTogc2FtcGxlLFxuICAgIHNvcnRCeTogc29ydEJ5LFxuICAgIGdyb3VwQnk6IGdyb3VwQnksXG4gICAgaW5kZXhCeTogaW5kZXhCeSxcbiAgICBjb3VudEJ5OiBjb3VudEJ5LFxuICAgIHBhcnRpdGlvbjogcGFydGl0aW9uLFxuICAgIHRvQXJyYXk6IHRvQXJyYXksXG4gICAgc2l6ZTogc2l6ZSxcbiAgICBwaWNrOiBwaWNrLFxuICAgIG9taXQ6IG9taXQsXG4gICAgZmlyc3Q6IGZpcnN0LFxuICAgIGhlYWQ6IGZpcnN0LFxuICAgIHRha2U6IGZpcnN0LFxuICAgIGluaXRpYWw6IGluaXRpYWwsXG4gICAgbGFzdDogbGFzdCxcbiAgICByZXN0OiByZXN0LFxuICAgIHRhaWw6IHJlc3QsXG4gICAgZHJvcDogcmVzdCxcbiAgICBjb21wYWN0OiBjb21wYWN0LFxuICAgIGZsYXR0ZW46IGZsYXR0ZW4sXG4gICAgd2l0aG91dDogd2l0aG91dCxcbiAgICB1bmlxOiB1bmlxLFxuICAgIHVuaXF1ZTogdW5pcSxcbiAgICB1bmlvbjogdW5pb24sXG4gICAgaW50ZXJzZWN0aW9uOiBpbnRlcnNlY3Rpb24sXG4gICAgZGlmZmVyZW5jZTogZGlmZmVyZW5jZSxcbiAgICB1bnppcDogdW56aXAsXG4gICAgdHJhbnNwb3NlOiB1bnppcCxcbiAgICB6aXA6IHppcCxcbiAgICBvYmplY3Q6IG9iamVjdCxcbiAgICByYW5nZTogcmFuZ2UsXG4gICAgY2h1bms6IGNodW5rLFxuICAgIG1peGluOiBtaXhpbixcbiAgICAnZGVmYXVsdCc6IF8kMVxuICB9O1xuXG4gIC8vIERlZmF1bHQgRXhwb3J0XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICB2YXIgXyA9IG1peGluKGFsbEV4cG9ydHMpO1xuICAvLyBMZWdhY3kgTm9kZS5qcyBBUEkuXG4gIF8uXyA9IF87XG5cbiAgcmV0dXJuIF87XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD11bmRlcnNjb3JlLXVtZC5qcy5tYXBcbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuX193ZWJwYWNrX3JlcXVpcmVfXy5uID0gKG1vZHVsZSkgPT4ge1xuXHR2YXIgZ2V0dGVyID0gbW9kdWxlICYmIG1vZHVsZS5fX2VzTW9kdWxlID9cblx0XHQoKSA9PiAobW9kdWxlWydkZWZhdWx0J10pIDpcblx0XHQoKSA9PiAobW9kdWxlKTtcblx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgeyBhOiBnZXR0ZXIgfSk7XG5cdHJldHVybiBnZXR0ZXI7XG59OyIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18uZyA9IChmdW5jdGlvbigpIHtcblx0aWYgKHR5cGVvZiBnbG9iYWxUaGlzID09PSAnb2JqZWN0JykgcmV0dXJuIGdsb2JhbFRoaXM7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIHRoaXMgfHwgbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHJldHVybiB3aW5kb3c7XG5cdH1cbn0pKCk7IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsIi8vIGltcG9ydCBcIi4vbW9kdWxlLnNjc3NcIjtcblxuaW1wb3J0IHsgVGVtcGxhdGVQcmVsb2FkZXIgfSBmcm9tIFwiLi9tb2R1bGUvaGVscGVyL1RlbXBsYXRlUHJlbG9hZGVyXCI7XG5cbmltcG9ydCBNYXJrZG93bkl0IGZyb20gXCJtYXJrZG93bi1pdFwiO1xuXG5pbXBvcnQgYWRkRXh0cmFzIGZyb20gXCIuL2FkZEV4dHJhc1wiO1xuXG4vLyBVc2UgcHJldHR5IHF1b3Rlc1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUVkaXRvclwiLCBhc3luYyAob3B0aW9uczogTWFya2Rvd25JdC5PcHRpb25zKSA9PiB7XG4gIG9wdGlvbnMudHlwb2dyYXBoZXIgPSB0cnVlO1xuICByZXR1cm4gb3B0aW9ucztcbn0pO1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUNoYXRcIiwgYXN5bmMgKG9wdGlvbnM6IE1hcmtkb3duSXQuT3B0aW9ucykgPT4ge1xuICBvcHRpb25zLnR5cG9ncmFwaGVyID0gdHJ1ZTtcbiAgcmV0dXJuIG9wdGlvbnM7XG59KTtcbkhvb2tzLm9uY2UoXCJpbml0XCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgeyBtYXJrZG93bkl0IH0gPSB3aW5kb3cuTUVNRTtcblxuICBhZGRFeHRyYXMobWFya2Rvd25JdCk7XG59KTtcblxuSG9va3Mub25jZShcIk1lbWVSZW5kZXJFZGl0b3JcIiwgYXN5bmMgKGEsIGIpID0+IHtcbiAgY29uc29sZS5sb2coXCJtYXJrZG93bi1lZGl0b3ItZXh0cmFzIGhlYXJkIE1lbWVSZW5kZXJFZGl0b3IgZXZlbnQuXCIsIGEsIGIpO1xufSk7XG5cbkhvb2tzLm9uY2UoXCJyZWFkeVwiLCBhc3luYyAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKFwibWFya2Rvd24tZWRpdG9yLWV4dHJhcyByZWFkeVwiKTtcbn0pO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIikge1xuICBpZiAobW9kdWxlLmhvdCkge1xuICAgIG1vZHVsZS5ob3QuYWNjZXB0KCk7XG5cbiAgICBpZiAobW9kdWxlLmhvdC5zdGF0dXMoKSA9PT0gXCJhcHBseVwiKSB7XG4gICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIGluIF90ZW1wbGF0ZUNhY2hlKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoX3RlbXBsYXRlQ2FjaGUsIHRlbXBsYXRlKSkge1xuICAgICAgICAgIGRlbGV0ZSBfdGVtcGxhdGVDYWNoZVt0ZW1wbGF0ZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgVGVtcGxhdGVQcmVsb2FkZXIucHJlbG9hZEhhbmRsZWJhcnNUZW1wbGF0ZXMoKS50aGVuKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHBsaWNhdGlvbiBpbiB1aS53aW5kb3dzKSB7XG4gICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh1aS53aW5kb3dzLCBhcHBsaWNhdGlvbikpIHtcbiAgICAgICAgICAgIHVpLndpbmRvd3NbYXBwbGljYXRpb25dLnJlbmRlcih0cnVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==