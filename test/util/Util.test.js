const assert = require('assert');
const mathjs = require('mathjs');
const _ = require('lodash');

const Util = require('../../lib/util/Util');

describe('appendToArrayInObject', function () {
  it('creates empty array', function () {
    const object = {};
    Util.appendToArrayInObject(object, 'key', 'value');
    assert.deepEqual(
      object,
      {'key': ['value']}
     );
  });
  it('appends to array if it exists', function () {
    const object = {'key': ['old_value']};
    Util.appendToArrayInObject(object, 'key', 'new_value');
    assert.deepEqual(
      object,
      {'key': ['old_value', 'new_value']}
     );
  });
});

function testHaveSameNodes(arr1, arr2, expectOut) {
  it('[' + arr1.join(', ') + '] and [' + arr2.join(', ') + ']'
    + ' -> ' + expectOut, function () {
      const arr1Nodes = arr1.map(n => mathjs.parse(n));
      const arr2Nodes = arr2.map(n => mathjs.parse(n));
      const out = Util.haveSameNodes(arr1, arr2);
      assert.equal(out, expectOut);
  });
}

describe('have same nodes', function() {
  const tests = [
    [ ['x'], ['x'], true ],
    [ ['x', 'y'], ['y', 'x'], true ],
    [ ['x', 'y'], ['x'], false ],
    [ ['x', 'y'], ['x', 'z'], false ],
    [ ['-2', 'x^2 - 3', '6 - y'], ['6 - y', '-2', 'x^2 - 3'], true ],
  ];
  tests.forEach(t => testHaveSameNodes(t[0], t[1], t[2]));
});

function testModifyNode(expr1, expr2) {
  it(`${expr1} to ${expr2}`, function() {
    const expr1Node = mathjs.parse(expr1);
    const expr2Node = mathjs.parse(expr2);
    const oldExpr1Node = expr1Node;

    Util.modifyNode(expr1Node, expr2Node);

    // Same ref
    assert.equal(oldExpr1Node, expr1Node);

    // But with properties of expr2Node
    assert.deepEqual(expr1Node, expr2Node);
  });
}

describe('modify node', function() {
  const tests = [
    ['3', 'y'],
    ['x', 'y'],
    ['x + 1', '-9'],
    ['x^2 + 2x + 1', 'x^2 - 1'],
  ];
  tests.forEach(t => testModifyNode(t[0], t[1]));
});
