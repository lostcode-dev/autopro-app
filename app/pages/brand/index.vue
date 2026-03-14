<script setup lang="ts">
useSeoMeta({
	title: 'Brand',
	description: 'Official Kortex brand page with logo assets, colors, icon system, and usage guidance.'
})

type BrandColor = {
	name: string
	hex: string
	usage: string
	textClass: string
}

type BrandAsset = {
	name: string
	path: string
	description: string
}

const primaryColors: BrandColor[] = [
	{
		name: 'Emerald Core',
		hex: '#10B981',
		usage: 'Primary logo stroke, core brand actions, key emphasis.',
		textClass: 'text-black'
	},
	{
		name: 'Cyan Glitch',
		hex: '#22D3EE',
		usage: 'Terminal glow, glitch layer, energetic accent.',
		textClass: 'text-black'
	},
	{
		name: 'Midnight Base',
		hex: '#020618',
		usage: 'Primary dark background for logo containers and product shell.',
		textClass: 'text-white'
	}
]

const supportingColors: BrandColor[] = [
	{
		name: 'Slate 900',
		hex: '#0F172A',
		usage: 'Elevated surfaces and dark cards.',
		textClass: 'text-white'
	},
	{
		name: 'Slate 100',
		hex: '#F1F5F9',
		usage: 'Light background previews and print simulations.',
		textClass: 'text-black'
	},
	{
		name: 'White',
		hex: '#FFFFFF',
		usage: 'Light backgrounds, inverse compositions, readable overlays.',
		textClass: 'text-black'
	}
]

const assetDownloads: BrandAsset[] = [
	{
		name: 'Main SVG',
		path: '/icons/kortex-icon.svg',
		description: 'Primary icon for product, marketing, and social use.'
	},
	{
		name: 'Mono SVG',
		path: '/icons/kortex-mono.svg',
		description: 'Single-color version for masks, engraving, and constrained contexts.'
	},
	{
		name: 'Favicon',
		path: '/favicon.ico',
		description: 'Browser favicon generated from the approved logo.'
	},
	{
		name: 'Apple Touch Icon',
		path: '/icons/apple-touch-icon.png',
		description: 'Home screen icon for Apple devices.'
	},
	{
		name: 'PWA Icon 192',
		path: '/icons/icon-192x192.png',
		description: 'Primary installable app icon for Android/PWA contexts.'
	},
	{
		name: 'PWA Icon 512',
		path: '/icons/icon-512x512.png',
		description: 'High-resolution installable icon for app stores and splash usage.'
	}
]

const usageDo = [
	'Use the official SVG whenever the platform supports vector assets.',
	'Keep the icon on dark surfaces whenever possible to preserve the glow and glitch contrast.',
	'Use the monochrome version for mask icons, embossing, or one-color print applications.',
	'Preserve the original proportions and internal spacing of the mark.',
	'Prefer the icon-only mark for app surfaces and the icon + wordmark lockup for brand presentations.'
]

const usageDont = [
	'Do not recolor the logo outside the approved emerald, cyan, black, and white system.',
	'Do not remove the center glow node or terminal accents from the main brand mark.',
	'Do not stretch, rotate, or apply extra shadows and gradients to the exported assets.',
	'Do not place the colored logo on busy low-contrast backgrounds.',
	'Do not recreate the icon manually; always reuse the stored brand assets.'
]

const iconGrid = [
	'/favicon.ico',
	'/icons/icon-72x72.png',
	'/icons/icon-96x96.png',
	'/icons/icon-128x128.png',
	'/icons/icon-192x192.png',
	'/icons/icon-512x512.png'
]
</script>

