import { defineConfig } from "vitepress";

export default defineConfig({
	lang: "en-US",
	title: "JasonDB",
	description: "A lightweight, JSON-based database",
	appearance: true,
	cleanUrls: true,
	lastUpdated: true,
	metaChunk: true,
	srcDir: "src",
	//
	head: [["link", { rel: "icon", href: "/logo.svg", type: "image/svg+xml" }]],
	//
	themeConfig: {
		siteTitle: "JasonDB",
		logo: "/logo.svg",
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Guide", link: "/guide/" },
			{ text: "API", link: "/api/" },
		],
		sidebar: {
			"/guide/": [
				{
					text: "Introduction",
					items: [
						{ text: "What is JasonDB?", link: "/guide/" },
						{ text: "Getting Started", link: "/guide/getting-started" },
						{ text: "Installation", link: "/guide/installation" },
					],
				},
				{
					text: "Usage",
					items: [
						{ text: "Basic Operations", link: "/guide/basic-operations" },
						{ text: "Advanced Usage", link: "/guide/advanced-usage" },
					],
				},
			],
			"/api/": [
				{
					text: "API Reference",
					items: [
						{ text: "Overview", link: "/api/" },
						{
							text: "Collection",
							link: "/api/collection",
							items: [
								{ text: "Create", link: "/api/collection/#create-document" },
								{ text: "Find", link: "/api/collection/#find-query-options" },
							],
						},
					],
				},
			],
		},
		socialLinks: [{ icon: "github", link: "https://github.com/aurijs/jason" }],
		footer: {
			message: "Released under the MIT License.",
			copyright: "© 2025 Auri Js",
		},
	},
});
