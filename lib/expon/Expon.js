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
// e.g. x^3 becomes [3]
//      x^2^m becomes [2, m]
//      (3x)^3 becomes [3]
//      x^3m becomes [3m]
//      x^(m + 1) becomes [m + 1]
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

// Collapse all exponents into a single exponent with a multiplication
// e.g. (x^2)^3 becomes x^(2*3)
// e.g. ((x^2)^3)^4 becomes x^(2*3*4)
Expon.collapseExponents = function(node) {
  if (!NodeType.isOperator(node, '^')) {
    return node;
  }

  let base = node.args[0];
  let expon = node.args[1];
  while (NodeType.isParenthesis(base)
    && NodeType.isOperator(base.content, '^')) {
    expon = Node.Creator.operator('*', [base.content.args[1], expon]);
    base = base.content.args[0];
  }

  return Node.Creator.operator('^', [base, expon]);
};

module.exports = Expon;
