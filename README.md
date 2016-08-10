# eslint-plugin-brace-rules

Enhancements to eslint brace rules

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-brace-rules`:

```
$ npm install eslint-plugin-brace-rules --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-brace-rules` globally.

## Usage

Add `brace-rules` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "brace-rules"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "brace-rules/rule-name": 2
    }
}
```

## Supported Rules

* Fill in provided rules here





