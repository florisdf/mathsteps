const assert = require('assert');
const mathjs = require('mathjs');
const Polynom = require('../../lib/polynom/Polynom');


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
