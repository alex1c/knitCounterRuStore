"""
Generate Expo/Android/store branding assets from the approved master icon.

Technical resize/padding only — does not redraw or modify assets/icon_gpt.png.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'assets' / 'icon_gpt.png'
IMAGES = ROOT / 'assets' / 'images'
RELEASE = ROOT / 'release-artifacts'


def main() -> None:
	master_bytes = MASTER.read_bytes()
	master_hash = hashlib.sha256(master_bytes).hexdigest()
	print('master_sha256', master_hash)
	print('master_size_bytes', len(master_bytes))

	master = Image.open(MASTER).convert('RGB')
	assert master.size[0] == master.size[1], 'master must be square'
	assert master.size == (1254, 1254), f'unexpected master size {master.size}'

	IMAGES.mkdir(parents=True, exist_ok=True)
	RELEASE.mkdir(parents=True, exist_ok=True)

	# 1) Main Expo icon 1024×1024 — full artwork
	icon = master.resize((1024, 1024), Image.Resampling.LANCZOS).convert('RGBA')
	icon_path = IMAGES / 'icon.png'
	icon.save(icon_path, format='PNG', optimize=True)
	print('wrote', icon_path.relative_to(ROOT), icon.size, icon.mode)

	# 2) Adaptive foreground with transparent safe padding (~68% content)
	# Android safe zone is ~66% center; keep yarn + «Вязальня» inside masks.
	canvas = 1024
	content_scale = 0.68
	content_size = int(round(canvas * content_scale))
	fg_art = master.resize(
		(content_size, content_size), Image.Resampling.LANCZOS
	).convert('RGBA')
	fg = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
	offset = (canvas - content_size) // 2
	fg.paste(fg_art, (offset, offset))
	fg_path = IMAGES / 'android-icon-foreground.png'
	fg.save(fg_path, format='PNG', optimize=True)
	print(
		'wrote',
		fg_path.relative_to(ROOT),
		fg.size,
		'content',
		content_size,
		'pad_each',
		offset,
	)

	# 3) Adaptive background — near-white matching master corners
	bg = Image.new('RGBA', (1024, 1024), (254, 254, 254, 255))
	bg_path = IMAGES / 'android-icon-background.png'
	bg.save(bg_path, format='PNG', optimize=True)
	print('wrote', bg_path.relative_to(ROOT), bg.size)

	# 4) Splash image — same 1024 artwork (Expo splash plugin scales it)
	splash_path = IMAGES / 'splash-icon.png'
	icon.save(splash_path, format='PNG', optimize=True)
	print('wrote', splash_path.relative_to(ROOT), icon.size)

	# 5) Favicon for web config
	favicon = master.resize((48, 48), Image.Resampling.LANCZOS).convert('RGBA')
	favicon_path = IMAGES / 'favicon.png'
	favicon.save(favicon_path, format='PNG', optimize=True)
	print('wrote', favicon_path.relative_to(ROOT), favicon.size)

	# 6) RuStore storefront icon — same master lineage
	store_path = RELEASE / 'icon-rustore.png'
	icon.save(store_path, format='PNG', optimize=True)
	print('wrote', store_path.relative_to(ROOT), icon.size)

	# Prove master untouched
	assert MASTER.read_bytes() == master_bytes
	assert hashlib.sha256(MASTER.read_bytes()).hexdigest() == master_hash
	print('master_unmodified OK')


if __name__ == '__main__':
	main()
