/**
 * @fileoverview Rules around placement of braces.
 * @author Joshua Searles
 */
"use strict";

var _ = require("lodash");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

var blocks = [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "IfStatement",
    "TryStatement",
    "CatchClause",
    "DoWhileStatement",
    "WhileStatement",
    "WithStatement",
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "SwitchStatement"
];

var styles = {
    "1tbs": blocks.reduce(function(acc, type) { 
        acc[type] = "always";
        return acc;
    }, {}),

    allman: blocks.reduce(function(acc, type) {
        acc[type] = "never";
        return acc;
    }, {})
};

var noop = function() {};

styles.stroustrup = _.assign({}, styles["1tbs"], {
    noCuddledElse: true,
    noCuddledCatchFinally: true
});

var factory = function(context) {
    var sourceCode = context.getSourceCode(),
        style = context.options[0] || "1tbs";

    if (typeof style === "string") {
        style = styles[style];
    }

    var options = _.assign({}, style, context.options[1]);

    blocks.forEach(function(type) {
        if (type in options) {
            if (options[type] === "ignore") {
                delete options[type];
            } else {
                options[type] = options[type] === "always";
            }
        }
    });

    var OPEN_MESSAGE = "Opening curly brace does not appear on the same line as controlling statement.",
        OPEN_MESSAGE_ALLMAN = "Opening curly brace appears on the same line as controlling statement.",
        BODY_MESSAGE = "Statement inside of curly braces should be on next line.",
        CLOSE_MESSAGE = "Closing curly brace does not appear on the same line as the subsequent block.",
        CLOSE_MESSAGE_SINGLE = "Closing curly brace should be on the same line as opening curly brace or on the line after the previous block.",
        CLOSE_MESSAGE_STROUSTRUP_ALLMAN = "Closing curly brace appears on the same line as the subsequent block.";

    //--------------------------------------------------------------------------
    // Helpers
    //--------------------------------------------------------------------------

    function insertBreakBefore(token, whitespace) {
        whitespace = whitespace || "";
        return function (fixer) {
                return fixer.insertTextBefore(token, "\n" + whitespace);
        }
    }

    function removeBreakBetween(startToken, endToken) {
        return function (fixer) {
            return fixer.replaceTextRange([
                startToken.range[1],
                endToken.range[0]
            ], " ");
        }
    }

    function getWhitespace(token) {
        var src = sourceCode.getText(token, token.loc.start.column);
        var indent = (/^(\s+)/).exec(src);

        return indent ? indent[1] : "";
    }

    /**
     * Determines if a given node is a block statement.
     * @param {ASTNode} node The node to check.
     * @returns {boolean} True if the node is a block statement, false if not.
     * @private
     */
    function isBlock(node) {
        return node && node.type === "BlockStatement";
    }

    /**
     * Check if the token is an punctuator with a value of curly brace
     * @param {Object} token - Token to check
     * @returns {boolean} true if its a curly punctuator
     * @private
     */
    function isCurlyPunctuator(token) {
        return token.value === "{" || token.value === "}";
    }

    /**
     * Binds a list of properties to a function that verifies that the opening
     * curly brace is on the same line as its controlling statement of a given
     * node.
     * @param {...string} The properties to check on the node.
     * @returns {Function} A function that will perform the check on a node
     * @private
     */
    function checkBlock(type) {
        var blockProperties = Array.prototype.slice.call(arguments, 1);

        return function(node) {
           blockProperties.forEach(function(blockProp) {
                var block = node[blockProp];

                if (!isBlock(block)) {
                    return;
                }

                var previousToken = sourceCode.getTokenBefore(block);
                var curlyToken = sourceCode.getFirstToken(block);
                var curlyTokenEnd = sourceCode.getLastToken(block);

                var allOnSameLine = previousToken.loc.start.line === curlyTokenEnd.loc.start.line;

                if (allOnSameLine && options.allowSingleLine) {
                    return;
                }

                var startSameLine = previousToken.loc.start.line === curlyToken.loc.start.line;                
                var lastToken = block.body.length && block.body[block.body.length - 1];
                var endOnSameLine = !lastToken || curlyTokenEnd.loc.start.line === lastToken.loc.start.line;

                // deduce whitespace from ending brace, if possible
                var whitespace = endOnSameLine ? "" : getWhitespace(curlyTokenEnd);

                if (startSameLine !== options[type]) {
                    context.report({
                        node: node,
                        message: startSameLine ? OPEN_MESSAGE_ALLMAN : OPEN_MESSAGE,
                        fix: startSameLine ? insertBreakBefore(curlyToken, whitespace) : removeBreakBetween(previousToken, curlyToken)
                    });
                }

                if (!block.body.length) {
                    return;
                }
                
                if (curlyToken.loc.start.line === block.body[0].loc.start.line) {
                    context.report({
                        node: block.body[0],
                        message: BODY_MESSAGE,
                        fix: insertBreakBefore(curlyToken, whitespace)
                    })
                }

                if (endOnSameLine) {
                    context.report({
                        node: lastToken,
                        message: CLOSE_MESSAGE_SINGLE,
                        fix: insertBreakBefore(curlyTokenEnd, "")
                    });
                }
            });
        };
    }

    function checkNode(type) {
        if (!(type in options)) {
            return noop;
        }

        return checkBlock(type, "body");
    }

    function checkForCuddled(node, previousToken, firstToken, expectSameLine) {
        var closeOnSameLine = previousToken.loc.start.line === firstToken.loc.start.line;

        if (expectSameLine) {
            if (!closeOnSameLine && isCurlyPunctuator(previousToken)) {
                context.report({
                    node: node,
                    message: CLOSE_MESSAGE,
                    fix: removeBreakBetween(previousToken, firstToken)
                });
            }
        } else if (closeOnSameLine) {
            context.report({
                node: node,
                message: CLOSE_MESSAGE_STROUSTRUP_ALLMAN,
                fix: insertBreakBefore(firstToken)
            });
        }
    }

    /**
     * Enforces the configured brace style on IfStatements
     * @param {ASTNode} node An IfStatement node.
     * @returns {void}
     * @private
     */
    function checkIfStatement(node) {
        checkBlock("IfStatement", "consequent", "alternate")(node);

        if (node.alternate) {
            var tokens = sourceCode.getTokensBefore(node.alternate, 2);
            checkForCuddled(node.alternate, tokens[0], tokens[1], options.IfStatement && !options.noCuddledElse && isBlock(node.consequent));
        }
    }

    /**
     * Enforces the configured brace style on TryStatements
     * @param {ASTNode} node A TryStatement node.
     * @returns {void}
     * @private
     */
    function checkTryStatement(node) {
        checkBlock("TryStatement", "block", "finalizer")(node);

        if (isBlock(node.finalizer)) {
            var tokens = sourceCode.getTokensBefore(node.finalizer, 2);
            checkForCuddled(node.finalizer, tokens[0], tokens[1], options.TryStatement && !options.noCuddledCatchFinally);
        }
    }

    /**
     * Enforces the configured brace style on CatchClauses
     * @param {ASTNode} node A CatchClause node.
     * @returns {void}
     * @private
     */
    function checkCatchClause(node) {
        var previousToken = sourceCode.getTokenBefore(node),
            firstToken = sourceCode.getFirstToken(node);

        checkBlock("CatchClause", "body")(node);

        if (isBlock(node.body)) {
            checkForCuddled(node, previousToken, firstToken, options.CatchClause && !options.noCuddledCatchFinally);
        }
    }

    /**
     * Enforces the configured brace style on SwitchStatements
     * @param {ASTNode} node A SwitchStatement node.
     * @returns {void}
     * @private
     */
    function checkSwitchStatement(node) {
        var tokens;

        if (node.cases && node.cases.length) {
            tokens = sourceCode.getTokensBefore(node.cases[0], 2);
        } else {
            tokens = sourceCode.getLastTokens(node, 3);
        }

        var sameLine = tokens[0].loc.start.line === tokens[1].loc.start.line;
        if (options.SwitchStatement !== sameLine) {
            context.report({
                node: node,
                message: sameLine ? OPEN_MESSAGE_ALLMAN : OPEN_MESSAGE,
                fix: sameLine ? insertBreakBefore(tokens[1], getWhitespace(node)) : removeBreakBetween(tokens[0], tokens[1])
            });
        }
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        FunctionDeclaration: checkNode("FunctionDeclaration"),
        FunctionExpression: checkNode("FunctionExpression"),
        ArrowFunctionExpression: checkNode("ArrowFunctionExpression"),
        IfStatement: "IfStatement" in options ? checkIfStatement : noop,
        TryStatement: "TryStatement" in options ? checkTryStatement : noop,
        CatchClause: "CatchClause" in options ? checkCatchClause : noop,
        DoWhileStatement: checkNode("DoWhileStatement"),
        WhileStatement: checkNode("WhileStatement"),
        WithStatement: checkNode("WithStatement"),
        ForStatement: checkNode("ForStatement"),
        ForInStatement: checkNode("ForInStatement"),
        ForOfStatement: checkNode("ForOfStatement"),
        SwitchStatement: "SwitchStatement" in options ? checkSwitchStatement : noop
    };
};

module.exports = {
    meta: {
        fixable: "whitespace",

        schema: [
            {
                oneOf: [
                    { enum: ["1tbs", "stroustrup", "allman"] },
                    {
                        type: "object",
                        properties: blocks.reduce(function(acc, type) {
                            acc[type] = { enum: ["always", "never", "ignore"] };
                            return acc;
                        }, {})
                    }
                ]
            },
            {
                type: "object",
                properties: { 
                    allowSingleLine: { type: "boolean" },
                    noCuddledElse: { type: "boolean" },
                    noCuddledCatchFinally: { type: "boolean" }
                },
                additionalProperties: false
            }
        ]
    },

    create: factory
};
