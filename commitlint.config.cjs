module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Dependabot writes conventional subjects, but generated ones get long:
    // "build(deps): bump qs from 6.14.1 to 6.14.2 in /tools/asset-generator in
    // the npm_and_yarn group across 1 directory" is 113 characters. The limit is
    // raised rather than special-cased by author, so bot pull requests stay
    // fully linted instead of being skipped over a rule about length.
    'header-max-length': [2, 'always', 140],

    // The repository squash-merges with squash_merge_commit_message = BLANK, so
    // the commit body of a pull request never reaches main. Failing a pull
    // request over the length of a body that is about to be discarded blocked
    // every Dependabot update, whose body is a list of URLs that cannot honour
    // a 100 character limit.
    'body-max-line-length': [0, 'always', 100],
    'footer-max-line-length': [0, 'always', 100],
  },
};
