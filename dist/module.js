/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/markdown-it-attrs/index.js":
/*!*************************************************!*\
  !*** ./node_modules/markdown-it-attrs/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



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

/***/ "./node_modules/markdown-it-container/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/markdown-it-container/index.js ***!
  \*****************************************************/
/***/ ((module) => {

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

/***/ "./static/templates/blank.html":
/*!*************************************!*\
  !*** ./static/templates/blank.html ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addExtras": () => (/* binding */ addExtras),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! markdown-it-attrs */ "./node_modules/markdown-it-attrs/index.js");
/* harmony import */ var markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var markdown_it_container__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! markdown-it-container */ "./node_modules/markdown-it-container/index.js");
/* harmony import */ var markdown_it_container__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(markdown_it_container__WEBPACK_IMPORTED_MODULE_1__);

// import * as markdownItCheckbox from "markdown-it-checkbox";

const addExtras = (markdownIt) => {
    // todo: get settings as well
    // Allow {.class #id data-other="foo"} tags
    markdownIt.use((markdown_it_attrs__WEBPACK_IMPORTED_MODULE_0___default()), {
        leftDelimiter: "{",
        rightDelimiter: "}",
        allowedAttributes: ["class", "id", /^(?!on).*$/gim],
    });
    markdownIt.use((markdown_it_container__WEBPACK_IMPORTED_MODULE_1___default()), "any-class", {
        validate: () => true,
        render: (tokens, idx, options, _env, self) => {
            const m = tokens[idx].info.trim().match(/^(.*)$/);
            tokens[idx].attrPush(["class", m[1]]);
            return self.renderToken(tokens, idx, options);
        },
    });
    return markdownIt;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (addExtras);
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


/***/ }),

