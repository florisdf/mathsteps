const math = require('mathjs');

const Factor = require('../factor/Factor');
const Term = require('../term/Term');
const Negative = require('../Negative');
const simplify = require('../simplifyExpression/simplify');
const Node = require('../node');

const Polynom = {};

// Divides a given polynomial by a non-polynomial divisor
Polynom.divide_np = function(node, divisor) {
  let terms = Term.getTerms(node);
  if (terms.length > 1) {
    // Multiple terms, so divide each term
    let quots = terms.map(t => Polynom.divide_np(t, divisor));

    // Join all quotients in a summation
    quot = quots.map(q => `(${q.toString()})`).join('+');
    return math.simplify(quot);
  }

  let nodeFacs = Factor.getFactors(node)
                        .map(fac => math.simplify(fac).toString());
  let divFacs = Factor.getFactors(divisor)
                      .map(fac => math.simplify(fac).toString());

  if (!divFacs.every(f => nodeFacs.includes(f))) {
    throw "Node is not divisible by divisor";
  }

  let nodeFacIdxs = [];
  divFacs.forEach((fac, idx) => {
    let nodeFacIdx = nodeFacs.indexOf(fac);
    if (nodeFacIdxs.includes(nodeFacIdx)) {
      // This factor occurs more than once in divFacs
      nodeFacIdx = nodeFacs.indexOf(fac, nodeFacIdx + 1);
    }
    nodeFacIdxs.push(nodeFacIdx);
  });

  let quotFacs = nodeFacs.filter((fac, idx) => !nodeFacIdxs.includes(idx));
  if (quotFacs.length === 0) {
    quotFacs.push('1');
  }
  return math.simplify(quotFacs.map(fac => `(${fac.toString()})`).join('*'));
};

Polynom.negate = function(node) {
  if (!Node.Type.isOperator(node)) {
    return Negative.negate(node);
  }

  let newNode = node.cloneDeep();
  // For multiplication and division, we can push the unary minus in to
  // the first argument.
  // e.g. -(2/3) -> (-2/3)    -(4*9*x^2) --> (-4 * 9  * x^2)
  if (node.op === '*' || node.op === '/') {
    newNode.args[0] = Negative.negate(newNode.args[0]);
    return newNode;
  } else if (node.op === '+') {
    // Now we know `node` is of the form -(x + y + ...).
    // We want to now return (-x + -y + ....)
    // If any term is negative, we make it positive it right away
    // e.g. -(2-4) => -2 + 4
    const newArgs = newNode.args.map(arg => {
       Negative.negate(arg);
    });
    newNode.args = newArgs;
    return newNode;
  } else {
    return Negative.negate(node);
  }
}

// Convert a list of terms consisting of
// a list with factors back into a mathjs node
Polynom.termFacsToNode = function(termFacs) {
  termFacs.reduce((termsAcc, facs) => {
    let facsNode = facs.reduce((facsAcc, fac) => {
      Node.Creator.operator('*', facs);
    });
  });
}

// Isolate the factor from the give node
// e.g. node 'x^2 + x' and factor 'x' return 'x * (x + 1)'
Polynom.isolate = function(node, factor) {
   try {
     let quot = Polynom.divide_np(node, factor);
   } catch(e) {
     throw "Can't isolate factor from node"
   }
  return math.simplify(`( ${factor.toString()} ) *`
    + `( ${quot.toString()} )`);
}

// Given two polynomials, returns whether the polynomials are equal
Polynom.areEqual = function(node1, node2) {
  // Check if the second expression equals the first
  // after negate + expand + simplify
  return math.simplify(simplify(node1).toString()).toString()
    === math.simplify(simplify(node2).toString()).toString();
}

// Given two polynomials, returns whether the polynomials are opposite each
// other
Polynom.areOpposite = function(node1, node2) {
  // Check if the second expression equals the first
  // after negate + expand + simplify
  let invNode2 = math.parse(`-(${node2})`);
  return Polynom.areEqual(node1, invNode2);
}

// Breakdown the polynomial into which factors in terms are equal and which are
// opposite
// e.g. a*(x - 1) + (1 - x)*b + (x - 1)*a will return
// [
//   { equal: [{term: 0, fac: 0, val: 'a'}, {term: 2, fac: 1, val: 'a'}],
//     oppos: [] },
//
//   { equal: [{term: 0, fac: 1, val: 'x - 1'}, {term: 2, fac: 0, val: 'x - 1'}],
//     oppos: [{term: 1, fac: 0, val: '1 - x'}]}
// ]
Polynom.opEqFacs = function(node) {
  let termFacs = Term.getTerms(node).map(t => Factor.getFactors(t));

  let flatFacs = [];
  for (let i = 0; i < termFacs.length; i++) {
    let facs = termFacs[i];
    for (let j = 0; j < facs.length; j++) {
      flatFacs.push({'term': i, 'fac': j, 'val': facs[j]});
    }
  }

  // Look for equal factors
  let eqFacs = [];
  for (let i = 0; i < flatFacs.length; i++) {
    let fac1 = flatFacs[i];
    let inEqFacs = false;
    if (eqFacs.length !== 0) {
      inEqFacs = eqFacs.map(facs => Polynom.areEqual(fac1.val, facs[0].val)).reduce((acc, val) => acc || val);
    }

    if (!inEqFacs) {
      eqFacs.push(flatFacs.filter(fac2 => Polynom.areEqual(fac1.val, fac2.val)));
    }
  }

  // Combine lists of equal and opposite factors into a single object
  let opFacs = [];
  let alreadyIn = new Set([]);

  eqFacs.forEach((facs1, idx1) => {
    if (alreadyIn.has(idx1)) { return; }

    let argOpFacs1 = eqFacs.map((facs2, idx2) => idx2).filter(idx2 =>
      Polynom.areOpposite(eqFacs[idx1][0].val, eqFacs[idx2][0].val) && !alreadyIn.has(idx2)
    );

    if (argOpFacs1.length > 0) {
      if (argOpFacs1.length !== 1) {
        throw 'Multiple lists of opposite terms should not occur';
      }

      alreadyIn.add(argOpFacs1[0]);
      let facs2 = eqFacs[argOpFacs1[0]];
      opFacs.push(
        {
          'equal': facs1.length >= facs2.length ? facs1 : facs2,
          'oppos': facs1.length >= facs2.length ? facs2 : facs1,
        }
      );
    } else if(facs1.length > 1) {
      alreadyIn.add(idx1);
      opFacs.push(
        {
          'equal': facs1,
          'oppos': [],
        }
      );
    }
  });

  return opFacs;
}

module.exports = Polynom;
