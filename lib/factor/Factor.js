// This module deals with getting constant factors, including prime factors
// and factor pairs of a number
const _ = require('lodash');
const math = require('mathjs');

const Expon = require('../expon/Expon');
const Node = require('../node');
const NodeCreator = require('../node/Creator');
const NodeType = require('../node/Type');

const Factor = {};

// Given a number Node, returns a list of the prime factors it is composed of.
// e.g. 12 becomes [2, 2, 3]
//      -12 becomes [-1, 2, 2, 3]
Factor.splitNumberPrimes = function(numberNode) {
  let factors = [];

  if (NodeType.isConstantOrConstantFraction(numberNode, true)) {
    if (NodeType.isUnaryMinus(numberNode)) {
      factors.push(NodeCreator.constant(-1));
      if (numberNode.args[0].value === '1') {
        // Don't push '1' if '-1' was the value of the number
        return factors;
      }
      numberNode = numberNode.args[0];
    }

    if (NodeType.isConstantFraction(numberNode)) {
      const numer = numberNode.args[0];
      const denom = numberNode.args[1];
      const numerFacs = Factor.splitNumberPrimes(numer);
      const denomFacs = Factor.splitNumberPrimes(denom);
      if (numerFacs.length === 1 && denomFacs.length === 1) {
        // No splitting happened, just return the original node
        return [numberNode];
      }

      return [...numerFacs.filter(f => f.value !== '1'),
        ...denomFacs.map(f => Node.Creator.operator('/', [math.parse('1'), f]))];
    }
  }
  else {
    // Node is not a number or a fraction
    return [numberNode];
  }

  const origNode = numberNode;
  numberNode = math.simplify(numberNode);
  const root = Math.sqrt(numberNode);
  let candidate = 2;
  if (numberNode % 2) {
    candidate = 3; // assign first odd
    while (numberNode % candidate && candidate <= root) {
      candidate = candidate + 2;
    }
  }

  // if no factor found then the numberNode is prime
  if (candidate > root) {
    // Push origNode for reference consistence
    factors.push(origNode);
  }
  // if we find a factor, make a recursive call on the quotient of the number and
  // our newly found prime factor in order to find more factors
  else {
    factors.push(NodeCreator.constant(candidate));
    const quot = NodeCreator.constant(numberNode/candidate);
    factors = factors.concat(Factor.splitNumberPrimes(quot));
  }

  return factors;
};


// Given an expression (symbolic or not), returns a list of the JSON paths of
// all factors by simply splitting the top-level multiplications.
// e.g. 12x^2 * y^3 becomes ['args[0].args[0]', 'args[0].args[1]', 'args[1]']
Factor.getFactorPaths = function(node) {
  const factors = [];

  if (NodeType.isOperator(node, '*')) {
    node.args.forEach((n, idx) =>
      factors.push(
        ...Factor.getFactorPaths(n)
          .map(path => {
            if (path) {
              return `args[${idx}].${path}`;
            }
            else {
              return `args[${idx}]`;
            }
          })
      )
    );
  }
  else {
    factors.push('');
  }
  return factors;
};

// Given an expression (symbolic or not), returns a list of all factors by
// simply splitting the top-level multiplications.
// e.g. 12x^2 * y^3 becomes [12, x^2, y^3]
//      -12x^2 * y^3 becomes [-12, x^2, y^3]
Factor.getFactors = function(node, rmParens=false) {
  const factors = [];
  factors.push(...Factor.getFactorPaths(node).map(p => {
    if (!p) {
      return node;
    }
    else {
      return _.get(node, p);
    }
  }));

  if (rmParens) {
    const newFactors = [];
    factors.forEach(fac => {
      if (NodeType.isParenthesis(fac)) {
        fac = removeParens(fac);
        newFactors.push(...Factor.getFactors(fac, true));
      }
      else {
        newFactors.push(fac);
      }
    });
    return newFactors;
  }

  return factors;
};

function removeParens(node) {
  while (Node.Type.isParenthesis(node)) {
    node = node.content;
  }
  return node;
}

// Given an expression (symbolic or not), returns a list of all factors in the
// top level of the expression, factorizing all numbers into primes and
// expanding exponents into factors where possible
// e.g. 12x^2 * y^3 becomes [2, 2, 3, x, x, y, y, y]
//      -12x^2 * y^3 becomes [-1, 2, 2, 3, x, x, y, y, y]
//      -3x becomes [-1, 3, x]
Factor.fullSplit = function(node) {
  if (node.op === '/') {
    const factors = [];
    if (node.args[0].value !== '1') {
      // Add the numerator as factors
      const numerFacs = Factor.fullSplit(node.args[0]);
      factors.push(...numerFacs);
    }
    if (node.args[1].value !== '1') {
      // Factor the denominator and add the inverse of each as a factor
      const denomFacs = Factor.fullSplit(node.args[1]);

      factors.push(...denomFacs.map(
        d => NodeCreator.operator('/',
          [NodeCreator.constant(1), d])));
    }
    return factors;
  }

  const multFacs = Factor.getFactors(node, true);

  const primeFacs = [];
  multFacs.forEach(fac =>
    primeFacs.push(...Factor.splitNumberPrimes(fac)));

  const powExpandFacs = [];
  primeFacs.forEach(fac => {
    const expons = Expon.getExponents(fac);
    if (expons.length === 0) {
      powExpandFacs.push(fac);
      return;
    }

    expons.forEach(expon => {
      if (NodeType.isConstant(expon, false)
          && Number.isInteger(parseFloat(expon.value))) {
        for (let i = 0; i < parseInt(expon.value); i++) {
          powExpandFacs.push(fac.args[0].cloneDeep());
        }
      }
      else {
        powExpandFacs.push(
          Node.Creator.operator('^',
            [fac.args[0].cloneDeep(),
              expon.cloneDeep()]));
      }
    });
  });

  return powExpandFacs;
};

// Given a number, will return all the factor pairs for that number as a list
// of 2-item lists
Factor.getFactorPairs = function(number){
  const factors = [];

  const bound = Math.floor(Math.sqrt(Math.abs(number)));
  for (var divisor = -bound; divisor <= bound; divisor++) {
    if (divisor === 0) {
      continue;
    }
    if (number % divisor === 0) {
      const quotient = number / divisor;
      factors.push([divisor, quotient]);
    }
  }

  return factors;
};

module.exports = Factor;
