// Format : type(scope): message (#12) — voir docs/conventions-projet.md §3.
// Le suffixe (#n) est toléré, jamais exigé.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci']],
    'subject-case': [0],
  },
};