<template>
	<div class="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,_#020618_0%,_#06101f_45%,_#020618_100%)]">
		<div class="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:36px_36px] opacity-30" />

		<UContainer class="relative py-16 sm:py-20">
			<section class="mb-16 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
				<div class="space-y-6">
					<div class="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
						Official Brand Storage
					</div>

					<div class="space-y-4">
						<h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
							Kortex brand guide and official asset source
						</h1>
						<p class="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
							This page stores the approved Kortex identity system: the glitch-style K mark, icon exports, color references, and usage rules.
						</p>
					</div>

					<div class="flex flex-wrap gap-3">
						<UButton to="/icons/kortex-icon.svg" target="_blank" icon="i-lucide-download" size="lg">
							Download main SVG
						</UButton>
						<UButton to="/icons/kortex-mono.svg" target="_blank" color="neutral" variant="subtle" icon="i-lucide-circle" size="lg">
							Download mono SVG
						</UButton>
					</div>
				</div>

				<UCard class="border border-emerald-400/20 bg-black/20 backdrop-blur">
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="rounded-2xl border border-white/10 bg-[#020618] p-8">
							<div class="flex min-h-40 items-center justify-center">
								<img src="/icons/kortex-icon.svg" alt="Kortex logo on dark background" class="h-28 w-28" >
							</div>
						</div>
						<div class="rounded-2xl border border-black/10 bg-white p-8">
							<div class="flex min-h-40 items-center justify-center">
								<img src="/icons/kortex-mono.svg" alt="Kortex monochrome logo on light background" class="h-28 w-28 text-black" >
							</div>
						</div>
					</div>

					<div class="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 p-5">
						<div class="flex items-center gap-3">
							<AppLogo />
						</div>
						<p class="mt-3 text-sm leading-6 text-slate-400">
							Official lockup for product headers, brand documents, and internal presentations.
						</p>
					</div>
				</UCard>
			</section>

			<section class="mb-16">
				<div class="mb-6 flex items-center justify-between gap-4">
					<div>
						<h2 class="text-2xl font-semibold text-white sm:text-3xl">
							Official assets
						</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
							These are the canonical files to reuse across product, marketing, social, and installation surfaces.
						</p>
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					<UCard v-for="asset in assetDownloads" :key="asset.path" class="border border-white/10 bg-white/5">
						<div class="flex h-full flex-col gap-4">
							<div class="rounded-xl border border-white/10 bg-slate-950/70 p-5">
								<div class="flex min-h-24 items-center justify-center">
									<img :src="asset.path" :alt="asset.name" class="max-h-16 max-w-full">
								</div>
							</div>

							<div class="space-y-2">
								<h3 class="text-base font-semibold text-white">
									{{ asset.name }}
								</h3>
								<p class="text-sm leading-6 text-slate-400">
									{{ asset.description }}
								</p>
								<p class="break-all text-xs font-mono text-cyan-300">
									{{ asset.path }}
								</p>
							</div>

							<div class="mt-auto pt-2">
								<UButton :to="asset.path" target="_blank" icon="i-lucide-download" color="neutral" variant="subtle" block>
									Open asset
								</UButton>
							</div>
						</div>
					</UCard>
				</div>
			</section>

			<section class="mb-16 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
				<UCard class="border border-white/10 bg-white/5">
					<template #header>
						<div>
							<h2 class="text-2xl font-semibold text-white">
								Logo behavior
							</h2>
							<p class="mt-2 text-sm leading-6 text-slate-400">
								The approved mark combines a bold geometric K with a cyan ghost layer, terminal dots, and scanline texture.
							</p>
						</div>
					</template>

					<div class="grid gap-4 md:grid-cols-3">
						<div class="rounded-2xl border border-white/10 bg-[#020618] p-6 text-center">
							<div class="mb-4 flex min-h-28 items-center justify-center">
								<img src="/icons/kortex-icon.svg" alt="Primary Kortex logo" class="h-16 w-16" >
							</div>
							<p class="text-sm font-medium text-white">
								Primary mark
							</p>
							<p class="mt-1 text-xs leading-5 text-slate-400">
								Default use on product surfaces and dark brand backgrounds.
							</p>
						</div>

						<div class="rounded-2xl border border-black/10 bg-white p-6 text-center">
							<div class="mb-4 flex min-h-28 items-center justify-center">
								<img src="/icons/kortex-mono.svg" alt="Monochrome Kortex logo" class="h-16 w-16 text-black" >
							</div>
							<p class="text-sm font-medium text-black">
								Mono mark
							</p>
							<p class="mt-1 text-xs leading-5 text-slate-500">
								Single-color version for light print, masks, and restricted outputs.
							</p>
						</div>

						<div class="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400 to-cyan-300 p-6 text-center">
							<div class="mb-4 flex min-h-28 items-center justify-center rounded-xl bg-black/75">
								<AppLogo />
							</div>
							<p class="text-sm font-medium text-black">
								Wordmark lockup
							</p>
							<p class="mt-1 text-xs leading-5 text-black/70">
								Use in brand pages, decks, signatures, and presentation covers.
							</p>
						</div>
					</div>
				</UCard>

				<UCard class="border border-white/10 bg-white/5">
					<template #header>
						<div>
							<h2 class="text-2xl font-semibold text-white">
								Icon system
							</h2>
							<p class="mt-2 text-sm leading-6 text-slate-400">
								Generated icon outputs already stored in the repository for browser, PWA, and mobile surfaces.
							</p>
						</div>
					</template>

					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
						<div v-for="iconPath in iconGrid" :key="iconPath" class="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-center">
							<div class="flex min-h-20 items-center justify-center">
								<img :src="iconPath" :alt="iconPath" class="h-12 w-12 rounded-xl">
							</div>
							<p class="mt-3 break-all text-[11px] font-mono leading-4 text-slate-400">
								{{ iconPath.split('/').pop() }}
							</p>
						</div>
					</div>
				</UCard>
			</section>

			<section class="mb-16">
				<div class="mb-6">
					<h2 class="text-2xl font-semibold text-white sm:text-3xl">
						Color system
					</h2>
					<p class="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
						The selected logo depends on a narrow, high-contrast palette. The emerald carries the mark, cyan creates the digital glitch feel, and midnight anchors the system.
					</p>
				</div>

				<div class="grid gap-4 lg:grid-cols-3">
					<UCard v-for="color in primaryColors" :key="color.hex" class="overflow-hidden border border-white/10 bg-white/5">
						<div class="h-28" :style="{ backgroundColor: color.hex }" />
						<div class="space-y-2 p-5">
							<div class="flex items-center justify-between gap-3">
								<h3 class="text-base font-semibold text-white">
									{{ color.name }}
								</h3>
								<span class="rounded-full border border-white/10 px-2 py-1 text-xs font-mono text-slate-300">
									{{ color.hex }}
								</span>
							</div>
							<p class="text-sm leading-6 text-slate-400">
								{{ color.usage }}
							</p>
						</div>
					</UCard>
				</div>

				<div class="mt-4 grid gap-4 md:grid-cols-3">
					<div v-for="color in supportingColors" :key="color.hex" class="rounded-2xl border border-white/10 bg-white/5 p-4">
						<div class="mb-4 h-20 rounded-xl border border-black/10" :style="{ backgroundColor: color.hex }" />
						<div class="flex items-center justify-between gap-3">
							<p class="text-sm font-semibold text-white">
								{{ color.name }}
							</p>
							<span class="text-xs font-mono text-slate-400">
								{{ color.hex }}
							</span>
						</div>
						<p class="mt-2 text-xs leading-5 text-slate-400">
							{{ color.usage }}
						</p>
					</div>
				</div>
			</section>

			<section class="mb-16 grid gap-6 lg:grid-cols-2">
				<UCard class="border border-emerald-400/20 bg-emerald-950/10">
					<template #header>
						<h2 class="text-2xl font-semibold text-white">
							Do
						</h2>
					</template>

					<ul class="space-y-3 text-sm leading-6 text-slate-300">
						<li v-for="item in usageDo" :key="item" class="flex gap-3">
							<UIcon name="i-lucide-check" class="mt-1 size-4 shrink-0 text-emerald-400" />
							<span>{{ item }}</span>
						</li>
					</ul>
				</UCard>

				<UCard class="border border-red-400/20 bg-red-950/10">
					<template #header>
						<h2 class="text-2xl font-semibold text-white">
							Do not
						</h2>
					</template>

					<ul class="space-y-3 text-sm leading-6 text-slate-300">
						<li v-for="item in usageDont" :key="item" class="flex gap-3">
							<UIcon name="i-lucide-x" class="mt-1 size-4 shrink-0 text-red-400" />
							<span>{{ item }}</span>
						</li>
					</ul>
				</UCard>
			</section>

			<section>
				<UCard class="border border-cyan-400/20 bg-gradient-to-br from-slate-950 to-slate-900">
					<div class="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
						<div class="rounded-3xl border border-white/10 bg-[#020618] p-8">
							<div class="flex min-h-56 items-center justify-center">
								<img src="/icons/kortex-icon.svg" alt="Official Kortex brand icon" class="h-40 w-40" >
							</div>
						</div>

						<div class="space-y-4">
							<h2 class="text-2xl font-semibold text-white sm:text-3xl">
								Stored brand status
							</h2>
							<p class="text-sm leading-7 text-slate-300 sm:text-base">
								The current approved identity is the glitch-style K icon with emerald primary strokes, cyan terminal accents, and a midnight base. Favicon, PWA icons, apple touch icon, and supporting monochrome assets have already been regenerated from this source.
							</p>
							<div class="flex flex-wrap gap-3">
								<UButton to="/icons/icon-512x512.png" target="_blank" icon="i-lucide-image">
									Open 512 icon
								</UButton>
								<UButton to="/favicon.ico" target="_blank" color="neutral" variant="subtle" icon="i-lucide-globe">
									Open favicon
								</UButton>
							</div>
						</div>
					</div>
				</UCard>
			</section>
		</UContainer>
	</div>
</template>
