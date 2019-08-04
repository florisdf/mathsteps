const _ = require('lodash');
/*
  Various utility functions used in the math stepper
 */
const Util = {};

// Adds `value` to a list in `dict`, creating a new list if the key isn't in
// the dictionary yet. Returns the updated dictionary.
Util.appendToArrayInObject = function(dict, key, value) {
  if (dict[key]) {
    dict[key].push(value);
  }
  else {
    dict[key] = [value];
  }
  return dict;
};

// Returns whether two lists contain the same nodes in the same amounts,
// irrespective of their order.
// e.g. [x, y, -2x] and [-2x, x, y] returns true
//      [x, x, y] and [x, y] returns false
Util.haveSameNodes = function(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const arr1Str = arr1.map(n => n.toString());
  const arr2Str = arr2.map(n => n.toString());
  arr1Str.forEach(n1 => {
    let idx = arr2Str.indexOf(n1);
    if (idx > -1) {
      arr2Str.splice(idx, 1);
    }
  });

  return arr2Str.length === 0;
}

// Puts the new node in the reference of the old node
Util.modifyNode = function (node, newNode) {
  // Copy keys
  Object.keys(node).forEach(k => delete node[k]);
  Object.keys(newNode).forEach(k => node[k] = newNode[k]);

  // Copy proto keys
  Object.keys(node.__proto__).forEach(k => delete node[k]);
  Object.keys(newNode.__proto__).forEach(k => node.__proto__[k] = newNode[k]);
}


// Returns the path of the node in the nodeTree
// Returns undefined if the node is not found in the tree
Util.getNodePath = function(node, nodeTree) {
  const foundPaths = [];
  nodeTree.traverse((curNode, curPath, curParent) => {
    if (curNode === node) {
      const parPath = Util.getNodePath(curParent, nodeTree);
      if (parPath) {
        foundPaths.push(`${parPath}.${curPath}`);
      } else {
        foundPaths.push(curPath);
      }
    }
  });

  if (foundPaths.length > 0) {
    if (foundPaths.length !== 1) {
      console.warn(`Found multiple paths for ${node} in ${nodeTree}`);
    }
    return foundPaths[0];
  } else {
    return undefined;
  }
}

// Return the path of the parent, given the path of the child
// If the child has no parent, return an empty string
Util.getParentPath = function(childPath) {
      return _.slice(childPath.split('.'), 0, -1).join('.');
}

module.exports = Util;
