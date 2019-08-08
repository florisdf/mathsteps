const _ = require('lodash');
const Node = require('../node');
const NodeType = require('../node/Type');

const Expon = {};

// Given an expression (symbolic or not), returns a list of the JSON paths of
// all factors by simply splitting the top-level multiplications.
// If returnBase, the base will be the first element in the list.
// e.g. 12x^2 * y^3 becomes ['args[0].args[0]', 'args[0].args[1]', 'args[1]']
Expon.getExponentPaths = function(node, returnBase=false) {
  const expons = [];

  if (NodeType.isOperator(node, '^')) {
    if (returnBase) {
      expons.push('args[0]');
    }

    let exp = node.args[1];
    let prePath = 'args[1]';
    if (NodeType.isParenthesis(exp)) {
      exp = exp.content;
      prePath = `${prePath}.content`;
    }

    expons.push(...Expon.getExponentPaths(exp, true)
      .map(path => {
        if (path) {
          return `${prePath}.${path}`;
        }
        else {
          return prePath;
        }
      })
    );
  }
  else {
    expons.push('');
  }
  return expons;
};

// Given an expression (symbolic or not), returns a list of factors by
// splitting the top-level positive integer exponents.
// e.g. x^3 becomes [x, x, x]
//      (3x)^3 becomes [3x, 3x, 3x]
//      x^3m becomes [x^m, x^m, x^m]
//      x^(m + 1) becomes [x^m, x]
//      x^3(m + 1) becomes [x^3, x^(m + 1)]
Expon.getExponents = function(node) {
  if (!NodeType.isOperator(node, '^')) {
    return [];
  }

  const expons = [];
  expons.push(...Expon.getExponentPaths(node).map(p => {
    if (!p) {
      return node;
    }
    else {
      return _.get(node, p);
    }
  }));

  return expons;
};

module.exports = Expon;
