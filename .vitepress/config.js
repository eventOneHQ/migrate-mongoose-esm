import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'docs',

  title: 'migrate-mongoose',
  description: 'A migration framework for Mongoose',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'CLI Reference', link: '/guide/cli' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Programmatic API', link: '/guide/programmatic' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'CLI Usage', link: '/examples/cli-usage' },
          { text: 'Config File', link: '/examples/config-file' },
          { text: 'Programmatic Usage', link: '/examples/programmatic' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/eventOneHQ/migrate-mongoose-esm',
      },
    ],
  },
})
