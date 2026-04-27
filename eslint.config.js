import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['docs/**', '.vitepress/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
]
