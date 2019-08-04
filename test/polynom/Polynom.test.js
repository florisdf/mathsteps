const assert = require('assert');
const mathjs = require('mathjs');
const Polynom = require('../../lib/polynom/Polynom');
const _ = require('lodash');


function testDivide(term, divisor, expectOut) {
  it(`${term} by ${divisor}` + ' -> ' + expectOut, function () {
    const inTerm = mathjs.parse(term);
    const inDivisor = mathjs.parse(divisor);
    const out = Polynom.divide_np(inTerm, inDivisor);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('divide non-poly factor', function() {
  const tests = [
    ['6', '3', '2'],
    ['x^2', 'x', 'x'],
    ['x^2 + x', 'x', 'x + 1'],
    ['x^2 - x', 'x', 'x - 1'],
    ['(x + 1) * x', 'x + 1', 'x'],
    ['(x + 1) * x + 3* (x + 1)', 'x + 1', 'x + 3'],
    ['3y^3 - 6y^2', '3y^2', 'y - 2'],
  ];
  tests.forEach(t => testDivide(t[0], t[1], t[2]));
});

function testNegate(node, expectOut) {
  it(`${node} -> ${expectOut}`, function() {
    const inNode = mathjs.parse(node);
    const out = Polynom.negate(inNode);
    assert.equal(out.toString(), expectOut);
  });
}

describe('negate polynomial', function() {
  const tests = [
    ['x', '-x'],
    ['2x', '-2 x'],
    ['2 * x', '-2 * x'],
    ['x - 1', '-x + 1'],
    ['x - 1 + 3y', '-x + 1 - 3 y'],
    ['2(x - 1) + 3y - 6 * (y - 2)', '-2 (x - 1) - 3 y + 6 * (y - 2)'],
  ];
  tests.forEach(t => testNegate(t[0], t[1]));
});


function testTermFacsToNode(terms, expectOut, allowImplicit) {
  it(`${terms} -> `
  + `${expectOut} (${allowImplicit ? '' : 'not '}allowing implicit)`, function() {
    const inTerms = terms.map(t => mathjs.parse(t));
    const out = Polynom.termFacsToNode(inTerms, allowImplicit);
    assert.equal(out.toString(), expectOut);
  });
}

describe('termfacs to node', function() {
  const tests = [
    [[['x']], 'x', true],
    [[['3', 'x']], '3 x', true],
    [[['3', 'x']], '3 * x', false],
    [[['3'], ['2', 'x']], '3 + 2 x', true],
    [[['-x'], ['1'], ['-3', 'y']], '-x + 1 - 3 y', true],
    [[['-x'], ['1'], ['-3', 'y']], '-x + 1 - 3 * y', false],
  ];
  tests.forEach(t => testTermFacsToNode(t[0], t[1], t[2]));
});


function testIsolate(node, factor, expectOut) {
  it(`${factor} from ${node}` + ' -> ' + expectOut, function () {
    const inNode = mathjs.parse(node);
    const inFactor = mathjs.parse(factor);
    const out = Polynom.isolate(inNode, inFactor);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('isolate factor', function() {
  const tests = [
    ['x^2 + x', 'x', 'x * (x + 1)'],
    ['2 * (x + 1) - 3x * (1 + x)', 'x + 1', '(x + 1) * (2 - 3 * x)'],
    ['3y^3 - 6y^2', '3y^2', '3 * y ^ 2 * (y - 2)'],
    ['3x^2 * y^3 - 6y^2 * x', '3y^2 * x', '3 * y ^ 2 * x * (x * y - 2)'],
  ];
  tests.forEach(t => testIsolate(t[0], t[1], t[2]));
});


function testAreOpposite(poly1, poly2, expectOut) {
  it(`${poly1} and ${poly2}` + ' -> ' + expectOut, function () {
    const polyNode1 = mathjs.parse(poly1);
    const polyNode2 = mathjs.parse(poly2);
    const out = Polynom.areOpposite(polyNode1, polyNode2);
    assert.equal(out, expectOut);
  });
}

describe('are polynoms opposite', function() {
  const tests = [
    ['3', '-3', true],
    ['3', '3', false],
    ['3', 'x', false],
    ['x', '-x', true],
    ['x - 1', '1 - x', true],
    ['x - 1', '-(-(1 - x))', true],
  ];
  tests.forEach(t => testAreOpposite(t[0], t[1], t[2]));
});


function testAreEqual(poly1, poly2, expectOut) {
  it(`${poly1} and ${poly2}` + ' -> ' + expectOut, function () {
    const polyNode1 = mathjs.parse(poly1);
    const polyNode2 = mathjs.parse(poly2);
    const out = Polynom.areEqual(polyNode1, polyNode2);
    assert.equal(out, expectOut);
  });
}

describe('are polynoms equal', function() {
  const tests = [
    ['3', '-3', false],
    ['3', '3', true],
    ['3', 'x', false],
    ['x', 'x + 0', true],
    ['x - 1', '- 1 - x + 2*x', true],
  ];
  tests.forEach(t => testAreEqual(t[0], t[1], t[2]));
});

function testOpEqFacs(poly, expectOut) {
  it(`${poly}` + ' -> ' + `${expectOut}`, function () {
    const polyNode = mathjs.parse(poly);
    const out = Polynom.opEqFacs(polyNode).map(opEq => {
      let eqs = opEq.equal.map(fac => {
        return {'term': fac.term, 'fac': fac.fac, 'val': fac.val.toString(), 'path': fac.path};
      });
      let ops = opEq.oppos.map(fac => {
        return {'term': fac.term, 'fac': fac.fac, 'val': fac.val.toString(), 'path': fac.path};
      });

      return {'equal': eqs, 'oppos': ops};
    });
    assert.deepEqual(out, expectOut);
  });
}

describe('polynomial opeq breakdown', function() {
  const tests = [
    ['x + x',
      [{'equal': [
        {'term': 0, 'fac': 0, 'val': 'x', 'path': 'args[0]'},
        {'term': 1, 'fac': 0, 'val': 'x', 'path': 'args[1]'}],

        'oppos': []}
      ]
    ],
    ['x + x*3 - 2',
      [{'equal': [
        {'term': 0, 'fac': 0, 'val': 'x', 'path': 'args[0].args[0]'},
        {'term': 1, 'fac': 0, 'val': 'x', 'path': 'args[0].args[1].args[0]'}],

        'oppos': []}
      ]
    ],
    ['(x - 1) + (1 - x)',
      [{'equal': [{'term': 0, 'fac': 0, 'val': 'x - 1', 'path': 'args[0].content'}],
        'oppos': [{'term': 1, 'fac': 0, 'val': '1 - x', 'path': 'args[1].content'}]}
      ]
    ],
    ['(2 + x - 3)*y + (1 - x)*(-2*z)',
      [{'equal': [{'term': 0, 'fac': 0, 'val': '2 + x - 3', 'path': 'args[0].args[0].content'}],
        'oppos': [{'term': 1, 'fac': 0, 'val': '1 - x', 'path': 'args[1].args[0].content'}]}
      ]
    ],
    ['a*(x - 1) - b*(1 - x)',
      [{'equal': [{'term': 0, 'fac': 1, 'val': 'x - 1', 'path': 'args[0].args[1].content'}],
        'oppos': [{'term': 1, 'fac': 2, 'val': '1 - x', 'path': 'args[1].args[1].content'}]}
      ]
    ]
  ];
  tests.forEach(t => testOpEqFacs(t[0], t[1]));
});


function testOpEqFacRefConsistence(poly, polyPath, opEqPath) {
  it(`Ref consistence for ${poly}`, function() {
    const polyNode = mathjs.parse(poly);
    const opEqs = Polynom.opEqFacs(polyNode);
    assert.equal(_.get(polyNode, polyPath), _.get(opEqs, opEqPath));
  });
}

describe('opeq reference consistence', function() {
  const tests = [
    ['x + x', 'args[0]', '[0].equal[0].val'],
    ['x + x*3 - 2', 'args[0].args[0]', '[0].equal[0].val'],
    ['(x - 1) + (1 - x)', 'args[1].content', '[0].oppos[0].val'],
  ];
  tests.forEach(t => testOpEqFacRefConsistence(t[0], t[1], t[2]));
});
