import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "JasonDB",
  description: "A lightweight, JSON-based database",
  appearance: true,
  head: [
    ['link', { rel: 'icon', href: '/static/logo.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    siteTitle: 'JasonDB',
    logo: '/static/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is JasonDB?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
          ]
        },
        {
          text: 'Usage',
          items: [
            { text: 'Basic Operations', link: '/guide/basic-operations' },
            { text: 'Advanced Usage', link: '/guide/advanced-usage' },
          ]
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Node.js API', link: '/api/node' },
            { text: 'Python API', link: '/api/python' },
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/aurijs/jason' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2025 Auri Js'
    }
  }
})