/***/ "./src/module/helper/TemplatePreloader.ts":
/*!************************************************!*\
  !*** ./src/module/helper/TemplatePreloader.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
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
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
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
    // // TODO: choose which plugins to include via settings
    // const attrsConfig = {
    //   leftDelimiter: "{",
    //   rightDelimiter: "}",
    //   allowedAttributes: ["class", "id", /^(?!on).*$/gim],
    // };
    // markdownIt.use(markdownItAttrs, attrsConfig);
    // // change the rule applied to write a custom name attr on headers in MEME
    // // markdownIt.renderer.rules["heading_open"] = (
    // //   tokens,
    // //   idx,
    // //   options,
    // //   _env,
    // //   self
    // // ) => {
    // //   const token = tokens[idx];
    // //   const nextToken = tokens[idx + 1];
    // //   const link = nextToken?.content || "";
    // //   token.attrSet("name", `${token.markup}${link}`);
    // //   return self.renderToken(tokens, idx, options);
    // // };
    // let firstHeader = true;
    // // change the rule applied to write a custom name attr on headers in MEME
    // // AND...allow easy folding
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
    //   const headerOpen = self.renderToken(tokens, idx, options);
    //   let wrapped = `<details open="1"><summary>${headerOpen}`;
    //   if (firstHeader) {
    //     firstHeader = false;
    //   } else {
    //     wrapped = `</details>${wrapped}`;
    //   }
    //   console.log("TOKEN:", wrapped);
    //   return wrapped;
    // };
    // markdownIt.renderer.rules["heading_close"] = (
    //   tokens,
    //   idx,
    //   options,
    //   _env,
    //   self
    // ) => {
    //   const headerClose = self.renderToken(tokens, idx, options);
    //   return `${headerClose}</summary>`;
    // };
    // markdownIt.use(markdownItCheckbox, {
    //   divWrap: true,
    //   divClass: "cb",
    //   idPrefix: "cbx_",
    // });
    // markdownIt.use(markdownItContainer, "fold-closed", {
    //   validate: (params) => {
    //     return params.trim().match(/^fold-closed\s+(.*)$/);
    //   },
    //   render: (tokens, idx) => {
    //     const m = tokens[idx].info.trim().match(/^fold-closed\s+(.*)$/);
    //     if (tokens[idx].nesting === 1) {
    //       return (
    //         "<details><summary>" +
    //         markdownIt.utils.escapeHtml(m[1]) +
    //         "</summary>\n"
    //       );
    //     } else {
    //       // closing tag
    //       return "</details>\n";
    //     }
    //   },
    // });
    // markdownIt.use(markdownItContainer, "fold", {
    //   validate: (params) => {
    //     return params.trim().match(/^fold\s+(.*)$/);
    //   },
    //   render: (tokens, idx) => {
    //     const m = tokens[idx].info.trim().match(/^fold\s+(.*)$/);
    //     if (tokens[idx].nesting === 1) {
    //       return (
    //         "<details open='1'><summary>" +
    //         markdownIt.utils.escapeHtml(m[1]) +
    //         "</summary>\n"
    //       );
    //     } else {
    //       // closing tag
    //       return "</details>\n";
    //     }
    //   },
    // });
    // markdownIt.use(markdownItContainer, "any-class", {
    //   validate: () => true,
    //   render: (tokens, idx, options, _env, self) => {
    //     const m = tokens[idx].info.trim().match(/^(.*)$/);
    //     tokens[idx].attrPush(["class", m[1]]);
    //     return self.renderToken(tokens, idx, options);
    //   },
    // });
    // // // give any other containers an 'unknown' class
    // // markdownIt.use(markdownItContainer, "unknown", {
    // //   validate: (_params) => {
    // //     return true;
    // //   },
    // // });
    // markdownIt.use(markdownItDeflist);
    // markdownIt.use(markdownItEmoji);
    // markdownIt.use(markdownItFootnote);
    // markdownIt.use(markdownItHTML5Embed, {
    //   html5embed: {
    //     useImageSyntax: true, // Enables video/audio embed with ![]() syntax (default)
    //     useLinkSyntax: true, // Enables video/audio embed with []() syntax
    //   },
    // });
    // // TODO: check TS error
    // markdownIt.use(markdownItKbd);
    // markdownIt.use(markdownItMark);
    // markdownIt.use(markdownItMultimdTable);
    // markdownIt.use(markdownItSub);
    // markdownIt.use(markdownItSup);
    // // TODO: see if there's a way to link directly to a journal
    // // markdownIt.use(markdownItToc);
    // markdownIt.use(markdownItUnderline);
    // console.log("INIT markdownit extras wATTRS!", markdownIt);
});
Hooks.once("MemeRenderEditor", async (a, b) => {
    console.log("MEMERENDERENDITOR markdownit extras!", a, b);
});
Hooks.once("ready", async () => {
    console.log("Test");
});
if (true) {
    if (false) {}
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWF0dHJzL2luZGV4LmpzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9ub2RlX21vZHVsZXMvbWFya2Rvd24taXQtYXR0cnMvcGF0dGVybnMuanMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy8uL25vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC1hdHRycy91dGlscy5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vbm9kZV9tb2R1bGVzL21hcmtkb3duLWl0LWNvbnRhaW5lci9pbmRleC5qcyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vc3RhdGljL3RlbXBsYXRlcy9ibGFuay5odG1sIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9zcmMvYWRkRXh0cmFzLnRzIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvLi9zcmMvbW9kdWxlL2hlbHBlci9UZW1wbGF0ZVByZWxvYWRlci50cyIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvd2VicGFjay9ydW50aW1lL2NvbXBhdCBnZXQgZGVmYXVsdCBleHBvcnQiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vbWFya2Rvd24tZWRpdG9yLWV4dHJhcy93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL21hcmtkb3duLWVkaXRvci1leHRyYXMvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9tYXJrZG93bi1lZGl0b3ItZXh0cmFzLy4vc3JjL21hcmtkb3duLWVkaXRvci1leHRyYXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFhOztBQUViLHVCQUF1QixtQkFBTyxDQUFDLG1FQUFlOztBQUU5QztBQUNBLG1CQUFtQjtBQUNuQixvQkFBb0I7QUFDcEI7QUFDQTs7QUFFQTtBQUNBLGdDQUFnQztBQUNoQzs7QUFFQTs7QUFFQTtBQUNBOztBQUVBLG1CQUFtQixtQkFBbUI7QUFDdEMscUJBQXFCLHFCQUFxQjtBQUMxQztBQUNBLHFCQUFxQjtBQUNyQjtBQUNBO0FBQ0EsK0JBQStCLFdBQVc7QUFDMUM7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxPQUFPO0FBQ2xCLFdBQVcsT0FBTztBQUNsQixZQUFZLE9BQU8sRUFBRTtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsOEJBQThCOzs7QUFHOUIsNEJBQTRCLFlBQVk7O0FBRXhDO0FBQ0EsZ0RBQWdELFVBQVU7O0FBRTFELG1DQUFtQyxZQUFZOztBQUUvQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1AsdUJBQXVCLHFCQUFxQjtBQUM1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDRCQUE0QixZQUFZOztBQUV4QztBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0NBQWtDLFlBQVk7QUFDOUM7QUFDQTtBQUNBLGdDQUFnQyxZQUFZO0FBQzVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMEJBQTBCLFlBQVk7QUFDdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0REFBNEQsSUFBSTtBQUNo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Q3pCLFdBQVc7SUFDWCxlQUFlO0lBQ2YsdUJBQXVCO0lBQ3ZCLCtCQUErQjtJQUMvQixRQUFRO0lBQ1IsT0FBTztJQUNQLE1BQU07SUFFTixxREFBcUQ7SUFDckQsMEJBQTBCO0lBRTFCLG9EQUFvRDtJQUNwRCx5REFBeUQ7SUFFekQsNkNBQTZDO0lBRTdDLHFEQUFxRDtJQUNyRCxPQUFPO0lBQ1AsTUFBTTtJQUVOLHFEQUFxRDtJQUNyRCxzREFBc0Q7SUFDdEQsZ0NBQWdDO0lBQ2hDLHNCQUFzQjtJQUN0QixVQUFVO0lBQ1YsU0FBUztJQUVULHFDQUFxQztJQUVyQyxtQ0FBbUM7SUFFbkMsc0NBQXNDO0lBRXRDLHlDQUF5QztJQUN6QyxrQkFBa0I7SUFDbEIscUZBQXFGO0lBQ3JGLHlFQUF5RTtJQUN6RSxPQUFPO0lBQ1AsTUFBTTtJQUVOLDBCQUEwQjtJQUMxQixpQ0FBaUM7SUFFakMsa0NBQWtDO0lBRWxDLDBDQUEwQztJQUUxQyxpQ0FBaUM7SUFFakMsaUNBQWlDO0lBRWpDLDhEQUE4RDtJQUM5RCxvQ0FBb0M7SUFFcEMsdUNBQXVDO0lBRXZDLDZEQUE2RDtBQUMvRCxDQUFDLENBQUMsQ0FBQztBQUVILEtBQUssQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLHNDQUFzQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1RCxDQUFDLENBQUMsQ0FBQztBQUVILEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxFQUFFO0lBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDLENBQUM7QUFFSCxJQUFJLElBQXNDLEVBQUU7SUFDMUMsSUFBSSxLQUFVLEVBQUUsRUFrQmY7Q0FDRiIsImZpbGUiOiJtb2R1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdHRlcm5zQ29uZmlnID0gcmVxdWlyZSgnLi9wYXR0ZXJucy5qcycpO1xuXG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgbGVmdERlbGltaXRlcjogJ3snLFxuICByaWdodERlbGltaXRlcjogJ30nLFxuICBhbGxvd2VkQXR0cmlidXRlczogW11cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXR0cmlidXRlcyhtZCwgb3B0aW9uc18pIHtcbiAgbGV0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucyk7XG4gIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKG9wdGlvbnMsIG9wdGlvbnNfKTtcblxuICBjb25zdCBwYXR0ZXJucyA9IHBhdHRlcm5zQ29uZmlnKG9wdGlvbnMpO1xuXG4gIGZ1bmN0aW9uIGN1cmx5QXR0cnMoc3RhdGUpIHtcbiAgICBsZXQgdG9rZW5zID0gc3RhdGUudG9rZW5zO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IHAgPSAwOyBwIDwgcGF0dGVybnMubGVuZ3RoOyBwKyspIHtcbiAgICAgICAgbGV0IHBhdHRlcm4gPSBwYXR0ZXJuc1twXTtcbiAgICAgICAgbGV0IGogPSBudWxsOyAvLyBwb3NpdGlvbiBvZiBjaGlsZCB3aXRoIG9mZnNldCAwXG4gICAgICAgIGxldCBtYXRjaCA9IHBhdHRlcm4udGVzdHMuZXZlcnkodCA9PiB7XG4gICAgICAgICAgbGV0IHJlcyA9IHRlc3QodG9rZW5zLCBpLCB0KTtcbiAgICAgICAgICBpZiAocmVzLmogIT09IG51bGwpIHsgaiA9IHJlcy5qOyB9XG4gICAgICAgICAgcmV0dXJuIHJlcy5tYXRjaDtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgIHBhdHRlcm4udHJhbnNmb3JtKHRva2VucywgaSwgaik7XG4gICAgICAgICAgaWYgKHBhdHRlcm4ubmFtZSA9PT0gJ2lubGluZSBhdHRyaWJ1dGVzJyB8fCBwYXR0ZXJuLm5hbWUgPT09ICdpbmxpbmUgbmVzdGluZyAwJykge1xuICAgICAgICAgICAgLy8gcmV0cnksIG1heSBiZSBzZXZlcmFsIGlubGluZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICBwLS07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbWQuY29yZS5ydWxlci5iZWZvcmUoJ2xpbmtpZnknLCAnY3VybHlfYXR0cmlidXRlcycsIGN1cmx5QXR0cnMpO1xufTtcblxuLyoqXG4gKiBUZXN0IGlmIHQgbWF0Y2hlcyB0b2tlbiBzdHJlYW0uXG4gKlxuICogQHBhcmFtIHthcnJheX0gdG9rZW5zXG4gKiBAcGFyYW0ge251bWJlcn0gaVxuICogQHBhcmFtIHtvYmplY3R9IHQgVGVzdCB0byBtYXRjaC5cbiAqIEByZXR1cm4ge29iamVjdH0geyBtYXRjaDogdHJ1ZXxmYWxzZSwgajogbnVsbHxudW1iZXIgfVxuICovXG5mdW5jdGlvbiB0ZXN0KHRva2VucywgaSwgdCkge1xuICBsZXQgcmVzID0ge1xuICAgIG1hdGNoOiBmYWxzZSxcbiAgICBqOiBudWxsICAvLyBwb3NpdGlvbiBvZiBjaGlsZFxuICB9O1xuXG4gIGxldCBpaSA9IHQuc2hpZnQgIT09IHVuZGVmaW5lZFxuICAgID8gaSArIHQuc2hpZnRcbiAgICA6IHQucG9zaXRpb247XG4gIGxldCB0b2tlbiA9IGdldCh0b2tlbnMsIGlpKTsgIC8vIHN1cHBvcnRzIG5lZ2F0aXZlIGlpXG5cblxuICBpZiAodG9rZW4gPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gcmVzOyB9XG5cbiAgZm9yIChsZXQga2V5IGluIHQpIHtcbiAgICBpZiAoa2V5ID09PSAnc2hpZnQnIHx8IGtleSA9PT0gJ3Bvc2l0aW9uJykgeyBjb250aW51ZTsgfVxuXG4gICAgaWYgKHRva2VuW2tleV0gPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gcmVzOyB9XG5cbiAgICBpZiAoa2V5ID09PSAnY2hpbGRyZW4nICYmIGlzQXJyYXlPZk9iamVjdHModC5jaGlsZHJlbikpIHtcbiAgICAgIGlmICh0b2tlbi5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICAgIGxldCBtYXRjaDtcbiAgICAgIGxldCBjaGlsZFRlc3RzID0gdC5jaGlsZHJlbjtcbiAgICAgIGxldCBjaGlsZHJlbiA9IHRva2VuLmNoaWxkcmVuO1xuICAgICAgaWYgKGNoaWxkVGVzdHMuZXZlcnkodHQgPT4gdHQucG9zaXRpb24gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gcG9zaXRpb25zIGluc3RlYWQgb2Ygc2hpZnRzLCBkbyBub3QgbG9vcCBhbGwgY2hpbGRyZW5cbiAgICAgICAgbWF0Y2ggPSBjaGlsZFRlc3RzLmV2ZXJ5KHR0ID0+IHRlc3QoY2hpbGRyZW4sIHR0LnBvc2l0aW9uLCB0dCkubWF0Y2gpO1xuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAvLyB3ZSBtYXkgbmVlZCBwb3NpdGlvbiBvZiBjaGlsZCBpbiB0cmFuc2Zvcm1cbiAgICAgICAgICBsZXQgaiA9IGxhc3QoY2hpbGRUZXN0cykucG9zaXRpb247XG4gICAgICAgICAgcmVzLmogPSBqID49IDAgPyBqIDogY2hpbGRyZW4ubGVuZ3RoICsgajtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjaGlsZHJlbi5sZW5ndGg7IGorKykge1xuICAgICAgICAgIG1hdGNoID0gY2hpbGRUZXN0cy5ldmVyeSh0dCA9PiB0ZXN0KGNoaWxkcmVuLCBqLCB0dCkubWF0Y2gpO1xuICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgcmVzLmogPSBqO1xuICAgICAgICAgICAgLy8gYWxsIHRlc3RzIHRydWUsIGNvbnRpbnVlIHdpdGggbmV4dCBrZXkgb2YgcGF0dGVybiB0XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG1hdGNoID09PSBmYWxzZSkgeyByZXR1cm4gcmVzOyB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN3aXRjaCAodHlwZW9mIHRba2V5XSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIGlmICh0b2tlbltrZXldICE9PSB0W2tleV0pIHsgcmV0dXJuIHJlczsgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZnVuY3Rpb24nOlxuICAgICAgaWYgKCF0W2tleV0odG9rZW5ba2V5XSkpIHsgcmV0dXJuIHJlczsgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGlmIChpc0FycmF5T2ZGdW5jdGlvbnModFtrZXldKSkge1xuICAgICAgICBsZXQgciA9IHRba2V5XS5ldmVyeSh0dCA9PiB0dCh0b2tlbltrZXldKSk7XG4gICAgICAgIGlmIChyID09PSBmYWxzZSkgeyByZXR1cm4gcmVzOyB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIC8vIGZhbGwgdGhyb3VnaCBmb3Igb2JqZWN0cyAhPT0gYXJyYXlzIG9mIGZ1bmN0aW9uc1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHlwZSBvZiBwYXR0ZXJuIHRlc3QgKGtleTogJHtrZXl9KS4gVGVzdCBzaG91bGQgYmUgb2YgdHlwZSBib29sZWFuLCBudW1iZXIsIHN0cmluZywgZnVuY3Rpb24gb3IgYXJyYXkgb2YgZnVuY3Rpb25zLmApO1xuICAgIH1cbiAgfVxuXG4gIC8vIG5vIHRlc3RzIHJldHVybmVkIGZhbHNlIC0+IGFsbCB0ZXN0cyByZXR1cm5zIHRydWVcbiAgcmVzLm1hdGNoID0gdHJ1ZTtcbiAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gaXNBcnJheU9mT2JqZWN0cyhhcnIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXJyKSAmJiBhcnIubGVuZ3RoICYmIGFyci5ldmVyeShpID0+IHR5cGVvZiBpID09PSAnb2JqZWN0Jyk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPZkZ1bmN0aW9ucyhhcnIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXJyKSAmJiBhcnIubGVuZ3RoICYmIGFyci5ldmVyeShpID0+IHR5cGVvZiBpID09PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBHZXQgbiBpdGVtIG9mIGFycmF5LiBTdXBwb3J0cyBuZWdhdGl2ZSBuLCB3aGVyZSAtMSBpcyBsYXN0XG4gKiBlbGVtZW50IGluIGFycmF5LlxuICogQHBhcmFtIHthcnJheX0gYXJyXG4gKiBAcGFyYW0ge251bWJlcn0gblxuICovXG5mdW5jdGlvbiBnZXQoYXJyLCBuKSB7XG4gIHJldHVybiBuID49IDAgPyBhcnJbbl0gOiBhcnJbYXJyLmxlbmd0aCArIG5dO1xufVxuXG4vLyBnZXQgbGFzdCBlbGVtZW50IG9mIGFycmF5LCBzYWZlIC0gcmV0dXJucyB7fSBpZiBub3QgZm91bmRcbmZ1bmN0aW9uIGxhc3QoYXJyKSB7XG4gIHJldHVybiBhcnIuc2xpY2UoLTEpWzBdIHx8IHt9O1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLyoqXG4gKiBJZiBhIHBhdHRlcm4gbWF0Y2hlcyB0aGUgdG9rZW4gc3RyZWFtLFxuICogdGhlbiBydW4gdHJhbnNmb3JtLlxuICovXG5cbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscy5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9wdGlvbnMgPT4ge1xuICBjb25zdCBfX2hyID0gbmV3IFJlZ0V4cCgnXiB7MCwzfVstKl9dezMsfSA/J1xuICAgICAgICAgICAgICAgICAgICAgICAgICArIHV0aWxzLmVzY2FwZVJlZ0V4cChvcHRpb25zLmxlZnREZWxpbWl0ZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICsgJ1teJyArIHV0aWxzLmVzY2FwZVJlZ0V4cChvcHRpb25zLnJpZ2h0RGVsaW1pdGVyKSArICddJyk7XG5cbiAgcmV0dXJuIChbXG4gICAge1xuICAgICAgLyoqXG4gICAgICAgKiBgYGBweXRob24gey5jbHN9XG4gICAgICAgKiBmb3IgaSBpbiByYW5nZSgxMCk6XG4gICAgICAgKiAgICAgcHJpbnQoaSlcbiAgICAgICAqIGBgYFxuICAgICAgICovXG4gICAgICBuYW1lOiAnZmVuY2VkIGNvZGUgYmxvY2tzJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICBibG9jazogdHJ1ZSxcbiAgICAgICAgICBpbmZvOiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdlbmQnLCBvcHRpb25zKVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgbGV0IHN0YXJ0ID0gdG9rZW4uaW5mby5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpO1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyh0b2tlbi5pbmZvLCBzdGFydCwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCB0b2tlbik7XG4gICAgICAgIHRva2VuLmluZm8gPSB1dGlscy5yZW1vdmVEZWxpbWl0ZXIodG9rZW4uaW5mbywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiBibGEgYGNsaWNrKClgey5jfSAhW10oaW1nLnBuZyl7LmR9XG4gICAgICAgKlxuICAgICAgICogZGlmZmVycyBmcm9tICdpbmxpbmUgYXR0cmlidXRlcycgYXMgaXQgZG9lc1xuICAgICAgICogbm90IGhhdmUgYSBjbG9zaW5nIHRhZyAobmVzdGluZzogLTEpXG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdpbmxpbmUgbmVzdGluZyAwJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzaGlmdDogLTEsXG4gICAgICAgICAgICAgIHR5cGU6IChzdHIpID0+IHN0ciA9PT0gJ2ltYWdlJyB8fCBzdHIgPT09ICdjb2RlX2lubGluZSdcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnc3RhcnQnLCBvcHRpb25zKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIHRyYW5zZm9ybTogKHRva2VucywgaSwgaikgPT4ge1xuICAgICAgICBsZXQgdG9rZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW5bal07XG4gICAgICAgIGxldCBlbmRDaGFyID0gdG9rZW4uY29udGVudC5pbmRleE9mKG9wdGlvbnMucmlnaHREZWxpbWl0ZXIpO1xuICAgICAgICBsZXQgYXR0clRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2ogLSAxXTtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnModG9rZW4uY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBhdHRyVG9rZW4pO1xuICAgICAgICBpZiAodG9rZW4uY29udGVudC5sZW5ndGggPT09IChlbmRDaGFyICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpKSB7XG4gICAgICAgICAgdG9rZW5zW2ldLmNoaWxkcmVuLnNwbGljZShqLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b2tlbi5jb250ZW50ID0gdG9rZW4uY29udGVudC5zbGljZShlbmRDaGFyICsgb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiB8IGgxIHxcbiAgICAgICAqIHwgLS0gfFxuICAgICAgICogfCBjMSB8XG4gICAgICAgKlxuICAgICAgICogey5jfVxuICAgICAgICovXG4gICAgICBuYW1lOiAndGFibGVzJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBsZXQgdGhpcyB0b2tlbiBiZSBpLCBzdWNoIHRoYXQgZm9yLWxvb3AgY29udGludWVzIGF0XG4gICAgICAgICAgLy8gbmV4dCB0b2tlbiBhZnRlciB0b2tlbnMuc3BsaWNlXG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ3RhYmxlX2Nsb3NlJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDEsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDIsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGkpID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2kgKyAyXTtcbiAgICAgICAgbGV0IHRhYmxlT3BlbiA9IHV0aWxzLmdldE1hdGNoaW5nT3BlbmluZ1Rva2VuKHRva2VucywgaSk7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKHRva2VuLmNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICAvLyBhZGQgYXR0cmlidXRlc1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdGFibGVPcGVuKTtcbiAgICAgICAgLy8gcmVtb3ZlIDxwPnsuY308L3A+XG4gICAgICAgIHRva2Vucy5zcGxpY2UoaSArIDEsIDMpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogKmVtcGhhc2lzKnsud2l0aCBhdHRycz0xfVxuICAgICAgICovXG4gICAgICBuYW1lOiAnaW5saW5lIGF0dHJpYnV0ZXMnLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgIHR5cGU6ICdpbmxpbmUnLFxuICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNoaWZ0OiAtMSxcbiAgICAgICAgICAgICAgbmVzdGluZzogLTEgIC8vIGNsb3NpbmcgaW5saW5lIHRhZywgPC9lbT57LmF9XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHNoaWZ0OiAwLFxuICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHV0aWxzLmhhc0RlbGltaXRlcnMoJ3N0YXJ0Jywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIDAsIG9wdGlvbnMpO1xuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zW2ldLmNoaWxkcmVuLCBqIC0gMSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gY29udGVudC5zbGljZShjb250ZW50LmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlcikgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiAtIGl0ZW1cbiAgICAgICAqIHsuYX1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3Qgc29mdGJyZWFrJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogLTIsXG4gICAgICAgICAgdHlwZTogJ2xpc3RfaXRlbV9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0yLFxuICAgICAgICAgICAgICB0eXBlOiAnc29mdGJyZWFrJ1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTEsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpLCBqKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXS5jaGlsZHJlbltqXTtcbiAgICAgICAgbGV0IGNvbnRlbnQgPSB0b2tlbi5jb250ZW50O1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyhjb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgbGV0IGlpID0gaSAtIDI7XG4gICAgICAgIHdoaWxlICh0b2tlbnNbaWkgLSAxXSAmJlxuICAgICAgICAgIHRva2Vuc1tpaSAtIDFdLnR5cGUgIT09ICdvcmRlcmVkX2xpc3Rfb3BlbicgJiZcbiAgICAgICAgICB0b2tlbnNbaWkgLSAxXS50eXBlICE9PSAnYnVsbGV0X2xpc3Rfb3BlbicpIHsgaWktLTsgfVxuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgdG9rZW5zW2lpIC0gMV0pO1xuICAgICAgICB0b2tlbnNbaV0uY2hpbGRyZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW4uc2xpY2UoMCwgLTIpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogLSBuZXN0ZWQgbGlzdFxuICAgICAgICogICAtIHdpdGggZG91YmxlIFxcblxuICAgICAgICogICB7LmF9IDwtLSBhcHBseSB0byBuZXN0ZWQgdWxcbiAgICAgICAqXG4gICAgICAgKiB7LmJ9IDwtLSBhcHBseSB0byByb290IDx1bD5cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3QgZG91YmxlIHNvZnRicmVhaycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gbGV0IHRoaXMgdG9rZW4gYmUgaSA9IDAgc28gdGhhdCB3ZSBjYW4gZXJhc2VcbiAgICAgICAgICAvLyB0aGUgPHA+ey5hfTwvcD4gdG9rZW5zIGJlbG93XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogKHN0cikgPT5cbiAgICAgICAgICAgIHN0ciA9PT0gJ2J1bGxldF9saXN0X2Nsb3NlJyB8fFxuICAgICAgICAgICAgc3RyID09PSAnb3JkZXJlZF9saXN0X2Nsb3NlJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDEsXG4gICAgICAgICAgdHlwZTogJ3BhcmFncmFwaF9vcGVuJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgc2hpZnQ6IDIsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnb25seScsIG9wdGlvbnMpLFxuICAgICAgICAgIGNoaWxkcmVuOiAoYXJyKSA9PiBhcnIubGVuZ3RoID09PSAxXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBzaGlmdDogMyxcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX2Nsb3NlJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpICsgMl07XG4gICAgICAgIGxldCBjb250ZW50ID0gdG9rZW4uY29udGVudDtcbiAgICAgICAgbGV0IGF0dHJzID0gdXRpbHMuZ2V0QXR0cnMoY29udGVudCwgMCwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBvcGVuaW5nVG9rZW4gPSB1dGlscy5nZXRNYXRjaGluZ09wZW5pbmdUb2tlbih0b2tlbnMsIGkpO1xuICAgICAgICB1dGlscy5hZGRBdHRycyhhdHRycywgb3BlbmluZ1Rva2VuKTtcbiAgICAgICAgdG9rZW5zLnNwbGljZShpICsgMSwgMyk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiAtIGVuZCBvZiB7Lmxpc3QtaXRlbX1cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2xpc3QgaXRlbSBlbmQnLFxuICAgICAgdGVzdHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHNoaWZ0OiAtMixcbiAgICAgICAgICB0eXBlOiAnbGlzdF9pdGVtX29wZW4nXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTEsXG4gICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgY29udGVudDogdXRpbHMuaGFzRGVsaW1pdGVycygnZW5kJywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSwgb3B0aW9ucyk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCB0b2tlbnNbaSAtIDJdKTtcbiAgICAgICAgbGV0IHRyaW1tZWQgPSBjb250ZW50LnNsaWNlKDAsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSk7XG4gICAgICAgIHRva2VuLmNvbnRlbnQgPSBsYXN0KHRyaW1tZWQpICE9PSAnICcgP1xuICAgICAgICAgIHRyaW1tZWQgOiB0cmltbWVkLnNsaWNlKDAsIC0xKTtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICAvKipcbiAgICAgICAqIHNvbWV0aGluZyB3aXRoIHNvZnRicmVha1xuICAgICAgICogey5jbHN9XG4gICAgICAgKi9cbiAgICAgIG5hbWU6ICdcXG57LmF9IHNvZnRicmVhayB0aGVuIGN1cmx5IGluIHN0YXJ0JyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwb3NpdGlvbjogLTIsXG4gICAgICAgICAgICAgIHR5cGU6ICdzb2Z0YnJlYWsnXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAtMSxcbiAgICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgICBjb250ZW50OiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdvbmx5Jywgb3B0aW9ucylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgYXR0cnMgPSB1dGlscy5nZXRBdHRycyh0b2tlbi5jb250ZW50LCAwLCBvcHRpb25zKTtcbiAgICAgICAgLy8gZmluZCBsYXN0IGNsb3NpbmcgdGFnXG4gICAgICAgIGxldCBpaSA9IGkgKyAxO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2lpICsgMV0gJiYgdG9rZW5zW2lpICsgMV0ubmVzdGluZyA9PT0gLTEpIHsgaWkrKzsgfVxuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zLCBpaSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICB0b2tlbnNbaV0uY2hpbGRyZW4gPSB0b2tlbnNbaV0uY2hpbGRyZW4uc2xpY2UoMCwgLTIpO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIC8qKlxuICAgICAgICogaG9yaXpvbnRhbCBydWxlIC0tLSB7I2lkfVxuICAgICAgICovXG4gICAgICBuYW1lOiAnaG9yaXpvbnRhbCBydWxlJyxcbiAgICAgIHRlc3RzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMCxcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX29wZW4nXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMSxcbiAgICAgICAgICB0eXBlOiAnaW5saW5lJyxcbiAgICAgICAgICBjaGlsZHJlbjogKGFycikgPT4gYXJyLmxlbmd0aCA9PT0gMSxcbiAgICAgICAgICBjb250ZW50OiAoc3RyKSA9PiBzdHIubWF0Y2goX19ocikgIT09IG51bGwsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzaGlmdDogMixcbiAgICAgICAgICB0eXBlOiAncGFyYWdyYXBoX2Nsb3NlJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgdHJhbnNmb3JtOiAodG9rZW5zLCBpKSA9PiB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgdG9rZW4udHlwZSA9ICdocic7XG4gICAgICAgIHRva2VuLnRhZyA9ICdocic7XG4gICAgICAgIHRva2VuLm5lc3RpbmcgPSAwO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2Vuc1tpICsgMV0uY29udGVudDtcbiAgICAgICAgbGV0IHN0YXJ0ID0gY29udGVudC5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpO1xuICAgICAgICB0b2tlbi5hdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIHN0YXJ0LCBvcHRpb25zKTtcbiAgICAgICAgdG9rZW4ubWFya3VwID0gY29udGVudDtcbiAgICAgICAgdG9rZW5zLnNwbGljZShpICsgMSwgMik7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAgLyoqXG4gICAgICAgKiBlbmQgb2Ygey5ibG9ja31cbiAgICAgICAqL1xuICAgICAgbmFtZTogJ2VuZCBvZiBibG9jaycsXG4gICAgICB0ZXN0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc2hpZnQ6IDAsXG4gICAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcG9zaXRpb246IC0xLFxuICAgICAgICAgICAgICBjb250ZW50OiB1dGlscy5oYXNEZWxpbWl0ZXJzKCdlbmQnLCBvcHRpb25zKSxcbiAgICAgICAgICAgICAgdHlwZTogKHQpID0+IHQgIT09ICdjb2RlX2lubGluZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICB0cmFuc2Zvcm06ICh0b2tlbnMsIGksIGopID0+IHtcbiAgICAgICAgbGV0IHRva2VuID0gdG9rZW5zW2ldLmNoaWxkcmVuW2pdO1xuICAgICAgICBsZXQgY29udGVudCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxldCBhdHRycyA9IHV0aWxzLmdldEF0dHJzKGNvbnRlbnQsIGNvbnRlbnQubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKSwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBpaSA9IGkgKyAxO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2lpICsgMV0gJiYgdG9rZW5zW2lpICsgMV0ubmVzdGluZyA9PT0gLTEpIHsgaWkrKzsgfVxuICAgICAgICBsZXQgb3BlbmluZ1Rva2VuID0gdXRpbHMuZ2V0TWF0Y2hpbmdPcGVuaW5nVG9rZW4odG9rZW5zLCBpaSk7XG4gICAgICAgIHV0aWxzLmFkZEF0dHJzKGF0dHJzLCBvcGVuaW5nVG9rZW4pO1xuICAgICAgICBsZXQgdHJpbW1lZCA9IGNvbnRlbnQuc2xpY2UoMCwgY29udGVudC5sYXN0SW5kZXhPZihvcHRpb25zLmxlZnREZWxpbWl0ZXIpKTtcbiAgICAgICAgdG9rZW4uY29udGVudCA9IGxhc3QodHJpbW1lZCkgIT09ICcgJyA/XG4gICAgICAgICAgdHJpbW1lZCA6IHRyaW1tZWQuc2xpY2UoMCwgLTEpO1xuICAgICAgfVxuICAgIH1cbiAgXSk7XG59O1xuXG4vLyBnZXQgbGFzdCBlbGVtZW50IG9mIGFycmF5IG9yIHN0cmluZ1xuZnVuY3Rpb24gbGFzdChhcnIpIHtcbiAgcmV0dXJuIGFyci5zbGljZSgtMSlbMF07XG59XG4iLCIndXNlIHN0cmljdCc7XG4vKipcbiAqIHBhcnNlIHsuY2xhc3MgI2lkIGtleT12YWx9IHN0cmluZ3NcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHI6IHN0cmluZyB0byBwYXJzZVxuICogQHBhcmFtIHtpbnR9IHN0YXJ0OiB3aGVyZSB0byBzdGFydCBwYXJzaW5nIChpbmNsdWRpbmcgeylcbiAqIEByZXR1cm5zIHsyZCBhcnJheX06IFtbJ2tleScsICd2YWwnXSwgWydjbGFzcycsICdyZWQnXV1cbiAqL1xuZXhwb3J0cy5nZXRBdHRycyA9IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBvcHRpb25zKSB7XG4gIC8vIG5vdCB0YWIsIGxpbmUgZmVlZCwgZm9ybSBmZWVkLCBzcGFjZSwgc29saWR1cywgZ3JlYXRlciB0aGFuIHNpZ24sIHF1b3RhdGlvbiBtYXJrLCBhcG9zdHJvcGhlIGFuZCBlcXVhbHMgc2lnblxuICBjb25zdCBhbGxvd2VkS2V5Q2hhcnMgPSAvW15cXHRcXG5cXGYgLz5cIic9XS87XG4gIGNvbnN0IHBhaXJTZXBhcmF0b3IgPSAnICc7XG4gIGNvbnN0IGtleVNlcGFyYXRvciA9ICc9JztcbiAgY29uc3QgY2xhc3NDaGFyID0gJy4nO1xuICBjb25zdCBpZENoYXIgPSAnIyc7XG5cbiAgY29uc3QgYXR0cnMgPSBbXTtcbiAgbGV0IGtleSA9ICcnO1xuICBsZXQgdmFsdWUgPSAnJztcbiAgbGV0IHBhcnNpbmdLZXkgPSB0cnVlO1xuICBsZXQgdmFsdWVJbnNpZGVRdW90ZXMgPSBmYWxzZTtcblxuICAvLyByZWFkIGluc2lkZSB7fVxuICAvLyBzdGFydCArIGxlZnQgZGVsaW1pdGVyIGxlbmd0aCB0byBhdm9pZCBiZWdpbm5pbmcge1xuICAvLyBicmVha3Mgd2hlbiB9IGlzIGZvdW5kIG9yIGVuZCBvZiBzdHJpbmdcbiAgZm9yIChsZXQgaSA9IHN0YXJ0ICsgb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzdHIuc2xpY2UoaSwgaSArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKSA9PT0gb3B0aW9ucy5yaWdodERlbGltaXRlcikge1xuICAgICAgaWYgKGtleSAhPT0gJycpIHsgYXR0cnMucHVzaChba2V5LCB2YWx1ZV0pOyB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgbGV0IGNoYXJfID0gc3RyLmNoYXJBdChpKTtcblxuICAgIC8vIHN3aXRjaCB0byByZWFkaW5nIHZhbHVlIGlmIGVxdWFsIHNpZ25cbiAgICBpZiAoY2hhcl8gPT09IGtleVNlcGFyYXRvciAmJiBwYXJzaW5nS2V5KSB7XG4gICAgICBwYXJzaW5nS2V5ID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB7LmNsYXNzfSB7Li5jc3MtbW9kdWxlfVxuICAgIGlmIChjaGFyXyA9PT0gY2xhc3NDaGFyICYmIGtleSA9PT0gJycpIHtcbiAgICAgIGlmIChzdHIuY2hhckF0KGkgKyAxKSA9PT0gY2xhc3NDaGFyKSB7XG4gICAgICAgIGtleSA9ICdjc3MtbW9kdWxlJztcbiAgICAgICAgaSArPSAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gJ2NsYXNzJztcbiAgICAgIH1cbiAgICAgIHBhcnNpbmdLZXkgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHsjaWR9XG4gICAgaWYgKGNoYXJfID09PSBpZENoYXIgJiYga2V5ID09PSAnJykge1xuICAgICAga2V5ID0gJ2lkJztcbiAgICAgIHBhcnNpbmdLZXkgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHt2YWx1ZT1cImluc2lkZSBxdW90ZXNcIn1cbiAgICBpZiAoY2hhcl8gPT09ICdcIicgJiYgdmFsdWUgPT09ICcnKSB7XG4gICAgICB2YWx1ZUluc2lkZVF1b3RlcyA9IHRydWU7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGNoYXJfID09PSAnXCInICYmIHZhbHVlSW5zaWRlUXVvdGVzKSB7XG4gICAgICB2YWx1ZUluc2lkZVF1b3RlcyA9IGZhbHNlO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gcmVhZCBuZXh0IGtleS92YWx1ZSBwYWlyXG4gICAgaWYgKChjaGFyXyA9PT0gcGFpclNlcGFyYXRvciAmJiAhdmFsdWVJbnNpZGVRdW90ZXMpKSB7XG4gICAgICBpZiAoa2V5ID09PSAnJykge1xuICAgICAgICAvLyBiZWdpbm5pbmcgb3IgZW5kaW5nIHNwYWNlOiB7IC5yZWQgfSB2cyB7LnJlZH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBhdHRycy5wdXNoKFtrZXksIHZhbHVlXSk7XG4gICAgICBrZXkgPSAnJztcbiAgICAgIHZhbHVlID0gJyc7XG4gICAgICBwYXJzaW5nS2V5ID0gdHJ1ZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGNvbnRpbnVlIGlmIGNoYXJhY3RlciBub3QgYWxsb3dlZFxuICAgIGlmIChwYXJzaW5nS2V5ICYmIGNoYXJfLnNlYXJjaChhbGxvd2VkS2V5Q2hhcnMpID09PSAtMSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gbm8gb3RoZXIgY29uZGl0aW9ucyBtZXQ7IGFwcGVuZCB0byBrZXkvdmFsdWVcbiAgICBpZiAocGFyc2luZ0tleSkge1xuICAgICAga2V5ICs9IGNoYXJfO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHZhbHVlICs9IGNoYXJfO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMuYWxsb3dlZEF0dHJpYnV0ZXMgJiYgb3B0aW9ucy5hbGxvd2VkQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICBsZXQgYWxsb3dlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmFsbG93ZWRBdHRyaWJ1dGVzO1xuXG4gICAgcmV0dXJuIGF0dHJzLmZpbHRlcihmdW5jdGlvbiAoYXR0clBhaXIpIHtcbiAgICAgIGxldCBhdHRyID0gYXR0clBhaXJbMF07XG5cbiAgICAgIGZ1bmN0aW9uIGlzQWxsb3dlZEF0dHJpYnV0ZSAoYWxsb3dlZEF0dHJpYnV0ZSkge1xuICAgICAgICByZXR1cm4gKGF0dHIgPT09IGFsbG93ZWRBdHRyaWJ1dGVcbiAgICAgICAgICB8fCAoYWxsb3dlZEF0dHJpYnV0ZSBpbnN0YW5jZW9mIFJlZ0V4cCAmJiBhbGxvd2VkQXR0cmlidXRlLnRlc3QoYXR0cikpXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhbGxvd2VkQXR0cmlidXRlcy5zb21lKGlzQWxsb3dlZEF0dHJpYnV0ZSk7XG4gICAgfSk7XG5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYXR0cnM7XG4gIH1cbn07XG5cbi8qKlxuICogYWRkIGF0dHJpYnV0ZXMgZnJvbSBbWydrZXknLCAndmFsJ11dIGxpc3RcbiAqIEBwYXJhbSB7YXJyYXl9IGF0dHJzOiBbWydrZXknLCAndmFsJ11dXG4gKiBAcGFyYW0ge3Rva2VufSB0b2tlbjogd2hpY2ggdG9rZW4gdG8gYWRkIGF0dHJpYnV0ZXNcbiAqIEByZXR1cm5zIHRva2VuXG4gKi9cbmV4cG9ydHMuYWRkQXR0cnMgPSBmdW5jdGlvbiAoYXR0cnMsIHRva2VuKSB7XG4gIGZvciAobGV0IGogPSAwLCBsID0gYXR0cnMubGVuZ3RoOyBqIDwgbDsgKytqKSB7XG4gICAgbGV0IGtleSA9IGF0dHJzW2pdWzBdO1xuICAgIGlmIChrZXkgPT09ICdjbGFzcycpIHtcbiAgICAgIHRva2VuLmF0dHJKb2luKCdjbGFzcycsIGF0dHJzW2pdWzFdKTtcbiAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2Nzcy1tb2R1bGUnKSB7XG4gICAgICB0b2tlbi5hdHRySm9pbignY3NzLW1vZHVsZScsIGF0dHJzW2pdWzFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9rZW4uYXR0clB1c2goYXR0cnNbal0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdG9rZW47XG59O1xuXG4vKipcbiAqIERvZXMgc3RyaW5nIGhhdmUgcHJvcGVybHkgZm9ybWF0dGVkIGN1cmx5P1xuICpcbiAqIHN0YXJ0OiAney5hfSBhc2RmJ1xuICogbWlkZGxlOiAnYXsuYn1jJ1xuICogZW5kOiAnYXNkZiB7LmF9J1xuICogb25seTogJ3suYX0nXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHdoZXJlIHRvIGV4cGVjdCB7fSBjdXJseS4gc3RhcnQsIG1pZGRsZSwgZW5kIG9yIG9ubHkuXG4gKiBAcmV0dXJuIHtmdW5jdGlvbihzdHJpbmcpfSBGdW5jdGlvbiB3aGljaCB0ZXN0ZXMgaWYgc3RyaW5nIGhhcyBjdXJseS5cbiAqL1xuZXhwb3J0cy5oYXNEZWxpbWl0ZXJzID0gZnVuY3Rpb24gKHdoZXJlLCBvcHRpb25zKSB7XG5cbiAgaWYgKCF3aGVyZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFyYW1ldGVyIGB3aGVyZWAgbm90IHBhc3NlZC4gU2hvdWxkIGJlIFwic3RhcnRcIiwgXCJtaWRkbGVcIiwgXCJlbmRcIiBvciBcIm9ubHlcIi4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICByZXR1cm4gZnVuY3Rpb24gKHN0cikge1xuICAgIC8vIHdlIG5lZWQgbWluaW11bSB0aHJlZSBjaGFycywgZm9yIGV4YW1wbGUge2J9XG4gICAgbGV0IG1pbkN1cmx5TGVuZ3RoID0gb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCArIDEgKyBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aDtcbiAgICBpZiAoIXN0ciB8fCB0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJyB8fCBzdHIubGVuZ3RoIDwgbWluQ3VybHlMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZEN1cmx5TGVuZ3RoIChjdXJseSkge1xuICAgICAgbGV0IGlzQ2xhc3MgPSBjdXJseS5jaGFyQXQob3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCkgPT09ICcuJztcbiAgICAgIGxldCBpc0lkID0gY3VybHkuY2hhckF0KG9wdGlvbnMubGVmdERlbGltaXRlci5sZW5ndGgpID09PSAnIyc7XG4gICAgICByZXR1cm4gKGlzQ2xhc3MgfHwgaXNJZClcbiAgICAgICAgPyBjdXJseS5sZW5ndGggPj0gKG1pbkN1cmx5TGVuZ3RoICsgMSlcbiAgICAgICAgOiBjdXJseS5sZW5ndGggPj0gbWluQ3VybHlMZW5ndGg7XG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0LCBlbmQsIHNsaWNlLCBuZXh0Q2hhcjtcbiAgICBsZXQgcmlnaHREZWxpbWl0ZXJNaW5pbXVtU2hpZnQgPSBtaW5DdXJseUxlbmd0aCAtIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoO1xuICAgIHN3aXRjaCAod2hlcmUpIHtcbiAgICBjYXNlICdzdGFydCc6XG4gICAgICAvLyBmaXJzdCBjaGFyIHNob3VsZCBiZSB7LCB9IGZvdW5kIGluIGNoYXIgMiBvciBtb3JlXG4gICAgICBzbGljZSA9IHN0ci5zbGljZSgwLCBvcHRpb25zLmxlZnREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgIHN0YXJ0ID0gc2xpY2UgPT09IG9wdGlvbnMubGVmdERlbGltaXRlciA/IDAgOiAtMTtcbiAgICAgIGVuZCA9IHN0YXJ0ID09PSAtMSA/IC0xIDogc3RyLmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlciwgcmlnaHREZWxpbWl0ZXJNaW5pbXVtU2hpZnQpO1xuICAgICAgLy8gY2hlY2sgaWYgbmV4dCBjaGFyYWN0ZXIgaXMgbm90IG9uZSBvZiB0aGUgZGVsaW1pdGVyc1xuICAgICAgbmV4dENoYXIgPSBzdHIuY2hhckF0KGVuZCArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKTtcbiAgICAgIGlmIChuZXh0Q2hhciAmJiBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmluZGV4T2YobmV4dENoYXIpICE9PSAtMSkge1xuICAgICAgICBlbmQgPSAtMTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnZW5kJzpcbiAgICAgIC8vIGxhc3QgY2hhciBzaG91bGQgYmUgfVxuICAgICAgc3RhcnQgPSBzdHIubGFzdEluZGV4T2Yob3B0aW9ucy5sZWZ0RGVsaW1pdGVyKTtcbiAgICAgIGVuZCA9IHN0YXJ0ID09PSAtMSA/IC0xIDogc3RyLmluZGV4T2Yob3B0aW9ucy5yaWdodERlbGltaXRlciwgc3RhcnQgKyByaWdodERlbGltaXRlck1pbmltdW1TaGlmdCk7XG4gICAgICBlbmQgPSBlbmQgPT09IHN0ci5sZW5ndGggLSBvcHRpb25zLnJpZ2h0RGVsaW1pdGVyLmxlbmd0aCA/IGVuZCA6IC0xO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdvbmx5JzpcbiAgICAgIC8vICd7LmF9J1xuICAgICAgc2xpY2UgPSBzdHIuc2xpY2UoMCwgb3B0aW9ucy5sZWZ0RGVsaW1pdGVyLmxlbmd0aCk7XG4gICAgICBzdGFydCA9IHNsaWNlID09PSBvcHRpb25zLmxlZnREZWxpbWl0ZXIgPyAwIDogLTE7XG4gICAgICBzbGljZSA9IHN0ci5zbGljZShzdHIubGVuZ3RoIC0gb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGgpO1xuICAgICAgZW5kID0gc2xpY2UgPT09IG9wdGlvbnMucmlnaHREZWxpbWl0ZXIgPyBzdHIubGVuZ3RoIC0gb3B0aW9ucy5yaWdodERlbGltaXRlci5sZW5ndGggOiAtMTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBzdGFydCAhPT0gLTEgJiYgZW5kICE9PSAtMSAmJiB2YWxpZEN1cmx5TGVuZ3RoKHN0ci5zdWJzdHJpbmcoc3RhcnQsIGVuZCArIG9wdGlvbnMucmlnaHREZWxpbWl0ZXIubGVuZ3RoKSk7XG4gIH07XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgbGFzdCBjdXJseSBmcm9tIHN0cmluZy5cbiAqL1xuZXhwb3J0cy5yZW1vdmVEZWxpbWl0ZXIgPSBmdW5jdGlvbiAoc3RyLCBvcHRpb25zKSB7XG4gIGNvbnN0IHN0YXJ0ID0gZXNjYXBlUmVnRXhwKG9wdGlvbnMubGVmdERlbGltaXRlcik7XG4gIGNvbnN0IGVuZCA9IGVzY2FwZVJlZ0V4cChvcHRpb25zLnJpZ2h0RGVsaW1pdGVyKTtcblxuICBsZXQgY3VybHkgPSBuZXcgUmVnRXhwKFxuICAgICdbIFxcXFxuXT8nICsgc3RhcnQgKyAnW14nICsgc3RhcnQgKyBlbmQgKyAnXSsnICsgZW5kICsgJyQnXG4gICk7XG4gIGxldCBwb3MgPSBzdHIuc2VhcmNoKGN1cmx5KTtcblxuICByZXR1cm4gcG9zICE9PSAtMSA/IHN0ci5zbGljZSgwLCBwb3MpIDogc3RyO1xufTtcblxuLyoqXG4gKiBFc2NhcGVzIHNwZWNpYWwgY2hhcmFjdGVycyBpbiBzdHJpbmcgcyBzdWNoIHRoYXQgdGhlIHN0cmluZ1xuICogY2FuIGJlIHVzZWQgaW4gYG5ldyBSZWdFeHBgLiBGb3IgZXhhbXBsZSBcIltcIiBiZWNvbWVzIFwiXFxcXFtcIi5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gcyBSZWdleCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IEVzY2FwZWQgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAgKHMpIHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvWy0vXFxcXF4kKis/LigpfFtcXF17fV0vZywgJ1xcXFwkJicpO1xufVxuZXhwb3J0cy5lc2NhcGVSZWdFeHAgPSBlc2NhcGVSZWdFeHA7XG5cbi8qKlxuICogZmluZCBjb3JyZXNwb25kaW5nIG9wZW5pbmcgYmxvY2tcbiAqL1xuZXhwb3J0cy5nZXRNYXRjaGluZ09wZW5pbmdUb2tlbiA9IGZ1bmN0aW9uICh0b2tlbnMsIGkpIHtcbiAgaWYgKHRva2Vuc1tpXS50eXBlID09PSAnc29mdGJyZWFrJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBub24gY2xvc2luZyBibG9ja3MsIGV4YW1wbGUgaW1nXG4gIGlmICh0b2tlbnNbaV0ubmVzdGluZyA9PT0gMCkge1xuICAgIHJldHVybiB0b2tlbnNbaV07XG4gIH1cblxuICBsZXQgbGV2ZWwgPSB0b2tlbnNbaV0ubGV2ZWw7XG4gIGxldCB0eXBlID0gdG9rZW5zW2ldLnR5cGUucmVwbGFjZSgnX2Nsb3NlJywgJ19vcGVuJyk7XG5cbiAgZm9yICg7IGkgPj0gMDsgLS1pKSB7XG4gICAgaWYgKHRva2Vuc1tpXS50eXBlID09PSB0eXBlICYmIHRva2Vuc1tpXS5sZXZlbCA9PT0gbGV2ZWwpIHtcbiAgICAgIHJldHVybiB0b2tlbnNbaV07XG4gICAgfVxuICB9XG59O1xuXG5cbi8qKlxuICogZnJvbSBodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbWFya2Rvd24taXQvYmxvYi9tYXN0ZXIvbGliL2NvbW1vbi91dGlscy5qc1xuICovXG5sZXQgSFRNTF9FU0NBUEVfVEVTVF9SRSA9IC9bJjw+XCJdLztcbmxldCBIVE1MX0VTQ0FQRV9SRVBMQUNFX1JFID0gL1smPD5cIl0vZztcbmxldCBIVE1MX1JFUExBQ0VNRU5UUyA9IHtcbiAgJyYnOiAnJmFtcDsnLFxuICAnPCc6ICcmbHQ7JyxcbiAgJz4nOiAnJmd0OycsXG4gICdcIic6ICcmcXVvdDsnXG59O1xuXG5mdW5jdGlvbiByZXBsYWNlVW5zYWZlQ2hhcihjaCkge1xuICByZXR1cm4gSFRNTF9SRVBMQUNFTUVOVFNbY2hdO1xufVxuXG5leHBvcnRzLmVzY2FwZUh0bWwgPSBmdW5jdGlvbiAoc3RyKSB7XG4gIGlmIChIVE1MX0VTQ0FQRV9URVNUX1JFLnRlc3Qoc3RyKSkge1xuICAgIHJldHVybiBzdHIucmVwbGFjZShIVE1MX0VTQ0FQRV9SRVBMQUNFX1JFLCByZXBsYWNlVW5zYWZlQ2hhcik7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG4iLCIvLyBQcm9jZXNzIGJsb2NrLWxldmVsIGN1c3RvbSBjb250YWluZXJzXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29udGFpbmVyX3BsdWdpbihtZCwgbmFtZSwgb3B0aW9ucykge1xuXG4gIC8vIFNlY29uZCBwYXJhbSBtYXkgYmUgdXNlZnVsIGlmIHlvdSBkZWNpZGVcbiAgLy8gdG8gaW5jcmVhc2UgbWluaW1hbCBhbGxvd2VkIG1hcmtlciBsZW5ndGhcbiAgZnVuY3Rpb24gdmFsaWRhdGVEZWZhdWx0KHBhcmFtcy8qLCBtYXJrdXAqLykge1xuICAgIHJldHVybiBwYXJhbXMudHJpbSgpLnNwbGl0KCcgJywgMilbMF0gPT09IG5hbWU7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJEZWZhdWx0KHRva2VucywgaWR4LCBfb3B0aW9ucywgZW52LCBzbGYpIHtcblxuICAgIC8vIGFkZCBhIGNsYXNzIHRvIHRoZSBvcGVuaW5nIHRhZ1xuICAgIGlmICh0b2tlbnNbaWR4XS5uZXN0aW5nID09PSAxKSB7XG4gICAgICB0b2tlbnNbaWR4XS5hdHRySm9pbignY2xhc3MnLCBuYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2xmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBfb3B0aW9ucywgZW52LCBzbGYpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgdmFyIG1pbl9tYXJrZXJzID0gMyxcbiAgICAgIG1hcmtlcl9zdHIgID0gb3B0aW9ucy5tYXJrZXIgfHwgJzonLFxuICAgICAgbWFya2VyX2NoYXIgPSBtYXJrZXJfc3RyLmNoYXJDb2RlQXQoMCksXG4gICAgICBtYXJrZXJfbGVuICA9IG1hcmtlcl9zdHIubGVuZ3RoLFxuICAgICAgdmFsaWRhdGUgICAgPSBvcHRpb25zLnZhbGlkYXRlIHx8IHZhbGlkYXRlRGVmYXVsdCxcbiAgICAgIHJlbmRlciAgICAgID0gb3B0aW9ucy5yZW5kZXIgfHwgcmVuZGVyRGVmYXVsdDtcblxuICBmdW5jdGlvbiBjb250YWluZXIoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gICAgdmFyIHBvcywgbmV4dExpbmUsIG1hcmtlcl9jb3VudCwgbWFya3VwLCBwYXJhbXMsIHRva2VuLFxuICAgICAgICBvbGRfcGFyZW50LCBvbGRfbGluZV9tYXgsXG4gICAgICAgIGF1dG9fY2xvc2VkID0gZmFsc2UsXG4gICAgICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSxcbiAgICAgICAgbWF4ID0gc3RhdGUuZU1hcmtzW3N0YXJ0TGluZV07XG5cbiAgICAvLyBDaGVjayBvdXQgdGhlIGZpcnN0IGNoYXJhY3RlciBxdWlja2x5LFxuICAgIC8vIHRoaXMgc2hvdWxkIGZpbHRlciBvdXQgbW9zdCBvZiBub24tY29udGFpbmVyc1xuICAgIC8vXG4gICAgaWYgKG1hcmtlcl9jaGFyICE9PSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvLyBDaGVjayBvdXQgdGhlIHJlc3Qgb2YgdGhlIG1hcmtlciBzdHJpbmdcbiAgICAvL1xuICAgIGZvciAocG9zID0gc3RhcnQgKyAxOyBwb3MgPD0gbWF4OyBwb3MrKykge1xuICAgICAgaWYgKG1hcmtlcl9zdHJbKHBvcyAtIHN0YXJ0KSAlIG1hcmtlcl9sZW5dICE9PSBzdGF0ZS5zcmNbcG9zXSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtYXJrZXJfY291bnQgPSBNYXRoLmZsb29yKChwb3MgLSBzdGFydCkgLyBtYXJrZXJfbGVuKTtcbiAgICBpZiAobWFya2VyX2NvdW50IDwgbWluX21hcmtlcnMpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcG9zIC09IChwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuO1xuXG4gICAgbWFya3VwID0gc3RhdGUuc3JjLnNsaWNlKHN0YXJ0LCBwb3MpO1xuICAgIHBhcmFtcyA9IHN0YXRlLnNyYy5zbGljZShwb3MsIG1heCk7XG4gICAgaWYgKCF2YWxpZGF0ZShwYXJhbXMsIG1hcmt1cCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvLyBTaW5jZSBzdGFydCBpcyBmb3VuZCwgd2UgY2FuIHJlcG9ydCBzdWNjZXNzIGhlcmUgaW4gdmFsaWRhdGlvbiBtb2RlXG4gICAgLy9cbiAgICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgICAvLyBTZWFyY2ggZm9yIHRoZSBlbmQgb2YgdGhlIGJsb2NrXG4gICAgLy9cbiAgICBuZXh0TGluZSA9IHN0YXJ0TGluZTtcblxuICAgIGZvciAoOzspIHtcbiAgICAgIG5leHRMaW5lKys7XG4gICAgICBpZiAobmV4dExpbmUgPj0gZW5kTGluZSkge1xuICAgICAgICAvLyB1bmNsb3NlZCBibG9jayBzaG91bGQgYmUgYXV0b2Nsb3NlZCBieSBlbmQgb2YgZG9jdW1lbnQuXG4gICAgICAgIC8vIGFsc28gYmxvY2sgc2VlbXMgdG8gYmUgYXV0b2Nsb3NlZCBieSBlbmQgb2YgcGFyZW50XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBzdGFydCA9IHN0YXRlLmJNYXJrc1tuZXh0TGluZV0gKyBzdGF0ZS50U2hpZnRbbmV4dExpbmVdO1xuICAgICAgbWF4ID0gc3RhdGUuZU1hcmtzW25leHRMaW5lXTtcblxuICAgICAgaWYgKHN0YXJ0IDwgbWF4ICYmIHN0YXRlLnNDb3VudFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHtcbiAgICAgICAgLy8gbm9uLWVtcHR5IGxpbmUgd2l0aCBuZWdhdGl2ZSBpbmRlbnQgc2hvdWxkIHN0b3AgdGhlIGxpc3Q6XG4gICAgICAgIC8vIC0gYGBgXG4gICAgICAgIC8vICB0ZXN0XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAobWFya2VyX2NoYXIgIT09IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXJ0KSkgeyBjb250aW51ZTsgfVxuXG4gICAgICBpZiAoc3RhdGUuc0NvdW50W25leHRMaW5lXSAtIHN0YXRlLmJsa0luZGVudCA+PSA0KSB7XG4gICAgICAgIC8vIGNsb3NpbmcgZmVuY2Ugc2hvdWxkIGJlIGluZGVudGVkIGxlc3MgdGhhbiA0IHNwYWNlc1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZm9yIChwb3MgPSBzdGFydCArIDE7IHBvcyA8PSBtYXg7IHBvcysrKSB7XG4gICAgICAgIGlmIChtYXJrZXJfc3RyWyhwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuXSAhPT0gc3RhdGUuc3JjW3Bvc10pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBjbG9zaW5nIGNvZGUgZmVuY2UgbXVzdCBiZSBhdCBsZWFzdCBhcyBsb25nIGFzIHRoZSBvcGVuaW5nIG9uZVxuICAgICAgaWYgKE1hdGguZmxvb3IoKHBvcyAtIHN0YXJ0KSAvIG1hcmtlcl9sZW4pIDwgbWFya2VyX2NvdW50KSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgIC8vIG1ha2Ugc3VyZSB0YWlsIGhhcyBzcGFjZXMgb25seVxuICAgICAgcG9zIC09IChwb3MgLSBzdGFydCkgJSBtYXJrZXJfbGVuO1xuICAgICAgcG9zID0gc3RhdGUuc2tpcFNwYWNlcyhwb3MpO1xuXG4gICAgICBpZiAocG9zIDwgbWF4KSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgIC8vIGZvdW5kIVxuICAgICAgYXV0b19jbG9zZWQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgb2xkX3BhcmVudCA9IHN0YXRlLnBhcmVudFR5cGU7XG4gICAgb2xkX2xpbmVfbWF4ID0gc3RhdGUubGluZU1heDtcbiAgICBzdGF0ZS5wYXJlbnRUeXBlID0gJ2NvbnRhaW5lcic7XG5cbiAgICAvLyB0aGlzIHdpbGwgcHJldmVudCBsYXp5IGNvbnRpbnVhdGlvbnMgZnJvbSBldmVyIGdvaW5nIHBhc3Qgb3VyIGVuZCBtYXJrZXJcbiAgICBzdGF0ZS5saW5lTWF4ID0gbmV4dExpbmU7XG5cbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdjb250YWluZXJfJyArIG5hbWUgKyAnX29wZW4nLCAnZGl2JywgMSk7XG4gICAgdG9rZW4ubWFya3VwID0gbWFya3VwO1xuICAgIHRva2VuLmJsb2NrICA9IHRydWU7XG4gICAgdG9rZW4uaW5mbyAgID0gcGFyYW1zO1xuICAgIHRva2VuLm1hcCAgICA9IFsgc3RhcnRMaW5lLCBuZXh0TGluZSBdO1xuXG4gICAgc3RhdGUubWQuYmxvY2sudG9rZW5pemUoc3RhdGUsIHN0YXJ0TGluZSArIDEsIG5leHRMaW5lKTtcblxuICAgIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2NvbnRhaW5lcl8nICsgbmFtZSArICdfY2xvc2UnLCAnZGl2JywgLTEpO1xuICAgIHRva2VuLm1hcmt1cCA9IHN0YXRlLnNyYy5zbGljZShzdGFydCwgcG9zKTtcbiAgICB0b2tlbi5ibG9jayAgPSB0cnVlO1xuXG4gICAgc3RhdGUucGFyZW50VHlwZSA9IG9sZF9wYXJlbnQ7XG4gICAgc3RhdGUubGluZU1heCA9IG9sZF9saW5lX21heDtcbiAgICBzdGF0ZS5saW5lID0gbmV4dExpbmUgKyAoYXV0b19jbG9zZWQgPyAxIDogMCk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG1kLmJsb2NrLnJ1bGVyLmJlZm9yZSgnZmVuY2UnLCAnY29udGFpbmVyXycgKyBuYW1lLCBjb250YWluZXIsIHtcbiAgICBhbHQ6IFsgJ3BhcmFncmFwaCcsICdyZWZlcmVuY2UnLCAnYmxvY2txdW90ZScsICdsaXN0JyBdXG4gIH0pO1xuICBtZC5yZW5kZXJlci5ydWxlc1snY29udGFpbmVyXycgKyBuYW1lICsgJ19vcGVuJ10gPSByZW5kZXI7XG4gIG1kLnJlbmRlcmVyLnJ1bGVzWydjb250YWluZXJfJyArIG5hbWUgKyAnX2Nsb3NlJ10gPSByZW5kZXI7XG59O1xuIiwiZXhwb3J0IGRlZmF1bHQgXCJcIjsiLCJpbXBvcnQgbWFya2Rvd25JdEF0dHJzIGZyb20gXCJtYXJrZG93bi1pdC1hdHRyc1wiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdENoZWNrYm94IGZyb20gXCJtYXJrZG93bi1pdC1jaGVja2JveFwiO1xuaW1wb3J0IG1hcmtkb3duSXRDb250YWluZXIgZnJvbSBcIm1hcmtkb3duLWl0LWNvbnRhaW5lclwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdERlZmxpc3QgZnJvbSBcIm1hcmtkb3duLWl0LWRlZmxpc3RcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRFbW9qaSBmcm9tIFwibWFya2Rvd24taXQtZW1vamlcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRGb290bm90ZSBmcm9tIFwibWFya2Rvd24taXQtZm9vdG5vdGVcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRIVE1MNUVtYmVkIGZyb20gXCJtYXJrZG93bi1pdC1odG1sNS1lbWJlZFwiO1xuLy8gaW1wb3J0IG1hcmtkb3duSXRLYmQgZnJvbSBcIm1hcmtkb3duLWl0LWtiZFwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdE1hcmsgZnJvbSBcIm1hcmtkb3duLWl0LW1hcmtcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRNdWx0aW1kVGFibGUgZnJvbSBcIm1hcmtkb3duLWl0LW11bHRpbWQtdGFibGVcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRTdWIgZnJvbSBcIm1hcmtkb3duLWl0LXN1YlwiO1xuLy8gaW1wb3J0ICogYXMgbWFya2Rvd25JdFN1cCBmcm9tIFwibWFya2Rvd24taXQtc3VwXCI7XG4vLyAvLyBpbXBvcnQgKiBhcyBtYXJrZG93bkl0VG9jIGZyb20gXCJtYXJrZG93bi1pdC10b2NcIjtcbi8vIGltcG9ydCAqIGFzIG1hcmtkb3duSXRVbmRlcmxpbmUgZnJvbSBcIm1hcmtkb3duLWl0LXVuZGVybGluZVwiO1xuaW1wb3J0IE1hcmtkb3duSXQgZnJvbSBcIm1hcmtkb3duLWl0XCI7XG5cbmV4cG9ydCBjb25zdCBhZGRFeHRyYXMgPSAobWFya2Rvd25JdDogTWFya2Rvd25JdCkgPT4ge1xuICAvLyB0b2RvOiBnZXQgc2V0dGluZ3MgYXMgd2VsbFxuXG4gIC8vIEFsbG93IHsuY2xhc3MgI2lkIGRhdGEtb3RoZXI9XCJmb29cIn0gdGFnc1xuICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0QXR0cnMsIHtcbiAgICBsZWZ0RGVsaW1pdGVyOiBcIntcIixcbiAgICByaWdodERlbGltaXRlcjogXCJ9XCIsXG4gICAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtcImNsYXNzXCIsIFwiaWRcIiwgL14oPyFvbikuKiQvZ2ltXSxcbiAgfSk7XG5cbiAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdENvbnRhaW5lciwgXCJhbnktY2xhc3NcIiwge1xuICAgIHZhbGlkYXRlOiAoKSA9PiB0cnVlLFxuXG4gICAgcmVuZGVyOiAodG9rZW5zLCBpZHgsIG9wdGlvbnMsIF9lbnYsIHNlbGYpID0+IHtcbiAgICAgIGNvbnN0IG0gPSB0b2tlbnNbaWR4XS5pbmZvLnRyaW0oKS5tYXRjaCgvXiguKikkLyk7XG5cbiAgICAgIHRva2Vuc1tpZHhdLmF0dHJQdXNoKFtcImNsYXNzXCIsIG1bMV1dKTtcblxuICAgICAgcmV0dXJuIHNlbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpO1xuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBtYXJrZG93bkl0O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgYWRkRXh0cmFzO1xuXG4vLyBjb25zdCB7IG1hcmtkb3duSXQgfSA9IHdpbmRvdy5NRU1FO1xuXG4vLyAvLyBUT0RPOiBjaG9vc2Ugd2hpY2ggcGx1Z2lucyB0byBpbmNsdWRlIHZpYSBzZXR0aW5nc1xuXG4vLyBjb25zdCBhdHRyc0NvbmZpZyA9IHtcbi8vICAgbGVmdERlbGltaXRlcjogXCJ7XCIsXG4vLyAgIHJpZ2h0RGVsaW1pdGVyOiBcIn1cIixcbi8vICAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtcImNsYXNzXCIsIFwiaWRcIiwgL14oPyFvbikuKiQvZ2ltXSxcbi8vIH07XG5cbi8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRBdHRycywgYXR0cnNDb25maWcpO1xuXG4vLyAvLyBUaGlzIGJyZWFrcyBhIGJpdCBvZiB0aGUgaGVhZGluZ19vcGVuIHJ1bGUgaW4gTUVNRSwgd2hpY2ggaXMgYWRkcmVzc2VkIGhlcmUuXG5cbi8vIGNvbnN0IG9yaWdpbmFsSGVhZGluZ09wZW5SdWxlID0gbWFya2Rvd25JdC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfb3BlblwiXTtcblxuLy8gbWFya2Rvd25JdC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfb3BlblwiXSA9IChcbi8vICAgdG9rZW5zLFxuLy8gICBpZHgsXG4vLyAgIG9wdGlvbnMsXG4vLyAgIF9lbnYsXG4vLyAgIHNlbGZcbi8vICkgPT4ge1xuLy8gICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpZHhdO1xuLy8gICBjb25zdCBuZXh0VG9rZW4gPSB0b2tlbnNbaWR4ICsgMV07XG4vLyAgIGNvbnN0IGxpbmsgPSBuZXh0VG9rZW4/LmNvbnRlbnQgfHwgXCJcIjtcblxuLy8gICB0b2tlbi5hdHRyU2V0KFwibmFtZVwiLCBgJHt0b2tlbi5tYXJrdXB9JHtsaW5rfWApO1xuXG4vLyAgIHJldHVybiBzZWxmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRpb25zKTtcbi8vIH07XG5cbi8vICAgbGV0IGZpcnN0SGVhZGVyID0gdHJ1ZTtcblxuLy8gICAvLyBjaGFuZ2UgdGhlIHJ1bGUgYXBwbGllZCB0byB3cml0ZSBhIGN1c3RvbSBuYW1lIGF0dHIgb24gaGVhZGVycyBpbiBNRU1FXG4vLyAgIC8vIEFORC4uLmFsbG93IGVhc3kgZm9sZGluZ1xuLy8gICBtYXJrZG93bkl0LnJlbmRlcmVyLnJ1bGVzW1wiaGVhZGluZ19vcGVuXCJdID0gKFxuLy8gICAgIHRva2Vucyxcbi8vICAgICBpZHgsXG4vLyAgICAgb3B0aW9ucyxcbi8vICAgICBfZW52LFxuLy8gICAgIHNlbGZcbi8vICAgKSA9PiB7XG4vLyAgICAgY29uc3QgdG9rZW4gPSB0b2tlbnNbaWR4XTtcbi8vICAgICBjb25zdCBuZXh0VG9rZW4gPSB0b2tlbnNbaWR4ICsgMV07XG4vLyAgICAgY29uc3QgbGluayA9IG5leHRUb2tlbj8uY29udGVudCB8fCBcIlwiO1xuXG4vLyAgICAgdG9rZW4uYXR0clNldChcIm5hbWVcIiwgYCR7dG9rZW4ubWFya3VwfSR7bGlua31gKTtcblxuLy8gICAgIGNvbnN0IGhlYWRlck9wZW4gPSBzZWxmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRpb25zKTtcblxuLy8gICAgIGxldCB3cmFwcGVkID0gYDxkZXRhaWxzIG9wZW49XCIxXCI+PHN1bW1hcnk+JHtoZWFkZXJPcGVufWA7XG5cbi8vICAgICBpZiAoZmlyc3RIZWFkZXIpIHtcbi8vICAgICAgIGZpcnN0SGVhZGVyID0gZmFsc2U7XG4vLyAgICAgfSBlbHNlIHtcbi8vICAgICAgIHdyYXBwZWQgPSBgPC9kZXRhaWxzPiR7d3JhcHBlZH1gO1xuLy8gICAgIH1cblxuLy8gICAgIGNvbnNvbGUubG9nKFwiVE9LRU46XCIsIHdyYXBwZWQpO1xuXG4vLyAgICAgcmV0dXJuIHdyYXBwZWQ7XG4vLyAgIH07XG5cbi8vICAgbWFya2Rvd25JdC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfY2xvc2VcIl0gPSAoXG4vLyAgICAgdG9rZW5zLFxuLy8gICAgIGlkeCxcbi8vICAgICBvcHRpb25zLFxuLy8gICAgIF9lbnYsXG4vLyAgICAgc2VsZlxuLy8gICApID0+IHtcbi8vICAgICBjb25zdCBoZWFkZXJDbG9zZSA9IHNlbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpO1xuXG4vLyAgICAgcmV0dXJuIGAke2hlYWRlckNsb3NlfTwvc3VtbWFyeT5gO1xuLy8gICB9O1xuXG4vLyAgIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRDaGVja2JveCwge1xuLy8gICAgIGRpdldyYXA6IHRydWUsXG4vLyAgICAgZGl2Q2xhc3M6IFwiY2JcIixcbi8vICAgICBpZFByZWZpeDogXCJjYnhfXCIsXG4vLyAgIH0pO1xuXG4vLyAgIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRDb250YWluZXIsIFwiZm9sZC1jbG9zZWRcIiwge1xuLy8gICAgIHZhbGlkYXRlOiAocGFyYW1zKSA9PiB7XG4vLyAgICAgICByZXR1cm4gcGFyYW1zLnRyaW0oKS5tYXRjaCgvXmZvbGQtY2xvc2VkXFxzKyguKikkLyk7XG4vLyAgICAgfSxcblxuLy8gICAgIHJlbmRlcjogKHRva2VucywgaWR4KSA9PiB7XG4vLyAgICAgICBjb25zdCBtID0gdG9rZW5zW2lkeF0uaW5mby50cmltKCkubWF0Y2goL15mb2xkLWNsb3NlZFxccysoLiopJC8pO1xuXG4vLyAgICAgICBpZiAodG9rZW5zW2lkeF0ubmVzdGluZyA9PT0gMSkge1xuLy8gICAgICAgICByZXR1cm4gKFxuLy8gICAgICAgICAgIFwiPGRldGFpbHM+PHN1bW1hcnk+XCIgK1xuLy8gICAgICAgICAgIG1hcmtkb3duSXQudXRpbHMuZXNjYXBlSHRtbChtWzFdKSArXG4vLyAgICAgICAgICAgXCI8L3N1bW1hcnk+XFxuXCJcbi8vICAgICAgICAgKTtcbi8vICAgICAgIH0gZWxzZSB7XG4vLyAgICAgICAgIC8vIGNsb3NpbmcgdGFnXG4vLyAgICAgICAgIHJldHVybiBcIjwvZGV0YWlscz5cXG5cIjtcbi8vICAgICAgIH1cbi8vICAgICB9LFxuLy8gICB9KTtcblxuLy8gICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0Q29udGFpbmVyLCBcImZvbGRcIiwge1xuLy8gICAgIHZhbGlkYXRlOiAocGFyYW1zKSA9PiB7XG4vLyAgICAgICByZXR1cm4gcGFyYW1zLnRyaW0oKS5tYXRjaCgvXmZvbGRcXHMrKC4qKSQvKTtcbi8vICAgICB9LFxuXG4vLyAgICAgcmVuZGVyOiAodG9rZW5zLCBpZHgpID0+IHtcbi8vICAgICAgIGNvbnN0IG0gPSB0b2tlbnNbaWR4XS5pbmZvLnRyaW0oKS5tYXRjaCgvXmZvbGRcXHMrKC4qKSQvKTtcblxuLy8gICAgICAgaWYgKHRva2Vuc1tpZHhdLm5lc3RpbmcgPT09IDEpIHtcbi8vICAgICAgICAgcmV0dXJuIChcbi8vICAgICAgICAgICBcIjxkZXRhaWxzIG9wZW49JzEnPjxzdW1tYXJ5PlwiICtcbi8vICAgICAgICAgICBtYXJrZG93bkl0LnV0aWxzLmVzY2FwZUh0bWwobVsxXSkgK1xuLy8gICAgICAgICAgIFwiPC9zdW1tYXJ5PlxcblwiXG4vLyAgICAgICAgICk7XG4vLyAgICAgICB9IGVsc2Uge1xuLy8gICAgICAgICAvLyBjbG9zaW5nIHRhZ1xuLy8gICAgICAgICByZXR1cm4gXCI8L2RldGFpbHM+XFxuXCI7XG4vLyAgICAgICB9XG4vLyAgICAgfSxcbi8vICAgfSk7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdENvbnRhaW5lciwgXCJhbnktY2xhc3NcIiwge1xuLy8gICAgIHZhbGlkYXRlOiAoKSA9PiB0cnVlLFxuXG4vLyAgICAgcmVuZGVyOiAodG9rZW5zLCBpZHgsIG9wdGlvbnMsIF9lbnYsIHNlbGYpID0+IHtcbi8vICAgICAgIGNvbnN0IG0gPSB0b2tlbnNbaWR4XS5pbmZvLnRyaW0oKS5tYXRjaCgvXiguKikkLyk7XG5cbi8vICAgICAgIHRva2Vuc1tpZHhdLmF0dHJQdXNoKFtcImNsYXNzXCIsIG1bMV1dKTtcblxuLy8gICAgICAgcmV0dXJuIHNlbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpO1xuLy8gICAgIH0sXG4vLyAgIH0pO1xuXG4vLyAgIC8vIC8vIGdpdmUgYW55IG90aGVyIGNvbnRhaW5lcnMgYW4gJ3Vua25vd24nIGNsYXNzXG4vLyAgIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRDb250YWluZXIsIFwidW5rbm93blwiLCB7XG4vLyAgIC8vICAgdmFsaWRhdGU6IChfcGFyYW1zKSA9PiB7XG4vLyAgIC8vICAgICByZXR1cm4gdHJ1ZTtcbi8vICAgLy8gICB9LFxuLy8gICAvLyB9KTtcblxuLy8gICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0RGVmbGlzdCk7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdEVtb2ppKTtcblxuLy8gICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0Rm9vdG5vdGUpO1xuXG4vLyAgIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRIVE1MNUVtYmVkLCB7XG4vLyAgICAgaHRtbDVlbWJlZDoge1xuLy8gICAgICAgdXNlSW1hZ2VTeW50YXg6IHRydWUsIC8vIEVuYWJsZXMgdmlkZW8vYXVkaW8gZW1iZWQgd2l0aCAhW10oKSBzeW50YXggKGRlZmF1bHQpXG4vLyAgICAgICB1c2VMaW5rU3ludGF4OiB0cnVlLCAvLyBFbmFibGVzIHZpZGVvL2F1ZGlvIGVtYmVkIHdpdGggW10oKSBzeW50YXhcbi8vICAgICB9LFxuLy8gICB9KTtcblxuLy8gICAvLyBUT0RPOiBjaGVjayBUUyBlcnJvclxuLy8gICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0S2JkKTtcblxuLy8gICBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0TWFyayk7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdE11bHRpbWRUYWJsZSk7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdFN1Yik7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdFN1cCk7XG5cbi8vICAgLy8gVE9ETzogc2VlIGlmIHRoZXJlJ3MgYSB3YXkgdG8gbGluayBkaXJlY3RseSB0byBhIGpvdXJuYWxcbi8vICAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdFRvYyk7XG5cbi8vICAgbWFya2Rvd25JdC51c2UobWFya2Rvd25JdFVuZGVybGluZSk7XG5cbi8vICAgY29uc29sZS5sb2coXCJJTklUIG1hcmtkb3duaXQgZXh0cmFzIHdBVFRSUyFcIiwgbWFya2Rvd25JdCk7XG4iLCJpbXBvcnQgXCIuLi8uLi8uLi9zdGF0aWMvdGVtcGxhdGVzL2JsYW5rLmh0bWxcIjtcblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlUHJlbG9hZGVyIHtcbiAgICAvKipcbiAgICAgKiBQcmVsb2FkIGEgc2V0IG9mIHRlbXBsYXRlcyB0byBjb21waWxlIGFuZCBjYWNoZSB0aGVtIGZvciBmYXN0IGFjY2VzcyBkdXJpbmcgcmVuZGVyaW5nXG4gICAgICovXG4gICAgc3RhdGljIGFzeW5jIHByZWxvYWRIYW5kbGViYXJzVGVtcGxhdGVzKCkge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZVBhdGhzID0gW1wibW9kdWxlcy90ZW1wbGF0ZS90ZW1wbGF0ZXMvYmxhbmsuaHRtbFwiXTtcbiAgICAgICAgcmV0dXJuIGxvYWRUZW1wbGF0ZXModGVtcGxhdGVQYXRocyk7XG4gICAgfVxufVxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSAobW9kdWxlKSA9PiB7XG5cdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuXHRcdCgpID0+IChtb2R1bGVbJ2RlZmF1bHQnXSkgOlxuXHRcdCgpID0+IChtb2R1bGUpO1xuXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQoZ2V0dGVyLCB7IGE6IGdldHRlciB9KTtcblx0cmV0dXJuIGdldHRlcjtcbn07IiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsIi8vIGltcG9ydCBcIi4vbW9kdWxlLnNjc3NcIjtcblxuaW1wb3J0IHsgVGVtcGxhdGVQcmVsb2FkZXIgfSBmcm9tIFwiLi9tb2R1bGUvaGVscGVyL1RlbXBsYXRlUHJlbG9hZGVyXCI7XG5cbmltcG9ydCBNYXJrZG93bkl0IGZyb20gXCJtYXJrZG93bi1pdFwiO1xuXG5pbXBvcnQgYWRkRXh0cmFzIGZyb20gXCIuL2FkZEV4dHJhc1wiO1xuXG4vLyBVc2UgcHJldHR5IHF1b3Rlc1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUVkaXRvclwiLCBhc3luYyAob3B0aW9uczogTWFya2Rvd25JdC5PcHRpb25zKSA9PiB7XG4gIG9wdGlvbnMudHlwb2dyYXBoZXIgPSB0cnVlO1xuICByZXR1cm4gb3B0aW9ucztcbn0pO1xuSG9va3Mub25jZShcIk1lbWVBY3RpdmF0ZUNoYXRcIiwgYXN5bmMgKG9wdGlvbnM6IE1hcmtkb3duSXQuT3B0aW9ucykgPT4ge1xuICBvcHRpb25zLnR5cG9ncmFwaGVyID0gdHJ1ZTtcbiAgcmV0dXJuIG9wdGlvbnM7XG59KTtcbkhvb2tzLm9uY2UoXCJpbml0XCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgeyBtYXJrZG93bkl0IH0gPSB3aW5kb3cuTUVNRTtcblxuICBhZGRFeHRyYXMobWFya2Rvd25JdCk7XG5cbiAgLy8gLy8gVE9ETzogY2hvb3NlIHdoaWNoIHBsdWdpbnMgdG8gaW5jbHVkZSB2aWEgc2V0dGluZ3NcblxuICAvLyBjb25zdCBhdHRyc0NvbmZpZyA9IHtcbiAgLy8gICBsZWZ0RGVsaW1pdGVyOiBcIntcIixcbiAgLy8gICByaWdodERlbGltaXRlcjogXCJ9XCIsXG4gIC8vICAgYWxsb3dlZEF0dHJpYnV0ZXM6IFtcImNsYXNzXCIsIFwiaWRcIiwgL14oPyFvbikuKiQvZ2ltXSxcbiAgLy8gfTtcblxuICAvLyBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0QXR0cnMsIGF0dHJzQ29uZmlnKTtcblxuICAvLyAvLyBjaGFuZ2UgdGhlIHJ1bGUgYXBwbGllZCB0byB3cml0ZSBhIGN1c3RvbSBuYW1lIGF0dHIgb24gaGVhZGVycyBpbiBNRU1FXG4gIC8vIC8vIG1hcmtkb3duSXQucmVuZGVyZXIucnVsZXNbXCJoZWFkaW5nX29wZW5cIl0gPSAoXG4gIC8vIC8vICAgdG9rZW5zLFxuICAvLyAvLyAgIGlkeCxcbiAgLy8gLy8gICBvcHRpb25zLFxuICAvLyAvLyAgIF9lbnYsXG4gIC8vIC8vICAgc2VsZlxuICAvLyAvLyApID0+IHtcbiAgLy8gLy8gICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpZHhdO1xuICAvLyAvLyAgIGNvbnN0IG5leHRUb2tlbiA9IHRva2Vuc1tpZHggKyAxXTtcbiAgLy8gLy8gICBjb25zdCBsaW5rID0gbmV4dFRva2VuPy5jb250ZW50IHx8IFwiXCI7XG5cbiAgLy8gLy8gICB0b2tlbi5hdHRyU2V0KFwibmFtZVwiLCBgJHt0b2tlbi5tYXJrdXB9JHtsaW5rfWApO1xuXG4gIC8vIC8vICAgcmV0dXJuIHNlbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpO1xuICAvLyAvLyB9O1xuXG4gIC8vIGxldCBmaXJzdEhlYWRlciA9IHRydWU7XG5cbiAgLy8gLy8gY2hhbmdlIHRoZSBydWxlIGFwcGxpZWQgdG8gd3JpdGUgYSBjdXN0b20gbmFtZSBhdHRyIG9uIGhlYWRlcnMgaW4gTUVNRVxuICAvLyAvLyBBTkQuLi5hbGxvdyBlYXN5IGZvbGRpbmdcbiAgLy8gbWFya2Rvd25JdC5yZW5kZXJlci5ydWxlc1tcImhlYWRpbmdfb3BlblwiXSA9IChcbiAgLy8gICB0b2tlbnMsXG4gIC8vICAgaWR4LFxuICAvLyAgIG9wdGlvbnMsXG4gIC8vICAgX2VudixcbiAgLy8gICBzZWxmXG4gIC8vICkgPT4ge1xuICAvLyAgIGNvbnN0IHRva2VuID0gdG9rZW5zW2lkeF07XG4gIC8vICAgY29uc3QgbmV4dFRva2VuID0gdG9rZW5zW2lkeCArIDFdO1xuICAvLyAgIGNvbnN0IGxpbmsgPSBuZXh0VG9rZW4/LmNvbnRlbnQgfHwgXCJcIjtcblxuICAvLyAgIHRva2VuLmF0dHJTZXQoXCJuYW1lXCIsIGAke3Rva2VuLm1hcmt1cH0ke2xpbmt9YCk7XG5cbiAgLy8gICBjb25zdCBoZWFkZXJPcGVuID0gc2VsZi5yZW5kZXJUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucyk7XG5cbiAgLy8gICBsZXQgd3JhcHBlZCA9IGA8ZGV0YWlscyBvcGVuPVwiMVwiPjxzdW1tYXJ5PiR7aGVhZGVyT3Blbn1gO1xuXG4gIC8vICAgaWYgKGZpcnN0SGVhZGVyKSB7XG4gIC8vICAgICBmaXJzdEhlYWRlciA9IGZhbHNlO1xuICAvLyAgIH0gZWxzZSB7XG4gIC8vICAgICB3cmFwcGVkID0gYDwvZGV0YWlscz4ke3dyYXBwZWR9YDtcbiAgLy8gICB9XG5cbiAgLy8gICBjb25zb2xlLmxvZyhcIlRPS0VOOlwiLCB3cmFwcGVkKTtcblxuICAvLyAgIHJldHVybiB3cmFwcGVkO1xuICAvLyB9O1xuXG4gIC8vIG1hcmtkb3duSXQucmVuZGVyZXIucnVsZXNbXCJoZWFkaW5nX2Nsb3NlXCJdID0gKFxuICAvLyAgIHRva2VucyxcbiAgLy8gICBpZHgsXG4gIC8vICAgb3B0aW9ucyxcbiAgLy8gICBfZW52LFxuICAvLyAgIHNlbGZcbiAgLy8gKSA9PiB7XG4gIC8vICAgY29uc3QgaGVhZGVyQ2xvc2UgPSBzZWxmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRpb25zKTtcblxuICAvLyAgIHJldHVybiBgJHtoZWFkZXJDbG9zZX08L3N1bW1hcnk+YDtcbiAgLy8gfTtcblxuICAvLyBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0Q2hlY2tib3gsIHtcbiAgLy8gICBkaXZXcmFwOiB0cnVlLFxuICAvLyAgIGRpdkNsYXNzOiBcImNiXCIsXG4gIC8vICAgaWRQcmVmaXg6IFwiY2J4X1wiLFxuICAvLyB9KTtcblxuICAvLyBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0Q29udGFpbmVyLCBcImZvbGQtY2xvc2VkXCIsIHtcbiAgLy8gICB2YWxpZGF0ZTogKHBhcmFtcykgPT4ge1xuICAvLyAgICAgcmV0dXJuIHBhcmFtcy50cmltKCkubWF0Y2goL15mb2xkLWNsb3NlZFxccysoLiopJC8pO1xuICAvLyAgIH0sXG5cbiAgLy8gICByZW5kZXI6ICh0b2tlbnMsIGlkeCkgPT4ge1xuICAvLyAgICAgY29uc3QgbSA9IHRva2Vuc1tpZHhdLmluZm8udHJpbSgpLm1hdGNoKC9eZm9sZC1jbG9zZWRcXHMrKC4qKSQvKTtcblxuICAvLyAgICAgaWYgKHRva2Vuc1tpZHhdLm5lc3RpbmcgPT09IDEpIHtcbiAgLy8gICAgICAgcmV0dXJuIChcbiAgLy8gICAgICAgICBcIjxkZXRhaWxzPjxzdW1tYXJ5PlwiICtcbiAgLy8gICAgICAgICBtYXJrZG93bkl0LnV0aWxzLmVzY2FwZUh0bWwobVsxXSkgK1xuICAvLyAgICAgICAgIFwiPC9zdW1tYXJ5PlxcblwiXG4gIC8vICAgICAgICk7XG4gIC8vICAgICB9IGVsc2Uge1xuICAvLyAgICAgICAvLyBjbG9zaW5nIHRhZ1xuICAvLyAgICAgICByZXR1cm4gXCI8L2RldGFpbHM+XFxuXCI7XG4gIC8vICAgICB9XG4gIC8vICAgfSxcbiAgLy8gfSk7XG5cbiAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdENvbnRhaW5lciwgXCJmb2xkXCIsIHtcbiAgLy8gICB2YWxpZGF0ZTogKHBhcmFtcykgPT4ge1xuICAvLyAgICAgcmV0dXJuIHBhcmFtcy50cmltKCkubWF0Y2goL15mb2xkXFxzKyguKikkLyk7XG4gIC8vICAgfSxcblxuICAvLyAgIHJlbmRlcjogKHRva2VucywgaWR4KSA9PiB7XG4gIC8vICAgICBjb25zdCBtID0gdG9rZW5zW2lkeF0uaW5mby50cmltKCkubWF0Y2goL15mb2xkXFxzKyguKikkLyk7XG5cbiAgLy8gICAgIGlmICh0b2tlbnNbaWR4XS5uZXN0aW5nID09PSAxKSB7XG4gIC8vICAgICAgIHJldHVybiAoXG4gIC8vICAgICAgICAgXCI8ZGV0YWlscyBvcGVuPScxJz48c3VtbWFyeT5cIiArXG4gIC8vICAgICAgICAgbWFya2Rvd25JdC51dGlscy5lc2NhcGVIdG1sKG1bMV0pICtcbiAgLy8gICAgICAgICBcIjwvc3VtbWFyeT5cXG5cIlxuICAvLyAgICAgICApO1xuICAvLyAgICAgfSBlbHNlIHtcbiAgLy8gICAgICAgLy8gY2xvc2luZyB0YWdcbiAgLy8gICAgICAgcmV0dXJuIFwiPC9kZXRhaWxzPlxcblwiO1xuICAvLyAgICAgfVxuICAvLyAgIH0sXG4gIC8vIH0pO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRDb250YWluZXIsIFwiYW55LWNsYXNzXCIsIHtcbiAgLy8gICB2YWxpZGF0ZTogKCkgPT4gdHJ1ZSxcblxuICAvLyAgIHJlbmRlcjogKHRva2VucywgaWR4LCBvcHRpb25zLCBfZW52LCBzZWxmKSA9PiB7XG4gIC8vICAgICBjb25zdCBtID0gdG9rZW5zW2lkeF0uaW5mby50cmltKCkubWF0Y2goL14oLiopJC8pO1xuXG4gIC8vICAgICB0b2tlbnNbaWR4XS5hdHRyUHVzaChbXCJjbGFzc1wiLCBtWzFdXSk7XG5cbiAgLy8gICAgIHJldHVybiBzZWxmLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRpb25zKTtcbiAgLy8gICB9LFxuICAvLyB9KTtcblxuICAvLyAvLyAvLyBnaXZlIGFueSBvdGhlciBjb250YWluZXJzIGFuICd1bmtub3duJyBjbGFzc1xuICAvLyAvLyBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0Q29udGFpbmVyLCBcInVua25vd25cIiwge1xuICAvLyAvLyAgIHZhbGlkYXRlOiAoX3BhcmFtcykgPT4ge1xuICAvLyAvLyAgICAgcmV0dXJuIHRydWU7XG4gIC8vIC8vICAgfSxcbiAgLy8gLy8gfSk7XG5cbiAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdERlZmxpc3QpO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRFbW9qaSk7XG5cbiAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdEZvb3Rub3RlKTtcblxuICAvLyBtYXJrZG93bkl0LnVzZShtYXJrZG93bkl0SFRNTDVFbWJlZCwge1xuICAvLyAgIGh0bWw1ZW1iZWQ6IHtcbiAgLy8gICAgIHVzZUltYWdlU3ludGF4OiB0cnVlLCAvLyBFbmFibGVzIHZpZGVvL2F1ZGlvIGVtYmVkIHdpdGggIVtdKCkgc3ludGF4IChkZWZhdWx0KVxuICAvLyAgICAgdXNlTGlua1N5bnRheDogdHJ1ZSwgLy8gRW5hYmxlcyB2aWRlby9hdWRpbyBlbWJlZCB3aXRoIFtdKCkgc3ludGF4XG4gIC8vICAgfSxcbiAgLy8gfSk7XG5cbiAgLy8gLy8gVE9ETzogY2hlY2sgVFMgZXJyb3JcbiAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdEtiZCk7XG5cbiAgLy8gbWFya2Rvd25JdC51c2UobWFya2Rvd25JdE1hcmspO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRNdWx0aW1kVGFibGUpO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRTdWIpO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRTdXApO1xuXG4gIC8vIC8vIFRPRE86IHNlZSBpZiB0aGVyZSdzIGEgd2F5IHRvIGxpbmsgZGlyZWN0bHkgdG8gYSBqb3VybmFsXG4gIC8vIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRUb2MpO1xuXG4gIC8vIG1hcmtkb3duSXQudXNlKG1hcmtkb3duSXRVbmRlcmxpbmUpO1xuXG4gIC8vIGNvbnNvbGUubG9nKFwiSU5JVCBtYXJrZG93bml0IGV4dHJhcyB3QVRUUlMhXCIsIG1hcmtkb3duSXQpO1xufSk7XG5cbkhvb2tzLm9uY2UoXCJNZW1lUmVuZGVyRWRpdG9yXCIsIGFzeW5jIChhLCBiKSA9PiB7XG4gIGNvbnNvbGUubG9nKFwiTUVNRVJFTkRFUkVORElUT1IgbWFya2Rvd25pdCBleHRyYXMhXCIsIGEsIGIpO1xufSk7XG5cbkhvb2tzLm9uY2UoXCJyZWFkeVwiLCBhc3luYyAoKSA9PiB7XG4gIGNvbnNvbGUubG9nKFwiVGVzdFwiKTtcbn0pO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIikge1xuICBpZiAobW9kdWxlLmhvdCkge1xuICAgIG1vZHVsZS5ob3QuYWNjZXB0KCk7XG5cbiAgICBpZiAobW9kdWxlLmhvdC5zdGF0dXMoKSA9PT0gXCJhcHBseVwiKSB7XG4gICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIGluIF90ZW1wbGF0ZUNhY2hlKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoX3RlbXBsYXRlQ2FjaGUsIHRlbXBsYXRlKSkge1xuICAgICAgICAgIGRlbGV0ZSBfdGVtcGxhdGVDYWNoZVt0ZW1wbGF0ZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgVGVtcGxhdGVQcmVsb2FkZXIucHJlbG9hZEhhbmRsZWJhcnNUZW1wbGF0ZXMoKS50aGVuKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBhcHBsaWNhdGlvbiBpbiB1aS53aW5kb3dzKSB7XG4gICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh1aS53aW5kb3dzLCBhcHBsaWNhdGlvbikpIHtcbiAgICAgICAgICAgIHVpLndpbmRvd3NbYXBwbGljYXRpb25dLnJlbmRlcih0cnVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==